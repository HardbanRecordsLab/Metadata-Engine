from fastapi import APIRouter
from app.config import settings
import httpx

router = APIRouter()


@router.get("/proxy/lastfm/artist")
async def get_lastfm_artist(artist: str):
    params = {
        "method": "artist.getinfo",
        "artist": artist,
        "api_key": settings.LASTFM_API_KEY,
        "format": "json",
    }
    async with httpx.AsyncClient() as client:
        response = await client.get("http://ws.audioscrobbler.com/2.0/", params=params)
    return response.json()

@router.get("/proxy/lastfm/track")
async def get_lastfm_track(artist: str, track: str):
    params = {
        "method": "track.getInfo",
        "artist": artist,
        "track": track,
        "api_key": settings.LASTFM_API_KEY,
        "format": "json",
        "autocorrect": "1"
    }
    async with httpx.AsyncClient() as client:
        response = await client.get("http://ws.audioscrobbler.com/2.0/", params=params)
    return response.json()

@router.get("/proxy/lastfm/similar")
async def get_lastfm_similar(artist: str):
    params = {
        "method": "artist.getSimilar",
        "artist": artist,
        "api_key": settings.LASTFM_API_KEY,
        "format": "json",
        "limit": "5",
        "autocorrect": "1"
    }
    async with httpx.AsyncClient() as client:
        response = await client.get("http://ws.audioscrobbler.com/2.0/", params=params)
    return response.json()
