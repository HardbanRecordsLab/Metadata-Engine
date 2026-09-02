"""Minimal transactional email.

Uses stdlib smtplib in a worker thread (no extra dependency). If SMTP is not
configured, the message is logged instead of sent so local/dev and an
un-provisioned prod degrade loudly rather than failing silently.
"""
import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)


def _send_sync(to: str, subject: str, html: str, text: str) -> None:
    if not settings.SMTP_HOST:
        logger.warning(
            "SMTP not configured — email NOT sent.\n"
            "  To: %s\n  Subject: %s\n  %s",
            to, subject, text,
        )
        return

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    ctx = ssl.create_default_context()
    # Port 465 = implicit TLS (SMTP_SSL); 587/25 = plain connect + STARTTLS.
    if settings.SMTP_PORT == 465:
        smtp_cm = smtplib.SMTP_SSL(settings.SMTP_HOST, 465, timeout=20, context=ctx)
    else:
        smtp_cm = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)

    with smtp_cm as smtp:
        if settings.SMTP_PORT != 465 and settings.SMTP_STARTTLS:
            smtp.starttls(context=ctx)
        if settings.SMTP_USER and settings.SMTP_PASS:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASS)
        smtp.send_message(msg)
    logger.info("Email sent to %s (%s)", to, subject)


async def send_email(to: str, subject: str, html: str, text: str | None = None) -> None:
    """Fire-and-forget-safe: never raises to the caller."""
    body_text = text or _strip_tags(html)
    try:
        await asyncio.to_thread(_send_sync, to, subject, html, body_text)
    except Exception as e:  # noqa: BLE001 — email must never break the request
        logger.error("Failed to send email to %s: %s", to, e)


def _strip_tags(html: str) -> str:
    import re
    return re.sub(r"<[^>]+>", "", html).strip()
