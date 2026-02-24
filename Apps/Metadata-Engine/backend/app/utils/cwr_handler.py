
from datetime import datetime
from typing import Dict, Any, List

def format_fixed_width(text: str, length: int, align: str = 'left') -> str:
    """Helper to format a string to a fixed width."""
    text = str(text or "")[:length]
    if align == 'left':
        return text.ljust(length)
    return text.rjust(length)

def generate_cwr_record(metadata: Dict[str, Any]) -> str:
    """
    Generates a simplified CWR 2.1 file content (Common Works Registration).
    Based on CISAC standards for work registration.
    """
    now = datetime.now()
    records = []

    # HDR - Header Record
    # Format: HDR + SenderType(3) + SenderID(9) + SenderName(45) + EDI_v(2) + Date(8) + Time(6) ...
    hdr = "HDR"
    hdr += "PB " # Publisher
    hdr += format_fixed_width("MME-001", 9)
    hdr += format_fixed_width("MUSIC METADATA ENGINE CORP", 45)
    hdr += "01" # EDI Version
    hdr += now.strftime("%Y%m%d")
    hdr += now.strftime("%H%M%S")
    hdr += format_fixed_width("", 15) # Character Set
    records.append(hdr)

    # GRH - Group Header
    grh = "GRH"
    grh += "NWR" # New Work Registration
    grh += "00001" # Group ID
    grh += "02.10" # Version
    grh += format_fixed_width("", 10)
    records.append(grh)

    # NWR - New Work Registration Record
    # Format: NWR + TransID(8) + WorkTitle(60) + ISRC(12) ...
    nwr = "NWR"
    nwr += "00000001" # Transaction ID
    nwr += format_fixed_width(metadata.get("title", "UNKNOWN TITLE"), 60)
    nwr += format_fixed_width("", 11) # Language Code
    nwr += format_fixed_width(metadata.get("isrc", ""), 12)
    nwr += format_fixed_width("", 8) # Work ID
    nwr += "000000" # Duration
    nwr += "U" # Title Type (Unspecified)
    records.append(nwr)

    # SPU - Submitter Publisher Record
    spu = "SPU"
    spu += "00000001" # Transaction ID
    spu += "001" # Sequence ID
    spu += format_fixed_width("MME PUBLISHING", 45)
    spu += "E " # Publisher Type (Original Publisher)
    spu += format_fixed_width(metadata.get("upc", ""), 9) # Using UPC as placeholder for IPI
    records.append(spu)

    # SWR - Submitter Writer Record
    swr = "SWR"
    swr += "00000001"
    swr += "001"
    swr += format_fixed_width(metadata.get("artist", "INDEPENDENT"), 45)
    swr += format_fixed_width("", 45) # First Name
    swr += "WA" # Writer Role (Writer/Author)
    swr += "000" # PR Society
    swr += "000" # MR Society
    swr += "05000" # PRS Share (50%)
    swr += "05000" # MR Share (50%)
    swr += "05000" # SR Share (50%)
    records.append(swr)

    # GRT - Group Trailer
    grt = "GRT"
    grt += "00001"
    grt += "00000003" # 3 records in group (NWR, SPU, SWR)
    records.append(grt)

    # TRL - Trailer Record
    trl = "TRL"
    trl += "00001" # Group Count
    trl += "00000006" # Total record count
    records.append(trl)

    return "\n".join(records)
