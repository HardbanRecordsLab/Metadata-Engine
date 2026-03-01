from fastapi import APIRouter, Body, Response
from typing import Dict
from app.utils.ddex_ern import generate_ddex_ern_xml

router = APIRouter(prefix="/ddex", tags=["ddex"])


@router.post("/export")
def export_ddex(metadata: Dict = Body(...)):
    xml_str = generate_ddex_ern_xml(metadata)
    return Response(content=xml_str, media_type="application/xml")
