"""Render a narration text file to a single WAV with Piper TTS.

Text format:
  - One paragraph per line; blank lines are ignored.
  - "[pause 2.5]" on its own line inserts that many seconds of silence.
  - Any other line starting with a single "[" (e.g. "[MUSIC: ...]") is a
    production cue and is not spoken. "[[ phonemes ]]" blocks are spoken.

Usage:
  .venv/bin/python narrate.py INPUT.txt OUTPUT.wav --voice voices/NAME.onnx
"""

import argparse
import re
import sys
import wave
from pathlib import Path

from piper import PiperVoice, SynthesisConfig

PAUSE_RE = re.compile(r"^\[pause\s+([0-9.]+)\]$", re.IGNORECASE)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--voice", type=Path, required=True, help=".onnx model")
    parser.add_argument("--length-scale", type=float, default=1.1)
    parser.add_argument("--sentence-silence", type=float, default=0.45)
    parser.add_argument("--paragraph-silence", type=float, default=0.9)
    args = parser.parse_args()

    if args.output.exists():
        print(f"Refusing to overwrite existing file: {args.output}", file=sys.stderr)
        return 1

    voice = PiperVoice.load(args.voice)
    rate = voice.config.sample_rate
    syn_config = SynthesisConfig(length_scale=args.length_scale)

    def silence(seconds: float) -> bytes:
        return bytes(int(rate * seconds) * 2)  # 16-bit mono

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(args.output), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)

        for line in args.input.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            if match := PAUSE_RE.match(line):
                wav.writeframes(silence(float(match.group(1))))
                continue
            if line.startswith("[") and not line.startswith("[["):
                continue

            for i, chunk in enumerate(voice.synthesize(line, syn_config)):
                if i > 0:
                    wav.writeframes(silence(args.sentence_silence))
                wav.writeframes(chunk.audio_int16_bytes)
            wav.writeframes(silence(args.paragraph_silence))

        seconds = wav.getnframes() / rate

    print(f"Wrote {args.output} ({seconds / 60:.1f} min)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
