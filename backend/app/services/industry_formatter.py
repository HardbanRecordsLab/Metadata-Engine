from jinja2 import Template
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# --- INDUSTRY FORMATTER (CWR/DDEX) ---
class IndustryFormatter:
    """
    Module 3: Business Logic (Layer 3)
    Generates registration and distribution files (CWR, DDEX).
    """

    CWR_TEMPLATE = """
    NWR{{ work_title[:60].ljust(60).upper() }} {{ iswc or '00000000000' }} {{ duration }}
    SPU{{ publisher_name.ljust(45).upper() }} {{ ipi_number }} 05000 05000
    SWR{{ writer_name.ljust(45).upper() }} {{ writer_ipi }} 05000 05000
    """

    @staticmethod
    def generate_cwr_draft(data: Dict[str, Any]) -> str:
        """
        Generate a CWR draft string from data.
        """
        try:
            # Basic validation/defaults
            data.setdefault('iswc', 'T-000000000-0')
            data.setdefault('publisher_name', 'HARDBAN RECORDS')
            data.setdefault('ipi_number', '000000000')
            data.setdefault('writer_name', 'UNKNOWN WRITER')
            data.setdefault('writer_ipi', '000000000')
            data.setdefault('duration', '030000') # HHMMSS
            
            template = Template(IndustryFormatter.CWR_TEMPLATE)
            # Use ljust manually in template mostly or helper here?
            # Jinja2 logic in template might need custom filters if strictly following CWR.
            # For now, using what user provided but added .ljust in template above because CWR is positional.
            
            return template.render(data).strip()
        except Exception as e:
            logger.error(f"CWR generation failed: {e}")
            return f"ERROR_GENERATING_CWR: {str(e)}"
