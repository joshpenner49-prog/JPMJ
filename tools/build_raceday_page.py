#!/usr/bin/env python3
"""
Build the JP Race Day landing page (raceday.html) from data/raceday.json.

Writes the generated blocks between <!-- BUILD:raceday-latest --> and
<!-- BUILD:raceday-archive --> markers. The newest edition is featured;
every older published edition goes in the archive.

An edition only gets a download link once its status is "published" and
its final PDF exists in its folder (built with build_raceday.py --final).
Until then the page says when it will publish and offers no file, so a
proof can never be linked by mistake.

Usage: python3 tools/build_raceday_page.py
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import build_raceday  # noqa: E402  (track outline)

DATA = json.load(open(os.path.join(ROOT, "data", "raceday.json"), encoding="utf-8"))
PAGE = os.path.join(ROOT, "raceday.html")


def esc(s):
    return html.escape(str(s), quote=True)


def check():
    errors = []
    for ed in DATA["editions"]:
        folder = os.path.join(ROOT, ed["folder"])
        if not os.path.exists(os.path.join(folder, "edition.json")):
            errors.append(f"Edition {ed['edition']}: no edition.json in {ed['folder']}")
        if ed["status"] == "published":
            pdf = os.path.join(folder, ed["filename"])
            if not os.path.exists(pdf):
                errors.append(f"Edition {ed['edition']}: published but {ed['folder']}/{ed['filename']} is missing")
            if not ed.get("publication_date"):
                errors.append(f"Edition {ed['edition']}: published but no publication_date")
        elif ed["status"] != "upcoming":
            errors.append(f"Edition {ed['edition']}: unknown status {ed['status']!r}")
    if errors:
        print("Race Day page check FAILED:\n  " + "\n  ".join(errors))
        sys.exit(1)


def outline(ed):
    detail = json.load(open(os.path.join(ROOT, ed["folder"], "edition.json"), encoding="utf-8"))
    c = json.load(open(os.path.join(ROOT, "data", "circuits.json"), encoding="utf-8"))["circuits"][detail["circuit_id"]]
    return build_raceday.track_svg(c, detail, dark=True, labels=False).replace('role="img"', 'aria-hidden="true" focusable="false"', 1)


def size_mb(ed):
    return os.path.getsize(os.path.join(ROOT, ed["folder"], ed["filename"])) / 1e6


def latest(ed):
    num = f'{ed["edition"]:02d}'
    href = f'{ed["folder"]}/{ed["filename"]}'
    if ed["status"] == "published":
        art = (f'<img src="{esc(ed["folder"])}/cover.png" width="794" height="1123" loading="eager" '
               f'alt="Cover of JP Race Day Programme Edition {num}, {esc(ed["grand_prix"])}">')
        status = f'<span class="rd-status rd-status--live">Published {esc(ed["publication_date"])}</span>'
        action = (f'<a class="btn btn--red" href="{esc(href)}" download>Download the PDF'
                  f'<span class="rd-file">A4 · 4 pages · {size_mb(ed):.1f} MB</span></a>'
                  f'<a class="btn" href="{esc(href)}" target="_blank" rel="noopener">Open in a new tab</a>')
    else:
        art = (f'<div class="rd-cover-type" aria-hidden="true"><span class="rd-cover-mast">JP Race Day Programme</span>'
               f'<span class="rd-cover-ed">Edition<b>{num}</b></span>{outline(ed)}'
               f'<span class="rd-cover-gp">{esc(ed["short_name"])}</span></div>')
        status = f'<span class="rd-status">Publishes {esc(ed["publishes"])}</span>'
        action = ('<p class="rd-wait">The programme goes up once the starting grid is official, '
                  'so the version you download is the final one. Nothing provisional is published.</p>')
    return f'''    <article class="rd-latest" aria-labelledby="rd-latest-h">
      <div class="rd-cover">{art}</div>
      <div class="rd-latest-body">
        <span class="cat-label">Latest edition · Round {ed["round"]}</span>
        <h2 id="rd-latest-h">{esc(ed["grand_prix"])}</h2>
        <p class="meta-mono">EDITION {num} · {esc(ed["circuit"]).upper()} · {esc(ed["race_date"]).upper()}</p>
        {status}
        <div class="rd-actions">{action}</div>
        <p class="rd-filename">File: <span class="meta-mono">{esc(ed["filename"])}</span></p>
      </div>
    </article>'''


def archive(eds):
    past = [e for e in eds if e["status"] == "published"]
    if not past:
        return ('    <p class="rd-empty">Edition 01 is the first JP Race Day Programme. After each race, '
                'its programme moves here, so every edition stays available to download.</p>')
    rows = "".join(
        f'\n      <li><span class="rd-arch-num">{e["edition"]:02d}</span>'
        f'<span class="rd-arch-gp">{esc(e["grand_prix"])}<span class="meta-mono">{esc(e["race_date"])} · {esc(e["circuit"])}</span></span>'
        f'<a class="link" href="{esc(e["folder"])}/{esc(e["filename"])}" download>PDF · {size_mb(e):.1f} MB</a></li>'
        for e in past)
    return f'    <ol class="rd-archive" reversed>{rows}\n    </ol>'


def replace_block(text, name, content):
    pat = re.compile(r"<!-- BUILD:%s -->.*?<!-- /BUILD:%s -->" % (name, name), re.S)
    if not pat.search(text):
        sys.exit(f"raceday.html: missing <!-- BUILD:{name} --> markers")
    return pat.sub(lambda m: f"<!-- BUILD:{name} -->\n{content}\n    <!-- /BUILD:{name} -->", text)


def main():
    check()
    eds = DATA["editions"]
    s = open(PAGE, encoding="utf-8").read()
    s = replace_block(s, "raceday-latest", latest(eds[0]))
    s = replace_block(s, "raceday-archive", archive(eds[1:]))
    open(PAGE, "w", encoding="utf-8").write(s)
    print(f"Race Day page built: latest Edition {eds[0]['edition']:02d} ({eds[0]['status']}), {len(eds) - 1} in the archive")


if __name__ == "__main__":
    main()
