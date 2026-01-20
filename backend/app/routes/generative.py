from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from pydantic import BaseModel, Field
from typing import Dict, Any, List
import json
import logging
import random
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

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


# --- Cover Generation (Local Pillow Fallback) ---

class CoverRequest(BaseModel):
    title: str
    artist: str
    genre: str = "Electronic"
    mood: str = "Neutral"

def get_gradient_colors(genre: str):
    """Return start/end colors based on genre."""
    genre = genre.lower()
    if "metal" in genre or "rock" in genre:
        return (20, 0, 0), (100, 0, 0) # Dark Red
    if "pop" in genre:
        return (255, 105, 180), (255, 20, 147) # Pink/HotPink
    if "jazz" in genre or "blues" in genre:
        return (0, 0, 50), (20, 20, 100) # Dark Blue
    if "electronic" in genre or "techno" in genre:
        return (0, 0, 0), (0, 255, 200) # Cyberpunk Cyan
    if "ambient" in genre:
        return (200, 200, 255), (255, 255, 255) # Ethereal White/Blue
    # Default
    return (random.randint(0, 100), random.randint(0, 100), random.randint(0, 100)), \
           (random.randint(50, 200), random.randint(50, 200), random.randint(50, 200))

@router.post("/cover")
async def generate_cover(request: CoverRequest):
    """
    Generate a high-quality cover art image.
    1. Fetches a thematic background from pollinations.ai based on title and genre.
    2. Overlays the Title and Artist name with premium typography.
    """
    try:
        import httpx
        from urllib.parse import quote
        
        width, height = 1024, 1024
        
        # Step 1: Create a prompt for the background image
        genre_safe = request.genre or "General"
        title_safe = request.title or "Track"
        artist_safe = request.artist or "Artist"
        
        # User Requirement: Structure: "{Artist} - {Title}. {Visual Prompt specifically related to title}"
        image_prompt = f"{artist_safe} - {title_safe}. Professional album cover art, visual content strictly related to the concept of '{title_safe}', {genre_safe} aesthetic, cinematic lighting, 8k resolution, highly detailed"
        encoded_prompt = quote(image_prompt)
        image_url = f"https://pollinations.ai/p/{encoded_prompt}?width={width}&height={height}&seed={random.randint(0, 1000000)}&nologo=true"
        
        logger.info(f"Fetching thematic background: {image_url}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                img_res = await client.get(image_url)
                if img_res.status_code == 200:
                    base = Image.open(BytesIO(img_res.content)).convert('RGB')
                else:
                    logger.warning(f"Pollinations fetch returned status: {img_res.status_code}")
                    raise Exception(f"Failed to fetch image: {img_res.status_code}")
        except Exception as fetch_err:
            logger.warning(f"Pollinations fetch failed ({fetch_err}), using gradient fallback.")
            # Fallback to gradient if external service fails
            start_color, end_color = get_gradient_colors(request.genre)
            base = Image.new('RGB', (width, height), start_color)
            top = Image.new('RGB', (width, height), end_color)
            mask = Image.new('L', (width, height))
            mask_data = []
            for y in range(height):
                mask_data.extend([int(255 * (y / height))] * width)
            mask.putdata(mask_data)
            base.paste(top, (0, 0), mask)

        # Step 2: Overlay Typography
        draw = ImageDraw.Draw(base, "RGBA")
        
        # Overlay a subtle dark gradient at the bottom for text legibility
        overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        for i in range(height // 2, height):
            alpha = int(180 * ((i - height // 2) / (height // 2)))
            overlay_draw.line([(0, i), (width, i)], fill=(0, 0, 0, alpha))
        base = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
        draw = ImageDraw.Draw(base)

        # Fonts
        try:
            # Try some common high-quality fonts on Windows
            font_title = ImageFont.truetype("arialbd.ttf", 80) # Bold
            font_artist = ImageFont.truetype("arial.ttf", 50)
        except:
             font_title = ImageFont.load_default()
             font_artist = ImageFont.load_default()
             
        def draw_centered_text(text, font, y_pos, color=(255, 255, 255)):
            try:
                # Pillow >= 10.0.0
                left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
                w, h = right - left, bottom - top
                x = (width - w) / 2
                # Draw subtle drop shadow
                draw.text((x+2, y_pos+2), text, font=font, fill=(0,0,0,128))
                draw.text((x, y_pos), text, font=font, fill=color)
            except:
                # Legacy Pillow
                w, h = draw.textsize(text, font=font)
                x = (width - w) / 2
                draw.text((x, y_pos), text, font=font, fill=color)

        draw_centered_text(request.title.upper(), font_title, height - 200)
        draw_centered_text(request.artist, font_artist, height - 100)
        
        # Save to buffer
        buffer = BytesIO()
        base.save(buffer, format="JPEG", quality=90)
        buffer.seek(0)
        
        img_str = base64.b64encode(buffer.getvalue()).decode()
        return {"image": f"data:image/jpeg;base64,{img_str}"}

    except Exception as e:
        logger.error(f"Cover generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        logger.error(f"Cover generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
