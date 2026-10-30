"""Server-side proxy for ACRCloud audio identification.

The frontend used to sign ACRCloud requests in the browser with
VITE_ACR_ACCESS_SECRET, which Vite inlines into the public JS bundle at
build time — any visitor could read it via view-source. ACR_ACCESS_KEY/
ACR_ACCESS_SECRET/ACR_HOST already existed as backend-only config (unused
until now), matching every other third-party integration in this app
(Spotify, Last.fm, Discogs, Gemini), which are all proxied server-side.
"""
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services import acr_identify

router = APIRouter(prefix="/acr", tags=["acr"])

# ACRCloud only needs a short sample to identify a track; capping this
# keeps upload size and signing cost bounded.
SAMPLE_SIZE_BYTES = 1 * 1024 * 1024


@router.post("/identify")
async def identify_track(file: UploadFile = File(...)):
    if not acr_identify.configured():
        raise HTTPException(status_code=503, detail="ACRCloud is not configured on the server.")
    sample = await file.read(SAMPLE_SIZE_BYTES)
    if not sample:
        raise HTTPException(status_code=400, detail="Empty file.")
    try:
        return await acr_identify.identify(sample, file.filename or "sample")
    except acr_identify.AcrError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e
