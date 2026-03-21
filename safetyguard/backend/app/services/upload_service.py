import os
from app.config import settings


def get_upload_path(upload_id: str) -> str | None:
    upload_dir = os.path.join(settings.UPLOAD_DIR, upload_id)
    if os.path.exists(upload_dir):
        return upload_dir
    return None
