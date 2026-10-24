#!/usr/bin/env python3
"""
Build a JP Race Day Programme edition: four A4 pages as a real-text PDF.

  python3 tools/build_raceday.py raceday/2026-united-states            # proof
  python3 tools/build_raceday.py raceday/2026-united-states --final    # publishable

Reads the edition's edition.json (content), raceday/print.css (layout),
data/circuits.json (verified track outline) and data/standings.json
(championship). Writes, inside the edition folder:
  programme.html      the print document (open it in a browser to review)
  <filename>.pdf      the programme (A4, fonts embedded, selectable text)
  cover.png           cover thumbnail for the website

--final refuses to build while any race-weekend field is still empty
(grid, overtaking zones, Pirelli's 2026 strategy, sign-off, publication
date), so provisional information can never be published as final.
Requires: node + the playwright package (uses its Chromium), pypdf.
"""
import html
import json
import math
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from generate_drivers import TEAM_COLORS  # noqa: E402

FONTS = ("https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1"
         "&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap")
SITE_NAME = "JP Motorsport Journal"
REQUIRED_FOR_FINAL = [
    ("publication_date",), ("briefing", "grid"), ("briefing", "sign_off"),
    ("circuit", "overtaking_aids"), ("circuit", "straight_mode_zones"), ("circuit", "overtake_detection"),
    ("strategy", "tyre_plan"),
]
KIND_LABEL = {"verified": "Verified", "measured": "Measured", "estimate": "Estimate", "analysis": "Analysis"}


def e(s):
    return html.escape(str(s), quote=True)


def host(url):
    return re.sub(r"^https?://(www\.)?", "", url).split("/")[0]


def kind(k):
    return f'<span class="k k-{k}">{KIND_LABEL[k]}</span>' if k in KIND_LABEL else ""


def get(d, path):
    for p in path:
        d = d.get(p) if isinstance(d, dict) else None
    return d


# ---------- circuit geometry ----------
def path_points(d):
    return [tuple(map(float, p.split())) for p in re.findall(r"[ML]([\d.]+ [\d.]+)", d)]


def point_at(pts, pct):
    segs = [(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]
    total = sum(math.dist(a, b) for a, b in segs)
    target, run = total * pct / 100, 0.0
    for a, b in segs:
        L = math.dist(a, b)
        if run + L >= target:
            t = (target - run) / L if L else 0
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), math.atan2(b[1] - a[1], b[0] - a[0])
        run += L
    return pts[0], 0.0


def track_svg(c, ed, dark=False, labels=True):
    pts = path_points(c["d"])
    seg = c["sfStraight"]["fwd"] + c["sfStraight"]["bwd"]
    track, edge = ("#CFCAC2", "#0E0F10") if dark else ("#191A1C", "#F5F2EC")
    red = "#E8687A" if dark else "#C5283D"
    mx, my = (c["sf"][0] + c["sf"][2]) / 2, (c["sf"][1] + c["sf"][3]) / 2
    k = 1.5
    sf = [mx + (c["sf"][0] - mx) * k, my + (c["sf"][1] - my) * k, mx + (c["sf"][2] - mx) * k, my + (c["sf"][3] - my) * k]
    out = [f'<svg viewBox="-12 -12 424 284" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{e(c["name"])} track map">']
    out.append(f'<path d="{c["d"]}" fill="none" stroke="{track}" stroke-width="7" stroke-linejoin="round"/>')
    out.append(f'<path d="{c["d"]}" fill="none" stroke="{edge}" stroke-width="1.6" stroke-linejoin="round" opacity=".55"/>')
    out.append(f'<path d="{c["d"]}" fill="none" stroke="{red}" stroke-width="5" stroke-dasharray="{seg:.1f} {c["length"] - seg:.1f}" stroke-dashoffset="{c["sfStraight"]["bwd"]:.1f}"/>')
    out.append(f'<line x1="{sf[0]:.1f}" y1="{sf[1]:.1f}" x2="{sf[2]:.1f}" y2="{sf[3]:.1f}" stroke="{"#F5F2EC" if not dark else "#191A1C"}" stroke-width="3.2"/>')
    out.append(f'<line x1="{sf[0]:.1f}" y1="{sf[1]:.1f}" x2="{sf[2]:.1f}" y2="{sf[3]:.1f}" stroke="{track if dark else "#191A1C"}" stroke-width="3.2" stroke-dasharray="2 2"/>')
    if labels:
        # direction of travel, a little after the start line
        (ax, ay), h = point_at(pts, 2.2)
        nx, ny = -math.sin(h), math.cos(h)
        bx, by = ax + nx * 11, ay + ny * 11
        out.append(f'<g transform="translate({bx:.1f} {by:.1f}) rotate({math.degrees(h):.1f})"><path d="M-7 0 H5 M1 -4 L6 0 L1 4" fill="none" stroke="#6B6761" stroke-width="1.4"/></g>')
        # labels go where they clear the track and each other; the dx/dy in
        # edition.json is tried first, then rings of candidate offsets
        dense = []
        for i in range(len(pts)):
            p0, p1 = pts[i], pts[(i + 1) % len(pts)]
            dense += [(p0[0] + (p1[0] - p0[0]) * t / 4, p0[1] + (p1[1] - p0[1]) * t / 4) for t in range(4)]
        placed = []

        def clear_spot(px, py, w, h, prefer):
            cands = [prefer] + [(r * math.cos(i * math.pi / 8), r * math.sin(i * math.pi / 8)) for r in (14, 20, 27, 34, 42) for i in range(16)]
            best, best_score = prefer, -1e9
            for dx, dy in cands:
                cx, cy = px + dx, py + dy
                if not (-10 + w / 2 < cx < 410 - w / 2 and -10 + h / 2 < cy < 270 - h / 2):
                    continue
                edge = [(cx + sx * w / 2, cy + sy * h / 2) for sx in (-1, 0, 1) for sy in (-1, 0, 1)]
                d_track = min(math.dist(q, t) for q in edge for t in dense)
                inside = any(abs(t[0] - cx) < w / 2 and abs(t[1] - cy) < h / 2 for t in dense)
                d_label = min([max(abs(cx - lx) - (w + lw) / 2, abs(cy - ly) - (h + lh) / 2) for lx, ly, lw, lh in placed] or [99])
                score = min(-20 if inside else d_track, d_label) - math.hypot(dx, dy) / 40
                if (dx, dy) == prefer and score >= 5:
                    return dx, dy
                if score > best_score:
                    best, best_score = (dx, dy), score
            return best

        # FIA Straight Mode zones (blue core inside the track) and the
        # Overtake detection point(s); positions are metres from the start
        # line along the lap, from the FIA event notes, scaled onto the outline
        ci = ed["circuit"]
        lap_m = ci["lap_m"]
        L = c["length"]
        for z in ci.get("straight_mode_zones") or []:
            a, b = z["from_m"] / lap_m * L, z["to_m"] / lap_m * L
            for x0, x1 in ([(a, b)] if b > a else [(a, L), (0, b)]):
                out.append(f'<path d="{c["d"]}" fill="none" stroke="#1F5FD6" stroke-width="2.6" stroke-linecap="butt" stroke-dasharray="0 {x0:.1f} {x1 - x0:.1f} {L:.1f}"/>')
        for i, dp in enumerate(ci.get("overtake_detection") or []):
            (px, py), h = point_at(pts, dp["at_m"] / lap_m * 100)
            nx, ny = -math.sin(h) * 7, math.cos(h) * 7
            out.append(f'<line x1="{px - nx:.1f}" y1="{py - ny:.1f}" x2="{px + nx:.1f}" y2="{py + ny:.1f}" stroke="#1F5FD6" stroke-width="2"/>')
            dx, dy = clear_spot(px, py, 14, 14, (nx * 2.2, ny * 2.2))
            placed.append((px + dx, py + dy, 14, 14))
            out.append(f'<line x1="{px:.1f}" y1="{py:.1f}" x2="{px + dx:.1f}" y2="{py + dy:.1f}" stroke="#1F5FD6" stroke-width=".7"/>')
            out.append(f'<rect x="{px + dx - 6.5:.1f}" y="{py + dy - 6.5:.1f}" width="13" height="13" fill="#1F5FD6"/>')
            out.append(f'<text x="{px + dx:.1f}" y="{py + dy + 2.8:.1f}" font-family="IBM Plex Mono, monospace" font-size="7.6" font-weight="600" fill="#FFFFFF" text-anchor="middle">D</text>')
        for m in ed["circuit"]["map_markers"]:
            (px, py), _ = point_at(pts, m["at"])
            dx, dy = clear_spot(px, py, 15, 15, (m["dx"], m["dy"]))
            cx, cy = px + dx, py + dy
            placed.append((cx, cy, 15, 15))
            out.append(f'<line x1="{px:.1f}" y1="{py:.1f}" x2="{cx:.1f}" y2="{cy:.1f}" stroke="#C5283D" stroke-width=".8"/>')
            out.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="7.2" fill="#C5283D"/>')
            out.append(f'<text x="{cx:.1f}" y="{cy + 2.9:.1f}" font-family="IBM Plex Mono, monospace" font-size="8" font-weight="600" fill="#FFFFFF" text-anchor="middle">{e(m["n"])}</text>')
        # sections get lettered tags (keyed in the map note): long text
        # labels cannot sit on a tight outline without crossing the track
        for i, sct in enumerate(ed["circuit"]["map_sections"]):
            (px, py), _ = point_at(pts, sct["at"])
            dx, dy = clear_spot(px, py, 14, 14, (sct["dx"], sct["dy"]))
            cx, cy = px + dx, py + dy
            placed.append((cx, cy, 14, 14))
            out.append(f'<line x1="{px:.1f}" y1="{py:.1f}" x2="{cx:.1f}" y2="{cy:.1f}" stroke="#191A1C" stroke-width=".7"/>')
            out.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="6.6" fill="#F5F2EC" stroke="#191A1C" stroke-width="1"/>')
            out.append(f'<text x="{cx:.1f}" y="{cy + 2.8:.1f}" font-family="IBM Plex Mono, monospace" font-size="7.6" font-weight="600" fill="#191A1C" text-anchor="middle">{"ABCDEFGH"[i]}</text>')
    out.append("</svg>")
    return "".join(out)


# ---------- pages ----------
def run_head(ed, title):
    return (f'<div class="run-head"><span class="brand">JP Race Day Programme</span>'
            f'<span>{e(ed["short_name"])} · Edition {ed["edition"]:02d}</span><span>{e(title)}</span></div>')


def run_foot(ed, n, extra):
    return (f'<div class="run-foot"><span>{e(SITE_NAME)} · JP Race Day</span>'
            f'<span>{extra}</span><span class="num">{n} / 4</span></div>')


def pending(text):
    return f'<div class="pending">To come in the final edition: {e(text)}</div>'


def page_cover(ed, c, st, proof):
    cv = ed["cover"]
    if cv.get("photo"):
        art = f'<img src="{e(cv["photo"])}" alt="{e(cv.get("photo_alt", ed["circuit_name"]))}"><span class="credit">{e(cv.get("photo_credit") or "")}</span>'
    else:
        art = track_svg(c, ed, dark=True, labels=False)
    stories = "".join(
        f'<li><b>{e(s["title"])}{kind(s["kind"])}</b><span>{e(s["text"])}</span></li>' for s in ed["storylines"])
    snap = "".join(
        f'<div><span class="p">P{i}</span><span class="n"><span class="stripe" style="background:{TEAM_COLORS.get(d["team"], "#888")}"></span>{e(d["name"].split()[-1])}</span><span class="pts">{d["points"]}</span></div>'
        for i, d in enumerate(st["drivers"][:5], 1))
    return f'''<section class="page cover">{'<span class="proof-flag">PROOF · NOT FOR PUBLICATION</span>' if proof else ''}
  <div class="cover-top">
    <div class="cover-mast">{e(SITE_NAME)}<small>Est. 2026 · JP Race Day Programme</small></div>
    <div class="cover-ed">Edition<b>{ed["edition"]:02d}</b>Round {ed["round"]} of {ed["rounds_total"]}</div>
  </div>
  <div class="cover-title">
    <div class="rd">JP Race Day · {e(ed["grand_prix"])}</div>
    <h1>{e(cv["headline"])}</h1>
  </div>
  <div class="cover-art"><span class="cover-rule"></span>{art}</div>
  <div class="cover-meta"><span><b>{e(ed["race_date"])}</b></span><span>{e(ed["circuit_name"])} · {e(ed["location"])}</span><span>Race 15:00 CDT</span></div>
  <div class="cover-body">
    <div><p class="stand">{e(cv["standfirst"])}</p><p class="intro">{e(ed["intro"])}</p></div>
    <ol class="story-list">{stories}</ol>
  </div>
  <div class="snap">{snap}</div>
  {run_foot(ed, 1, "Standings after Round " + str(st["after_round"]) + " · Verified " + e(ed["last_verified"]))}
</section>'''


def page_circuit(ed, c):
    ci = ed["circuit"]
    facts = "".join(f'<tr><td>{e(f["label"])}</td><td>{e(f["value"])}{kind(f["kind"])}</td></tr>' for f in ci["facts"])
    aids = (f'<div class="aids"><b>Overtaking aids</b>{kind("verified")}<br>{e(ci["overtaking_aids"])}</div>' if ci.get("overtaking_aids")
            else f'<div class="aids"><b>No DRS in 2026.</b> {e(ci["overtaking_aids_note"])}</div>')
    gloss = "".join(f"<div><b>{e(t)}</b>{e(d)}</div>" for t, d in ed["briefing"]["glossary"])
    aero = ""
    if ci.get("straight_mode_zones"):
        aero = ('<span><i class="key-zone"></i>Straight Mode zone</span>'
                '<span><b class="key-det">D</b> Overtake detection</span>'
                + (f'<span class="key-pending">{e(ci["aero_note"])}</span>' if ci.get("aero_note") else ""))
    else:
        aero = '<span class="key-pending">Straight Mode zones and Overtake detection: added in the final edition</span>'
    sec_key = " ".join(f'<span><b>{"ABCDEFGH"[i]}</b> {e(x["label"])}</span>' for i, x in enumerate(ci["map_sections"]))
    keys = "".join(f'<div><b>{e(k["name"])}{kind(k["kind"])}</b>{e(k["text"])}</div>' for k in ci["key_sections"])
    return f'''<section class="page">
  {run_head(ed, "The Circuit File")}
  <div class="kicker">02 · The Circuit File</div>
  <h2 class="page-title">{e(ed["circuit_name"])}</h2>
  <p class="page-dek" style="margin-bottom:3.5mm">Twenty corners, anticlockwise, on a lap that climbs to Turn 1 and finishes with a stadium section and a long multi-apex right-hander. Here is where the race is won and lost.</p>
  <div class="circ-grid">
    <div class="map">{track_svg(c, ed)}<div class="map-note"><span class="map-key">{sec_key}{aero}</span>Red: start/finish straight · Arrow: direction of travel · {e(ci["map_note"])} Outline: f1-circuits (MIT).</div></div>
    <div><table class="facts"><tbody>{facts}</tbody></table>{aids}</div>
  </div>
  <div class="key">{keys}</div>
  <div class="callout">{e(ci["time_gain_loss"])}<span class="k k-{ci["time_gain_loss_kind"]}">{KIND_LABEL[ci["time_gain_loss_kind"]]}</span></div>
  <h3 class="sec" style="margin-top:3mm">Terms used in this programme</h3>
  <div class="gloss">{gloss}</div>
  <div class="legend" style="margin-top:2.5mm"><span>{kind("verified")}official source</span><span>{kind("measured")}computed from timing data or the outline</span><span>{kind("estimate")}sourced estimate</span><span>{kind("analysis")}our editorial view</span></div>
  {run_foot(ed, 2, "Facts: Formula1.com · Verified " + e(ed["last_verified"]))}
</section>'''


COMPOUND_NAME = {"S": "Soft", "M": "Medium", "H": "Hard"}


def tyre_plan(s, laps):
    """The race-weekend tyre strategy block: predicted strategies on a lap
    timeline with their pit windows, and the pace gap between compounds.
    Filled after qualifying from the teams'/Pirelli's published prediction;
    until then the proof shows what is coming."""
    tp = s.get("tyre_plan")
    if not tp:
        return f'<div class="tyre-plan"><h4>Tyre strategy</h4>{pending(s["tyre_plan_note"])}</div>'
    comp = s["compounds"]  # e.g. {"S": "C4", "M": "C3", "H": "C2"}
    legend = "".join(f'<span><i class="tp-{c}"></i>{COMPOUND_NAME[c]} ({e(comp[c])})</span>' for c in ("S", "M", "H"))
    deltas = "".join(f'<div><span class="tp-d-lab">{e(d["label"])}</span><span class="tp-d-val">{e(d["value"])}</span></div>' for d in tp.get("deltas") or [])
    deltas = (f'<div class="tp-deltas"><span class="tp-d-head">Pace gap per lap</span>{deltas}</div>' if deltas
              else f'<div class="tp-deltas"><span class="tp-d-head">Pace gap per lap</span><span class="tp-d-lab">{e(tp.get("deltas_note", "Not published for this race."))}</span></div>')
    timed = [st for st in tp["strategies"] if st.get("stints")]
    if timed:
        # lap chart: only when stint lengths have actually been published
        pct = lambda lap: (lap - 1) / laps * 100
        rows = []
        for st in timed:
            win = "".join(f'<span class="tp-win" style="left:{pct(a):.2f}%;width:{(b - a + 1) / laps * 100:.2f}%"></span>' for a, b in st.get("windows", []))
            stints = "".join(
                f'<span class="tp-stint tp-{c}" style="left:{pct(a):.2f}%;width:{(b - a + 1) / laps * 100:.2f}%">{c}</span>'
                for c, a, b in st["stints"])
            wtxt = ", ".join(f"{a}–{b}" for a, b in st.get("windows", []))
            rows.append(f'<div class="tp-row"><span class="tp-lab"><b>{e(st["label"])}</b>{e(st.get("tag", ""))}</span>'
                        f'<span class="tp-track">{win}{stints}</span><span class="tp-pit">Stop{"s" if len(st.get("windows", [])) > 1 else ""}: laps {wtxt}</span></div>')
        ticks = "".join(f'<span style="left:{pct(t):.2f}%">{t}</span>' for t in [1, 10, 20, 30, 40, 50, laps])
        chart = f'<div class="tp-chart">{"".join(rows)}<div class="tp-row tp-axis"><span class="tp-lab">Lap</span><span class="tp-track tp-ticks">{ticks}</span><span class="tp-pit"></span></div></div>'
        legend += '<span><i class="tp-winkey"></i>Pit window</span>'
    else:
        # no published stint lengths: show each strategy as its compound order
        arrow = '<span class="tp-arrow">→</span>'
        chart = '<div class="tp-seqs">' + "".join(
            f'<div class="tp-seq"><span class="tp-lab"><b>{e(st["label"])}</b>{e(st.get("tag", ""))}</span>'
            f'<span class="tp-chips">{arrow.join(f"<span class=\"tp-chip tp-{c}\">{COMPOUND_NAME[c]}</span>" for c in st["sequence"])}</span>'
            f'<span class="tp-note">{e(st.get("note", ""))}</span></div>' for st in tp["strategies"]) + '</div>'
    return f'''<div class="tyre-plan"><h4>Tyre strategy{kind(tp.get("kind", "verified"))}</h4>
    <p class="tp-sum">{e(tp["summary"])}</p>
    {chart}
    <div class="tp-foot">{deltas}<div class="tp-legend">{legend}<span class="tp-src">{e(tp["source_line"])}</span></div></div></div>'''


def page_strategy(ed):
    s = ed["strategy"]
    rows = "".join(
        f'<tr><td>{e(r["condition"])}</td><td class="big">{e(r["pit_lane"])}{kind("measured")}</td>'
        f'<td class="big">{e(r["net_loss"])}{kind(r["net_kind"])}</td><td class="big">{e(r["saving"])}</td></tr>'
        for r in s["pit_loss_rows"])

    notes = "".join(f"<li>{e(n)}</li>" for n in s["pit_loss_notes"])
    hist = "".join(f'<tr><td class="num">{h["year"]}</td><td><b>{e(h["pattern"])}</b></td><td>{e(h["detail"])}{kind(h["kind"])}</td></tr>' for h in s["history"])
    plan = tyre_plan(s, ed["race_laps"])
    # the pre-weekend one-or-two-stop reading gives way to the real plan
    # likewise the historical pit window: the plan's windows replace it
    history_window = "" if s.get("tyre_plan") else f'<h4 style="margin-top:2.5mm">Pit window</h4><p>{e(s["pit_window"])}{kind(s["pit_window_kind"])}</p>'
    preview = "" if s.get("tyre_plan") else f'<p>{e(s["one_vs_two"])}{kind(s["one_vs_two_kind"])}</p>'
    watch = "".join(f"<li>{e(w)}</li>" for w in s["what_to_watch"])
    return f'''<section class="page">
  {run_head(ed, "The Strategy Desk")}
  <div class="kicker">03 · The Strategy Desk</div>
  <h2 class="page-title">What a pit stop really costs</h2>
  <p class="page-dek" style="margin-bottom:3.5mm">Time in the pit lane is not the same as time lost. What matters is the race time a stop costs compared with staying out, and that changes when the race is neutralised.</p>
  <table class="loss-table"><thead><tr><th>Conditions</th><th>Time in pit lane</th><th>Net race-time loss</th><th>Saving vs green</th></tr></thead><tbody>{rows}</tbody></table>
  <ul class="notes">{notes}</ul>
  {plan}
  <div class="cols2">
    <div class="panel"><h4>One stop or two?</h4><table class="hist"><tbody>{hist}</tbody></table><p class="muted" style="margin-top:1.5mm;font-size:7.4pt">{e(s["history_note"])}</p><p>{e(s["tyres"])}{kind(s["tyres_kind"])}</p>{preview}</div>
    <div class="panel"><h4>Undercut and overcut</h4><p>{e(s["undercut"])}</p><p>{e(s["overcut"])}</p>{history_window}<h4 style="margin-top:2.5mm">If the VSC or Safety Car comes out</h4><p>{e(s["neutralisation"])}{kind(s["neutralisation_kind"])}</p></div>
  </div>
  <div class="watch"><h4>What to Watch</h4><ol>{watch}</ol></div>
  {run_foot(ed, 3, "Pit times: f1db · Net loss: Pirelli · Verified " + e(ed["last_verified"]))}
</section>'''


def page_briefing(ed, st, site_url):
    b = ed["briefing"]
    sched = "".join(
        f'<tr class="{"race" if "Grand Prix" in r["session"] else ""}"><td>{e(r["day"])}</td><td>{e(r["session"])}</td><td class="t">{e(r["time"])} CDT</td></tr>' for r in b["schedule"])
    stand = "".join(
        f'<tr><td class="num">{i}</td><td><span class="stripe" style="background:{TEAM_COLORS.get(d["team"], "#888")}"></span>{e(d["name"])}</td><td class="num">{d["points"]}</td></tr>'
        for i, d in enumerate(st["drivers"][:10], 1))
    cons = "".join(
        f'<tr><td class="num">{i}</td><td><span class="stripe" style="background:{TEAM_COLORS.get(t["name"], "#888")}"></span>{e(t["name"])}</td><td class="num">{t["points"]}</td></tr>'
        for i, t in enumerate(st["constructors"][:5], 1))
    if b.get("grid"):
        cell = lambda g: (f'<td class="num">{g["pos"]}</td><td><span class="stripe" style="background:{TEAM_COLORS.get(g.get("team"), "#888")}"></span>{e(g["driver"])}'
                          + (f'<span class="gnote">{e(g["note"])}</span>' if g.get("note") else "") + '</td>')
        g = b["grid"]
        rows = "".join(f'<tr>{cell(g[i])}{cell(g[i + 1]) if i + 1 < len(g) else "<td></td><td></td>"}</tr>' for i in range(0, len(g), 2))
        grid = f'<table class="tight grid"><tbody>{rows}</tbody></table>'
        if b.get("penalties"):
            grid += f'<p class="muted" style="font-size:7.2pt;margin-top:1mm">{e(b["penalties"])}</p>'
    else:
        grid = pending(b["grid_note"])
    battles = "".join(f'<tr><td><b>{e(x["title"])}</b></td><td>{e(x["text"])}</td></tr>' for x in b["battles"])
    five = "".join(f"<li>{e(x)}</li>" for x in b["five_things"])
    sign = (f'<div class="signoff">{"<span class=\"so-title\">" + e(b["sign_off_title"]) + "</span>" if b.get("sign_off_title") else ""}{e(b["sign_off"])}<span class="by">— JP</span></div>' if b.get("sign_off") else pending(b["sign_off_note"]))
    srcs = "".join(f'<div>{e(v["label"])}: <a href="{e(v["url"])}">{e(host(v["url"]))}</a></div>' for v in ed["sources"].values())
    web = f'<a href="{e(site_url)}">{e(host(site_url))}</a>' if site_url else ""
    return f'''<section class="page">
  {run_head(ed, "The Viewer's Briefing")}
  <div class="kicker">04 · The Viewer's Briefing</div>
  <h2 class="page-title">Your race-day reference</h2>
  <div class="brief-grid">
    <div>
      <div class="start-box"><span class="big">15:00 CDT</span><span class="small">Lights out · {e(ed["race_date"])}<br>{e(ed["timezone_label"])}</span></div>
      <h3 class="sec">Weekend schedule{kind(b["schedule_kind"])}</h3>
      <table class="sched tight"><tbody>{sched}</tbody></table>
      <h3 class="sec" style="margin-top:3mm">Starting grid</h3>
      {grid}
      <h3 class="sec" style="margin-top:3mm">Key battles</h3>
      <table class="tight battles"><tbody>{battles}</tbody></table>
    </div>
    <div>
      <h3 class="sec">Standings entering the race{kind("verified")}</h3>
      <table class="tight"><thead><tr><th class="num">Pos</th><th>Driver</th><th class="num">Pts</th></tr></thead><tbody>{stand}</tbody></table>
      <table class="tight" style="margin-top:2mm"><thead><tr><th class="num">Pos</th><th>Constructor</th><th class="num">Pts</th></tr></thead><tbody>{cons}</tbody></table>
      <h3 class="sec" style="margin-top:3mm">Five things to watch</h3>
      <ol class="five">{five}</ol>
    </div>
  </div>
  {sign}
  <div class="sources"><div><b>Sources</b> (last verified {e(ed["last_verified"])})</div>{srcs}</div>
  {run_foot(ed, 4, (web + " · " if site_url else "") + "All times local to the circuit")}
</section>'''


def build_html(ed, c, st, proof, site_url):
    title = f'JP Race Day Programme · {ed["grand_prix"]} {ed["season"]} · Edition {ed["edition"]:02d}'
    css = open(os.path.join(ROOT, "raceday", "print.css"), encoding="utf-8").read()
    return f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>{e(title)}</title>
<meta name="author" content="{e(SITE_NAME)}"><meta name="description" content="Four-page race-day programme for the {e(ed["grand_prix"])}, {ed["season"]}.">
<link rel="stylesheet" href="{FONTS}"><style>{css}</style></head><body>
{page_cover(ed, c, st, proof)}
{page_circuit(ed, c)}
{page_strategy(ed)}
{page_briefing(ed, st, site_url)}
</body></html>'''


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    final = "--final" in sys.argv
    if not args:
        sys.exit(__doc__)
    folder = os.path.join(ROOT, args[0]) if not os.path.isabs(args[0]) else args[0]
    ed = json.load(open(os.path.join(folder, "edition.json"), encoding="utf-8"))
    config = json.load(open(os.path.join(ROOT, "data", "raceday.json"), encoding="utf-8"))
    site_url = config.get("site_url")
    if final:
        missing = [".".join(p) for p in REQUIRED_FOR_FINAL if not get(ed, p)]
        if missing:
            sys.exit("Not ready for a final edition. Still empty: " + ", ".join(missing))
    c = json.load(open(os.path.join(ROOT, "data", "circuits.json"), encoding="utf-8"))["circuits"][ed["circuit_id"]]
    st = json.load(open(os.path.join(ROOT, "data", "standings.json"), encoding="utf-8"))
    # proofs go to a git-ignored proof/ folder so they can never be deployed
    out = folder if final else os.path.join(folder, "proof")
    os.makedirs(out, exist_ok=True)
    html_path = os.path.join(out, "programme.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(build_html(ed, c, st, proof=not final, site_url=site_url))
    pdf_path = os.path.join(out, ed["filename"])
    png_path = os.path.join(out, "cover.png")
    r = subprocess.run(["node", os.path.join(ROOT, "tools", "raceday_render.js"), html_path, pdf_path, png_path],
                       capture_output=True, text=True)
    print(r.stdout.strip())
    if r.returncode:
        sys.exit(r.stderr.strip() or "render failed")
    try:
        from pypdf import PdfReader, PdfWriter
        reader = PdfReader(pdf_path)
        writer = PdfWriter(clone_from=reader)
        writer.add_metadata({
            "/Title": f'JP Race Day Programme: {ed["grand_prix"]} {ed["season"]} (Edition {ed["edition"]:02d})',
            "/Author": SITE_NAME,
            "/Subject": f'Race-day programme for the {ed["grand_prix"]}, {ed["circuit_name"]}, {ed["race_date"]}',
            "/Keywords": f'Formula 1, {ed["grand_prix"]}, {ed["circuit_name"]}, JP Race Day',
        })
        writer.page_mode = "/UseNone"
        with open(pdf_path, "wb") as f:
            writer.write(f)
        print(f"metadata set; {len(reader.pages)} pages")
    except ImportError:
        print("pypdf not installed: PDF metadata left as Chromium wrote it (pip install pypdf)")
    print(("FINAL" if final else "PROOF") + f" built: {os.path.relpath(pdf_path, ROOT)}")


if __name__ == "__main__":
    main()
