"""Manage the account's outbound webhook (see services/outbound_webhooks.py and docs/WEBHOOKS.md).

Works with a login token or with the account's API key (X-API-Key), so a pipeline can set itself up."""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import WebhookEndpoint, get_db
from app.dependencies import get_current_user_optional
from app.services import outbound_webhooks as wh

router = APIRouter(prefix="/webhook-endpoint", tags=["webhooks-outbound"])


class EndpointIn(BaseModel):
    url: str


def _user(current_user: Any = Depends(get_current_user_optional)):
    if current_user is None:
        raise HTTPException(status_code=401, detail="Sign in or send your X-API-Key.")
    return current_user


def _public(ep: Optional[WebhookEndpoint]) -> Dict[str, Any]:
    if not ep:
        return {"configured": False, "events": list(wh.EVENTS)}
    return {
        "configured": True, "url": ep.url, "active": bool(ep.is_active), "events": list(wh.EVENTS),
        "last_attempt_at": ep.last_attempt_at.isoformat() + "Z" if ep.last_attempt_at else None,
        "last_status": ep.last_status, "last_error": ep.last_error, "consecutive_failures": ep.consecutive_failures or 0,
    }


def _mine(db: Session, user: Any) -> Optional[WebhookEndpoint]:
    return db.query(WebhookEndpoint).filter(WebhookEndpoint.user_id == str(user.id)).first()


@router.get("")
async def get_endpoint(user: Any = Depends(_user), db: Session = Depends(get_db)):
    return _public(_mine(db, user))


@router.put("")
async def set_endpoint(body: EndpointIn, user: Any = Depends(_user), db: Session = Depends(get_db)):
    """Set or change the URL. The secret is returned ONLY when the endpoint is created; keep it, it is not shown again."""
    try:
        wh.check_url(body.url.strip())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    ep = _mine(db, user)
    out: Dict[str, Any]
    if ep is None:
        ep = WebhookEndpoint(user_id=str(user.id), url=body.url.strip(), secret=wh.new_secret(), is_active=True)
        db.add(ep)
        db.commit()
        out = {**_public(ep), "secret": ep.secret}
    else:
        ep.url = body.url.strip()
        ep.is_active = True
        ep.consecutive_failures = 0
        ep.last_error = None
        db.commit()
        out = _public(ep)
    return out


@router.post("/rotate-secret")
async def rotate_secret(user: Any = Depends(_user), db: Session = Depends(get_db)):
    ep = _mine(db, user)
    if not ep:
        raise HTTPException(status_code=404, detail="No webhook configured.")
    ep.secret = wh.new_secret()
    db.commit()
    return {**_public(ep), "secret": ep.secret}


@router.post("/test")
async def send_test(user: Any = Depends(_user), db: Session = Depends(get_db)):
    """One synchronous test delivery (no retries) so the owner sees at once whether the receiver works."""
    ep = _mine(db, user)
    if not ep:
        raise HTTPException(status_code=404, detail="No webhook configured.")
    import time
    import uuid
    event = {"id": "evt_" + uuid.uuid4().hex, "type": "webhook.test", "created": int(time.time()),
             "data": {"message": "This is a test delivery from Metadata Engine."}}
    status, error = await wh.deliver(ep.id, event, retries=(0.0,))
    return {"delivered": error is None, "status": status, "error": error}


@router.delete("")
async def delete_endpoint(user: Any = Depends(_user), db: Session = Depends(get_db)):
    ep = _mine(db, user)
    if ep:
        db.delete(ep)
        db.commit()
    return {"configured": False}
