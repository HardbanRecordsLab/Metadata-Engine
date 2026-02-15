from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from pydantic import BaseModel, Field
from typing import Dict, Any, List
import json
import logging
import random
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
import httpx
import asyncio
from urllib.parse import quote

from app.config import settings
from app.dependencies import get_user_and_check_quota
from app.services.groq_whisper import get_groq_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["generative"])

# --- Pydantic Models for Request Bodies ---


class RefineFieldRequest(BaseModel):
    current_metadata: Dict[str, Any] = Field(
        ..., description="The full current metadata object for context."
    )
    field_to_refine: str = Field(
        ..., description="The specific key/field in the metadata to be refined."
    )
    refinement_instruction: str = Field(
        ..., description="The user's instruction on how to refine the field."
    )


# --- Helper for Groq JSON response ---
async def call_groq_json(
    prompt: str, model_name: str = "llama-3.3-70b-versatile"
) -> Dict[str, Any]:
    try:
        client = get_groq_client()
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional music metadata analyst. Always respond with valid JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )
        
        result_text = response.choices[0].message.content
        return json.loads(result_text)

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI model returned invalid JSON.")
    except Exception as e:
        logger.error(f"Groq generation error: {e}")
        raise HTTPException(
            status_code=500, detail=f"An error occurred with the AI model: {str(e)}"
        )


# --- New Endpoints (Replaced Gemini with Groq) ---


@router.post("/refine_field", dependencies=[Depends(get_user_and_check_quota)])
async def refine_metadata_field(request: RefineFieldRequest):
    prompt = f"""
    You are a professional Music Editor and Metadata Specialist.
    
    Context: Music Metadata Refinement.
    Current Data: {json.dumps(request.current_metadata)}
    
    Task: Rewrite or Update the field "{request.field_to_refine}" based on the user's instruction.
    User Instruction: "{request.refinement_instruction}"
    
    Guidelines:
    1. Maintain professional formatting (Capitalization, Punctuation).
    2. Ensure the new value is consistent with the rest of the metadata (e.g., if Genre is 'Metal', do not suggest 'Soft' mood unless explicitly asked).
    3. If the field is 'vocalStyle', return a valid JSON object, not a string.
    
    Output JSON with ONLY the key "{request.field_to_refine}" and its new value.
    """
    return await call_groq_json(prompt)


class CoverRequest(BaseModel):
    title: str
    artist: str
    genre: str = "Electronic"
    mood: str = "Neutral"

class CoverGenerationService:
    @staticmethod
    async def generate_enhanced_prompt(title: str, artist: str, genre: str, mood: str | None = None) -> str:
        title_keywords = title.lower().split()[:3]
        mood_descriptor = mood or genre

        visual_themes = {
            "electronic": "neon, cyberpunk, digital waves, laser",
            "ambient": "ethereal, soft focus, atmospheric, clouds, mist",
            "rock": "gritty, raw texture, urban, metallic, dark",
            "pop": "vibrant, colorful, dynamic, pop-art style",
            "jazz": "vintage, smoky, warm tones, retro, vinyl",
            "classical": "elegant, orchestral, ornate, dramatic lighting",
            "hip-hop": "urban, street art, graffiti, bold colors, dynamic",
            "folk": "natural, rustic, warm, acoustic, vintage",
        }

        theme = visual_themes.get(genre.lower(), "abstract, artistic")

        prompt = f"""
        Album cover art for: "{title}" by {artist}
        Genre: {genre}
        Mood: {mood_descriptor}
        Style: {theme}, professional design, high quality, 8k
        Requirements: visually represents the song title metaphorically or literally
        """

        return prompt.strip()

    @staticmethod
    async def fetch_from_pollinations(
        title: str,
        artist: str,
        genre: str,
        retries: int = 3,
    ) -> Image.Image | None:
        for attempt in range(retries):
            try:
                prompt = await CoverGenerationService.generate_enhanced_prompt(
                    title, artist, genre
                )

                image_prompt = f"{artist} - {title}. {prompt}"
                encoded = quote(image_prompt)
                url = f"https://pollinations.ai/p/{encoded}?width=1024&height=1024&nologo=true"

                async with httpx.AsyncClient(timeout=25.0) as client:
                    response = await client.get(url)

                    if response.status_code == 200:
                        return Image.open(BytesIO(response.content)).convert("RGB")

                    if attempt < retries - 1:
                        await asyncio.sleep(2**attempt)

            except Exception as e:
                logger.warning(f"Pollinations attempt {attempt + 1} failed: {e}")
                if attempt < retries - 1:
                    await asyncio.sleep(2**attempt)

        return None

    @staticmethod
    def create_smart_gradient(genre: str, title: str) -> Image.Image:
        genre_colors = {
            "metal": [(30, 0, 20), (120, 0, 0)],
            "rock": [(50, 25, 0), (150, 50, 0)],
            "pop": [(255, 105, 180), (255, 192, 203)],
            "electronic": [(0, 0, 0), (0, 255, 200)],
            "ambient": [(200, 220, 255), (100, 180, 255)],
            "jazz": [(20, 20, 80), (60, 60, 150)],
            "classical": [(139, 69, 19), (210, 180, 140)],
            "hip-hop": [(0, 0, 0), (255, 215, 0)],
        }

        colors = genre_colors.get(
            genre.lower(),
            [(50, 50, 50), (100, 100, 100)],
        )

        start_color, end_color = colors

        width, height = 1024, 1024
        base = Image.new("RGB", (width, height), start_color)
        overlay = Image.new("RGB", (width, height), end_color)

        mask = Image.new("L", (width, height))
        mask_data = []
        for y in range(height):
            mask_data.extend([int(255 * (y / height))] * width)
        mask.putdata(mask_data)

        base.paste(overlay, (0, 0), mask)
        return base


@router.post("/cover")
async def generate_cover(request: CoverRequest):
    try:
        logger.info(f"Generating cover for: {request.title} by {request.artist}")

        base_image = await CoverGenerationService.fetch_from_pollinations(
            request.title,
            request.artist,
            request.genre,
            retries=2,
        )

        if not base_image:
            logger.info("External services failed, generating gradient...")
            base_image = CoverGenerationService.create_smart_gradient(
                request.genre,
                request.title,
            )

        base_image = _overlay_text_on_cover(
            base_image,
            request.title,
            request.artist,
        )

        buffer = BytesIO()
        base_image.save(buffer, format="JPEG", quality=95)
        buffer.seek(0)
        img_str = base64.b64encode(buffer.getvalue()).decode()

        return {"image": f"data:image/jpeg;base64,{img_str}"}

    except Exception as e:
        logger.error(f"Cover generation critical failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _overlay_text_on_cover(image: Image.Image, title: str, artist: str) -> Image.Image:
    width, height = image.size
    draw = ImageDraw.Draw(image, "RGBA")

    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)

    for i in range(height // 2, height):
        alpha = int(200 * ((i - height // 2) / (height // 2)))
        overlay_draw.line(
            [(0, i), (width, i)],
            fill=(0, 0, 0, alpha),
        )

    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(image)

    try:
        font_title = ImageFont.truetype("arialbd.ttf", 90)
        font_artist = ImageFont.truetype("arial.ttf", 60)
    except Exception:
        font_title = ImageFont.load_default()
        font_artist = ImageFont.load_default()

    def draw_text(text: str, font: ImageFont.ImageFont, y_pos: int) -> None:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        x_pos = (width - text_width) / 2

        draw.text(
            (x_pos + 3, y_pos + 3),
            text,
            font=font,
            fill=(0, 0, 0, 150),
        )

        draw.text(
            (x_pos, y_pos),
            text,
            font=font,
            fill=(255, 255, 255, 255),
        )

    draw_text(title.upper(), font_title, height - 250)
    draw_text(artist, font_artist, height - 100)

    return image


# --- Certificate Generation ---

class CertificateRequest(BaseModel):
    metadata: Dict[str, Any] = Field(..., description="Complete metadata object")
    sha256: str = Field(..., description="SHA-256 hash of the audio file")
    filename: str = Field(..., description="Original filename")
    job_id: str | None = Field(None, description="Optional analysis Job ID to link IPFS data")


@router.post("/certificate")
async def generate_certificate(request: CertificateRequest):
    """
    Generate premium Certificate via IPFS (Pinata).
    Uploads the full metadata JSON to IPFS and returns the hash.
    The frontend will then render this certificate securely.
    
    Returns:
        JSON object with IPFS hash and URL.
    """
    try:
        from app.utils.pinata_client import upload_json_to_pinata
        from datetime import datetime
        
        # 1. Prepare the exact payload for the certificate
        timestamp = datetime.utcnow().isoformat() + "Z"
        
        certificate_data = {
            "type": "Digital Footprint Certificate",
            "generator": "Music Metadata Engine",
            "version": "2.1.0",
            "timestamp": timestamp,
            "verification": {
                "sha256": request.sha256,
                "filename": request.filename
            },
            # Complete metadata payload
            "metadata": request.metadata,
            # Legal Disclaimer embedded directly in the asset
            "legal_notice": "This certificate serves as a digital proof of authorship and metadata authenticity. The SHA-256 fingerprint ensures file integrity. This record is anchored on IPFS for decentralized verification."
        }
        
        # 2. Upload to Pinata
        pin_name = f"Cert_{request.filename}_{timestamp}"
        ipfs_result = await upload_json_to_pinata(certificate_data, pin_name)

        if request.job_id:
            from app.db import SessionLocal, Job
            db = SessionLocal()
            try:
                job = db.query(Job).filter(Job.id == request.job_id).first()
                if not job:
                    raise HTTPException(status_code=404, detail="Job not found")
                job.ipfs_hash = ipfs_result["ipfs_hash"]
                job.ipfs_url = ipfs_result["ipfs_url"]
                db.commit()
            finally:
                db.close()
        
        # 3. Return the IPFS keys
        return {
            "ipfs_hash": ipfs_result["ipfs_hash"],
            "ipfs_url": ipfs_result["ipfs_url"],
            "timestamp": timestamp,
            "status": "success" 
        }
    
    except Exception as e:
        logger.error(f"Certificate generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- SHA-256 Hash Generation ---

@router.post("/hash")
async def calculate_file_hash(file: UploadFile = File(...)):
    """
    Calculate SHA-256 hash for uploaded audio file.
    
    Returns:
        64-character hexadecimal SHA-256 hash
    """
    import tempfile
    import os
    from app.utils.hash_generator import generate_file_hash
    
    temp_file = None
    try:
        # Save uploaded file to temp location
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp:
            temp_file = temp.name
            content = await file.read()
            temp.write(content)
        
        # Calculate hash
        file_hash = generate_file_hash(temp_file)
        
        return {
            "sha256": file_hash,
            "filename": file.filename,
            "size_bytes": len(content)
        }
    
    except Exception as e:
        logger.error(f"Hash calculation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Cleanup temp file
        if temp_file and os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except:
                pass
