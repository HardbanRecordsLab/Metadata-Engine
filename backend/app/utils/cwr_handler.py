"""Compatibility shim for POST /cwr/export: the generator lives in services/cwr21.py (see the note in services/cwr_gen.py)."""
from typing import Any, Dict

from app.services import cwr21


def generate_cwr_record(metadata: Dict[str, Any]) -> str:
    return cwr21.export_metadata(metadata, splitsheet=metadata.get("splitsheet")).text
