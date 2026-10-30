"""Compatibility shim. The CWR generator lives in services/cwr21.py.

The earlier implementation in this file wrote record types that do not exist in CWR (WRK, GRL), a wrong EDI version, placeholder
agreement numbers and a hard-coded 50 % publisher share; an independent CWR parser rejected every one of its records."""
from typing import Any, Dict, Optional

from app.services import cwr21


class CWRGenerator:
    @staticmethod
    def generate_cwr(metadata: Dict[str, Any], sender_id: Optional[str] = None, sender_name: Optional[str] = None) -> str:
        """The file text for an analysis result (a draft when the submitter's credentials are missing). Raises ValueError if shares are not valid."""
        return cwr21.export_metadata(metadata).text
