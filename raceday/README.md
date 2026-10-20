# JP Race Day Programme: how an edition is made

Each Grand Prix gets a four-page A4 PDF programme:

1. **The Grand Prix**: the cover, the storylines and the top five.
2. **The Circuit File**: the map, the facts, the key sections and the glossary.
3. **The Strategy Desk**: pit loss under green, VSC and Safety Car, plus strategy.
4. **The Viewer's Briefing**: the schedule, grid, standings, battles, five things to watch, the sign-off and sources.

Everything comes from one file per race: `raceday/<season>-<slug>/edition.json`.

## Rules

- **Facts:** every fact carries a kind:
  - `verified`: an official or primary source;
  - `measured`: computed from timing data or the outline;
  - `estimate`: sourced, with assumptions stated;
  - `analysis`: editorial view.
- **Sources:** list every source in `sources`, and set `last_verified`.
- **Track:** the map and its markers come only from `data/circuits.json`. Never draw or guess the track geometry.
- **Times:** all times are local to the circuit.
- **Unknowns:** anything not yet known stays `null`. The proof shows it as a "to come in the final edition" box. Nothing provisional is published.
- **Sign-off:** JP writes it (`briefing.sign_off`). Edit it lightly only.

## Workflow

1. **Research** (race week, Monday to Thursday):
   - copy the last edition's folder;
   - update `edition.json` (cover, storylines, circuit, strategy, briefing, sources);
   - add the edition to the top of `data/raceday.json` with `status: "upcoming"`;
   - run `python3 tools/build_raceday_page.py` so the landing page announces it.
2. **Proof:** run `python3 tools/build_raceday.py raceday/<folder>`.
   - It writes `proof/` (git-ignored, never deployed): `programme.html`, the PDF and `cover.png`, stamped "PROOF".
   - The build fails if any content runs off a page or into the bottom margin. Tighten the copy until it passes.
3. **After qualifying:** fill in:
   - `briefing.grid` (`pos`, `driver`, `team`, optional `note`) and `briefing.penalties`;
   - `circuit.overtaking_aids` (the FIA Straight Mode zones and Overtake detection);
   - `strategy.pirelli_2026`;
   - `briefing.sign_off`;
   - `publication_date`.
4. **Final:** run `python3 tools/build_raceday.py raceday/<folder> --final`.
   - It refuses to build while any required field is empty.
   - It writes the PDF and `cover.png` into the edition folder.
5. **Review:** read all four pages of the PDF. Check the grid against the official FIA classification.
6. **Publish:**
   - in `data/raceday.json`, set `status: "published"` and `publication_date`;
   - run `python3 tools/build_raceday_page.py`. The download button appears only for a published edition whose PDF exists.
   - commit, then deploy (on JP's approval).
7. **Archive:** when the next edition is added at the top of `data/raceday.json`, this one moves to the archive automatically.

## Requirements

- Python 3.
- Node with the `playwright` package and Chromium.
- `pypdf`, for the PDF metadata. It is optional.
