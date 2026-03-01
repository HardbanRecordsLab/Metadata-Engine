"""
Admin Configuration
Defines admin users with full access privileges
"""

# Admin users with full access (no quota limits, all features)
ADMIN_EMAILS = [
    "hardbanrecordslab.pl@gmail.com",
]

def is_admin(email: str) -> bool:
    """Check if email belongs to an admin user"""
    return email.lower() in [admin.lower() for admin in ADMIN_EMAILS]
