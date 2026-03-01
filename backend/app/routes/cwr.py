
from fastapi import APIRouter, Body, Response
from typing import Dict
from app.utils.cwr_handler import generate_cwr_record

router = APIRouter(prefix="/cwr", tags=["cwr"])

@router.post("/export")
def export_cwr(metadata: Dict = Body(...)):
    """
    Generates a Common Works Registration (CWR) 2.1 file content.
    """
    cwr_content = generate_cwr_record(metadata)
    return Response(
        content=cwr_content, 
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename=registration_{metadata.get('isrc', 'work')}.cwr"}
    )
