import httpx
import logging
import json
from app.config import settings

logger = logging.getLogger(__name__)

async def upload_json_to_pinata(data: dict, filename: str) -> dict:
    """
    Uploads a JSON object to Pinata (IPFS).
    
    Args:
        data: The JSON dictionary to upload (e.g., certificate metadata).
        filename: A name for the file in Pinata IPFS.
        
    Returns:
        dict: containing 'ipfs_hash', 'ipfs_url', and 'pin_size'.
    """
    if not settings.PINATA_JWT:
        logger.error("PINATA_JWT is missing from configuration.")
        raise ValueError("Pinata is not configured (missing JWT).")

    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
    
    headers = {
        "Authorization": f"Bearer {settings.PINATA_JWT}",
        "Content-Type": "application/json"
    }
    
    body = {
        "pinataContent": data,
        "pinataMetadata": {
            "name": filename
        },
        "pinataOptions": {
            "cidVersion": 1
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=body, headers=headers, timeout=30.0)
            
            if response.status_code == 200:
                result = response.json()
                ipfs_hash = result["IpfsHash"]
                # Use dedicated gateway if available, or public
                gateway = settings.PINATA_GATEWAY or "gateway.pinata.cloud"
                ipfs_url = f"https://{gateway}/ipfs/{ipfs_hash}"
                
                logger.info(f"Successfully pinned JSON to Pinata: {ipfs_hash}")
                return {
                    "ipfs_hash": ipfs_hash,
                    "ipfs_url": ipfs_url,
                    "pin_size": result.get("PinSize", 0)
                }
            else:
                logger.error(f"Pinata API Error ({response.status_code}): {response.text}")
                raise Exception(f"Pinata Upload Failed: {response.text}")
                
    except Exception as e:
        logger.error(f"Pinata connection failed: {e}")
        raise
