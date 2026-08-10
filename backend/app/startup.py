import os
from app.db import SessionLocal, User
from app.security import get_password_hash
import logging

logger = logging.getLogger("app.main")

def ensure_admin_user():
    """Bootstrap an initial superuser from env vars, if configured and absent.

    No default credentials are baked in: set ADMIN_BOOTSTRAP_EMAIL and
    ADMIN_BOOTSTRAP_PASSWORD to enable this on a fresh deployment. Existing
    admin accounts are left untouched either way.
    """
    admin_email = os.getenv("ADMIN_BOOTSTRAP_EMAIL")
    admin_password = os.getenv("ADMIN_BOOTSTRAP_PASSWORD")
    if not admin_email or not admin_password:
        logger.info("ADMIN_BOOTSTRAP_EMAIL/PASSWORD not set — skipping admin bootstrap.")
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == admin_email).first()
        if not user:
            logger.info(f"Creating admin user: {admin_email}")
            admin_user = User(
                email=admin_email,
                password_hash=get_password_hash(admin_password),
                is_active=True,
                is_superuser=True,
                tier="studio",
                credits=999999999
            )
            db.add(admin_user)
            db.commit()
        else:
            logger.info(f"Admin user already exists: {admin_email}")
    except Exception as e:
        logger.error(f"Error seeding admin user: {e}")
    finally:
        db.close()
