"""Convert a Markdown episode script into a Piper narration text file.

- Speaks body paragraphs and "### CHAPTER ..." / "### EPILOGUE ..." headings.
- Skips the title block, metadata, "**NARRATOR:**" labels and the PROLOGUE
  heading (the episode opens cold).
- Keeps "[MUSIC: ...]" / "[SOUND: ...]" cues as unspoken lines, followed by a
  pause so the editor has room to lay music.
- Replaces words listed in pronunciations.tsv with [[ phonemes ]].

Usage: python3 prepare_script.py scripts/episode-01-script.md scripts/episode-01.txt
"""

import re
import sys
from pathlib import Path

CUE_PAUSE = 3.0
BEFORE_HEADING_PAUSE = 1.5
AFTER_HEADING_PAUSE = 1.0
SMALL_WORDS = {"a", "an", "and", "the", "of", "in", "on", "to", "across"}


def title_case(text: str) -> str:
    words = text.lower().split()
    return " ".join(
        w if i > 0 and w in SMALL_WORDS else w[:1].upper() + w[1:]
        for i, w in enumerate(words)
    )


def load_pronunciations(path: Path) -> dict[str, str]:
    table = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.startswith("#"):
                word, phonemes = line.split("\t", 1)
                table[word.strip()] = phonemes.strip()
    return table


def clean(text: str, pronunciations: dict[str, str]) -> str:
    text = text.replace("’", "'").replace("‘", "'")
    text = re.sub(r"\s*—\s*", ", ", text)
    text = re.sub(r"\*+([^*]+)\*+", r"\1", text)
    for word, phonemes in pronunciations.items():
        text = re.sub(rf"\b{re.escape(word)}\b", f"[[ {phonemes} ]]", text)
    return text


def main() -> int:
    src, dest = Path(sys.argv[1]), Path(sys.argv[2])
    if dest.exists():
        print(f"Refusing to overwrite existing file: {dest}", file=sys.stderr)
        return 1
    pronunciations = load_pronunciations(Path(__file__).parent / "pronunciations.tsv")

    out: list[str] = []
    for raw in src.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line == "---" or re.match(r"^#{1,2}\s", line):
            continue
        if line.startswith("**"):  # metadata, NARRATOR labels, END OF EPISODE
            continue
        if line.startswith("### "):
            label, _, title = line[4:].partition("—")
            label = label.strip()
            if label.upper().startswith("PROLOGUE"):
                continue
            out += [
                f"[pause {BEFORE_HEADING_PAUSE}]",
                clean(f"{title_case(label)}. {title_case(title.strip())}.", pronunciations),
                f"[pause {AFTER_HEADING_PAUSE}]",
            ]
            continue
        if line.startswith("["):
            out += [line, f"[pause {CUE_PAUSE}]"]
            continue
        out.append(clean(line, pronunciations))

    dest.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"Wrote {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
