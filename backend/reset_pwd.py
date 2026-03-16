from app.db import SessionLocal, User
from app.security import get_password_hash

def reset_password():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == 'hardbanrecordslab.pl@gmail.com').first()
        if user:
            user.password_hash = get_password_hash('REDACTED-PASSWORD')
            db.commit()
            print('Password explicitly reset to: REDACTED-PASSWORD')
        else:
            print('User not found.')
    finally:
        db.close()

if __name__ == "__main__":
    reset_password()
