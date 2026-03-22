import json

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.run import AnalysisRun
from app.models.user import User
from app.models.user_app_settings import UserAppSettings
from app.models.workflow_webhook import WorkflowWebhook
from app.schemas.workflow_webhook import (
    WorkflowWebhookCreate,
    WorkflowWebhookOut,
    WorkflowWebhookTestIn,
    WorkflowWebhookUpdate,
)
from app.utils.n8n_webhook import _collect_webhook_targets, _sign_payload, emit_workflow_event
from app.utils.n8n_public_api import probe_n8n_public_api
from app.config import settings as app_settings

router = APIRouter()


class AppSettings(BaseModel):
    featherless_api_key: str | None = None
    fail_ci_on_critical: bool = False
    notification_email: str | None = None
    slack_webhook_url: str | None = None
    notify_on_completion: bool = True
    notify_on_score_drop: bool = False
    notify_on_critical: bool = True
    score_threshold: int = 70
    # n8n Public API (https://docs.n8n.io/api/) — key is write-only; never returned on GET
    n8n_base_url: str | None = None
    n8n_api_key: str | None = None
    n8n_api_key_set: bool = False
    # Read-only: surfaced from server env N8N_WEBHOOK_URL for Settings UI (n8n links, etc.)
    n8n_webhook_url_from_env: str | None = None


class TestKeyInput(BaseModel):
    provider: str
    key: str


class TestKeyResult(BaseModel):
    success: bool
    message: str


class N8nApiTestIn(BaseModel):
    """Optional overrides; if omitted, uses saved settings then server env."""

    n8n_base_url: str | None = None
    n8n_api_key: str | None = None


class N8nWorkflowTriggerIn(BaseModel):
    run_id: str | None = None


def _app_defaults() -> dict:
    d = AppSettings().model_dump()
    d.pop("n8n_api_key_set", None)
    return d


def _settings_response_payload(stored: dict) -> dict:
    merged = {**_app_defaults(), **stored}
    has_n8n_key = bool(merged.get("n8n_api_key"))
    merged["n8n_api_key"] = None
    merged["n8n_api_key_set"] = has_n8n_key
    # When DB has no n8n instance URL, show server env so Settings + n8n links work without re-save.
    n8n_base = (merged.get("n8n_base_url") or "").strip()
    if not n8n_base:
        env_base = (app_settings.N8N_BASE_URL or "").strip()
        if env_base:
            merged["n8n_base_url"] = env_base
    merged["n8n_webhook_url_from_env"] = (app_settings.N8N_WEBHOOK_URL or "").strip() or None
    return merged


@router.get("", response_model=AppSettings)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(UserAppSettings)
        .filter(UserAppSettings.user_id == current_user.id)
        .first()
    )
    stored = row.data if row and isinstance(row.data, dict) else {}
    return AppSettings(**_settings_response_payload(stored))


@router.put("", response_model=AppSettings)
def update_settings(
    data: AppSettings,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(UserAppSettings)
        .filter(UserAppSettings.user_id == current_user.id)
        .first()
    )
    patch = data.model_dump(
        exclude_unset=True,
        exclude={"n8n_api_key_set", "n8n_webhook_url_from_env"},
    )
    old = row.data if row and isinstance(row.data, dict) else {}

    merged = {**old, **patch}
    if "n8n_api_key" in patch:
        k = patch.get("n8n_api_key")
        if k is None or (isinstance(k, str) and not k.strip()):
            merged["n8n_api_key"] = None
        else:
            merged["n8n_api_key"] = str(k).strip()
    else:
        merged["n8n_api_key"] = old.get("n8n_api_key")

    # Never persist computed flags
    merged.pop("n8n_api_key_set", None)

    if row:
        row.data = merged
    else:
        row = UserAppSettings(user_id=current_user.id, data=merged)
        db.add(row)
    db.commit()
    return AppSettings(**_settings_response_payload(merged))


@router.post("/n8n-api-test", response_model=TestKeyResult)
def test_n8n_public_api(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    body: N8nApiTestIn | None = Body(default=None),
):
    row = (
        db.query(UserAppSettings)
        .filter(UserAppSettings.user_id == current_user.id)
        .first()
    )
    stored = row.data if row and isinstance(row.data, dict) else {}
    b = body if body is not None else N8nApiTestIn()
    base = (b.n8n_base_url or "").strip() or stored.get("n8n_base_url") or app_settings.N8N_BASE_URL
    key = (b.n8n_api_key or "").strip() or stored.get("n8n_api_key") or app_settings.N8N_API_KEY
    ok, msg = probe_n8n_public_api(str(base or ""), str(key or ""))
    return TestKeyResult(success=ok, message=msg)


def _wh_to_out(w: WorkflowWebhook) -> WorkflowWebhookOut:
    return WorkflowWebhookOut(
        id=w.id,
        name=w.name,
        url=w.url,
        has_secret=bool(w.secret),
        enabled=w.enabled,
        created_at=w.created_at.isoformat() if w.created_at else "",
    )


@router.get("/workflow-webhooks", response_model=list[WorkflowWebhookOut])
def list_workflow_webhooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(WorkflowWebhook)
        .filter(WorkflowWebhook.user_id == current_user.id)
        .order_by(WorkflowWebhook.created_at.desc())
        .all()
    )
    return [_wh_to_out(w) for w in rows]


@router.post("/workflow-webhooks", response_model=WorkflowWebhookOut)
def create_workflow_webhook(
    body: WorkflowWebhookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.url.strip():
        raise HTTPException(status_code=400, detail="URL is required")
    w = WorkflowWebhook(
        user_id=current_user.id,
        name=body.name.strip() or "Workflow",
        url=body.url.strip(),
        secret=(body.secret.strip() if body.secret else None) or None,
        enabled=body.enabled,
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return _wh_to_out(w)


@router.put("/workflow-webhooks/{webhook_id}", response_model=WorkflowWebhookOut)
def update_workflow_webhook(
    webhook_id: str,
    body: WorkflowWebhookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    w = (
        db.query(WorkflowWebhook)
        .filter(
            WorkflowWebhook.id == webhook_id,
            WorkflowWebhook.user_id == current_user.id,
        )
        .first()
    )
    if not w:
        raise HTTPException(status_code=404, detail="Webhook not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        w.name = (data["name"] or "").strip() or w.name
    if "url" in data and data["url"] is not None:
        u = data["url"].strip()
        if not u:
            raise HTTPException(status_code=400, detail="URL cannot be empty")
        w.url = u
    if "enabled" in data and data["enabled"] is not None:
        w.enabled = data["enabled"]
    if "secret" in data:
        sec = data["secret"]
        if sec is None:
            pass
        elif sec == "":
            w.secret = None
        else:
            w.secret = sec.strip() or None
    db.commit()
    db.refresh(w)
    return _wh_to_out(w)


@router.delete("/workflow-webhooks/{webhook_id}")
def delete_workflow_webhook(
    webhook_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    w = (
        db.query(WorkflowWebhook)
        .filter(
            WorkflowWebhook.id == webhook_id,
            WorkflowWebhook.user_id == current_user.id,
        )
        .first()
    )
    if not w:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.delete(w)
    db.commit()
    return {"ok": True}


@router.post("/workflow-webhooks/test", response_model=TestKeyResult)
def test_workflow_webhook(
    body: WorkflowWebhookTestIn,
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    url = body.url.strip()
    if not url:
        return TestKeyResult(success=False, message="URL is required")
    payload = {
        "event": "workflow.test",
        "source": "safetyguard",
        "message": "Test ping from SafetyGuard Settings",
    }

    raw = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json", "User-Agent": "SafetyGuard/1.0"}
    sec = (body.secret or "").strip()
    if sec:
        headers["X-SafetyGuard-Signature"] = f"sha256={_sign_payload(raw, sec)}"
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(url, content=raw, headers=headers)
        if r.status_code < 400:
            return TestKeyResult(success=True, message=f"OK ({r.status_code})")
        return TestKeyResult(
            success=False,
            message=f"HTTP {r.status_code}: {(r.text or '')[:300]}",
        )
    except Exception as e:
        return TestKeyResult(success=False, message=str(e)[:300])


@router.post("/workflow-webhooks/trigger", response_model=TestKeyResult)
def trigger_workflow_webhook(
    body: N8nWorkflowTriggerIn | None = Body(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _collect_webhook_targets(current_user.id):
        return TestKeyResult(
            success=False,
            message="No webhook configured. Add one in Settings -> Workflow automation.",
        )

    run_id = body.run_id if body else None
    extra: dict = {"source_action": "dashboard_button"}
    status = "manual"
    if run_id:
        run = (
            db.query(AnalysisRun)
            .filter(AnalysisRun.id == run_id, AnalysisRun.user_id == current_user.id)
            .first()
        )
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")
        status = run.status or "manual"
        extra.update(
            {
                "repo_url": run.repo_url or "",
                "branch": run.branch or "",
                "links": {"report": f"/report/{run_id}"},
            }
        )

    result = emit_workflow_event(
        "workflow.manual_triggered",
        run_id=run_id or "manual-trigger",
        status=status,
        user_id=current_user.id,
        extra=extra,
    )
    if result.get("sent", 0) > 0:
        return TestKeyResult(
            success=True,
            message=f"n8n trigger sent to {result.get('sent', 0)} target(s)",
        )
    detail = ""
    errors = result.get("errors", [])
    if errors:
        detail = f" Last error: {errors[0]}"
    return TestKeyResult(
        success=False,
        message=(
            "n8n did not accept the webhook. Ensure workflow is active and path is correct "
            "(production URL usually uses /webhook/, test URL uses /webhook-test/ only when Execute is waiting)."
            + detail
        ),
    )


@router.post("/test-key", response_model=TestKeyResult)
async def test_api_key(
    data: TestKeyInput,
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    if not data.key or len(data.key) < 10:
        return TestKeyResult(success=False, message="Invalid key format")
    return TestKeyResult(success=True, message=f"{data.provider} key is valid")
