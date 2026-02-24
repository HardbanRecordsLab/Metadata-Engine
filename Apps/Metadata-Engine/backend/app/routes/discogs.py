from fastapi import APIRouter
from app.config import settings
import httpx

router = APIRouter()


@router.get("/proxy/discogs/release")
async def get_discogs_release(release_id: str):
    headers = {
        "Authorization": f"Discogs key={settings.DISCOGS_CONSUMER_KEY}, secret={settings.DISCOGS_CONSUMER_SECRET}",
        "User-Agent": "MusicMetadataEngine/1.3"
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.discogs.com/releases/{release_id}", headers=headers
        )
    return response.json()

@router.get("/proxy/discogs/search")
async def search_discogs(q: str):
    headers = {
        "Authorization": f"Discogs key={settings.DISCOGS_CONSUMER_KEY}, secret={settings.DISCOGS_CONSUMER_SECRET}",
        "User-Agent": "MusicMetadataEngine/1.3"
    }
    params = {
        "q": q,
        "type": "release",
        "per_page": 1
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.discogs.com/database/search", headers=headers, params=params
        )
    return response.json()
