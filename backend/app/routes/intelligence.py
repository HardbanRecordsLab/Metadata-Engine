"""Engine 3.0 endpoints: QC, smart cutdowns, hearing, sonic similarity, signed passports."""
from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.db import get_db
from app.dependencies import get_user_and_check_quota
from app.rate_limit import limiter
from app.services import cutdowns, hearing, passport, qc

router = APIRouter(prefix="/intelligence", tags=["intelligence"])
ALLOWED = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}
MAX_BYTES = 200 * 1024 * 1024


@contextmanager
def _spooled(upload: UploadFile):
    ext = os.path.splitext(upload.filename or "")[1].lower()
    if ext not in ALLOWED:
        raise HTTPException(400, f"Unsupported file type: {ext or 'none'}")
    d = tempfile.mkdtemp(prefix="intel_")
    path = os.path.join(d, "audio" + ext)
    try:
        written = 0
        with open(path, "wb") as f:
            while chunk := upload.file.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_BYTES:
                    raise HTTPException(413, "File too large (limit 200 MB)")
                f.write(chunk)
        yield path
    finally:
        shutil.rmtree(d, ignore_errors=True)


async def _off_loop(fn, *a):
    return await asyncio.get_running_loop().run_in_executor(None, fn, *a)


@router.post("/qc")
async def technical_qc(file: UploadFile = File(...), user=Depends(get_user_and_check_quota)) -> Dict[str, Any]:
    """Loudness (LUFS / true peak), clipping, lossy-origin test, head/tail silence, ending style, sync-readiness score."""
    with _spooled(file) as path:
        return await _off_loop(qc.analyze_file, path)


def _fingerprint_sample(path: str, duration: float) -> bytes:
    """15 s from the middle of the track as a small mono MP3: enough for ACRCloud, cheap to upload."""
    import subprocess
    start = max(0.0, duration / 2 - 7.5) if duration else 0.0
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{start:.2f}", "-t", "15", "-i", path, "-vn", "-ac", "1", "-ar", "22050",
                        "-b:a", "96k", "-f", "mp3", "-"], capture_output=True, timeout=120)
    return r.stdout if r.returncode == 0 else b""


def _sha256_file(path: str) -> str:
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _read_cover(data: bytes) -> Optional[Dict[str, Any]]:
    try:
        import io
        from PIL import Image
        with Image.open(io.BytesIO(data)) as im:
            return {"width": im.width, "height": im.height, "format": im.format, "bytes": len(data)}
    except Exception:  # noqa: BLE001 - not an image
        return {"width": 0, "height": 0, "format": None, "bytes": len(data)}


@router.post("/preflight")
@limiter.limit("20/hour")
async def release_preflight(request: Request, file: UploadFile = File(...), title: str = Form(""), artist: str = Form(""), isrc: str = Form(""),
                            upc: str = Form(""), composer: str = Form(""), cover: Optional[UploadFile] = File(None),
                            user=Depends(get_user_and_check_quota), db=Depends(get_db)) -> Dict[str, Any]:
    """"Will a distributor reject this?": technical QC, an audio-fingerprint check against existing recordings (ACRCloud), the metadata
    you typed, a duplicate check against your own analyses and, if you send it, the cover image - one checklist with a verdict."""
    from app.db import AnalysisHistory
    from app.services import acr_identify, release_preflight as rp
    with _spooled(file) as path:
        qc_report = await _off_loop(qc.analyze_file, path)
        sha = await _off_loop(_sha256_file, path)
        fp, fp_checked = None, False
        if acr_identify.configured():
            sample = await _off_loop(_fingerprint_sample, path, qc_report.get("duration_s") or 0)
            if sample:
                try:
                    fp, fp_checked = await acr_identify.identify(sample, "sample.mp3"), True
                except acr_identify.AcrError:
                    fp, fp_checked = None, False
    own: List[Dict[str, Any]] = []
    uid = getattr(user, "id", None)
    if uid:
        for h in db.query(AnalysisHistory).filter(AnalysisHistory.user_id == str(uid), AnalysisHistory.file_hash == sha).limit(5).all():
            r = h.metadata_json or h.result or {}
            own.append({"title": (r.get("title") if isinstance(r, dict) else None), "file_name": h.file_name})
    cover_info = None
    if cover is not None and cover.filename:
        data = await cover.read(15 * 1024 * 1024 + 1)
        if len(data) > 15 * 1024 * 1024:
            raise HTTPException(413, "Cover image too large (limit 15 MB)")
        cover_info = _read_cover(data)
    meta = {"title": title, "artist": artist, "isrc": isrc, "upc": upc, "composer": composer}
    out = rp.evaluate(qc_report, meta, fp, fp_checked, own, cover_info, cover_given=cover_info is not None)
    out["audio"] = {"sha256": sha, "durationSeconds": qc_report.get("duration_s")}
    return out


@router.post("/cutdowns")
async def plan_cutdowns(file: UploadFile = File(...), targets: str = Form("15,30,60"), user=Depends(get_user_and_check_quota)) -> Dict[str, Any]:
    """Bar/phrase-aligned 15/30/60 s edit proposals (an 'intro' cut and a 'hook' cut per length)."""
    try:
        wanted = sorted({int(t) for t in targets.split(",") if t.strip()})
    except ValueError:
        raise HTTPException(400, "targets must be comma-separated seconds, e.g. 15,30,60")
    if not wanted or any(t < 5 or t > 180 for t in wanted):
        raise HTTPException(400, "each target must be 5-180 seconds")
    with _spooled(file) as path:
        return await _off_loop(cutdowns.plan_file, path, wanted)


@router.post("/cutdowns/render")
async def render_cutdown(file: UploadFile = File(...), start: float = Form(...), end: float = Form(...), fade_out: float = Form(1.0),
                         format: str = Form("mp3"), user=Depends(get_user_and_check_quota)):
    """Render one proposed cut (start/end from /cutdowns) with a 20 ms fade-in and a musical fade-out."""
    if not (0 <= start < end) or end - start > 300 or format not in ("mp3", "wav"):
        raise HTTPException(400, "invalid cut")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED:
        raise HTTPException(400, f"Unsupported file type: {ext or 'none'}")
    d = tempfile.mkdtemp(prefix="cut_")
    src, out = os.path.join(d, "src" + ext), os.path.join(d, f"cutdown.{format}")
    with open(src, "wb") as f:
        shutil.copyfileobj(file.file, f)
    try:
        await _off_loop(cutdowns.render, src, start, end, max(0.0, min(fade_out, 8.0)), out)
    except Exception:
        shutil.rmtree(d, ignore_errors=True)
        raise HTTPException(500, "render failed")
    return FileResponse(out, media_type="audio/mpeg" if format == "mp3" else "audio/wav", filename=f"cutdown_{int(end - start)}s.{format}",
                        background=BackgroundTask(shutil.rmtree, d, True))


@router.post("/hear")
async def hear(file: UploadFile = File(...), vector: bool = Form(False), user=Depends(get_user_and_check_quota)) -> Dict[str, Any]:
    """What the audio model hears: genre / mood / instruments / singer verdict (+ optional 512-d sonic vector)."""
    with _spooled(file) as path:
        res = await _off_loop(hearing.listen, path)
    if not res:
        raise HTTPException(503, "Hearing model unavailable")
    if not vector:
        res.pop("sonicVector", None)
    return res


@router.post("/similar")
async def similar(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Rank candidates by audio similarity. Body: {"vector": b64, "candidates": [{"id": ..., "vector": b64}], "top": 10}.
    Vectors come from the analysis result (``sonicVector``). Cosine >= 0.97 usually means the same recording / another master."""
    try:
        q = hearing.unpack_vector(payload["vector"])
        cands = payload["candidates"]
    except (KeyError, ValueError, TypeError):
        raise HTTPException(400, "vector and candidates are required")
    if len(cands) > 20000:
        raise HTTPException(413, "too many candidates")
    scored: List[Dict[str, Any]] = []
    for c in cands:
        try:
            s = hearing.cosine(q, hearing.unpack_vector(c["vector"]))
        except (KeyError, ValueError, TypeError):
            continue
        scored.append({"id": c.get("id"), "similarity": round(s, 4), "likelyDuplicate": s >= 0.97})
    scored.sort(key=lambda x: -x["similarity"])
    return {"results": scored[: int(payload.get("top", 10))]}


@router.get("/passport/public-key")
async def passport_public_key() -> Dict[str, Any]:
    return {"alg": "Ed25519", "publicKey": passport.public_key_b64(), "keyId": passport.key_id(),
            "engine": passport.ENGINE_NAME, "version": passport.ENGINE_VERSION}


@router.post("/passport/verify")
async def passport_verify(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Body: the ``passport`` object from an analysis result (optional ``publicKey`` to verify against another engine's key)."""
    p = payload.get("passport", payload)
    if not isinstance(p, dict) or "payload" not in p:
        raise HTTPException(400, "passport object expected")
    return passport.verify_passport(p, payload.get("publicKey"))


@router.post("/passport/timestamp")
@limiter.limit("30/hour")
async def passport_timestamp(request: Request, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Put a public, Bitcoin-anchored timestamp on a passport this engine issued (OpenTimestamps). Body: ``{"passport": {...}}``.

    Only the SHA-256 of the signed passport is sent to the public calendars. The returned `.ots` files are PENDING until upgraded
    with the official client (see the ``next`` field)."""
    p = payload.get("passport", payload)
    if not isinstance(p, dict) or "payload" not in p:
        raise HTTPException(400, "passport object expected")
    if not passport.verify_passport(p).get("valid"):
        raise HTTPException(400, "only a valid passport issued by this engine can be timestamped")
    from app.services import ots_stamp
    return await ots_stamp.submit(p)


@router.post("/passport/timestamp/check")
async def passport_timestamp_check(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Does this `.ots` file belong to this passport? Body: ``{"passport": {...}, "ots_b64": "..."}``. (Bitcoin confirmation is checked
    with the official client: `ots verify`.)"""
    import base64
    from app.services import ots_stamp
    p = payload.get("passport")
    if not isinstance(p, dict) or "payload" not in p:
        raise HTTPException(400, "passport object expected")
    try:
        raw = base64.b64decode(payload.get("ots_b64") or "", validate=True)
    except ValueError:
        raise HTTPException(400, "ots_b64 is not valid base64")
    got = ots_stamp.ots_digest(raw)
    if got is None:
        return {"matches": False, "reason": "not an OpenTimestamps file"}
    want = ots_stamp.passport_digest(p)
    return {"matches": got == want, "digest": want.hex(), "passportValid": bool(passport.verify_passport(p).get("valid"))}


@router.post("/embed-text")
@limiter.limit("120/minute")
async def embed_text(request: Request, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Free text -> CLAP vectors in the same space as a track's ``sonicVector``: cosine ranks tracks by how they SOUND.
    Body: {"queries": ["dark driving techno for a chase scene", ...]} (max 8, 300 chars each). Public + rate-limited:
    it carries no user data and costs ~50 ms."""
    qs = payload.get("queries")
    if not isinstance(qs, list) or not qs or len(qs) > 8 or not all(isinstance(q, str) and q.strip() for q in qs):
        raise HTTPException(400, "queries: 1-8 non-empty strings")
    vecs = await _off_loop(hearing.embed_text, qs)
    if vecs is None:
        raise HTTPException(503, "Hearing model unavailable")
    return {"model": hearing.MODEL_NAME, "vectors": [hearing.pack_vector(v) for v in vecs]}


@router.post("/semantic-search")
@limiter.limit("60/minute")
async def semantic_search(request: Request, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Body: {"query": "...", "candidates": [{"id", "vector"}], "top": 20}. Convenience wrapper: embed + cosine rank."""
    q = payload.get("query")
    cands = payload.get("candidates")
    if not isinstance(q, str) or not q.strip() or not isinstance(cands, list) or len(cands) > 20000:
        raise HTTPException(400, "query and candidates (<= 20000) are required")
    vecs = await _off_loop(hearing.embed_text, [q])
    if vecs is None:
        raise HTTPException(503, "Hearing model unavailable")
    return {"results": hearing.semantic_rank(vecs[0], cands, int(payload.get("top", 20)))}


@router.post("/profile")
async def catalog_profile(file: UploadFile = File(...), user=Depends(get_user_and_check_quota)) -> Dict[str, Any]:
    """Fast profile (hearing + tempo consensus, no LLM): seconds per track - for catalogue back-fills."""
    from app.services import catalog_profile as cp

    with _spooled(file) as path:
        return await _off_loop(cp.profile_file, path)
