from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any
from app.db import get_db, AnalysisHistory
from app.routes.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/history", tags=["history"])


# Pydantic model for the request body
class HistoryCreate(BaseModel):
    file_name: str
    result: Dict[str, Any]


@router.post("/", response_model=None)  # Response model can be defined if needed
async def add_history(
    history_data: HistoryCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """
    Adds a new analysis record for the currently authenticated user.
    """
    history_entry = AnalysisHistory(
        user_id=current_user.id,
        file_name=history_data.file_name,
        result=history_data.result,
        created_at=datetime.utcnow(),
    )
    db.add(history_entry)
    db.commit()
    db.refresh(history_entry)
    return history_entry


@router.get("/", response_model=List[Dict[str, Any]])
async def get_history(
    db: Session = Depends(get_db), current_user: Any = Depends(get_current_user)
):
    """
    Retrieves all analysis records for the currently authenticated user.
    """
    history_records = (
        db.query(AnalysisHistory)
        .filter(AnalysisHistory.user_id == current_user.id)
        .order_by(AnalysisHistory.created_at.desc())
        .all()
    )
    return history_records
