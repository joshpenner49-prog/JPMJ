# Pax Napoleonica: narration voice test (Piper TTS)

This folder holds local, free text-to-speech for *Pax Napoleonica: The World That Never Was*.
It uses [Piper](https://github.com/OHF-Voice/piper1-gpl), the maintained successor to `rhasspy/piper`.
Piper runs offline on your machine with no API, account or per-use cost. The engine is GPL-3.0.
Each voice has its own licence, listed in its `MODEL_CARD` on Hugging Face, so check it before commercial release.

## Layout

| Path | What |
|---|---|
| `scripts/voice-test-01.txt` | The voice-test script |
| `narrate.sh` | Text file → WAV |
| `to-mp3.sh` | WAV → podcast MP3 (needs `ffmpeg`) |
| `voices/` | Downloaded voice models (git-ignored) |
| `output/` | Generated audio (git-ignored) |
| `.venv/` | Isolated Python environment (git-ignored) |

## One-time setup (Linux / macOS, Python 3.9+)

```sh
cd pax-napoleonica-tts
python3 -m venv .venv
.venv/bin/pip install piper-tts          # ~200 MB inside .venv only

# Candidate British male voices (~60 MB model + ~5 KB config each):
.venv/bin/python -m piper.download_voices en_GB-alan-medium --data-dir voices
.venv/bin/python -m piper.download_voices en_GB-northern_english_male-medium --data-dir voices
```

On Windows, use `.venv\Scripts\python` instead of `.venv/bin/python`.
Then run the `python -m piper ...` command shown in `narrate.sh` directly.

## Generate narration

```sh
./narrate.sh scripts/voice-test-01.txt                                   # default: alan
./narrate.sh scripts/voice-test-01.txt en_GB-northern_english_male-medium
LENGTH_SCALE=1.2 SENTENCE_SILENCE=0.8 ./narrate.sh scripts/voice-test-01.txt   # slower, more gravitas
```

The output goes to `output/<script>_<voice>.wav`. The script never overwrites an existing file.
To make a new take, delete or rename the old one, or pass an explicit output path as the third argument.

## Play and export

```sh
ffplay -autoexit output/voice-test-01_en_GB-alan-medium.wav   # or: aplay (Linux), afplay (macOS)
./to-mp3.sh output/voice-test-01_en_GB-alan-medium.wav        # → .mp3, -16 LUFS, 128 kbps mono
```

[Audacity](https://www.audacityteam.org/) is free and can also open the WAV and export it as an MP3.

## Tips

- Piper reads one line at a time. Keep each paragraph on its own line, and blank lines are ignored.
- Spell out numbers the way you want them spoken, for example "eighteen-oh-five".
- Fix a mispronounced name with espeak phonemes: `[[ ˈbəʊnəpɑːt ]]`.
