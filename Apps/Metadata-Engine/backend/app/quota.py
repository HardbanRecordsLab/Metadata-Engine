import time
from fastapi import HTTPException, status
from typing import Dict

# Simple in-memory quota store (replace with Redis or DB in production)
user_quota: Dict[str, Dict[str, int]] = {}
QUOTA_LIMIT = 100  # Example: 100 requests per day
QUOTA_RESET = 24 * 60 * 60  # 24 hours


def check_quota(user: str):
    now = int(time.time())
    quota = user_quota.get(user)
    if not quota or now - quota["reset"] > QUOTA_RESET:
        user_quota[user] = {"count": 1, "reset": now}
        return True
    if quota["count"] >= QUOTA_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="API quota exceeded"
        )
    user_quota[user]["count"] += 1
    return True
