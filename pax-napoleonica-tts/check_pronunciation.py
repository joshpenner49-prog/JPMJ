"""Print how a Piper en_GB voice will pronounce words (no model needed).

Usage: .venv/bin/python check_pronunciation.py Württemberg Baden "Pax Napoleonica"
"""

import sys
from pathlib import Path

import piper
from piper.phonemize_espeak import EspeakPhonemizer

phonemizer = EspeakPhonemizer(Path(piper.__file__).parent / "espeak-ng-data")
for text in sys.argv[1:]:
    phonemes = phonemizer.phonemize("en-gb-x-rp", text)
    print(f"{text:24} {' '.join(''.join(s) for s in phonemes)}")
