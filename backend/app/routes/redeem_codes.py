import secrets
import string

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db, User, RedeemCode, RedeemedCode
from app.routes.auth import get_current_user
from app.routes.system import require_superuser

router = APIRouter(tags=["redeem-codes"])


class RedeemRequest(BaseModel):
    code: str


@router.post("/quota/redeem")
async def redeem_code(
    payload: RedeemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    code_str = (payload.code or "").strip().upper()
    if not code_str:
        return JSONResponse(status_code=400, content={"error": "Enter a code."})

    entry = db.query(RedeemCode).filter(RedeemCode.code == code_str).first()
    if not entry or not entry.is_active:
        return JSONResponse(status_code=404, content={"error": "Invalid or inactive code."})

    if entry.used_count >= entry.max_uses:
        return JSONResponse(status_code=400, content={"error": "This code has reached its usage limit."})

    already_used = (
        db.query(RedeemedCode)
        .filter(RedeemedCode.user_id == current_user.id, RedeemedCode.redeem_code_id == entry.id)
        .first()
    )
    if already_used:
        return JSONResponse(status_code=400, content={"error": "You've already redeemed this code."})

    current_user.credits = (current_user.credits or 0) + entry.credits
    entry.used_count += 1
    db.add(RedeemedCode(user_id=current_user.id, redeem_code_id=entry.id))
    db.commit()

    return {"message": f"Success! {entry.credits} credits added to your account.", "credits": current_user.credits}


# ── Admin: create/list codes ────────────────────────────────────────────────

class CreateRedeemCodeRequest(BaseModel):
    code: str | None = None
    credits: int
    max_uses: int = 1


def _generate_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "HRL-" + "".join(secrets.choice(alphabet) for _ in range(8))


@router.post("/admin/redeem-codes")
async def create_redeem_code(
    payload: CreateRedeemCodeRequest,
    current_user: User = Depends(require_superuser),
    db: Session = Depends(get_db),
):
    if payload.credits <= 0:
        return JSONResponse(status_code=400, content={"error": "credits must be positive."})
    if payload.max_uses <= 0:
        return JSONResponse(status_code=400, content={"error": "max_uses must be positive."})

    code_str = (payload.code or "").strip().upper() or _generate_code()

    if db.query(RedeemCode).filter(RedeemCode.code == code_str).first():
        return JSONResponse(status_code=409, content={"error": f"Code '{code_str}' already exists."})

    entry = RedeemCode(code=code_str, credits=payload.credits, max_uses=payload.max_uses)
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return {
        "id": entry.id,
        "code": entry.code,
        "credits": entry.credits,
        "max_uses": entry.max_uses,
        "used_count": entry.used_count,
        "is_active": entry.is_active,
    }


@router.get("/admin/redeem-codes")
async def list_redeem_codes(
    current_user: User = Depends(require_superuser),
    db: Session = Depends(get_db),
):
    codes = db.query(RedeemCode).order_by(RedeemCode.created_at.desc()).all()
    return {
        "items": [
            {
                "id": c.id,
                "code": c.code,
                "credits": c.credits,
                "max_uses": c.max_uses,
                "used_count": c.used_count,
                "is_active": c.is_active,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in codes
        ]
    }
