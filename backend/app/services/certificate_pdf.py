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

    # Render all metadata as key: value
    left_x, right_x = 80, int(w / 2) + 20
    col_width = int(w / 2) - 100
    left_y, right_y = y, y
    toggle = True

    for k in sorted(metadata.keys()):
        val = metadata.get(k)
        value_str = ""
        if isinstance(val, (list, tuple)):
            value_str = ", ".join([str(x) for x in val])
        elif isinstance(val, dict):
            # inline dict as simple key=value segments
            value_str = ", ".join([f"{kk}:{vv}" for kk, vv in val.items()])
        else:
            value_str = str(val)
        text_block = f"{k}: {value_str}"

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

