from typing import Dict

from fastapi import APIRouter, Body, HTTPException, Response

from app.services import cwr21

router = APIRouter(prefix="/cwr", tags=["cwr"])


@router.post("/export")
def export_cwr(metadata: Dict = Body(...)):
    """CWR 2.1 new-work registration for an analysis result.

    Body: the analysis metadata, optionally with ``splitsheet`` (a signed split sheet from /intelligence/splitsheet, which supplies the
    writers and shares) and ``cwr`` ({writers, publishers, category, language, submitter_work_number}). Without either, a single named
    writer is given 100 % of every right; several names need their shares (422).

    The file is a DRAFT (name prefix, X-CWR-Submittable: false, X-CWR-Missing) until the submitter ID the society issued (CWR_SENDER_ID,
    CWR_SENDER_NAME) and the IPI numbers and society codes of the writers and publishers are filled in: a society accepts files only from
    approved CWR participants. See docs/CWR.md."""
    try:
        res = cwr21.export_metadata(metadata, splitsheet=metadata.get("splitsheet"))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e).split("\n"))
    return Response(content=res.text, media_type="text/plain", headers=cwr21.response_headers(res))
