from fastapi import APIRouter, Request
from app.config import settings
import httpx

router = APIRouter()


@router.post("/proxy/audd")
async def proxy_audd(request: Request):
    body = await request.json()
    data = {"api_token": settings.AUDD_API_TOKEN, **body}
    async with httpx.AsyncClient() as client:
        response = await client.post("https://api.audd.io/", data=data)
    return response.json()
