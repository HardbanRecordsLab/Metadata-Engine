from typing import Dict, Any, Tuple
import os
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont
import qrcode


CERT_DIR = "/data/certificates"
os.makedirs(CERT_DIR, exist_ok=True)


def _build_qr(data_url: str, box_size: int = 6, border: int = 2) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    return img.convert("RGB")


def _draw_multiline(draw: ImageDraw.ImageDraw, text: str, xy: Tuple[int, int], font: ImageFont.ImageFont, max_width: int, fill=(0, 0, 0)) -> int:
    words = text.split()
    lines = []
    current = ""
    for w in words:
        candidate = (current + " " + w).strip()
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    line_height = font.size + 6
    y = xy[1]
    for line in lines:
        draw.text((xy[0], y), line, font=font, fill=fill)
        y += line_height
    return y


def generate_certificate_pdf(
    certificate_id: str,
    file_name: str,
    sha256: str,
    metadata: Dict[str, Any],
    verify_url: str,
) -> str:
    """
    Generates a single-page PDF certificate with all metadata and a QR code to the verification URL.
    Returns absolute file path to the PDF.
    """
    w, h = 1240, 1754  # A4-ish at ~150 DPI
    bg = Image.new("RGB", (w, h), color=(255, 255, 255))
    draw = ImageDraw.Draw(bg)

    # Fonts: use default PIL fonts to avoid OS deps
    title_font = ImageFont.load_default()
    header_font = ImageFont.load_default()
    body_font = ImageFont.load_default()

    # Header
    y = 60
    draw.text((80, y), "Certificate of Originality", font=title_font, fill=(0, 0, 0))
    y += 40
    draw.text((80, y), f"Certificate ID: {certificate_id}", font=header_font, fill=(0, 0, 0))
    y += 30
    draw.text((80, y), f"File: {file_name}", font=header_font, fill=(0, 0, 0))
    y += 30
    draw.text((80, y), f"Audio SHA-256: {sha256}", font=header_font, fill=(0, 0, 0))
    y += 30
    draw.text((80, y), f"Issued: {datetime.utcnow().isoformat()}Z", font=header_font, fill=(0, 0, 0))
    y += 40

    # Divider
    draw.line([(80, y), (w - 80, y)], fill=(0, 0, 0), width=2)
    y += 20

    # Metadata heading
    draw.text((80, y), "Metadata", font=header_font, fill=(0, 0, 0))
    y += 30

    # Render metadata with UI-synced labels and priority ordering
    LABELS = {
        # Identity
        "title": "Track Title",
        "artist": "Artist",
        "album": "Album",
        "albumArtist": "Album Artist",
        "year": "Year",
        "track": "Track",
        "duration": "Duration",
        # Sonic & Technical
        "bpm": "BPM",
        "key": "Key",
        "mode": "Mode",
        "mainInstrument": "Main Instrument",
        "mainGenre": "Main Genre",
        "additionalGenres": "Additional Genres",
        "language": "Language",
        "trackDescription": "Description",
        "keywords": "Keywords",
        # Credits & Legal
        "copyright": "Copyright",
        "pLine": "(P) Line",
        "publisher": "Publisher",
        "composer": "Composer",
        "lyricist": "Lyricist",
        "producer": "Producer",
        "catalogNumber": "Catalog Number",
        "isrc": "ISRC",
        "iswc": "ISWC",
        "upc": "UPC",
        "license": "License",
        # Misc / Advanced
        "similar_artists": "Similar Artists",
        "moods": "Moods",
        "mood_vibe": "Mood Vibe",
        "energy_level": "Energy Level",
        "energyLevel": "Energy Level",
        "instrumentation": "Instrumentation",
        "vocalStyle": "Vocal Style",
        "useCases": "Use Cases",
        "explicitContent": "Explicit Content",
        "tempoCharacter": "Tempo Character",
        "musicalEra": "Musical Era",
        "productionQuality": "Production Quality",
        "dynamics": "Dynamics",
        "targetAudience": "Target Audience",
        "fileOwner": "File Owner",
        "analysisReasoning": "Analysis Reasoning",
        "dynamicRange": "Dynamic Range (dB LRA)",
        "spectralCentroid": "Spectral Centroid (Hz)",
        "spectralRolloff": "Spectral Rolloff (Hz)",
        "acousticScore": "Acoustic Score",
        "hasVocals": "Has Vocals",
        "percussionDetected": "Percussion Detected",
        "confidence": "AI Confidence",
        "validation_report": "Validation Report",
        # Hash
        "sha256": "SHA-256",
    }
    ORDER = [
        # Identity
        "title", "artist", "album", "albumArtist", "year", "track", "duration",
        # Sonic & Technical
        "bpm", "key", "mode", "mainInstrument", "mainGenre", "additionalGenres", "language",
        "trackDescription", "keywords",
        # Legal
        "isrc", "iswc", "upc", "catalogNumber", "license",
        "publisher", "composer", "lyricist", "producer",
        "copyright", "pLine",
        # Hash & trust
        "sha256", "confidence", "validation_report",
    ]

    def format_value(k: str, v: Any) -> str:
        if v is None:
            return ""
        if k == "duration":
            try:
                total = int(float(v))
                m, s = divmod(total, 60)
                return f"{m}:{str(s).zfill(2)}"
            except Exception:
                return str(v)
        if k == "validation_report" and isinstance(v, dict):
            score = v.get("score")
            status = v.get("status")
            issues = len(v.get("issues", []) or [])
            warnings = len(v.get("warnings", []) or [])
            parts = []
            if status is not None:
                parts.append(f"status:{status}")
            if score is not None:
                parts.append(f"score:{score}")
            parts.append(f"issues:{issues}")
            parts.append(f"warnings:{warnings}")
            return ", ".join(parts)
        if isinstance(v, (list, tuple)):
            return ", ".join([str(x) for x in v])
        if isinstance(v, dict):
            # compact inline dict
            return ", ".join([f"{kk}:{vv}" for kk, vv in v.items()])
        if isinstance(v, bool):
            return "Yes" if v else "No"
        return str(v)

    left_x, right_x = 80, int(w / 2) + 20
    col_width = int(w / 2) - 100
    left_y, right_y = y, y
    toggle = True

    # Build ordered list of fields present
    present_keys = [k for k in ORDER if k in (metadata or {})]
    # Append any remaining fields not in ORDER
    remaining = [k for k in (metadata or {}).keys() if k not in present_keys]
    render_keys = present_keys + sorted(remaining)

    for k in render_keys:
        val = metadata.get(k)
        if val is None or val == "":
            continue
        label = LABELS.get(k, k.replace("_", " ").title())
        value_str = format_value(k, val)
        text_block = f"{label}: {value_str}"

        if toggle:
            left_y = _draw_multiline(draw, text_block, (left_x, left_y), body_font, col_width)
        else:
            right_y = _draw_multiline(draw, text_block, (right_x, right_y), body_font, col_width)
        toggle = not toggle

    y = max(left_y, right_y) + 30

    # Divider
    draw.line([(80, y), (w - 80, y)], fill=(0, 0, 0), width=2)
    y += 20

    # QR code and verify URL
    qr_img = _build_qr(verify_url, box_size=6, border=2)
    qr_size = 280
    qr_img = qr_img.resize((qr_size, qr_size))
    bg.paste(qr_img, (80, y))
    draw.text((80 + qr_size + 20, y + 20), "Verify this certificate:", font=header_font, fill=(0, 0, 0))
    _ = _draw_multiline(draw, verify_url, (80 + qr_size + 20, y + 40), body_font, max_width=w - (80 + qr_size + 40))

    # Save as PDF
    out_path = os.path.join(CERT_DIR, f"{certificate_id}.pdf")
    bg.save(out_path, "PDF", resolution=150.0)
    return out_path
