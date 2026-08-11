"""Shared rate limiter instance.

Lives in its own module (not app.main) so route files can apply
@limiter.limit(...) without a circular import — main.py imports routes,
so routes can't import the limiter back out of main.py.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
