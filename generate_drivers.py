#!/usr/bin/env python3
"""
Generates /drivers/<number>/index.html for all 22 current-grid drivers
from driver-template.html, plus the /drivers.html list page.

Wins, podiums and 2026 season points below are REAL — pulled directly
from this site's own archive.html (podium-mini blocks, rounds 1-11) and
standings.html (points table). Poles, Top 10s and all career stats are
intentionally left as "—" (TBD): this site has no source for them yet.
Wire lib/historical (Jolpica) or equivalent here later to fill them in —
don't hand-type numbers into this file.

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

# number = REAL confirmed 2026 F1 car number (not standings position — verified
# via web search, see chat), name, code, team, season points (real,
# standings.html), season wins (real), season podiums (real), round-by-round
# points for rounds 1-12 (real — rounds 1-11 from archive.html podium data,
# round 12 is the Dutch GP + Sprint combined, pulled from official F1.com
# results). Rounds 13-23 stay null until raced.
NULL = None
DRIVERS = [
    (12, "Kimi Antonelli",    "ANT", "Mercedes",     340, 8, 14, [18,25,25,25,25,25,NULL,15,NULL,25,15,23,25,25,10,18,20]),
    (63, "George Russell",    "RUS", "Mercedes",     238, 3, 8,  [25,18,NULL,NULL,NULL,NULL,18,25,18,NULL,NULL,23,18,10,25,NULL,2]),
    (44, "Lewis Hamilton",    "HAM", "Ferrari",      229, 1, 6,  [NULL,15,NULL,NULL,18,18,25,NULL,15,NULL,NULL,14,8,NULL,8,15,15]),
    (3, "Max Verstappen",    "VER", "Red Bull",     221, 2, 9,  [NULL,NULL,NULL,NULL,15,NULL,NULL,18,NULL,15,18,3,15,18,18,25,33]),
    (16, "Charles Leclerc",   "LEC", "Ferrari",      215, 1, 5,  [15,NULL,15,NULL,NULL,NULL,NULL,NULL,25,18,NULL,17,NULL,12,12,12,24]),
    (1, "Lando Norris",      "NOR", "McLaren",      201, 2, 6,  [NULL,NULL,NULL,18,NULL,NULL,15,NULL,NULL,NULL,25,31,12,15,NULL,2,13]),
    (81, "Oscar Piastri",     "PIA", "McLaren",      138, 0, 2,  [NULL,NULL,18,15,NULL,NULL,NULL,NULL,NULL,NULL,NULL,12,10,4,0,8,10]),
    (6, "Isack Hadjar",      "HAD", "Red Bull",      97, 0, 1,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,15,10,1]),
    (30, "Liam Lawson",       "LAW", "Racing Bulls",  75, 0, 0,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,6,0,8,0,6,10]),
    (10, "Pierre Gasly",      "GAS", "Alpine",        41, 0, 1,  [NULL,NULL,NULL,NULL,NULL,15,NULL,NULL,NULL,NULL,NULL,2,6,0,NULL,0,0]),
    (41, "Arvid Lindblad",    "LIN", "Racing Bulls",  38, 0, 0,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,4,2,6,1,0]),
    (43, "Franco Colapinto",  "COL", "Alpine",        27, 0, 0,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,2,6,NULL,0,0]),
    (87, "Oliver Bearman",    "BEA", "Haas",          23, 0, 0,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,2,0,3]),
    (27, "Nico Hülkenberg",   "HUL", "Audi",          13, 0, 0,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,4,0,1,0,0,6]),
    (5, "Gabriel Bortoleto", "BOR", "Audi",          10, 0, 0,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,0,0]),
    (31, "Esteban Ocon",      "OCO", "Haas",           7, 0, 0,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,4,0,0]),
    (14, "Fernando Alonso",   "ALO", "Aston Martin",   7, 0, 0,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,NULL,0,NULL,4,0]),
    (55, "Carlos Sainz",      "SAI", "Williams",       7, 0, 0,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,1,0,0]),
    (23, "Alexander Albon",   "ALB", "Williams",       5, 0, 0,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,NULL,NULL,0]),
    (18, "Lance Stroll",      "STR", "Aston Martin",   0, 0, 0,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,0]),
    (77, "Valtteri Bottas",   "BOT", "Cadillac",       0, 0, 0,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,0]),
    (11, "Sergio Pérez",      "PER", "Cadillac",       0, 0, 0,  [NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,0,0,0]),
]
# Season totals were reconciled to the official standings after Round 17
# (Singapore GP, sprint weekend; round 17 = sprint + race points combined).
# They were first reconciled after Round 16 (Bahrain GP in Malaysia). Earlier totals had drifted (likely uncounted
# sprint points), so the points column is the source of truth; the
# round-by-round arrays only cover rounds the site has tracked in detail.
# Tsunoda (1 pt, Racing Bulls seat-cover stint, Rounds 12-14) is still not a
# tracked driver here; he appears only as a manual line in standings.html.
SEASON_GPS = 17  # rounds completed so far


def hex_to_rgba(hex_color, alpha):
    hex_color = hex_color.lstrip("#")
    r, g, b = (int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    return f"rgba({r}, {g}, {b}, {alpha})"


def tbd_class(value):
    return "" if value not in (None, "—") else " tbd"


def render_driver(template, d):
    number, name, code, team, points, wins, podiums, round_points = d
    color = TEAM_COLORS[team]
    color_dim = hex_to_rgba(color, 0.14)
    first_name = name.split(" ")[0]

    replacements = {
        "{{NAME}}": name,
        "{{FIRST_NAME}}": first_name,
        "{{TEAM}}": team,
        "{{NUMBER}}": str(number),
        "{{CODE}}": code,
        "{{TEAM_COLOR}}": color,
        "{{TEAM_COLOR_DIM}}": color_dim,
        "{{S_WINS}}": str(wins),
        "{{C_WINS}}": "—",
        "{{S_PODIUMS}}": str(podiums),
        "{{C_PODIUMS}}": "—",
        "{{S_POLES}}": "—",
        "{{C_POLES}}": "—",
        "{{S_POLES_TBD}}": " tbd",
        "{{S_TOP10}}": "—",
        "{{C_TOP10}}": "—",
        "{{S_TOP10_TBD}}": " tbd",
        "{{S_POINTS}}": str(points),
        "{{C_POINTS}}": "—",
        "{{S_GPS}}": str(SEASON_GPS),
        "{{C_GPS}}": "—",
        "{{BIO}}": (
            f"[Hand-write {first_name}'s bio here — junior career, home circuit, "
            f"what makes them a fan favourite. Not pulled from an API on purpose.]"
        ),
        "{{ROUND_POINTS_JSON}}": json.dumps(round_points + [None] * (23 - len(round_points))),
    }
    out = template
    for k, v in replacements.items():
        out = out.replace(k, v)
    return out


def render_list_card(d):
    number, name, code, team, points, wins, podiums, _ = d
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
