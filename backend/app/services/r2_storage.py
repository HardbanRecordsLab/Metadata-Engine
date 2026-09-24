"""Uploads a file to Cloudflare R2 (S3-compatible). Used to give generated
certificates a durable, public copy independent of our own VPS - R2's free
tier has no egress fees, which matters for a QR code meant to be scanned by
anyone, indefinitely, without our storage bill growing with each scan."""
import asyncio
import os

import boto3
from botocore.config import Config


class R2StorageError(Exception):
    pass


def _client():
    account_id = os.getenv("R2_ACCOUNT_ID")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    if not (account_id and access_key and secret_key):
        raise R2StorageError("R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY not configured on server")

    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def _upload_sync(file_path: str, key: str, content_type: str) -> str:
    bucket = os.getenv("R2_BUCKET", "hrl-metadata-engine-certificates")
    public_base = os.getenv("R2_PUBLIC_BASE_URL")  # e.g. a custom domain or r2.dev URL, once enabled

    client = _client()
    try:
        client.upload_file(file_path, bucket, key, ExtraArgs={"ContentType": content_type})
    except Exception as e:
        raise R2StorageError(f"R2 upload failed: {e}") from e

    if public_base:
        return f"{public_base.rstrip('/')}/{key}"
    account_id = os.getenv("R2_ACCOUNT_ID")
    return f"https://{account_id}.r2.cloudflarestorage.com/{bucket}/{key}"


async def upload_certificate_pdf(file_path: str, certificate_id: str) -> str:
    """Uploads a certificate PDF to R2 and returns its URL."""
    key = f"certificates/{certificate_id}.pdf"
    return await asyncio.to_thread(_upload_sync, file_path, key, "application/pdf")
