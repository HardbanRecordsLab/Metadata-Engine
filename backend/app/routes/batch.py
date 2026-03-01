from fastapi import APIRouter, UploadFile, File, Form
from typing import List

router = APIRouter()


@router.post("/batch/analyze")
async def batch_analyze(files: List[UploadFile] = File(...), user: str = Form(...)):
    # Placeholder: process each file, return dummy results
    results = []
    for f in files:
        # Here you would call ML/audio analysis logic
        results.append({"file": f.filename, "result": "analyzed", "user": user})
    return {"results": results}
