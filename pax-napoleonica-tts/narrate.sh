#!/usr/bin/env bash
# Generate narration from a text file with Piper TTS (local, free).
#
# Usage: ./narrate.sh <input.txt> [voice] [output.wav]
#   voice defaults to en_GB-alan-medium (must already be in ./voices)
#   output defaults to output/<input-name>_<voice>.wav (never overwrites)
#
# Optional pacing env vars: LENGTH_SCALE (default 1.1 = slightly slower),
# SENTENCE_SILENCE (default 0.6 seconds between sentences).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
input="${1:?Usage: ./narrate.sh <input.txt> [voice] [output.wav]}"
voice="${2:-en_GB-alan-medium}"
output="${3:-$here/output/$(basename "${input%.*}")_${voice}.wav}"

if [[ ! -f "$here/voices/$voice.onnx" || ! -f "$here/voices/$voice.onnx.json" ]]; then
  echo "Voice '$voice' not found in $here/voices. Download it with:" >&2
  echo "  $here/.venv/bin/python -m piper.download_voices $voice --data-dir $here/voices" >&2
  exit 1
fi
if [[ -e "$output" ]]; then
  echo "Refusing to overwrite existing file: $output" >&2
  exit 1
fi

mkdir -p "$(dirname "$output")"
"$here/.venv/bin/python" -m piper \
  --data-dir "$here/voices" -m "$voice" \
  --length-scale "${LENGTH_SCALE:-1.1}" \
  --sentence-silence "${SENTENCE_SILENCE:-0.6}" \
  -i "$input" -f "$output"
echo "Wrote $output"
