from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from datetime import datetime
import os
import logging
import librosa

from app.db import SessionLocal, Job, Certificate, VerificationEvent
from app.dependencies import get_user_and_check_quota, increment_user_quota
from app.utils.hash_generator import generate_file_hash

router = APIRouter(prefix="/certificate", tags=["certificate"])
logger = logging.getLogger(__name__)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _build_upload_path(job: Job) -> str:
    upload_dir = "uploads"
    return os.path.join(upload_dir, f"{job.id}_{job.file_name}")


def _calculate_duration_seconds(file_path: str) -> float:
    try:
        duration = librosa.get_duration(filename=file_path)
        return float(duration)
    except Exception as e:
        logger.error(f"Duration calculation failed for {file_path}: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate audio duration")


@router.post("/generate/{job_id}")
async def generate_certificate(job_id: str, db: Session = Depends(get_db), current_user=Depends(get_user_and_check_quota)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Job must be completed before certificate generation")
    if not isinstance(job.result, dict):
        raise HTTPException(status_code=400, detail="Invalid metadata for this job")

    file_path = _build_upload_path(job)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Source audio file not available for verification")

    sha256_actual = generate_file_hash(file_path)
    sha256_meta = job.result.get("sha256")
    if not sha256_meta:
        job.result["sha256"] = sha256_actual
        db.commit()
    elif sha256_meta.lower() != sha256_actual.lower():
        raise HTTPException(status_code=409, detail="Hash mismatch between stored metadata and audio file")

    duration_actual = _calculate_duration_seconds(file_path)
    duration_meta = float(job.result.get("duration") or 0)
    duration_diff = abs(duration_actual - duration_meta)
    if duration_diff > 1.0:
        job.result["duration"] = round(duration_actual)
        db.commit()

    now = datetime.utcnow()
    year = now.year
    sequence = int(now.timestamp())
    certificate_human_id = f"HRL-{year}-{sequence}"

    verification_status = "verified"

    certificate = Certificate(
        certificate_id=certificate_human_id,
        user_id=current_user.id if current_user else None,
        job_id=job.id,
        file_name=job.file_name,
        sha256=sha256_actual,
        certificate_metadata=job.result,
        verification_status=verification_status,
        price_usd=1,
        created_at=now,
    )

    db.add(certificate)
    db.commit()
    db.refresh(certificate)

    if current_user and getattr(current_user, "id", None):
        try:
            await increment_user_quota(current_user.id)
        except Exception as e:
            logger.error(f"Failed to decrement credits for user {current_user.id}: {e}")

    return {
        "id": certificate.id,
        "certificate_id": certificate.certificate_id,
        "job_id": certificate.job_id,
        "file_name": certificate.file_name,
        "sha256": certificate.sha256,
        "verification_status": certificate.verification_status,
        "price_usd": certificate.price_usd,
        "created_at": certificate.created_at.isoformat() if certificate.created_at else None,
    }


@router.get("/verify/{identifier}")
async def verify_certificate(identifier: str, request: Request, db: Session = Depends(get_db)):
    certificate = (
        db.query(Certificate)
        .filter(
            (Certificate.certificate_id == identifier)
            | (Certificate.sha256 == identifier)
            | (Certificate.id == identifier)
        )
        .first()
    )
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    event = VerificationEvent(
        certificate_id=certificate.id,
        status="viewed",
        client_ip=client_ip,
        user_agent=user_agent,
    )
    db.add(event)
    db.commit()

    data = {
        "certificate_id": certificate.certificate_id,
        "file_name": certificate.file_name,
        "sha256": certificate.sha256,
        "verification_status": certificate.verification_status,
        "metadata": certificate.certificate_metadata or {},
    }

    return data

