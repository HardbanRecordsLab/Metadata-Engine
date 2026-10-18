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


def warm_up_analysis() -> None:
    """Run a tiny synthetic track through the DSP and tempo stages once, in the background, right after start.

    The first real analysis after every deploy used to take ~3 minutes (librosa / numba JIT compilation and lazy imports
    of the audio stack: 76 s for the audio layer instead of 12 s). Doing that work at boot moves it off the first user.
    Best effort - a failure here only means the first real analysis is slow again."""
    import asyncio
    import logging
    import os
    import tempfile
    import time

    log = logging.getLogger(__name__)
    t0 = time.time()
    path = None
    try:
        import numpy as np
        import soundfile as sf

        sr = 22050
        t = np.arange(sr * 8) / sr
        kick = np.sin(2 * np.pi * 55 * t * np.exp(-8 * (t % 0.5))) * np.exp(-6 * (t % 0.5))
        y = (0.6 * kick + 0.1 * np.sin(2 * np.pi * 220 * t) + 0.05 * np.sin(2 * np.pi * 329.63 * t)).astype("float32")
        fd, path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        sf.write(path, y, sr)

        from app.services.deep_audio_analyzer import DeepAudioAnalyzer
        from app.services.fresh_track_analyzer import FreshTrackAnalyzer

        asyncio.run(DeepAudioAnalyzer().extract_all_features(path))
        FreshTrackAnalyzer()._safe_tempo(path)
        log.info("Analysis stack warmed up in %.1fs", time.time() - t0)
    except Exception as e:  # noqa: BLE001
        log.warning("Analysis warm-up skipped: %s", e)
    finally:
        if path and os.path.exists(path):
            os.remove(path)

