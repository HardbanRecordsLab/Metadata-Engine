"""Regression guard for _extract_rhythm_features()'s 'rhythm_complexity' field.

Two _quick_heuristics() genre-hint rules in fresh_track_analyzer.py read
rhythm.get('rhythm_complexity', ...) — a key _extract_rhythm_features() never
actually set, so those rules ('afrobeats/world', 'drill') were permanently
dead. This checks the field exists and moves in the right direction: a rigid
metronome click track should not read as more complex than a syncopated,
irregular one.
"""
import numpy as np
import pytest

from app.services.deep_audio_analyzer import DeepAudioAnalyzer

SAMPLE_RATE = 22050


def _click_track(interval_sec, jitter=0.0, amp_jitter=0.0, duration_sec=12.0, sr=SAMPLE_RATE, seed=0):
    """Synthesize short percussive clicks at (optionally jittered) intervals."""
    rng = np.random.default_rng(seed)
    n = int(duration_sec * sr)
    y = np.zeros(n, dtype=np.float32)
    click_len = int(0.01 * sr)
    envelope = np.exp(-np.linspace(0, 8, click_len))
    t = 0.0
    while t < duration_sec:
        idx = int(t * sr)
        amp = 1.0 + (rng.uniform(-1, 1) * amp_jitter)
        end = min(n, idx + click_len)
        y[idx:end] += (envelope[: end - idx] * amp).astype(np.float32)
        t += interval_sec + rng.uniform(-jitter, jitter)
    return y


@pytest.mark.parametrize("execution_number", [0])
def test_rhythm_complexity_field_present_and_valid(execution_number):
    analyzer = DeepAudioAnalyzer()
    y = _click_track(0.5, jitter=0.0)
    features = analyzer._extract_rhythm_features(y, SAMPLE_RATE)
    assert features["rhythm_complexity"] in ("simple", "medium", "complex")


def test_steady_click_track_is_not_more_complex_than_irregular_one():
    analyzer = DeepAudioAnalyzer()

    steady = _click_track(0.5, jitter=0.0, amp_jitter=0.0, seed=1)
    irregular = _click_track(0.5, jitter=0.18, amp_jitter=0.9, seed=2)

    order = {"simple": 0, "medium": 1, "complex": 2}
    steady_complexity = order[analyzer._extract_rhythm_features(steady, SAMPLE_RATE)["rhythm_complexity"]]
    irregular_complexity = order[analyzer._extract_rhythm_features(irregular, SAMPLE_RATE)["rhythm_complexity"]]

    assert steady_complexity <= irregular_complexity
