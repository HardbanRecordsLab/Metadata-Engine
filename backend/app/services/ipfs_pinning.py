"""Pins a file to IPFS via Pinata. Used to give generated certificates a
decentralized, content-addressed backup independent of our own database."""
import os
import httpx


class IPFSPinningError(Exception):
    pass


async def pin_file_to_ipfs(file_path: str, filename: str) -> dict:
    jwt = os.getenv("PINATA_JWT")
    if not jwt:
        raise IPFSPinningError("PINATA_JWT not configured on server")

    gateway = os.getenv("PINATA_GATEWAY", "gateway.pinata.cloud")

    async with httpx.AsyncClient(timeout=30.0) as client:
        with open(file_path, "rb") as f:
            files = {"file": (filename, f, "application/pdf")}
            data = {
                "pinataMetadata": '{"name": "%s"}' % filename,
                "pinataOptions": '{"cidVersion": 1}',
            }
            try:
                response = await client.post(
                    "https://api.pinata.cloud/pinning/pinFileToIPFS",
                    headers={"Authorization": f"Bearer {jwt}"},
                    files=files,
                    data=data,
                )
            except httpx.HTTPError as e:
                raise IPFSPinningError(f"IPFS upload failed: {e}") from e

    if response.status_code != 200:
        raise IPFSPinningError(f"Pinata API error: {response.text}")

    ipfs_hash = response.json().get("IpfsHash")
    if not ipfs_hash:
        raise IPFSPinningError("Pinata response missing IpfsHash")

    return {
        "ipfs_hash": ipfs_hash,
        "ipfs_url": f"https://{gateway}/ipfs/{ipfs_hash}",
    }
