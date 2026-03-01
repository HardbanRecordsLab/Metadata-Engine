import os
import json
import requests
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

router = APIRouter(prefix="/integrations/pinata", tags=["pinata"])

class PinContent(BaseModel):
    content: str
    filename: str

@router.post("/pin")
async def pin_to_ipfs(payload: PinContent):
    jwt = os.getenv("PINATA_JWT")
    if not jwt:
        raise HTTPException(status_code=500, detail="PINATA_JWT not configured on server")

    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
    headers = {
        "Authorization": f"Bearer {jwt}",
        "Content-Type": "application/json"
    }
    
    body = {
        "pinataContent": {
            "certificate_text": payload.content,
            "filename": payload.filename,
            "type": "Digital Footprint Certificate",
            "generator": "Music Metadata Engine"
        },
        "pinataMetadata": {
            "name": payload.filename
        }
    }

    try:
        response = requests.post(url, json=body, headers=headers)
        response.raise_for_status()
        return {
            "ipfsHash": response.json().get("IpfsHash"),
            "status": "pinned"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pin-file")
async def pin_file_to_ipfs(
    file: UploadFile = File(...),
    name: str = Form(None)
):
    jwt = os.getenv("PINATA_JWT")
    if not jwt:
        raise HTTPException(status_code=500, detail="PINATA_JWT not configured on server")

    url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    headers = {
        "Authorization": f"Bearer {jwt}"
    }
    
    filename = name or file.filename
    
    files = {
        'file': (filename, file.file, file.content_type)
    }
    
    # Optional metadata
    payload = {
        'pinataMetadata': json.dumps({'name': filename}),
        'pinataOptions': json.dumps({'cidVersion': 1})
    }

    try:
        response = requests.post(url, files=files, headers=headers, data=payload)
        response.raise_for_status()
        return {
            "ipfsHash": response.json().get("IpfsHash"),
            "status": "pinned",
            "url": f"https://gateway.pinata.cloud/ipfs/{response.json().get('IpfsHash')}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
