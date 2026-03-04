from typing import Dict, Any, Tuple
import os
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import qrcode
import math


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


def _try_font(paths: Tuple[str, ...], size: int) -> ImageFont.ImageFont:
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def _load_fonts():
    bold_paths = (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/local/share/fonts/DejaVuSans-Bold.ttf",
        "/usr/local/share/fonts/DejaVuSans.ttf",
    )
    regular_paths = (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/local/share/fonts/DejaVuSans.ttf",
    )
    title = _try_font(bold_paths, 96)
    h1 = _try_font(bold_paths, 56)
    h2 = _try_font(bold_paths, 42)
    body = _try_font(regular_paths, 32)
    mono = _try_font(regular_paths, 30)
    return title, h1, h2, body, mono


def _draw_border(draw: ImageDraw.ImageDraw, w: int, h: int, inset: int, color_outer: Tuple[int, int, int], color_inner: Tuple[int, int, int]):
    draw.rectangle((inset, inset, w - inset, h - inset), outline=color_outer, width=12)
    draw.rectangle((inset + 24, inset + 24, w - inset - 24, h - inset - 24), outline=color_inner, width=4)


def _watermark(bg: Image.Image, text: str):
    wm = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(wm)
    f = ImageFont.load_default()
    tw = d.textlength(text, font=f)
    angle = -25
    x = -int(tw)
    y = int(bg.size[1] * 0.35)
    d.text((x, y), text, font=f, fill=(180, 180, 180, 35))
    wm = wm.rotate(angle, expand=1)
    bg.alpha_composite(wm)


def _draw_seal(draw: ImageDraw.ImageDraw, center: Tuple[int, int], radius: int, color: Tuple[int, int, int]):
    cx, cy = center
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=color, width=10)
    draw.ellipse((cx - int(radius * 0.8), cy - int(radius * 0.8), cx + int(radius * 0.8), cy + int(radius * 0.8)), outline=color, width=3)
    f = ImageFont.load_default()
    txt = "HRL VERIFIED"
    try:
        tw = draw.textlength(txt, font=f)
    except Exception:
        tw = len(txt) * f.size
    draw.text((cx - int(tw // 2), cy - int(f.size // 2)), txt, font=f, fill=color)


def generate_certificate_pdf(
    certificate_id: str,
    file_name: str,
    sha256: str,
    metadata: Dict[str, Any],
    verify_url: str,
) -> str:
    w, h = 2480, 3508
    bg = Image.new("RGBA", (w, h), color=(255, 255, 255, 255))
    draw = ImageDraw.Draw(bg)
    gold = (196, 155, 84)
    slate = (30, 41, 59)
    _draw_border(draw, w, h, 80, gold, (210, 210, 210))
    _watermark(bg, "HARD BAN RECORDS LAB")
    title_font, header_font, subheader_font, body_font, mono_font = _load_fonts()
    y = 220
    brand_logo_path = "/data/branding/logo.png"
    if os.path.exists(brand_logo_path):
        try:
            logo = Image.open(brand_logo_path).convert("RGBA")
            maxh = 180
            ratio = maxh / logo.height
            logo = logo.resize((int(logo.width * ratio), maxh))
            bg.paste(logo, (180, y - 40), logo)
        except Exception:
            pass
    title_text = "Digital Certificate of Authenticity"
    tw = draw.textlength(title_text, font=title_font)
    draw.text(((w - tw) // 2, y), title_text, font=title_font, fill=slate)
    y += 120
    draw.line([(160, y), (w - 160, y)], fill=gold, width=6)
    y += 40
    draw.text((180, y), f"Certificate ID: {certificate_id}", font=header_font, fill=slate)
    y += 60
    draw.text((180, y), f"File: {file_name}", font=subheader_font, fill=slate)
    y += 54
    draw.text((180, y), f"Audio SHA-256: {sha256}", font=mono_font, fill=slate)
    y += 50
    draw.text((180, y), f"Issued: {datetime.utcnow().isoformat()}Z", font=subheader_font, fill=slate)
    y += 60
    draw.line([(160, y), (w - 160, y)], fill=(220, 220, 220), width=3)
    y += 50

    LABELS = {
        "title": "Track Title",
        "artist": "Artist",
        "album": "Album",
        "albumArtist": "Album Artist",
        "year": "Year",
        "track": "Track",
        "duration": "Duration",
        "bpm": "BPM",
        "key": "Key",
        "mode": "Mode",
        "mainInstrument": "Main Instrument",
        "mainGenre": "Main Genre",
        "additionalGenres": "Additional Genres",
        "language": "Language",
        "trackDescription": "Description",
        "keywords": "Keywords",
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
        "sha256": "SHA-256",
    }
    ORDER = [
        "title", "artist", "album", "albumArtist", "year", "track", "duration",
        "bpm", "key", "mode", "mainInstrument", "mainGenre", "additionalGenres", "language",
        "trackDescription", "keywords",
        "isrc", "iswc", "upc", "catalogNumber", "license",
        "publisher", "composer", "lyricist", "producer",
        "copyright", "pLine",
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
            return ", ".join([f"{kk}:{vv}" for kk, vv in v.items()])
        if isinstance(v, bool):
            return "Yes" if v else "No"
        return str(v)

    section_title = "Metadata"
    draw.text((180, y), section_title, font=header_font, fill=slate)
    y += 46
    left_x, right_x = 180, int(w / 2) + 60
    col_width = int(w / 2) - 300
    left_y, right_y = y, y
    toggle = True

    present_keys = [k for k in ORDER if k in (metadata or {})]
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

    y = max(left_y, right_y) + 60

    draw.line([(160, y), (w - 160, y)], fill=(220, 220, 220), width=3)
    y += 40

    qr_img = _build_qr(verify_url, box_size=8, border=2)
    qr_size = 420
    qr_img = qr_img.resize((qr_size, qr_size))
    bg.paste(qr_img, (w - 160 - qr_size, y))
    draw.text((w - 160 - qr_size - 10 - int(draw.textlength("Verify this certificate:", font=header_font)), y + 20), "Verify this certificate:", font=header_font, fill=slate)
    _ = _draw_multiline(draw, verify_url, (w - 160 - qr_size - 10 - 800, y + 60), body_font, max_width=780)
    _draw_seal(draw, (int(160 + 220), int(y + qr_size / 2)), 120, gold)
    sig_y = y + qr_size + 80
    draw.line([(180, sig_y), (780, sig_y)], fill=slate, width=3)
    draw.text((180, sig_y + 10), "Authorized Signature", font=body_font, fill=slate)
    draw.text((180, sig_y + 60), "Issuer: Hardban Records Lab", font=body_font, fill=slate)
    draw.text((180, sig_y + 100), "Issued at: metadata.hardbanrecordslab.online", font=body_font, fill=slate)

    out_path = os.path.join(CERT_DIR, f"{certificate_id}.pdf")
    bg.save(out_path, "PDF", resolution=150.0)
    return out_path
