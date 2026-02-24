from app.db import SessionLocal, User
from app.security import get_password_hash
import logging

logger = logging.getLogger("app.main")

def ensure_admin_user():
    db = SessionLocal()
    try:
        admin_email = "hardbanrecordslab.pl@gmail.com"
        user = db.query(User).filter(User.email == admin_email).first()
        if not user:
            logger.info(f"Creating admin user: {admin_email}")
            admin_user = User(
                email=admin_email,
                password_hash=get_password_hash("HardbanRecordsLab2026!"),
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
