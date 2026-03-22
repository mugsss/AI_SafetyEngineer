import os
import shutil
import uuid
import zipfile

from git import Repo

from app.config import settings

REPOS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "repos")


def _make_work_dir() -> str:
    os.makedirs(REPOS_DIR, exist_ok=True)
    path = os.path.join(REPOS_DIR, f"sg_{uuid.uuid4().hex[:12]}")
    os.makedirs(path)
    return path


def clone_repo(repo_url: str, branch: str = "main") -> str:
    work_dir = _make_work_dir()
    # Skip Git LFS smudge so large dataset blobs do not block or fill disk during clone
    clone_env = {
        **os.environ,
        "GIT_TEMPLATE_DIR": "",
        "GIT_LFS_SKIP_SMUDGE": "1",
    }
    try:
        Repo.clone_from(repo_url, work_dir, branch=branch, depth=1, env=clone_env)
    except Exception:
        shutil.rmtree(work_dir, ignore_errors=True)
        work_dir = _make_work_dir()
        # Default branch (often main/master) when named branch is missing or wrong
        Repo.clone_from(repo_url, work_dir, depth=1, env=clone_env)
    return work_dir


def extract_upload(upload_id: str) -> str:
    upload_dir = os.path.join(settings.UPLOAD_DIR, upload_id)
    if not os.path.exists(upload_dir):
        raise FileNotFoundError(f"Upload {upload_id} not found")

    zip_files = [f for f in os.listdir(upload_dir) if f.endswith(".zip")]
    if not zip_files:
        raise FileNotFoundError(f"No zip file found in upload {upload_id}")

    work_dir = _make_work_dir()
    zip_path = os.path.join(upload_dir, zip_files[0])

    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(work_dir)

    return work_dir


def cleanup_repo(repo_path: str) -> None:
    if repo_path and os.path.exists(repo_path):
        shutil.rmtree(repo_path, ignore_errors=True)
