"""ACRCloud audio identification, shared by the /acr proxy route and the release preflight."""
import base64
import hashlib
import hmac
import time
from typing import Any, Dict

import httpx

from app.config import settings


class AcrError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def configured() -> bool:
    return bool(settings.ACR_HOST and settings.ACR_ACCESS_KEY and settings.ACR_ACCESS_SECRET)


async def identify(sample: bytes, filename: str = "sample") -> Dict[str, Any]:
    """Identify a short audio sample (about 10-15 s is enough). Raises AcrError (503 not configured, 502 service trouble)."""
    if not configured():
        raise AcrError(503, "ACRCloud is not configured on the server.")
    if not sample:
        raise AcrError(400, "Empty file.")
    method, uri, data_type, signature_version = "POST", "/v1/identify", "audio", "1"
    timestamp = str(int(time.time()))
    string_to_sign = "\n".join([method, uri, settings.ACR_ACCESS_KEY, signature_version, timestamp])
    signature = base64.b64encode(hmac.new(settings.ACR_ACCESS_SECRET.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha1).digest()).decode("utf-8")
    host = settings.ACR_HOST
    protocol_host = host if host.startswith("http") else f"https://{host}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{protocol_host}{uri}",
                data={"access_key": settings.ACR_ACCESS_KEY, "data_type": data_type, "signature_version": signature_version,
                      "signature": signature, "timestamp": timestamp},
                files={"sample": (filename or "sample", sample)},
            )
        except httpx.HTTPError as e:
            raise AcrError(502, f"ACRCloud request failed: {e}") from e
    if response.status_code != 200:
        raise AcrError(502, f"ACRCloud API error: {response.text[:300]}")
    return response.json()
