#!/usr/bin/env python3
"""
Build the standings tables from data/standings.json.

Writes the generated blocks (between <!-- BUILD:name --> markers) in
standings.html and index.html, so the standings page and the homepage
table always show the same numbers. Before writing, it cross-checks every
driver's points against generate_drivers.py and the constructor totals
against the sum of their drivers' points where that is possible, and
stops on any mismatch.

The chart lines and every points total are cross-checked against
data/driver-stats.json (computed from f1db by tools/f1db_stats.py).

Usage: python3 tools/build_standings.py
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import generate_drivers  # noqa: E402  (team colours + per-driver season data)

DATA = json.load(open(os.path.join(ROOT, "data", "standings.json"), encoding="utf-8"))
STATS = json.load(open(os.path.join(ROOT, "data", "driver-stats.json"), encoding="utf-8"))
CHARCOAL = "#191A1C"


# ---------- colour: team colours, lifted to 3:1 on charcoal if needed ----------
def _lum(hex_color):
    h = hex_color.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def _contrast(a, b):
    la, lb = _lum(a), _lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def on_dark(hex_color):
    """Team colour as used on the charcoal page: unchanged unless it is
    under 3:1 against charcoal, in which case it is mixed toward white
    just until it passes (bars and stripes are non-text graphics)."""
    color = hex_color
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    t = 0.0
    while _contrast(color, CHARCOAL) < 3.0 and t < 1:
        t += 0.02
        color = "#%02X%02X%02X" % tuple(round(v + (255 - v) * t) for v in (r, g, b))
    return color


TEAM = {team: on_dark(c) for team, c in generate_drivers.TEAM_COLORS.items()}


# ---------- checks ----------
def check():
    errors = []
    stats = {v["name"]: v for v in STATS["drivers"].values()}
    stats.update({v["name"].replace(" Jr.", ""): v for v in STATS["drivers"].values()})
    codes = {g[1]: g[2] for g in generate_drivers.DRIVERS}
    for d in DATA["drivers"]:
        st = stats.get(d["name"])
        if st is None:
            errors.append(f"{d['name']}: not in data/driver-stats.json")
            continue
        if st["season"]["points"] != d["points"]:
            errors.append(f"{d['name']}: standings.json {d['points']} vs f1db {st['season']['points']}")
        last = st["rounds"][DATA["after_round"] - 1] or 0
        if last != d["last"]:
            errors.append(f"{d['name']}: last round +{d['last']} vs f1db +{last}")
        if d["name"] in codes and codes[d["name"]] != st["code"]:
            errors.append(f"{d['name']}: code {codes[d['name']]} vs {st['code']}")
    if STATS["rounds_completed"] != DATA["after_round"]:
        errors.append(f"standings.json is after Round {DATA['after_round']}, driver-stats.json after Round {STATS['rounds_completed']}")
    if len(DATA["progression"]["rounds"]) != DATA["after_round"]:
        errors.append("progression round labels do not match after_round")
    pts = [d["points"] for d in DATA["drivers"]]
    if pts != sorted(pts, reverse=True):
        errors.append("drivers are not in points order")
    cpts = [c["points"] for c in DATA["constructors"]]
    if cpts != sorted(cpts, reverse=True):
        errors.append("constructors are not in points order")
    # the latest round's constructor haul must equal its drivers' haul
    by_team = {}
    for d in DATA["drivers"]:
        by_team[d["team"]] = by_team.get(d["team"], 0) + d["last"]
    for c in DATA["constructors"]:
        if by_team.get(c["name"], 0) != c["last"]:
            errors.append(f"{c['name']}: last-round points {c['last']} vs drivers' {by_team.get(c['name'], 0)}")
    if errors:
        print("Standings check FAILED:\n  " + "\n  ".join(errors))
        sys.exit(1)


# ---------- rendering ----------
def esc(s):
    return html.escape(str(s), quote=True)


def move(prev, pos):
    if prev == pos:
        return '<span class="mv mv--same" aria-label="no change">–</span>'
    n = abs(prev - pos)
    if pos < prev:
        return f'<span class="mv mv--up" aria-label="up {n}">▲{n}</span>'
    return f'<span class="mv mv--down" aria-label="down {n}">▼{n}</span>'


def rows(entries, kind):
    leader = entries[0]["points"] or 1
    out = []
    for i, e in enumerate(entries, start=1):
        team = e["team"] if kind == "drivers" else e["name"]
        color = TEAM.get(team, "#A29E97")
        gap = "—" if i == 1 else f"−{entries[0]['points'] - e['points']}"
        width = round(e["points"] / leader * 100, 1)
        sub = f'<span class="st-team">{esc(team)}</span>' if kind == "drivers" else ""
        last = f"+{e['last']}" if e["last"] else "0"
        out.append(
            f'          <tr{" class=\"is-leader\"" if i == 1 else ""} style="--team:{color}">'
            f'<td class="st-pos">{i:02d}</td>'
            f'<td class="st-mv">{move(e["prev"], i)}</td>'
            f'<td class="st-name"><span class="st-stripe" aria-hidden="true"></span><span class="st-who">{esc(e["name"])}{sub}</span></td>'
            f'<td class="st-bar"><span class="st-track"><span style="width:{width}%"></span></span></td>'
            f'<td class="st-pts">{e["points"]}</td>'
            f'<td class="st-gap">{gap}</td>'
            f'<td class="st-last">{last}</td>'
            "</tr>"
        )
    return "\n".join(out)


def summary():
    d, c = DATA["drivers"], DATA["constructors"]
    left = DATA["rounds_total"] - DATA["after_round"]
    available = left * DATA["points_per_gp_max"]  # no sprints left: 25 per GP
    p2, p3 = d[1], d[2]
    cell = lambda label, big, small, team=None: (
        f'      <div class="champ-cell"{f" style=\"--team:{TEAM[team]}\"" if team else ""}>'
        f'<span class="champ-label">{label}</span>'
        f'<span class="champ-big">{big}</span>'
        f'<span class="champ-small">{small}</span></div>'
    )
    sprint_note = "no sprints left" if DATA["sprints_remaining"] == 0 else f"{DATA['sprints_remaining']} sprints left"
    return "\n".join([
        cell("Leader", esc(d[0]["name"]), f"{d[0]['points']} pts · +{d[0]['points'] - d[1]['points']} over {esc(d[1]['name'].split()[-1])}", d[0]["team"]),
        cell("Fight for second", f"{p2['points'] - p3['points']} pts apart", f"{esc(p2['name'].split()[-1])} {p2['points']} · {esc(p3['name'].split()[-1])} {p3['points']}"),
        cell("Constructors", esc(c[0]["name"]), f"{c[0]['points']} pts · +{c[0]['points'] - c[1]['points']} over {esc(c[1]['name'])}", c[0]["name"]),
        cell("Still to play for", f"{available} pts", f"{left} Grands Prix, {sprint_note}"),
    ])


def chart_data():
    """Cumulative points per round for the top drivers, from f1db per-round
    points; team colours, a team-mate's line dashed."""
    prog = DATA["progression"]
    by_name = {v["name"].replace(" Jr.", ""): v for v in STATS["drivers"].values()}
    seen_team = set()
    series = []
    for d in DATA["drivers"][:prog["drivers_in_chart"]]:
        rounds = by_name[d["name"]]["rounds"][:DATA["after_round"]]
        total, cum = 0, []
        for v in rounds:
            total += v or 0
            cum.append(int(total) if float(total).is_integer() else total)
        dashed = d["team"] in seen_team
        seen_team.add(d["team"])
        series.append({"label": d["name"].split()[-1], "team": d["team"], "color": TEAM[d["team"]], "dashed": dashed, "data": cum})
    payload = {"rounds": prog["rounds"], "series": series}
    return "<script>window.STANDINGS_PROGRESSION = " + json.dumps(payload, ensure_ascii=False) + ";</script>"


def home_rows():
    d = DATA["drivers"][:10]
    leader = d[0]["points"]
    out = []
    for i, e in enumerate(d, start=1):
        color = TEAM.get(e["team"], "#A29E97")
        gap = "—" if i == 1 else f"−{leader - e['points']}"
        out.append(
            f'                <tr{" class=\"is-leader\"" if i == 1 else ""} style="--team:{color}">'
            f'<td>{i:02d}</td><td class="intel-driver"><span class="st-stripe" aria-hidden="true"></span>{esc(e["name"])}</td>'
            f'<td class="intel-team">{esc(e["team"])}</td>'
            f'<td class="intel-bar"><span class="intel-bar-track"><span style="width:{round(e["points"] / leader * 100, 1)}%"></span></span></td>'
            f'<td class="num">{e["points"]}</td><td class="num intel-gap">{gap}</td></tr>'
        )
    return "\n".join(out)


def replace_block(text, name, content, path):
    pat = re.compile(r"<!-- BUILD:%s -->.*?<!-- /BUILD:%s -->" % (name, name), re.S)
    if not pat.search(text):
        sys.exit(f"{path}: missing <!-- BUILD:{name} --> markers")
    return pat.sub(lambda m: f"<!-- BUILD:{name} -->\n{content}\n<!-- /BUILD:{name} -->", text)


def main():
    check()
    sp = os.path.join(ROOT, "standings.html")
    s = open(sp, encoding="utf-8").read()
    s = replace_block(s, "summary", summary(), sp)
    s = replace_block(s, "drivers", rows(DATA["drivers"], "drivers"), sp)
    s = replace_block(s, "constructors", rows(DATA["constructors"], "constructors"), sp)
    s = replace_block(s, "chart-data", chart_data(), sp)
    s = replace_block(s, "note", "      " + esc(DATA["note"]), sp)
    open(sp, "w", encoding="utf-8").write(s)
    ip = os.path.join(ROOT, "index.html")
    t = open(ip, encoding="utf-8").read()
    t = replace_block(t, "home-standings", home_rows(), ip)
    open(ip, "w", encoding="utf-8").write(t)
    print(f"Standings built: after Round {DATA['after_round']} ({DATA['race']}), "
          f"{len(DATA['drivers'])} drivers, {len(DATA['constructors'])} constructors")


if __name__ == "__main__":
    main()
