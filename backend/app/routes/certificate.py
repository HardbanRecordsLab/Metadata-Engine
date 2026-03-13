from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
import os
import logging
import librosa
import secrets

from app.db import SessionLocal, Job, Certificate, VerificationEvent
from app.dependencies import get_user_and_check_quota
from app.utils.hash_generator import generate_file_hash
from app.services.certificate_pdf import generate_certificate_pdf, CERT_DIR

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
async def generate_certificate(
    job_id: str,
    save: bool = Query(True, description="If true, persist certificate to DB and disk; if false, preview only"),
    db: Session = Depends(get_db),
    current_user=Depends(get_user_and_check_quota),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Job must be completed before certificate generation")
    if not isinstance(job.result, dict):
        raise HTTPException(status_code=400, detail="Invalid metadata for this job")

    file_path = _build_upload_path(job)
    file_exists = os.path.exists(file_path)

    sha256_meta = (job.result or {}).get("sha256")
    if file_exists:
        sha256_actual = generate_file_hash(file_path)
        if not sha256_meta:
            job.result["sha256"] = sha256_actual
            db.commit()
        elif sha256_meta.lower() != sha256_actual.lower():
            raise HTTPException(status_code=409, detail="Hash mismatch between stored metadata and audio file")
    else:
        if not sha256_meta:
            raise HTTPException(status_code=404, detail="Audio file missing and no stored SHA-256 found")
        sha256_actual = sha256_meta

    if file_exists:
        try:
            duration_actual = _calculate_duration_seconds(file_path)
            duration_meta = float(job.result.get("duration") or 0)
            duration_diff = abs(duration_actual - duration_meta)
            if duration_diff > 1.0:
                job.result["duration"] = round(duration_actual)
                db.commit()
        except Exception:
            pass

    now = datetime.utcnow()
    year = now.year
    sequence = int(now.timestamp())
    certificate_human_id = f"HRL-{year}-{sequence}"

    verification_status = "verified"

    verify_url: str
    if not save:
        verify_url = f"https://metadata.hardbanrecordslab.online/api/certificate/verify/{certificate_human_id}"
        pdf_path = generate_certificate_pdf(
            certificate_id=certificate_human_id,
            file_name=job.file_name,
            sha256=sha256_actual,
            metadata=job.result,
            verify_url=verify_url,
        )
        return FileResponse(pdf_path, filename=f"{certificate_human_id}.pdf", media_type="application/pdf")

    # For saved certificates, generate a private view token and embed a frontend verify URL with token
    view_token = secrets.token_urlsafe(24)
    verify_url = f"https://app-metadata.hardbanrecordslab.online/verify/{certificate_human_id}?token={view_token}"
    pdf_path = generate_certificate_pdf(
        certificate_id=certificate_human_id,
        file_name=job.file_name,
        sha256=sha256_actual,
        metadata=job.result,
        verify_url=verify_url,
    )

    certificate = Certificate(
        certificate_id=certificate_human_id,
        user_id=getattr(current_user, "id", None) if current_user else None,
        job_id=job.id,
        file_name=job.file_name,
        sha256=sha256_actual,
        certificate_metadata=job.result,
        verification_status=verification_status,
        price_usd=0.5,
        created_at=now,
        view_token=view_token,
    )

    db.add(certificate)
    db.commit()
    db.refresh(certificate)

    # Monetization: Subtract 1 credit for certificate generation if not superuser
    try:
        if current_user and not current_user.is_superuser:
            from app.dependencies import decrement_user_credits
            await decrement_user_credits(current_user.id, db, amount=1)
            logger.info(f"Subtracted 1 credit from user {current_user.id} for certificate {certificate_human_id}")
    except Exception as e:
        logger.error(f"Failed to subtract credit for certificate: {e}")

    return {
        "id": certificate.id,
        "certificate_id": certificate.certificate_id,
        "job_id": certificate.job_id,
        "file_name": certificate.file_name,
        "HardBand Records Authenticity DNA": certificate.sha256,
        "pdf_url": f"https://metadata.hardbanrecordslab.online/api/certificate/pdf/{certificate.certificate_id}",
        "verify_url": verify_url,
    }


@router.get("/verify/{identifier}")
async def verify_certificate(identifier: str, request: Request, token: str | None = Query(None), db: Session = Depends(get_db)):
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

    # If view_token is set, require a matching token
    if getattr(certificate, "view_token", None):
        if not token or token != certificate.view_token:
            raise HTTPException(status_code=403, detail="Valid QR token required")

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


@router.get("/pdf/{identifier}")
async def get_certificate_pdf(identifier: str, db: Session = Depends(get_db)):
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

    # Embed frontend verify URL with token if available
    vt = getattr(certificate, "view_token", None)
    if vt:
        verify_url = f"https://app-metadata.hardbanrecordslab.online/verify/{certificate.certificate_id}?token={vt}"
    else:
        verify_url = f"https://metadata.hardbanrecordslab.online/api/certificate/verify/{certificate.certificate_id}"
    pdf_path = os.path.join(CERT_DIR, f"{certificate.certificate_id}.pdf")
    if not os.path.exists(pdf_path):
        pdf_path = generate_certificate_pdf(
            certificate_id=certificate.certificate_id,
            file_name=certificate.file_name,
            sha256=certificate.sha256,
            metadata=certificate.certificate_metadata or {},
            verify_url=verify_url,
        )
    return FileResponse(pdf_path, filename=f"{certificate.certificate_id}.pdf", media_type="application/pdf")


@router.get("/list")
async def list_certificates(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_user_and_check_quota),
    db: Session = Depends(get_db),
):
    """
    Returns a paginated list of certificates for the current user.
    Admins receive all certificates.
    """
    query = db.query(Certificate)
    # If user is not present, return empty
    if not current_user:
        return {"items": [], "count": 0}
    try:
        from app.admin_config import is_admin
        if not is_admin(getattr(current_user, "email", None)):
            query = query.filter(Certificate.user_id == current_user.id)
    except Exception:
        query = query.filter(Certificate.user_id == current_user.id)

    count = query.count()
    items = (
        query.order_by(Certificate.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    def _serialize(c: Certificate):
        return {
            "id": c.id,
            "certificate_id": c.certificate_id,
            "file_name": c.file_name,
            "sha256": c.sha256,
            "verification_status": c.verification_status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "verify_url": f"https://metadata.hardbanrecordslab.online/api/certificate/verify/{c.certificate_id}",
            "pdf_url": f"https://metadata.hardbanrecordslab.online/api/certificate/pdf/{c.certificate_id}",
        }
    return {"items": [_serialize(c) for c in items], "count": count}
