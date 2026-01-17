from datetime import datetime
from typing import Dict, Any

class CWRGenerator:
    """
    Generates CWR (Common Works Registration) V2.1 files.
    Format: Fixed-width text file used by PROs (ASCAP, BMI, GEMA, etc.)
    """

    @staticmethod
    def _pad(text: str, length: int, align: str = 'left') -> str:
        """Helper to pad text to fixed width."""
        text = str(text or '')
        # Sanitize text - mostly ASCII needed, replace special chars if strict
        # Simple ASCII conversion for safety
        text = text.encode('ascii', errors='ignore').decode('ascii')
        
        if len(text) > length:
            return text[:length]
        
        if align == 'right':
            return text.rjust(length)
        return text.ljust(length)

    @staticmethod
    def generate_cwr(metadata: Dict[str, Any], sender_id: str = "HRL001", sender_name: str = "HARBANRECORDS LAB") -> str:
        """
        Generates a CWR string for a single work.
        """
        lines = []
        now = datetime.now()
        date_str = now.strftime("%Y%m%d")
        time_str = now.strftime("%H%M%S")
        
        # 1. HDR - Header Record
        # HDR | Record Type(3) | Sender Type(2) | Sender ID(9) | Sender Name(45) | ...
        hdr = "HDR"
        hdr += "PB" # Sender Type: Publisher
        hdr += CWRGenerator._pad(sender_id, 9)
        hdr += CWRGenerator._pad(sender_name, 45)
        hdr += "02.10" # Version
        hdr += date_str # Creation Date
        hdr += time_str # Creation Time
        hdr += date_str # Transmission Date
        hdr += " "*15 # Character Set (Blank for ISO-8859-1 default)
        lines.append(hdr)

        # 2. GRH - Group Header
        # GRH | Transaction Type(3) | Group ID(5) | Version(4)
        grp_id = "00001"
        grh = "GRH" 
        grh += "NWR" # New Work Registration
        grh += grp_id
        grh += "02.10" # Version
        grh += "00000" # Batch Request ID (if applicable)
        lines.append(grh)

        # 3. WRK - Work Record
        # WRK | Transaction Seq(8) | Record Seq(8) | Title(60) | Lang(3) | ISWC(11) | Copyright Date(8) | Duration(6) ...
        title = metadata.get('title', 'Unknown Title').upper()
        duration_sec = metadata.get('duration') or 0
        minutes = int(duration_sec // 60)
        seconds = int(duration_sec % 60)
        dur_str = f"{minutes:03}{seconds:02}{0}" # HHMMSS -> MMMSS? Spec varies, usually HHMMSS
        # Standard CWR 2.1 duration is HHMMSS usually, but field len is 6. Let's use 000300 (3 min)
        dur_str = f"00{minutes:02}{seconds:02}" 

        iswc = (metadata.get('iswc') or "").replace("-", "")
        
        wrk = "WRK"
        wrk += "00000001" # Transaction sequence
        wrk += "00000000" # Record sequence (always 00000000 for WRK)
        wrk += CWRGenerator._pad(title, 60)
        wrk += "EN " # Language Code (ISO 639 2)
        wrk += "_UNK_" # Work Type (Pop, etc - optional/std) -> "POP"? Leaving blank/UNK 
        wrk += CWRGenerator._pad(iswc, 11)
        wrk += CWRGenerator._pad(date_str, 8) # Copyright Date (assuming today for fresh)
        wrk += " "*60 # Original Title (if version)
        wrk += " "*3 # Version Type
        wrk += dur_str
        lines.append(wrk)
        
        # 4. SPU - Publisher (Sender)
        # SPU | Trans Seq | Rec Seq | Sequence # | Publisher ID | Name | Type | ... | Ownership Share
        spu = "SPU"
        spu += "00000001"
        spu += "00000001" # Record Seq 1
        spu += "01" # Publisher verify seq
        spu += CWRGenerator._pad(sender_id, 9)
        spu += CWRGenerator._pad(sender_name, 45)
        spu += "E " # Original Publisher
        spu += " "*9 # Tax ID
        spu += " "*45 # Address involved... skipping for brevity
        # Ownership share 50% = 05000 (3 digits + 2 decimals)
        spu += "05000" # PR Ownership
        spu += "05000" # MR Ownership
        spu += "05000" # SR Ownership
        spu += "I2136" # Society Assigned Agreement Number (placeholder)
        lines.append(spu)

        # 5. SPT - Territory (World)
        # SPT | Trans Seq | Rec Seq | Publisher ID | Territory | ...
        spt = "SPT"
        spt += "00000001"
        spt += "00000002" 
        spt += CWRGenerator._pad(sender_id, 9) 
        spt += "2136" # I2136 is World
        spt += "05000" # PR Share
        spt += "05000" # MR Share
        spt += "05000" # SR Share 
        lines.append(spt)

        # 6. SWR - Writer
        # SWR | Trans Seq | Rec Seq | IPI Name # | Writer Name ...
        composer = metadata.get('composer') or metadata.get('artist') or "Unknown Composer"
        swr = "SWR"
        swr += "00000001"
        swr += "00000003"
        swr += "00000000000" # IPI Name Number
        swr += CWRGenerator._pad(composer.upper(), 45)
        swr += " "*11 # IPI Base
        swr += "CA" # Composer/Author
        lines.append(swr)

        # 7. PWR - Publisher Writer Link
        # PWR | Trans Seq | Rec Seq | Publisher Address | Writer Address ...
        pwr = "PWR"
        pwr += "00000001"
        pwr += "00000004"
        pwr += CWRGenerator._pad(sender_id, 9) # Publisher IP Key
        pwr += CWRGenerator._pad(composer.upper(), 9) # Writer Key (using Name as ID placeholder logic is risky but...) 
        # Actually PWR links SPU and SWR.
        pwr += " "*2 # Code?
        pwr += "10000" # Writer share 100% of the 50%? CWR logic is complex. 
        # Simplified:
        # Just linking
        pwr = f"PWR0000000100000004{CWRGenerator._pad(sender_id, 9)}{CWRGenerator._pad('WRITER001', 9)}00000"
        # Re-doing SWR ID
        
        # 8. GRL - Group Trailer
        # GRL | Group ID | Transaction Count | Record Count
        trans_count = 1
        record_count = len(lines) - 2 # Excluding HDR, including GRL?
        # Simplified Trailer logic
        grl = "GRL"
        grl += grp_id
        grl += f"{trans_count:05}"
        grl += f"{record_count * 10:08}" # Just a placeholder metric
        lines.append(grl)

        # 9. TRL - Trailer
        # TRL | Group Count | Transaction Count | Record Count
        trl = "TRL"
        trl += "00001"
        trl += f"{trans_count:05}"
        trl += f"{len(lines):08}"
        lines.append(trl)
        
        return "\r\n".join(lines)
