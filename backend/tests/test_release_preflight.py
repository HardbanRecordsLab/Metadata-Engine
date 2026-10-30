"""Release preflight: each rule on its own, the ACRCloud answer shapes, and the route with fake audio facts (no ffmpeg, no network)."""
import io

import pytest

from app.services import release_preflight as rp


def by_id(result, cid):
    return next(c for c in result["checks"] if c["id"] == cid)


GOOD_QC = {
    "format": {"codec": "pcm_s24le", "container": "wav", "sampleRate": 44100, "channels": 2, "bitDepth": 24, "duration_s": 200.0}, "duration_s": 200.0,
    "loudness": {"integrated_lufs": -12.5, "lra": 6.0, "true_peak_dbtp": -1.4},
    "spectrum": {"cutoff_hz": 22050.0, "lossy_origin": False, "verdict": "full-band"},
    "clipping": {"clipped_samples": 0, "clip_runs": 0, "fraction": 0.0},
    "edges": {"head_s": 0.1, "tail_s": 0.8}, "ending": {"style": "fade"},
}
GOOD_META = {"title": "Midnight Drive", "artist": "CMLP", "isrc": "PLABC2600001", "upc": "", "composer": "Kamil Skomra"}
FP_NONE = {"status": {"code": 1001, "msg": "No result"}}


def run(qc=None, meta=None, **kw):
    return rp.evaluate(GOOD_QC if qc is None else qc, GOOD_META if meta is None else meta, kw.pop("fingerprint", FP_NONE), True, **kw)


# ───────────────────────────── identifiers ─────────────────────────────
@pytest.mark.parametrize("code,ok", [("PLABC2600001", True), ("PL-ABC-26-00001", True), ("pl-abc-26-00001", True), ("PLABC260000", False),
                                     ("PLABC26000012", False), ("1LABC2600001", False), ("", False)])
def test_isrc_format(code, ok):
    assert rp.valid_isrc(code) is ok


@pytest.mark.parametrize("code,ok", [("036000291452", True), ("4006381333931", True), ("036000291453", False), ("12345", False), ("abcdefghijkl", False),
                                     ("0360-0029-1452", True)])
def test_upc_check_digit(code, ok):
    assert rp.valid_upc(code) is ok


# ───────────────────────────── a clean release ─────────────────────────────
def test_a_clean_release_is_ready():
    r = run()
    assert r["verdict"] == "ready", [c for c in r["checks"] if c["level"] in ("warn", "fail")]
    assert r["counts"]["fail"] == 0 and r["counts"]["warn"] == 0
    assert "approval" in r["disclaimer"]
    assert {c["id"] for c in r["checks"]} >= {"format", "sample_rate", "true_peak", "title", "artist", "fingerprint", "own_duplicate", "cover"}


# ───────────────────────────── technical ─────────────────────────────
def test_each_technical_problem_is_found_and_has_a_fix():
    bad = {**GOOD_QC,
           "format": {"codec": "mp3", "container": "mp3", "sampleRate": 32000, "channels": 1, "bitDepth": 16, "duration_s": 8.0}, "duration_s": 8.0,
           "loudness": {"integrated_lufs": -3.0, "true_peak_dbtp": 0.8},
           "spectrum": {"cutoff_hz": 16000.0, "lossy_origin": True},
           "clipping": {"clipped_samples": 900, "clip_runs": 40, "fraction": 0.001},
           "edges": {"head_s": 3.0, "tail_s": 12.0}, "ending": {"style": "abrupt"}}
    r = run(bad)
    lv = {c["id"]: c["level"] for c in r["checks"]}
    assert lv["format"] == "warn" and lv["sample_rate"] == "fail" and lv["channels"] == "warn" and lv["duration"] == "fail"
    assert lv["lossy_origin"] == "warn" and lv["clipping"] == "fail" and lv["true_peak"] == "fail" and lv["loudness"] == "warn"
    assert lv["silence"] == "warn" and lv["ending"] == "warn"
    assert r["verdict"] == "fix" and r["counts"]["fail"] >= 4
    assert all("fix" in c for c in r["checks"] if c["level"] in ("warn", "fail"))


def test_true_peak_bands():
    def level(tp):
        q = {**GOOD_QC, "loudness": {"integrated_lufs": -12.0, "true_peak_dbtp": tp}}
        return by_id(run(q), "true_peak")["level"]
    assert (level(-2.0), level(-0.5), level(0.2)) == ("pass", "warn", "fail")


def test_a_lossy_file_is_not_asked_for_a_bit_depth():
    q = {**GOOD_QC, "format": {"codec": "mp3", "container": "mp3", "sampleRate": 44100, "channels": 2, "bitDepth": 16, "duration_s": 200.0}}
    assert not any(c["id"] == "bit_depth" for c in run(q)["checks"])


def test_missing_measurements_do_not_crash_or_invent_findings():
    r = run({})
    assert r["verdict"] in ("ready", "review", "fix")
    assert not any(c["id"] in ("true_peak", "loudness", "clipping") for c in r["checks"])


# ───────────────────────────── metadata ─────────────────────────────
@pytest.mark.parametrize("title,level", [("Midnight Drive", "pass"), ("", "fail"), ("Untitled", "fail"), ("test_mix.wav", "fail"),
                                         ("  Spaced  ", "warn"), ("Song (feat. Anna)", "warn"), ("LOUD TITLE", "warn"), ("Ends with dot.", "warn"),
                                         ("Fire 🔥", "warn")])
def test_title_rules(title, level):
    assert by_id(run(meta={**GOOD_META, "title": title}), "title")["level"] == level


@pytest.mark.parametrize("artist,level", [("CMLP", "pass"), ("", "fail"), ("Unknown Artist", "fail"), ("various", "fail")])
def test_artist_rules(artist, level):
    assert by_id(run(meta={**GOOD_META, "artist": artist}), "artist")["level"] == level


def test_isrc_upc_and_credits():
    r = run(meta={**GOOD_META, "isrc": "NOPE", "upc": "123", "composer": ""})
    assert by_id(r, "isrc")["level"] == "fail" and by_id(r, "upc")["level"] == "fail" and by_id(r, "credits")["level"] == "warn"
    r = run(meta={**GOOD_META, "isrc": "", "upc": ""})
    assert by_id(r, "isrc")["level"] == "skip" and by_id(r, "upc")["level"] == "skip"           # absent is fine: distributors assign them
    assert by_id(run(meta={**GOOD_META, "upc": "036000291452"}), "upc")["level"] == "pass"


# ───────────────────────────── fingerprint ─────────────────────────────
def music(title, artist, score):
    return {"status": {"code": 0}, "metadata": {"music": [{"title": title, "artists": [{"name": artist}], "score": score}]}}


def test_fingerprint_outcomes():
    assert by_id(run(fingerprint=FP_NONE), "fingerprint")["level"] == "pass"
    hit = by_id(run(fingerprint=music("Hit Song", "Famous Band", 100)), "fingerprint")
    assert hit["level"] == "fail" and "Hit Song" in hit["detail"] and "Famous Band" in hit["detail"]
    own = by_id(run(fingerprint=music("Midnight Drive", "CMLP", 98)), "fingerprint")
    assert own["level"] == "warn" and "already released" in own["detail"]                         # same artist: maybe your own live release
    assert by_id(run(fingerprint=music("Faint", "Someone", 40)), "fingerprint")["level"] == "pass"
    short = by_id(rp.evaluate(GOOD_QC, {**GOOD_META, "artist": "A"}, music("Hit", "Famous Band", 100), True), "fingerprint")
    assert short["level"] == "fail"                                                                   # a short artist name is not "inside" another artist
    assert by_id(run(fingerprint={"status": {"code": 3003}}), "fingerprint")["level"] == "skip"
    unreachable = rp.evaluate(GOOD_QC, GOOD_META, None, False)
    assert by_id(unreachable, "fingerprint")["level"] == "skip"
    assert unreachable["verdict"] == "ready"                                                       # an unchecked item never blocks


def test_best_of_several_matches_is_judged():
    fp = {"status": {"code": 0}, "metadata": {"music": [{"title": "A", "artists": [{"name": "X"}], "score": 72}, {"title": "B", "artists": [{"name": "Y"}], "score": 99}]}}
    assert "“B”" in by_id(run(fingerprint=fp), "fingerprint")["detail"]


# ───────────────────────────── own history, cover ─────────────────────────────
def test_own_duplicate_only_warns_when_the_title_differs():
    assert by_id(run(own_matches=[]), "own_duplicate")["level"] == "pass"
    assert by_id(run(own_matches=[{"title": "Old Name", "file_name": "a.wav"}]), "own_duplicate")["level"] == "warn"
    assert by_id(run(own_matches=[{"title": "midnight drive", "file_name": "a.wav"}]), "own_duplicate")["level"] == "pass"


@pytest.mark.parametrize("cover,level", [(None, "skip"), ({"width": 3000, "height": 3000, "format": "JPEG"}, "pass"), ({"width": 3000, "height": 3000, "format": "PNG"}, "pass"),
                                         ({"width": 2000, "height": 2000, "format": "JPEG"}, "warn"), ({"width": 1000, "height": 1000, "format": "JPEG"}, "fail"),
                                         ({"width": 3000, "height": 2000, "format": "JPEG"}, "fail"), ({"width": 3000, "height": 3000, "format": "GIF"}, "fail"),
                                         ({"width": 0, "height": 0, "format": None}, "fail")])
def test_cover_rules(cover, level):
    assert by_id(run(cover=cover, cover_given=cover is not None), "cover")["level"] == level


# ───────────────────────────── the route ─────────────────────────────
from types import SimpleNamespace  # noqa: E402

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.rate_limit import limiter  # noqa: E402
from app.routes import intelligence as intel  # noqa: E402
from app.dependencies import get_user_and_check_quota  # noqa: E402
from app.services import acr_identify, qc  # noqa: E402


@pytest.fixture()
def client(monkeypatch):
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(intel.router, prefix="/api")
    app.dependency_overrides[get_user_and_check_quota] = lambda: SimpleNamespace(id="u-preflight-test")
    monkeypatch.setattr(qc, "analyze_file", lambda path: GOOD_QC)
    monkeypatch.setattr(acr_identify, "configured", lambda: False)
    return TestClient(app)


def post(client, **fields):
    data = {"title": "Midnight Drive", "artist": "CMLP", "isrc": "PLABC2600001", "composer": "Kamil Skomra", **fields}
    return client.post("/api/intelligence/preflight", data=data, files={"file": ("track.wav", b"RIFFxxxxWAVE", "audio/wav")})


def test_route_returns_the_checklist_and_marks_the_fingerprint_unchecked_without_acr(client):
    r = post(client)
    assert r.status_code == 200
    body = r.json()
    assert body["verdict"] == "ready" and by_id(body, "fingerprint")["level"] == "skip"
    assert len(body["audio"]["sha256"]) == 64 and body["audio"]["durationSeconds"] == 200.0


def test_route_uses_the_fingerprint_service_and_the_cover(client, monkeypatch):
    monkeypatch.setattr(acr_identify, "configured", lambda: True)
    monkeypatch.setattr(intel, "_fingerprint_sample", lambda path, dur: b"sample-bytes")

    async def fake_identify(sample, name="sample"):
        assert sample == b"sample-bytes"
        return music("Hit Song", "Famous Band", 100)
    monkeypatch.setattr(acr_identify, "identify", fake_identify)
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (3000, 3000), "navy").save(buf, "JPEG")
    r = client.post("/api/intelligence/preflight", data={"title": "T", "artist": "A"}, files={"file": ("track.wav", b"RIFFxxxxWAVE", "audio/wav"),
                                                                                              "cover": ("cover.jpg", buf.getvalue(), "image/jpeg")})
    body = r.json()
    assert by_id(body, "fingerprint")["level"] == "fail" and by_id(body, "cover")["level"] == "pass" and body["verdict"] == "fix"


def test_route_survives_the_fingerprint_service_failing(client, monkeypatch):
    monkeypatch.setattr(acr_identify, "configured", lambda: True)
    monkeypatch.setattr(intel, "_fingerprint_sample", lambda path, dur: b"x")

    async def boom(sample, name="sample"):
        raise acr_identify.AcrError(502, "down")
    monkeypatch.setattr(acr_identify, "identify", boom)
    assert by_id(post(client).json(), "fingerprint")["level"] == "skip"


def test_route_rejects_an_unsupported_file(client):
    r = client.post("/api/intelligence/preflight", data={"title": "T"}, files={"file": ("notes.txt", b"hello", "text/plain")})
    assert r.status_code == 400
