#!/usr/bin/env python3
"""
Generates /drivers/<number>/index.html for all 22 current-grid drivers
from driver-template.html, plus the /drivers.html list page.

Every number comes from data/driver-stats.json, which tools/f1db_stats.py
computes from the open f1db results dataset (season and career: wins,
podiums, poles, top-10s, points, starts, and points per round). Nothing
here is hand-typed except the car numbers, team names and any bios JP
writes in BIOS below.

After each race:
  python3 tools/f1db_stats.py path/to/f1db 2026
  python3 generate_drivers.py
  python3 tools/build_standings.py

Usage: python3 generate_drivers.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))

TEAM_COLORS = {
    "Mercedes": "#00A19C",
    "Ferrari": "#DC0000",
    "McLaren": "#FF8000",
    "Red Bull": "#3671C6",
    "Racing Bulls": "#6C98FF",
    "Alpine": "#FF87BC",
    "Haas": "#B6BABD",
    "Audi": "#A6192E",
    "Williams": "#00A3E0",
    "Aston Martin": "#229971",
    "Cadillac": "#C9A227",
}

# Car number (2026 race entries), name, three-letter code and team. Stats
# are looked up by code in data/driver-stats.json. Order = championship order.
DRIVERS = [
    (12, "Kimi Antonelli", "ANT", "Mercedes"),
    (63, "George Russell", "RUS", "Mercedes"),
    (44, "Lewis Hamilton", "HAM", "Ferrari"),
    (3, "Max Verstappen", "VER", "Red Bull"),
    (16, "Charles Leclerc", "LEC", "Ferrari"),
    (1, "Lando Norris", "NOR", "McLaren"),
    (81, "Oscar Piastri", "PIA", "McLaren"),
    (6, "Isack Hadjar", "HAD", "Red Bull"),
    (30, "Liam Lawson", "LAW", "Racing Bulls"),
    (10, "Pierre Gasly", "GAS", "Alpine"),
    (41, "Arvid Lindblad", "LIN", "Racing Bulls"),
    (43, "Franco Colapinto", "COL", "Alpine"),
    (87, "Oliver Bearman", "BEA", "Haas"),
    (27, "Nico Hülkenberg", "HUL", "Audi"),
    (5, "Gabriel Bortoleto", "BOR", "Audi"),
    (31, "Esteban Ocon", "OCO", "Haas"),
    (14, "Fernando Alonso", "ALO", "Aston Martin"),
    (55, "Carlos Sainz", "SAI", "Williams"),
    (23, "Alexander Albon", "ALB", "Williams"),
    (18, "Lance Stroll", "STR", "Aston Martin"),
    (77, "Valtteri Bottas", "BOT", "Cadillac"),
    (11, "Sergio Pérez", "PER", "Cadillac"),
]

# JP's own words about each driver, keyed by code. Leave a driver out (or
# empty) and the page shows only the factual profile.
BIOS = {
}

with open(os.path.join(ROOT, "data", "driver-stats.json"), encoding="utf-8") as _f:
    STATS = json.load(_f)
BY_CODE = {d["code"]: d for d in STATS["drivers"].values()}
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]


def hex_to_rgba(hex_color, alpha):
    hex_color = hex_color.lstrip("#")
    r, g, b = (int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    return f"rgba({r}, {g}, {b}, {alpha})"


def fmt_points(v):
    return str(int(v)) if float(v).is_integer() else f"{v:g}"


def fmt_date(iso):
    if not iso:
        return ""
    y, m, d = iso.split("-")
    return f"{int(d)} {MONTHS[int(m) - 1]} {y}"


def profile_rows(p):
    rows = [("Born", f"{fmt_date(p['born'])}, {p['birthplace']}"), ("Nationality", p["nationality"])]
    if p.get("debut"):
        rows.append(("F1 debut", f"{p['debut']['gp']}, {p['debut']['year']}"))
    rows.append(("First win", f"{p['first_win']['gp']}, {p['first_win']['year']}" if p.get("first_win") else "Yet to win a Grand Prix"))
    if p.get("teams"):
        rows.append(("Teams", " · ".join(p["teams"])))
    return "\n".join(f"      <div><dt>{k}</dt><dd>{html_escape(v)}</dd></div>" for k, v in rows)


def html_escape(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_driver(template, d):
    number, name, code, team = d
    st = BY_CODE[code]
    S, C = st["season"], st["career"]
    color = TEAM_COLORS[team]
    color_dim = hex_to_rgba(color, 0.14)
    first_name = name.split(" ")[0]
    bio = BIOS.get(code, "").strip()

    replacements = {
        "{{NAME}}": name,
        "{{FIRST_NAME}}": first_name,
        "{{TEAM}}": team,
        "{{NUMBER}}": str(number),
        "{{CODE}}": code,
        "{{TEAM_COLOR}}": color,
        "{{TEAM_COLOR_DIM}}": color_dim,
        "{{S_WINS}}": str(S["wins"]), "{{C_WINS}}": str(C["wins"]),
        "{{S_PODIUMS}}": str(S["podiums"]), "{{C_PODIUMS}}": str(C["podiums"]),
        "{{S_POLES}}": str(S["poles"]), "{{C_POLES}}": str(C["poles"]),
        "{{S_TOP10}}": str(S["top10"]), "{{C_TOP10}}": str(C["top10"]),
        "{{S_POINTS}}": fmt_points(S["points"]), "{{C_POINTS}}": fmt_points(C["points"]),
        "{{S_GPS}}": str(S["starts"]), "{{C_GPS}}": str(C["starts"]),
        "{{BIO}}": f"    <p>{html_escape(bio)}</p>" if bio else "",
        "{{PROFILE}}": profile_rows(st["profile"]),
        "{{ROUNDS_COMPLETE}}": str(STATS["rounds_completed"]),
        "{{ROUND_POINTS_JSON}}": json.dumps([None if v is None else (int(v) if float(v).is_integer() else v) for v in st["rounds"]]),
    }
    out = template
    for k, v in replacements.items():
        out = out.replace(k, v)
    assert "{{" not in out, f"unfilled placeholder in {name}"
    return out


def render_list_card(d):
    number, name, code, team = d
    S = BY_CODE[code]["season"]
    wins, podiums, points = S["wins"], S["podiums"], fmt_points(S["points"])
    color = TEAM_COLORS[team]
    quick = f"{wins} win{'s' if wins != 1 else ''} · {podiums} podium{'s' if podiums != 1 else ''}" if (wins or podiums) else f"{points} pts this season"
    return f'''      <a class="driver-grid-card" href="drivers/{number}/index.html" data-name="{name.lower()}" data-team="{team.lower()}">
        <div class="team-chip" style="background:{color};"></div>
        <h3>{name}</h3>
        <div class="team-name">{team} · #{number}</div>
        <div class="quick-stat"><strong>{quick}</strong></div>
      </a>'''


def main():
    with open(os.path.join(ROOT, "driver-template.html"), encoding="utf-8") as f:
        template = f.read()

    for d in DRIVERS:
        number = d[0]
        out_dir = os.path.join(ROOT, "drivers", str(number))
        os.makedirs(out_dir, exist_ok=True)
        html = render_driver(template, d)
        with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(html)

    cards = "\n".join(render_list_card(d) for d in DRIVERS)
    with open(os.path.join(ROOT, "drivers-list-template.html"), encoding="utf-8") as f:
        list_template = f.read()
    list_html = list_template.replace("{{DRIVER_CARDS}}", cards)
    with open(os.path.join(ROOT, "drivers.html"), "w", encoding="utf-8") as f:
        f.write(list_html)

    print(f"Generated {len(DRIVERS)} driver pages + drivers.html")


if __name__ == "__main__":
    main()
