"""Engine 3.0 endpoints: QC, smart cutdowns, hearing, sonic similarity, signed passports."""
from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.dependencies import get_user_and_check_quota
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
