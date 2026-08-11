"""Server-side proxy for ACRCloud audio identification.

The frontend used to sign ACRCloud requests in the browser with
VITE_ACR_ACCESS_SECRET, which Vite inlines into the public JS bundle at
build time — any visitor could read it via view-source. ACR_ACCESS_KEY/
ACR_ACCESS_SECRET/ACR_HOST already existed as backend-only config (unused
until now), matching every other third-party integration in this app
(Spotify, Last.fm, Discogs, Gemini), which are all proxied server-side.
"""
import base64
import hashlib
import hmac
import time

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import settings

router = APIRouter(prefix="/acr", tags=["acr"])

# ACRCloud only needs a short sample to identify a track; capping this
# keeps upload size and signing cost bounded.
SAMPLE_SIZE_BYTES = 1 * 1024 * 1024


@router.post("/identify")
async def identify_track(file: UploadFile = File(...)):
    if not (settings.ACR_HOST and settings.ACR_ACCESS_KEY and settings.ACR_ACCESS_SECRET):
        raise HTTPException(status_code=503, detail="ACRCloud is not configured on the server.")

    sample = await file.read(SAMPLE_SIZE_BYTES)
    if not sample:
        raise HTTPException(status_code=400, detail="Empty file.")

    method = "POST"
    uri = "/v1/identify"
    data_type = "audio"
    signature_version = "1"
    timestamp = str(int(time.time()))

    string_to_sign = "\n".join(
        [method, uri, settings.ACR_ACCESS_KEY, signature_version, timestamp]
    )
    signature = base64.b64encode(
        hmac.new(
            settings.ACR_ACCESS_SECRET.encode("utf-8"),
            string_to_sign.encode("utf-8"),
            hashlib.sha1,
        ).digest()
    ).decode("utf-8")

    host = settings.ACR_HOST
    protocol_host = host if host.startswith("http") else f"https://{host}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{protocol_host}{uri}",
                data={
                    "access_key": settings.ACR_ACCESS_KEY,
                    "data_type": data_type,
                    "signature_version": signature_version,
                    "signature": signature,
                    "timestamp": timestamp,
                },
                files={"sample": (file.filename or "sample", sample)},
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ACRCloud request failed: {e}") from e

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"ACRCloud API error: {response.text[:300]}")

    return response.json()
