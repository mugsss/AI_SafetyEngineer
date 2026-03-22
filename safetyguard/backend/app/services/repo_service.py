import os
import shutil
import tempfile
import uuid
import zipfile

from git import Repo

from app.config import settings


def _repos_base() -> str:
    """Writable directory for Git clones and extracted uploads."""
    raw = (getattr(settings, "CLONE_WORK_DIR", None) or "").strip()
    if raw:
        return os.path.abspath(os.path.expanduser(raw))
    return os.path.join(tempfile.gettempdir(), "safetyguard_repos")


def _make_work_dir() -> str:
    base = _repos_base()
    os.makedirs(base, exist_ok=True)
    path = os.path.join(base, f"sg_{uuid.uuid4().hex[:12]}")
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
