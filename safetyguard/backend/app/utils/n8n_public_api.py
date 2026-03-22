"""Call n8n Public API (https://docs.n8n.io/api/) — not the Webhook node URL."""

from __future__ import annotations

import httpx


def probe_n8n_public_api(base_url: str, api_key: str) -> tuple[bool, str]:
    """GET /api/v1/workflows — tries X-N8N-API-KEY first, then Bearer (some JWT deployments)."""
    base = (base_url or "").strip().rstrip("/")
    key = (api_key or "").strip()
    if not base:
        return False, "n8n base URL is empty (e.g. https://yourname.app.n8n.cloud)"
    if not key:
        return False, "n8n API key is empty"
    if not base.startswith(("http://", "https://")):
        return False, "Base URL must start with https://"

    url = f"{base}/api/v1/workflows"
    params = {"limit": 1}
    accept = {"Accept": "application/json"}

    with httpx.Client(timeout=25.0, follow_redirects=True) as client:
        r1 = client.get(
            url,
            params=params,
            headers={**accept, "X-N8N-API-KEY": key},
        )
        if r1.status_code == 200:
            return True, "Connected (n8n Public API, X-N8N-API-KEY)"

        # JWT-style keys sometimes expect Bearer (cloud / gateway)
        r2 = client.get(
            url,
            params=params,
            headers={**accept, "Authorization": f"Bearer {key}"},
        )
        if r2.status_code == 200:
            return True, "Connected (n8n Public API, Bearer)"

        err = (r1.text or r2.text or "").strip()
        if len(err) > 400:
            err = err[:400] + "..."
        return (
            False,
            f"n8n API auth failed (HTTP {r1.status_code} / {r2.status_code}). "
            f"Set your instance root URL (no trailing path). Detail: {err or 'no body'}",
        )
