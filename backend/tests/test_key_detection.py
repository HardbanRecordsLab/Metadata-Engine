"""Golden-dataset test for _detect_key_from_chroma: sustained triads in
known keys, synthesized with exact frequencies, so the expected answer is
unambiguous (unlike real commercial music, which key-detection algorithms
routinely disagree on even between professional tools).

This exists because _extract_harmonic_features() used to compute chroma
vectors but never convert them into an actual key name — the merge step
in fresh_track_analyzer.py read harmonic.get('key', 'C'), which always hit
the default since 'key' was never actually present. Every analysis
silently returned "C Major" regardless of the audio. Confirmed live: 6/6
manually-submitted test chords all came back as "C Major" before this fix.
"""
import math
import wave

import numpy as np
import pytest

from app.services.deep_audio_analyzer import _detect_key_from_chroma

SAMPLE_RATE = 22050

# Equal-temperament note frequencies (A4 = 440Hz)
NOTES = {
    'C4': 261.63, 'Db4': 277.18, 'D4': 293.66, 'Eb4': 311.13, 'E4': 329.63,
    'F4': 349.23, 'Gb4': 369.99, 'G4': 392.00, 'Ab4': 415.30, 'A4': 440.00,
    'Bb4': 466.16, 'B4': 493.88, 'C5': 523.25, 'D5': 587.33, 'E5': 659.25,
    'F5': 698.46, 'G5': 783.99,
}


def _make_chroma(freqs, duration_sec=8.0, sr=SAMPLE_RATE):
    """Synthesize a sustained chord and return its mean CQT chroma vector,
    the same feature _extract_harmonic_features actually computes."""
    import librosa

    n = int(duration_sec * sr)
    t = np.arange(n) / sr
    y = sum(np.sin(2 * np.pi * f * t) for f in freqs) / len(freqs)
    fade = np.minimum(1.0, np.minimum(np.arange(n) / (sr * 0.5), (n - np.arange(n)) / (sr * 0.5)))
    y = (y * fade).astype(np.float32)

    y_harmonic, _ = librosa.effects.hpss(y)
    chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr)
    return chroma.mean(axis=1)


@pytest.mark.parametrize("chord_notes,expected_key,expected_mode", [
    ([NOTES['C4'], NOTES['E4'], NOTES['G4']], 'C', 'Major'),
    ([NOTES['A4'], NOTES['C5'], NOTES['E5']], 'A', 'Minor'),
    ([NOTES['G4'], NOTES['B4'], NOTES['D5']], 'G', 'Major'),
    ([NOTES['D4'], NOTES['F4'], NOTES['A4']], 'D', 'Minor'),
    ([NOTES['F4'], NOTES['A4'], NOTES['C5']], 'F', 'Major'),
    ([NOTES['E4'], NOTES['G4'], NOTES['B4']], 'E', 'Minor'),
])
def test_key_detection_on_known_triads(chord_notes, expected_key, expected_mode):
    chroma_mean = _make_chroma(chord_notes)
    key, mode, strength = _detect_key_from_chroma(chroma_mean)
    assert key == expected_key
    assert mode == expected_mode
    assert strength > 0.5  # a real match, not a coin-flip correlation


def test_key_detection_never_silently_defaults():
    """Regression guard for the actual production bug: a chord that is
    clearly NOT C major must not come back as C major."""
    chroma_mean = _make_chroma([NOTES['F4'], NOTES['Ab4'], NOTES['C5']])  # F minor
    key, mode, _ = _detect_key_from_chroma(chroma_mean)
    assert (key, mode) != ('C', 'Major')
