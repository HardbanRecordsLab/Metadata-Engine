import os
import json
import logging
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

logger = logging.getLogger(__name__)

CERT_DIR = os.getenv("CERT_DIR", "/data/certificates")
os.makedirs(CERT_DIR, exist_ok=True)

def generate_certificate_pdf(certificate_id, file_name, sha256, metadata, verify_url):
    """
    Generates a high-quality PDF certificate from an HTML template using WeasyPrint.
    """
    try:
        output_path = os.path.join(CERT_DIR, f"{certificate_id}.pdf")
        
        # Safe access to metadata with defaults
        def get_meta(key, default="Not specified"):
            val = metadata.get(key)
            return val if val is not None and val != "" else default

        # Handle moods as badges
        moods = metadata.get("moods", [])
        if isinstance(moods, str):
            moods = [m.strip() for m in moods.split(",")]
        
        moods_html = ""
        for mood in moods:
            moods_html += f'<span class="badge">{mood}</span> '

        # Map fields to HTML placeholders
        data = {
            "SERIAL_ID": f"SN-{certificate_id[-8:]}",
            "CERT_DATE": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "CERT_ID": certificate_id,
            "FILE_OWNER": metadata.get("fileOwner", "HardbanRecords Lab Client"),
            "TITLE": get_meta("title"),
            "ARTIST": get_meta("artist"),
            "ALBUM": get_meta("album"),
            "ALBUM_ARTIST": get_meta("albumArtist", get_meta("artist")),
            "MAIN_GENRE": get_meta("mainGenre"),
            "ADDITIONAL_GENRES": ", ".join(metadata.get("additionalGenres", [])) if isinstance(metadata.get("additionalGenres"), list) else get_meta("additionalGenres"),
            "TRACK": get_meta("trackNumber", "1"),
            "YEAR": get_meta("year"),
            "DURATION": get_meta("duration"),
            "BPM": get_meta("bpm"),
            "KEY": get_meta("key"),
            "MODE": get_meta("mode"),
            "ENERGY_LEVEL": get_meta("energyLevel"),
            "MAIN_INSTRUMENT": get_meta("mainInstrument"),
            "INSTRUMENTS": ", ".join(metadata.get("instruments", [])) if isinstance(metadata.get("instruments"), list) else get_meta("instruments"),
            "DYNAMICS": get_meta("dynamics"),
            "PRODUCTION_QUALITY": get_meta("productionQuality"),
            "MOODS_BADGES": moods_html,
            "MOOD_VIBE": get_meta("moodVibe"),
            "TEMPO_CHARACTER": get_meta("tempoCharacter"),
            "MUSICAL_ERA": get_meta("musicalEra"),
            "VOCAL_STYLE": get_meta("vocalStyle"),
            "EXPLICIT_CONTENT": get_meta("explicitContent", "No"),
            "LANGUAGE": get_meta("language"),
            "TRACK_DESCRIPTION": get_meta("trackDescription"),
            "KEYWORDS_CSV": ", ".join(metadata.get("keywords", [])) if isinstance(metadata.get("keywords"), list) else get_meta("keywords"),
            "USE_CASES_CSV": ", ".join(metadata.get("useCases", [])) if isinstance(metadata.get("useCases"), list) else get_meta("useCases"),
            "TARGET_AUDIENCE": get_meta("targetAudience"),
            "STRUCTURE": get_meta("structure"),
            "COPYRIGHT": get_meta("copyright"),
            "COMPOSER": get_meta("composer"),
            "LYRICIST": get_meta("lyricist"),
            "PRODUCER": get_meta("producer"),
            "PUBLISHER": get_meta("publisher"),
            "P_LINE": get_meta("pLine"),
            "ISRC": get_meta("isrc"),
            "ISWC": get_meta("iswc"),
            "UPC": get_meta("upc"),
            "CATALOG_NUMBER": get_meta("catalogNumber"),
            "LICENSE": get_meta("license", "Standard Music License"),
            "SHA256": sha256,
            "ANALYSIS_REASONING": get_meta("analysisReasoning", "Verified via HardbanRecords Lab DSP Engine."),
            "VERIFY_URL": verify_url,
            "LEGAL_NOTE": "This digital record constitutes cryptographic proof of the audio file's state and metadata as of its registration date. Under the Berne Convention and international 'prior art' standards, this timestamped fingerprint serves as essential evidentiary support for ownership claims and creative attribution."
        }

        # 2. Render Template
        current_dir = os.path.dirname(os.path.abspath(__file__))
        template_dir = os.path.join(os.path.dirname(current_dir), "templates")
        
        env = Environment(loader=FileSystemLoader(template_dir))
        template = env.get_template("certyficat.html")
        
        html_content = template.render(**data)
        
        # 3. Generate PDF
        HTML(string=html_content).write_pdf(output_path)
        
        logger.info(f"Certificate PDF generated successfully at {output_path}")
        return output_path

    except Exception as e:
        logger.error(f"Error generating certificate PDF: {e}", exc_info=True)
        raise e

