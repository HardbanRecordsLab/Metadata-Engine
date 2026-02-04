from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional
import httpx
import os
from datetime import datetime
from app.config import settings

router = APIRouter()

class MetadataPayload(BaseModel):
    title: Optional[str] = "Untitled"
    artist: Optional[str] = "Unknown Artist"
    album: Optional[str] = "Single"
    year: Optional[str] = None
    isrc: Optional[str] = "Not Assigned"
    copyright: Optional[str] = None
    pLine: Optional[str] = None
    publisher: Optional[str] = "Independent"
    mainGenre: Optional[str] = "Unknown"
    duration: Optional[float] = 0.0
    fileOwner: Optional[str] = None
    license: Optional[str] = "All Rights Reserved"

class IPFSRequest(BaseModel):
    metadata: MetadataPayload
    audioHash: str
    userId: Optional[str] = None

@router.post("/certify-ipfs")
async def certify_ipfs(payload: IPFSRequest):
    PINATA_JWT = os.getenv("PINATA_JWT")
    PINATA_GATEWAY = os.getenv("PINATA_GATEWAY", "gateway.pinata.cloud")
    APP_URL = os.getenv("VITE_APP_URL", "https://music-metadata.vercel.app")

    if not PINATA_JWT:
        raise HTTPException(status_code=500, detail="PINATA_JWT environment variable is missing on the server.")

    if not payload.audioHash:
        raise HTTPException(status_code=400, detail="Missing audioHash")

    # Construct Certificate Payload
    certificate_content = {
        "protocol": "Music Metadata Engine Proof v1.0",
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": payload.userId,
        "audio_fingerprint_sha256": payload.audioHash,
        "metadata": payload.metadata.dict(),
        "issuer": "HardbanRecords Lab",
        "verification_url": f"{APP_URL}/verify/{payload.audioHash}"
    }

    pinata_payload = {
        "pinataContent": certificate_content,
        "pinataMetadata": {
            "name": f"Certificate-{payload.audioHash[:16]}.json"
        }
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.pinata.cloud/pinning/pinJSONToIPFS",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {PINATA_JWT}"
                },
                json=pinata_payload,
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"Pinata API Error: {response.text}")

            data = response.json()
            cid = data.get("IpfsHash")
            
            return {
                "success": True,
                "cid": cid,
                "timestamp": data.get("Timestamp"),
                "gateway_url": f"https://{PINATA_GATEWAY}/ipfs/{cid}"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"IPFS Upload Failed: {str(e)}")

@router.get("/ipfs-status")
async def ipfs_status():
    return {"status": "IPFS Service Operational", "version": "2.0"}
