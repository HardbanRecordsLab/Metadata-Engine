"""Genre grounding: club tracks must not come back as soul/jazz, instrumentals must not get vocals."""
import pytest

from app.services import genre_guard as gg


def feats(tempo=124, rms=0.18, hp=20.0, centroid=1800, flatness=0.3):
    return {
        "rhythm": {"tempo": tempo},
        "energy": {"rms_mean": rms, "dynamic_range": 0.2, "zcr_mean": 0.05},
        "harmonic": {"harmonic_percussive_ratio": hp, "mode": "Minor"},
        "spectral": {"centroid_mean": centroid, "flatness_mean": flatness},
    }


def test_context_hints_from_file_name_and_context():
    assert gg.context_genre_hints("techno EMBRACE_@EDM_RMS_Master_16b.wav")[0] == "techno"
    assert gg.context_genre_hints("Club night.wav")[:1] == ["dance/club"]
    assert gg.context_genre_hints("x.mp3", "Instrumental DJ set, deep house")[0] == "deep house"
    assert gg.context_genre_hints("Ballada o domu.mp3") == []


def test_dance_pulse_ignores_harmonic_ratio_and_handles_half_time():
    assert gg.is_dance_pulse(feats(tempo=124, hp=25))
    assert gg.is_dance_pulse(feats(tempo=62, rms=0.15))      # half-time read of 124
    assert gg.is_dance_pulse(feats(tempo=117.5, rms=0.2))    # the 'Ambion' case that was tagged Neo-Soul
    assert not gg.is_dance_pulse(feats(tempo=90))
    assert not gg.is_dance_pulse(feats(tempo=124, rms=0.04))


def test_guard_rewrites_neo_soul_on_a_club_track():
    r = {"mainGenre": "Cinematic Neo-Soul", "additionalGenres": ["contemporary r&b", "nu-jazz"], "keywords": ["sultry", "soul"], "confidence": 0.8}
    out = gg.apply_genre_guard(r, feats(), ["techno"])
    assert out["mainGenre"] == "Cinematic Techno"
    assert out["genreCorrected"]["from"] == "Cinematic Neo-Soul"
    assert "contemporary r&b" not in out["additionalGenres"] and "Techno" in out["additionalGenres"]
    assert out["confidence"] < 0.8


def test_guard_uses_the_rhythm_when_there_is_no_context():
    out = gg.apply_genre_guard({"mainGenre": "Noir Neo-Soul"}, feats(tempo=122, rms=0.2), [])
    assert out["mainGenre"].endswith("Club Electronic") and "genreCorrected" in out


def test_guard_leaves_real_soul_alone():
    slow = gg.apply_genre_guard({"mainGenre": "Velvet Neo-Soul"}, feats(tempo=88, rms=0.12), [])
    assert slow["mainGenre"] == "Velvet Neo-Soul" and "genreCorrected" not in slow
    electronic = gg.apply_genre_guard({"mainGenre": "Deep House"}, feats(), ["techno"])
    assert electronic["mainGenre"] == "Deep House"


def test_guard_respects_vocal_led_material_without_context():
    out = gg.apply_genre_guard({"mainGenre": "Modern R&B"}, feats(tempo=124, rms=0.2), [], user_vocal_evidence=True)
    assert out["mainGenre"] == "Modern R&B"


def test_instrumental_removes_every_vocal_claim():
    r = {"hasVocals": True, "mainInstrument": "Soulful Vocals", "instrumentation": ["velvety lead vocals", "warm bass"],
         "keywords": ["vocal chops", "groove"], "vocalStyle": {"gender": "female"}}
    out = gg.apply_instrumental(r)
    assert out["hasVocals"] is False and out["vocalStyle"]["gender"] == "none"
    assert out["instrumentation"] == ["warm bass"] and out["keywords"] == ["groove"]
    assert out["mainInstrument"] == "Synth lead"


def test_heuristics_no_longer_call_every_tonal_track_jazz():
    pytest.importorskip("librosa")  # heavy DSP deps: present in the Docker image / CI, optional locally
    from app.services.fresh_track_analyzer import FreshTrackAnalyzer
    h = FreshTrackAnalyzer._quick_heuristics(object.__new__(FreshTrackAnalyzer), feats(tempo=117, rms=0.2, hp=20))
    assert "jazz/neo-soul" not in h["genre"]["hints"] and "r&b/soul" not in h["genre"]["hints"]
    assert "electronic dance" in h["genre"]["hints"]
    quiet_jazz = FreshTrackAnalyzer._quick_heuristics(object.__new__(FreshTrackAnalyzer), feats(tempo=96, rms=0.09, hp=3.5, centroid=2200, flatness=0.2))
    assert "jazz/neo-soul" in quiet_jazz["genre"]["hints"]


def test_grounding_block_mentions_instrumental_and_rules():
    block = gg.grounding_block("Club night.wav", "Instrumental DJ's Vol. 3", ["dance/club"], True)
    assert "INSTRUMENTAL" in block and "Club night.wav" in block and "neo-soul" in block
