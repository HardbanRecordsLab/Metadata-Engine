import musicbrainzngs as mb
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# --- METADATA ENRICHMENT (MusicBrainz) ---
class MetadataEnricher:
    """
    Module 2: Metadata Enrichment (Layer 2)
    Retrieves missing codes (ISWC) and metadata using ISRC.
    """
    
    def __init__(self):
        # Configure User Agent as requested
        mb.set_useragent("HardbanRecordsEngine", "1.0", "kontakt@hardban.pl")

    def find_codes_by_isrc(self, isrc: str) -> Dict[str, Any]:
        """
        Find metadata and codes by ISRC.
        """
        try:
            logger.info(f"Searching MusicBrainz for ISRC: {isrc}")
            result = mb.get_recordings_by_isrc(isrc, includes=["releases", "work-rels"])
            
            if "isrc" in result and "recording-list" in result["isrc"]:
                recordings = result["isrc"]["recording-list"]
                if not recordings:
                    return {}
                
                # Take the first match
                rec = recordings[0]
                
                metadata = {
                    "isrc": isrc,
                    "title": rec.get("title", "Unknown"),
                    "musicbrainz_id": rec.get("id"),
                    "artist": "Unknown", # Placeholder
                    "album": "Unknown",
                    "year": "",
                    "iswc": None
                }

                # Extract relationships (works -> ISWC)
                if "work-relation-list" in rec:
                    for work_rel in rec["work-relation-list"]:
                        if "work" in work_rel:
                            work = work_rel["work"]
                            if "iswc" in work:
                                metadata["iswc"] = work["iswc"]
                                break # Found one

                return metadata
            
            return {}

        except Exception as e:
            logger.error(f"MusicBrainz ISRC lookup failed: {e}")
            return {}
