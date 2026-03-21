import os
import shutil
import tempfile
import zipfile

from git import Repo

from app.config import settings


def clone_repo(repo_url: str, branch: str = "main") -> str:
    temp_dir = tempfile.mkdtemp(prefix="safetyguard_")
    try:
        Repo.clone_from(repo_url, temp_dir, branch=branch, depth=1)
    except Exception:
        Repo.clone_from(repo_url, temp_dir, depth=1)
    return temp_dir


def extract_upload(upload_id: str) -> str:
    upload_dir = os.path.join(settings.UPLOAD_DIR, upload_id)
    if not os.path.exists(upload_dir):
        raise FileNotFoundError(f"Upload {upload_id} not found")

    zip_files = [f for f in os.listdir(upload_dir) if f.endswith(".zip")]
    if not zip_files:
        raise FileNotFoundError(f"No zip file found in upload {upload_id}")

    temp_dir = tempfile.mkdtemp(prefix="safetyguard_")
    zip_path = os.path.join(upload_dir, zip_files[0])

    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(temp_dir)

    return temp_dir


def cleanup_repo(repo_path: str) -> None:
    if repo_path and os.path.exists(repo_path):
        shutil.rmtree(repo_path, ignore_errors=True)
