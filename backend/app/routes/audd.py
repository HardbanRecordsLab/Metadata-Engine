from fastapi import APIRouter, HTTPException, Request
from app.config import settings
import httpx

router = APIRouter()


@router.post("/proxy/audd")
async def proxy_audd(request: Request):
    if not settings.AUDD_API_TOKEN:
        raise HTTPException(status_code=500, detail="AudD API token not configured.")
    body = await request.json()
    data = {"api_token": settings.AUDD_API_TOKEN, **body}
    async with httpx.AsyncClient() as client:
        response = await client.post("https://api.audd.io/", data=data)
    return response.json()
