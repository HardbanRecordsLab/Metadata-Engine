from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.config import settings
import httpx
import time

router = APIRouter()

# In-memory cache for the access token
token_cache = {"access_token": None, "expires_at": 0}


class SpotifySearchQuery(BaseModel):
    query: str


async def get_spotify_access_token():
    """
    Retrieves a Spotify access token, caching it and refreshing if necessary.
    """
    if token_cache["access_token"] and time.time() < token_cache["expires_at"]:
        return token_cache["access_token"]

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://accounts.spotify.com/api/token",
            data={
                "grant_type": "client_credentials",
                "client_id": settings.SPOTIFY_CLIENT_ID,
                "client_secret": settings.SPOTIFY_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail="Failed to authenticate with Spotify",
            )

        token_data = response.json()
        token_cache["access_token"] = token_data["access_token"]
        # Set expiry a bit earlier to be safe
        token_cache["expires_at"] = time.time() + token_data["expires_in"] - 60
        return token_cache["access_token"]


@router.post("/spotify/search")
async def search_spotify(
    query: SpotifySearchQuery, token: str = Depends(get_spotify_access_token)
):
    """
    Proxies a search request to the Spotify API.
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.spotify.com/v1/search?q={query.query}&type=track&limit=1",
            headers={"Authorization": f"Bearer {token}"},
        )

    if response.status_code != 200:
        return HTTPException(status_code=response.status_code, detail=response.text)

    return response.json()


@router.get("/spotify/audio-features/{track_id}")
async def get_audio_features(
    track_id: str, token: str = Depends(get_spotify_access_token)
):
    """
    Proxies a request for a track's audio features to the Spotify API.
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.spotify.com/v1/audio-features/{track_id}",
            headers={"Authorization": f"Bearer {token}"},
        )

    if response.status_code != 200:
        return HTTPException(status_code=response.status_code, detail=response.text)

    return response.json()
