"""Engine 3.0: hearing helpers, trust layer, signed passport, QC maths, smart cutdowns. No model, no audio files."""
import numpy as np
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.services import cutdowns, genre_guard as gg, hearing, passport, qc, trust

# ───────────────────────────── hearing helpers ─────────────────────────────


def test_rank_orders_by_probability_and_drops_noise():
    r = hearing.rank(["a", "b", "c"], np.array([0.9, 0.1, 0.0]), scale=20, top=3, min_prob=0.02)
    assert [x["label"] for x in r][0] == "a" and r[0]["p"] > 0.9 and len(r) <= 3


def test_vector_roundtrip_is_unit_length():
    v = np.random.RandomState(0).randn(512)
    out = hearing.unpack_vector(hearing.pack_vector(v))
    assert out.shape == (512,) and abs(np.linalg.norm(out) - 1) < 1e-2
    assert hearing.cosine(out, v) > 0.999


def test_vocal_verdict_needs_a_margin():
    assert hearing.vocal_verdict({hearing.VOCAL_NONE: 0.85})["hasVocals"] is False
    v = hearing.vocal_verdict({hearing.VOCAL_NONE: 0.2, hearing.VOCAL_FEMALE: 0.6, hearing.VOCAL_MALE: 0.2})
    assert v["hasVocals"] is True and v["gender"] == "female"
    assert hearing.vocal_verdict({hearing.VOCAL_NONE: 0.65})["hasVocals"] is None
    assert hearing.vocal_verdict({hearing.VOCAL_NONE: 0.3, hearing.VOCAL_FEMALE: 0.35, hearing.VOCAL_MALE: 0.35})["gender"] == "mixed"


def test_clip_starts_skip_intro_and_outro():
    sr = hearing.SAMPLE_RATE
    starts = hearing.clip_starts(200 * sr)
    assert len(starts) == hearing.MAX_CLIPS and starts[0] >= 0.08 * 200 * sr and starts[-1] + 10 * sr <= 0.92 * 200 * sr + 1
    assert hearing.clip_starts(5 * sr) == [0]


# ───────────────────────────── trust layer ─────────────────────────────
ELECTRONIC_HEARING = {"genre": [{"label": "techno", "p": 0.5}, {"label": "trance", "p": 0.2}, {"label": "house", "p": 0.1}],
                      "genre_agreement": 1.0, "vocal_verdict": {"hasVocals": False, "pInstrumental": 0.9, "pVocal": 0.1}}
FEATS = {"rhythm": {"tempo": 124}, "energy": {"rms_mean": 0.2}}


def test_genre_families():
    assert trust.genre_family("Cinematic Neo-Soul") == "organic"
    assert trust.genre_family("Melodic Techno") == "electronic"
    assert trust.genre_family("Dance Pop") == "pop"
    assert trust.compatible("electronic", "pop") and not trust.compatible("electronic", "organic")


def test_trust_flags_llm_vs_hearing():
    t = trust.build_trust({"mainGenre": "Cinematic Neo-Soul", "bpm": 124, "energyLevel": "High"}, FEATS, ELECTRONIC_HEARING)
    assert "genre:llm_vs_hearing" in t["flags"] and t["needsReview"] and t["grade"] in ("C", "D")


def test_trust_is_high_when_sources_agree():
    t = trust.build_trust({"mainGenre": "Melodic Techno", "bpm": 124, "energyLevel": "High", "vocalStyle": {"gender": "none"}},
                          FEATS, ELECTRONIC_HEARING, ["techno"], instrumental=True, dsp_vocal=False)
    assert t["flags"] == [] and t["grade"] == "A" and not t["needsReview"]


def test_trust_vocal_conflict_with_owner():
    h = {**ELECTRONIC_HEARING, "vocal_verdict": {"hasVocals": True}}
    t = trust.build_trust({"mainGenre": "House"}, FEATS, h, instrumental=True)
    assert any(f.startswith("vocals:") for f in t["flags"]) and t["fields"]["vocals"]["value"] is False


def test_trust_tempo_half_time_ambiguity():
    t = trust.build_trust({"mainGenre": "Techno", "bpm": 62}, {"rhythm": {"tempo": 62}, "energy": {"rms_mean": 0.2}})
    assert "tempo:half_double_ambiguity" in t["flags"] and t["fields"]["tempo"]["alternative"] == 124


def test_hearing_guard_rewrites_to_what_is_audible():
    r = gg.apply_hearing_guard({"mainGenre": "Cinematic Neo-Soul", "additionalGenres": ["nu-jazz"]}, ELECTRONIC_HEARING)
    assert r["mainGenre"] == "Cinematic Techno" and r["genreCorrected"]["reason"] == "hearing"
    assert "nu-jazz" not in r["additionalGenres"] and "Trance" in r["additionalGenres"]


def test_hearing_guard_leaves_compatible_or_unsure_alone():
    same = gg.apply_hearing_guard({"mainGenre": "Deep House"}, ELECTRONIC_HEARING)
    assert same["mainGenre"] == "Deep House" and "genreCorrected" not in same
    unsure = {"genre": [{"label": "techno", "p": 0.2}, {"label": "jazz", "p": 0.2}, {"label": "pop", "p": 0.2}]}
    assert gg.apply_hearing_guard({"mainGenre": "Neo-Soul"}, unsure)["mainGenre"] == "Neo-Soul"


# ───────────────────────────── passport ─────────────────────────────
@pytest.fixture()
def key():
    k = Ed25519PrivateKey.generate()
    passport.use_key_for_tests(k)
    yield k
    passport.use_key_for_tests(None)


RESULT = {"sha256": "ab" * 32, "title": "Ambion", "artist": "CMLP", "mainGenre": "Melodic Techno", "bpm": 117.4538, "moods": ["dark", "deep"],
          "hasVocals": False, "publisher": "HardbanRecords Lab", "analysisVersion": "2.1.0"}


def test_passport_roundtrip_and_tamper(key):
    p = passport.build_passport(RESULT, {"score": 0.9, "grade": "A", "needsReview": False, "flags": []}, "clap")
    assert passport.verify_passport(p)["valid"] is True
    assert p["payload"]["claims"]["bpm"] == 117.45 and p["payload"]["sha256"] == RESULT["sha256"]
    p["payload"]["claims"]["mainGenre"] = "Neo-Soul"
    assert passport.verify_passport(p)["valid"] is False


def test_passport_wrong_key_is_rejected(key):
    p = passport.build_passport(RESULT)
    other = Ed25519PrivateKey.generate().public_key()
    from cryptography.hazmat.primitives import serialization
    pub = __import__("base64").b64encode(other.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()
    assert passport.verify_passport(p, pub)["valid"] is False


# ───────────────────────────── QC ─────────────────────────────
EBU = """
[Parsed_ebur128_0 @ 0x1] Summary:

  Integrated loudness:
    I:         -13.9 LUFS
    Threshold: -24.0 LUFS

  Loudness range:
    LRA:         6.1 LU
    LRA low:   -18.0 LUFS

  True peak:
    Peak:       -0.4 dBFS
"""


def test_parse_ebur128():
    r = qc.parse_ebur128(EBU)
    assert r == {"integrated_lufs": -13.9, "lra": 6.1, "true_peak_dbtp": -0.4}


def _noise(sr=44100, seconds=8, lowpass=None, seed=1):
    x = np.random.RandomState(seed).randn(sr * seconds)
    if lowpass:
        spec = np.fft.rfft(x)
        spec[np.fft.rfftfreq(x.size, 1 / sr) > lowpass] = 0
        x = np.fft.irfft(spec, n=x.size)
    return x / np.abs(x).max()


def test_cutoff_detects_a_16k_brickwall():
    c = qc.estimate_cutoff(_noise(lowpass=16000))
    assert 15000 <= c["cutoff_hz"] <= 16600
    v = qc.classify_cutoff(c["cutoff_hz"])
    assert v["lossy_origin"] is True


def test_cutoff_full_band_is_not_flagged():
    c = qc.estimate_cutoff(_noise())
    assert qc.classify_cutoff(c["cutoff_hz"])["lossy_origin"] is False


def test_clipping_and_edges():
    x = np.concatenate([np.zeros(10), np.ones(5), -np.ones(4), np.zeros(10)])
    s = qc.clipping_stats(x)
    assert s["clip_runs"] >= 3 and s["clipped_samples"] == 9
    env = np.concatenate([np.full(10, -90.0), np.full(100, -14.0), np.full(20, -90.0)])
    e = qc.edge_silence(env, 0.05)
    assert e["head_s"] == 0.5 and e["tail_s"] == 1.0


def test_ending_styles():
    body = np.full(200, -14.0)
    assert qc.ending_style(body, 0.05)["style"] == "abrupt"
    fade = np.concatenate([body, np.linspace(-14, -50, 40)])
    assert qc.ending_style(fade, 0.05)["style"] in ("fade", "decay")


def test_sync_checks_flag_fake_lossless_and_clipping():
    r = {"format": {"codec": "pcm_s16le"}, "duration_s": 180, "loudness": {"integrated_lufs": -12.0, "true_peak_dbtp": -0.2},
         "spectrum": {"lossy_origin": True, "cutoff_hz": 16000, "approx_source": "MP3/AAC ~160-256 kbps"},
         "clipping": {"clip_runs": 4}, "edges": {"head_s": 0.0, "tail_s": 0.5}, "ending": {"style": "fade"}}
    s = qc.sync_checks(r)
    bad = {c["id"] for c in s["checks"] if c["ok"] is False}
    assert {"true_peak", "clipping", "true_lossless"} <= bad and not s["ready"] and s["grade"] in ("C", "D")


def test_sync_checks_clean_master():
    r = {"format": {"codec": "flac"}, "duration_s": 200, "loudness": {"integrated_lufs": -11.0, "true_peak_dbtp": -1.5},
         "spectrum": {"lossy_origin": False, "cutoff_hz": 21500}, "clipping": {"clip_runs": 0}, "edges": {"head_s": 0.0, "tail_s": 1.0},
         "ending": {"style": "fade"}}
    s = qc.sync_checks(r)
    assert s["score"] == 1.0 and s["ready"] and s["grade"] == "A"


# ───────────────────────────── cutdowns ─────────────────────────────
def grid(bpm=120, seconds=150, intro_bars=4):
    beat = 60 / bpm
    bt = np.arange(0, seconds, beat)
    bar = np.arange(bt.size) // 4
    energy = np.where(bar < intro_bars, 0.01, 0.1) + np.where((bar >= 24) & (bar < 40), 0.15, 0)     # a loud chorus-like section
    energy[bar >= bar.max() - 1] = 0.02
    return bt, energy, seconds


def test_cutdowns_land_on_bar_lines_and_hit_the_target():
    bt, e, d = grid()
    plan = cutdowns.plan_cutdowns(bt, e, d, (15, 30, 60))
    assert plan["ok"] and plan["bpm"] == 120.0 and plan["bar_seconds"] == 2.0
    for item in plan["cutdowns"]:
        for opt in item["options"]:
            assert abs(opt["duration"] - item["target"]) <= 2.0                       # within one bar of the target
            assert opt["start"] % 2.0 == 0 and opt["end"] % 2.0 == 0 or opt["end"] == pytest.approx(d, abs=2.5)
            assert opt["bars"] >= 2


def test_intro_cut_skips_silence_and_hook_finds_the_loud_part():
    bt, e, d = grid()
    plan = cutdowns.plan_cutdowns(bt, e, d, (30,))
    intro, hook = plan["cutdowns"][0]["options"]
    assert intro["start"] == 8.0                                                      # 4 quiet bars skipped
    assert 48.0 <= hook["start"] <= 80.0                                              # inside / next to the loud section (bars 24-40)
    assert hook["score"] >= intro["score"] and hook["phraseAligned"]


def test_cutdowns_refuse_a_track_without_a_beat_grid():
    assert cutdowns.plan_cutdowns([0.5, 1.0], [0.1, 0.1], 3.0)["ok"] is False


# ───────────────────────────── tempo consensus ─────────────────────────────
from app.services import tempo  # noqa: E402


def test_refine_from_beats_beats_frame_quantisation():
    beats = np.arange(0, 60, 60 / 120.0) + np.random.RandomState(2).randn(120) * 0.004     # a true 120 BPM with timing jitter
    quantised = np.round(beats / 0.02322) * 0.02322                                         # what a 512-sample hop at 22.05 kHz gives
    assert abs(tempo.refine_from_beats(quantised) - 120.0) < 0.3


def test_fold_into_the_dance_window():
    assert tempo.fold(60) == 120 and tempo.fold(240) == 120 and tempo.fold(100) == 100


def test_consensus_resolves_octave_disagreement():
    c = tempo.consensus({"essentia_multifeature": 138.0, "essentia_degara": 137.9, "percival": 68.9, "librosa_refined": 138.0})
    assert abs(c["bpm"] - 138.0) < 0.3 and c["agreement"] == 1.0 and c["octaveAmbiguous"] is True


def test_consensus_reports_real_disagreement():
    c = tempo.consensus({"essentia_multifeature": 147.1, "essentia_degara": 151.2, "percival": 73.3, "librosa_refined": 196.7})
    assert c["agreement"] <= 0.75 and c["alternatives"]
    assert tempo.consensus({})["bpm"] is None


def test_consensus_single_clean_cluster():
    c = tempo.consensus({"essentia_multifeature": 120.0, "essentia_degara": 120.0, "percival": 120.2, "librosa_refined": 120.0})
    assert c["bpm"] == pytest.approx(120.0, abs=0.2) and c["agreement"] == 1.0 and not c["octaveAmbiguous"]


def test_beats_are_aligned_to_the_consensus_tempo():
    half = np.arange(0, 60, 1.0)                    # tracker locked to 60 BPM, consensus says 120
    assert len(cutdowns.align_beats_to_tempo(half, 120)) > 100
    dense = np.arange(0, 60, 0.25)                  # locked to 240 BPM
    assert np.median(np.diff(cutdowns.align_beats_to_tempo(dense, 120))) == pytest.approx(0.5)
    ok = np.arange(0, 60, 0.5)
    assert np.array_equal(cutdowns.align_beats_to_tempo(ok, 120), ok)


def test_trust_uses_tempo_agreement():
    good = trust.build_trust({"mainGenre": "Techno", "bpm": 120}, FEATS, None, [], None, None,
                             tempo_info={"bpm": 120, "agreement": 1.0, "octaveAmbiguous": False, "estimates": {"a": 120}})
    bad = trust.build_trust({"mainGenre": "Techno", "bpm": 147}, FEATS, None, [], None, None,
                            tempo_info={"bpm": 147, "agreement": 0.5, "octaveAmbiguous": True, "alternatives": [98.3], "estimates": {}})
    assert good["fields"]["tempo"]["flags"] == [] and good["fields"]["tempo"]["confidence"] > 0.9
    assert "tempo:estimators_disagree" in bad["flags"] and bad["fields"]["tempo"]["alternative"] == 98.3
