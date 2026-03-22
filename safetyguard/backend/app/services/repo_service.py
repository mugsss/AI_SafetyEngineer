import os
import shutil
import subprocess
import uuid
import zipfile
from pathlib import Path

from app.config import settings

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


def _default_clone_base() -> str:
    """Inside the repo checkout (workspace): allowed when the API runs under Cursor/macOS sandboxes.

    ~/.cache, /tmp, and sometimes Desktop paths get EPERM for the `git` subprocess
    ("could not create work tree dir" or "could not write .git/config").
    """
    return str(_BACKEND_DIR / ".data" / "clones")


def _repos_base() -> str:
    """Writable directory for Git clones and extracted uploads."""
    raw = (getattr(settings, "CLONE_WORK_DIR", None) or "").strip()
    if raw:
        return os.path.abspath(os.path.expanduser(raw))
    return _default_clone_base()


def _make_work_dir() -> str:
    """Create an empty directory (e.g. for zip extract)."""
    base = _repos_base()
    os.makedirs(base, exist_ok=True)
    path = os.path.join(base, f"sg_{uuid.uuid4().hex[:12]}")
    os.makedirs(path)
    return path


def _git_env() -> dict[str, str]:
    """Subprocess env must be str->str only (some platforms choke on None)."""
    env: dict[str, str] = {
        k: v
        for k, v in os.environ.items()
        if isinstance(v, str)
    }
    env["GIT_TEMPLATE_DIR"] = ""
    env["GIT_LFS_SKIP_SMUDGE"] = "1"
    return env


def clone_repo(repo_url: str, branch: str = "main") -> str:
    """Clone via the system `git` binary (subprocess; no GitPython)."""
    git_bin = shutil.which("git")
    if not git_bin:
        raise RuntimeError(
            "git binary not found on PATH. Install Git (e.g. Xcode CLI tools or Homebrew) "
            "and ensure `git --version` works in the same environment as the API server."
        )

    base = _repos_base()
    os.makedirs(base, exist_ok=True)
    work_dir = os.path.join(base, f"sg_{uuid.uuid4().hex[:12]}")
    env = _git_env()

    def _run(args: list[str]) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            args,
            env=env,
            check=False,
            capture_output=True,
            text=True,
            timeout=900,
        )

    # Destination must not exist — git creates it
    try:
        proc = _run(
            [
                git_bin,
                "clone",
                "-v",
                "--depth",
                "1",
                "--branch",
                branch,
                repo_url,
                work_dir,
            ]
        )
    except subprocess.TimeoutExpired as e:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise RuntimeError("git clone timed out after 900s") from e

    if proc.returncode != 0:
        shutil.rmtree(work_dir, ignore_errors=True)
        work_dir = os.path.join(base, f"sg_{uuid.uuid4().hex[:12]}")
        try:
            proc = _run([git_bin, "clone", "-v", "--depth", "1", repo_url, work_dir])
        except subprocess.TimeoutExpired as e:
            shutil.rmtree(work_dir, ignore_errors=True)
            raise RuntimeError("git clone timed out after 900s") from e
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or "").strip() or f"exit {proc.returncode}"
            raise RuntimeError(f"git clone failed: {err}")

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
