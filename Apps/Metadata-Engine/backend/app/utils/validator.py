
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class MetadataValidator:
    """
    Performs cross-checks and consistency validation on metadata.
    Aims for 95%+ accuracy by catching logical errors.
    """

    @staticmethod
    def validate(metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates metadata and adds a 'validation_report' field.
        """
        report = {
            "score": 100,
            "issues": [],
            "warnings": [],
            "status": "valid"
        }

        genre = (metadata.get("mainGenre") or "").lower()
        bpm = metadata.get("bpm") or 0
        key = metadata.get("key") or ""
        mode = metadata.get("mode") or ""

        # 1. BPM vs Genre Checks
        if "drum and bass" in genre or "dnb" in genre:
            if bpm < 155:
                report["score"] -= 15
                report["issues"].append(f"Suspiciously low BPM ({bpm}) for Drum and Bass (expected >160).")
        
        if "house" in genre or "techno" in genre or "trance" in genre:
            if bpm < 110 or bpm > 155:
                report["warnings"].append(f"BPM ({bpm}) is slightly outside typical range for electronic dance music (115-145).")
        
        if "hip hop" in genre or "rap" in genre:
            if bpm > 170 and "trap" not in genre:
                report["warnings"].append(f"High BPM ({bpm}) for Hip Hop; might be Double-Time or Trap.")

        if "ambient" in genre or "cinematic" in genre:
            if bpm > 140:
                report["warnings"].append(f"High BPM ({bpm}) for Ambient/Cinematic style.")

        # 2. Key/Mode Inconsistencies
        if mode == "Minor" and "uplifting" in [m.lower() for m in metadata.get("moods", [])]:
            report["warnings"].append("Minor key detected but mood is 'Uplifting'. Check for harmonic complexity.")
        
        if mode == "Major" and "dark" in [m.lower() for m in metadata.get("moods", [])]:
            report["warnings"].append("Major key detected but mood is 'Dark'. Check for dissonance.")

        # 3. Completeness Checks
        required_fields = ["title", "artist", "mainGenre", "bpm", "key"]
        for field in required_fields:
            if not metadata.get(field) or metadata.get(field) in ("Unknown", "none", 0):
                report["score"] -= 10
                report["issues"].append(f"Missing or uncertain critical field: {field}")

        # 4. Legal/Identity
        if not metadata.get("isrc") and not metadata.get("copyright"):
            report["warnings"].append("Missing ISRC and Copyright info. Track is not ready for distribution.")

        # Final Status
        if report["score"] < 70:
            report["status"] = "uncertain"
        if len(report["issues"]) > 2:
            report["status"] = "inconsistent"

        metadata["validation_report"] = report
        return metadata

    @staticmethod
    def cross_check_consensus(results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        If multiple analysis sources exist, this performs a consensus check.
        (Currently placeholder for future multi-agent expansion)
        """
        return results[0] if results else {}
