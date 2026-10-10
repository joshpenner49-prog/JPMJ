#!/usr/bin/env bash
# Generate narration from a text file with Piper TTS (local, free).
#
# Usage: ./narrate.sh <input.txt> [voice] [output.wav]
#   voice defaults to en_GB-northern_english_male-medium (must be in ./voices)
#   output defaults to output/<input-name>_<voice>.wav (never overwrites)
#
# Text format: one paragraph per line; "[pause 2.5]" inserts silence;
# other lines starting with "[" are production cues and are not spoken.
#
# Optional pacing env vars: LENGTH_SCALE (default 1.1 = slightly slower),
# SENTENCE_SILENCE (default 0.45 s), PARAGRAPH_SILENCE (default 0.9 s).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
input="${1:?Usage: ./narrate.sh <input.txt> [voice] [output.wav]}"
voice="${2:-en_GB-northern_english_male-medium}"
output="${3:-$here/output/$(basename "${input%.*}")_${voice}.wav}"

if [[ ! -f "$here/voices/$voice.onnx" || ! -f "$here/voices/$voice.onnx.json" ]]; then
  echo "Voice '$voice' not found in $here/voices. Download it with:" >&2
  echo "  $here/.venv/bin/python -m piper.download_voices $voice --data-dir $here/voices" >&2
  exit 1
fi

"$here/.venv/bin/python" "$here/narrate.py" "$input" "$output" \
  --voice "$here/voices/$voice.onnx" \
  --length-scale "${LENGTH_SCALE:-1.1}" \
  --sentence-silence "${SENTENCE_SILENCE:-0.45}" \
  --paragraph-silence "${PARAGRAPH_SILENCE:-0.9}"
