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

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        if settings.SMTP_STARTTLS:
            smtp.starttls(context=ssl.create_default_context())
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
