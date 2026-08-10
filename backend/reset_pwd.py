import argparse
import getpass
from app.db import SessionLocal, User
from app.security import get_password_hash


def reset_password(email: str, new_password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.password_hash = get_password_hash(new_password)
            db.commit()
            print(f"Password reset for: {email}")
        else:
            print("User not found.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset a user's password.")
    parser.add_argument("email", help="Email of the user to reset")
    args = parser.parse_args()
    password = getpass.getpass("New password: ")
    if not password:
        raise SystemExit("Password cannot be empty.")
    reset_password(args.email, password)
