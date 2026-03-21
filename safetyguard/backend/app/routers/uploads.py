import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from app.config import settings
from app.models.user import User
from app.dependencies import get_current_user

router = APIRouter()


class UploadResponse(BaseModel):
    upload_id: str
    filename: str
    size: int


@router.post("/zip", response_model=UploadResponse)
async def upload_zip(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are accepted")

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB}MB",
        )

    upload_id = str(uuid.uuid4())
    upload_dir = os.path.join(settings.UPLOAD_DIR, upload_id)
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as f:
        f.write(contents)

    return UploadResponse(
        upload_id=upload_id,
        filename=file.filename,
        size=len(contents),
    )
