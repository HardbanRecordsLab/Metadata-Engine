from fastapi import APIRouter, Request
from app.config import settings
import httpx

router = APIRouter()


@router.post("/proxy/gemini")
async def proxy_gemini(request: Request):
    body = await request.json()
    headers = {"Authorization": f"Bearer {settings.GEMINI_API_KEY}"}
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
            json=body,
            headers=headers,
        )
    return response.json()
