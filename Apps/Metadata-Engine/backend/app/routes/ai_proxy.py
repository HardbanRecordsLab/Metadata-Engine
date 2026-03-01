from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional
import httpx
import json
import logging

from app.config import settings
from app.dependencies import get_user_and_check_quota

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Proxy"])

class ProxyRequest(BaseModel):
    provider: str
    payload: Dict[str, Any]

@router.post("/proxy", dependencies=[Depends(get_user_and_check_quota)])
async def ai_proxy(request: ProxyRequest):
    """
    Unified AI Proxy endpoint. 
    Routes requests to various providers using backend-held API keys.
    """
    provider = request.provider.lower()
    payload = request.payload

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            if provider == "gemini":
                if not settings.GEMINI_API_KEY:
                    raise HTTPException(status_code=500, detail="Gemini API key not configured")
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
                response = await client.post(url, json=payload)
            elif provider == "groq_refine":
                if not settings.GROQ_API_KEY:
                    raise HTTPException(status_code=500, detail="Groq API key not configured")
                url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                response = await client.post(url, json=payload, headers=headers)
            elif provider == "spotify":
                from app.routes.spotify import get_spotify_access_token
                token = await get_spotify_access_token()
                
                type = payload.get("type")
                if type == "search":
                    query = payload.get("query")
                    url = "https://api.spotify.com/v1/search"
                    params = {"q": query, "type": "track", "limit": 1}
                    response = await client.get(url, headers={"Authorization": f"Bearer {token}"}, params=params)
                elif type == "features":
                    track_id = payload.get("trackId")
                    url = f"https://api.spotify.com/v1/audio-features/{track_id}"
                    response = await client.get(url, headers={"Authorization": f"Bearer {token}"})
                else:
                    raise HTTPException(status_code=400, detail=f"Invalid spotify type: {type}")
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

            if not response.is_success:
                logger.error(f"AI Proxy Error ({provider}): {response.status_code} - {response.text}")
                raise HTTPException(status_code=response.status_code, detail=f"Provider error: {response.text}")

            return response.json()

        except Exception as e:
            logger.error(f"AI Proxy Exception ({provider}): {str(e)}")
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f"Internal Proxy Error: {str(e)}")
