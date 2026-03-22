"""Optional outbound webhooks to n8n (or any HTTP listener) for workflow automation."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _sign_payload(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def _candidate_urls(url: str) -> list[str]:
    """Try test URL first, then production URL fallback for n8n."""
    u = (url or "").strip()
    if not u:
        return []
    urls = [u]
    if "/webhook-test/" in u:
        urls.append(u.replace("/webhook-test/", "/webhook/", 1))
    return urls


def _collect_webhook_targets(user_id: str | None) -> list[tuple[str, str]]:
    """Return list of (url, secret) with global env first, then user-configured."""
    targets: list[tuple[str, str]] = []

    env_url = (settings.N8N_WEBHOOK_URL or "").strip()
    if env_url:
        targets.append((env_url, (settings.N8N_WEBHOOK_SECRET or "").strip()))

    if user_id:
        from app.database import SessionLocal
        from app.models.workflow_webhook import WorkflowWebhook

        db = SessionLocal()
        try:
            rows = (
                db.query(WorkflowWebhook)
                .filter(
                    WorkflowWebhook.user_id == user_id,
                    WorkflowWebhook.enabled.is_(True),
                )
                .all()
            )
            for r in rows:
                u = (r.url or "").strip()
                if u:
                    targets.append((u, (r.secret or "").strip()))
        finally:
            db.close()

    seen: set[str] = set()
    deduped: list[tuple[str, str]] = []
    for url, sec in targets:
        if url not in seen:
            seen.add(url)
            deduped.append((url, sec))
    return deduped


def emit_workflow_event(
    event: str,
    *,
    run_id: str,
    status: str,
    user_id: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """POST JSON to all configured webhook URLs. Never raises."""
    targets = _collect_webhook_targets(user_id)
    if not targets:
        return {"targets": 0, "sent": 0, "failed": 0, "errors": ["No webhook targets configured"]}

    payload: dict[str, Any] = {
        "event": event,
        "source": "safetyguard",
        "run_id": run_id,
        "status": status,
    }
    if extra:
        payload.update(extra)

    body = json.dumps(payload, default=str).encode("utf-8")
    base_headers: dict[str, str] = {
        "Content-Type": "application/json",
        "User-Agent": "SafetyGuard/1.0",
    }

    sent = 0
    failed = 0
    errors: list[str] = []
    for url, secret in targets:
        headers = dict(base_headers)
        if secret:
            headers["X-SafetyGuard-Signature"] = f"sha256={_sign_payload(body, secret)}"
        delivered = False
        last_err = ""
        for candidate in _candidate_urls(url):
            try:
                with httpx.Client(timeout=15.0) as client:
                    r = client.post(candidate, content=body, headers=headers)
                if r.status_code < 400:
                    delivered = True
                    sent += 1
                    break
                last_err = f"{candidate[:120]} -> HTTP {r.status_code}: {(r.text or '')[:200]}"
                logger.warning("Webhook returned %s for %s", r.status_code, candidate[:120])
            except Exception as exc:
                last_err = f"{candidate[:120]} -> {str(exc)[:200]}"
                logger.exception(
                    "Webhook failed for run %s event %s url=%s",
                    run_id,
                    event,
                    candidate[:80],
                )
        if not delivered:
            failed += 1
            if last_err:
                errors.append(last_err)
    return {"targets": len(targets), "sent": sent, "failed": failed, "errors": errors}
