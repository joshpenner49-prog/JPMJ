#!/usr/bin/env bash
# Convert a narration WAV to a podcast-ready MP3 with ffmpeg (free).
# Usage: ./to-mp3.sh output/voice-test-01_en_GB-alan-medium.wav
# Mono 128 kbps, loudness-normalised to -16 LUFS (common podcast target).
set -euo pipefail
in="${1:?Usage: ./to-mp3.sh <file.wav>}"
out="${in%.wav}.mp3"
[[ -e "$out" ]] && { echo "Refusing to overwrite existing file: $out" >&2; exit 1; }
ffmpeg -hide_banner -loglevel error -i "$in" \
  -af loudnorm=I=-16:TP=-1.5:LRA=11 -ac 1 -ar 44100 \
  -codec:a libmp3lame -b:a 128k "$out"
echo "Wrote $out"
