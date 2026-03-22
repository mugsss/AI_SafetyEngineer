# SafetyGuard MAS

A production-ready, full-stack multi-agent AI safety evaluation platform. Point SafetyGuard at any AI-powered codebase (via Git URL or zip upload), run a battery of specialized safety agents, and receive a structured report covering: Risk, Security, Hallucinations, Failure Modes, Cost, Privacy, Observability, Performance, Resources, and Red Team.

## Architecture

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** FastAPI (Python 3.11) + LangGraph + SQLite (dev) / PostgreSQL (prod) + Redis (job queue)

## Quick Start (Development)

```bash
# 1. Copy env (single file for backend + frontend URL hints — lives in safetyguard/.env)
cp .env.example .env
# Edit .env: set SECRET_KEY (32+ chars). For LLMs: set OPENAI_API_KEY or FEATHERLESS_API_KEY; omit both or use FEATHERLESS_API_KEY=mock for offline mock analysis.

# Frontend API URL (optional — defaults to localhost:8000 in code if missing)
cp frontend/.env.example frontend/.env.local

# 2. Start infra
docker-compose up -d postgres redis

# 3. Backend
cd backend
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload

# 4. Celery worker (new terminal)
cd backend
celery -A app.tasks.analysis_tasks worker --loglevel=info

# 5. Frontend (new terminal)
cd frontend
npm install
npm run dev
# If the UI calls the wrong host for API routes, set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`
# in `frontend/.env.local`, or omit it and rely on `next.config.mjs` rewrites (`/api/*` → FastAPI).
# If the browser tab freezes or chunks fail to load, clear the Next cache and restart:
# npm run dev:clean
#
# If Chrome tabs keep crashing (Aw, Snap!) while developing: stop duplicate servers —
# only one `next dev` and one `uvicorn` should listen on 3000/8000. Example:
#   lsof -iTCP:3000 -sTCP:LISTEN; lsof -iTCP:8000 -sTCP:LISTEN
#   pkill -f "next dev"; pkill -f uvicorn
# Then start a single frontend + backend again.
```

### “Internal Server Error” in the browser

- **Next.js (localhost:3000):** Often a **stale `.next` cache** or a dev-server glitch. Run `cd frontend && npm run dev:clean`. Ensure only **one** `next dev` is running.
- **API (localhost:8000):** The backend logs the traceback in the terminal where `uvicorn` runs. Fix the underlying error (DB path, missing env, etc.). Real bugs return JSON `{"detail":"..."}` with HTTP 500.

**Why tabs sometimes crash during local dev:** Chrome’s GPU process can choke on stacked `backdrop-blur`, large `blur-*` filters, and heavy animation libraries. This frontend intentionally avoids those patterns on the home page, dashboard, and report views. If crashes persist, update Chrome, disable “Use hardware acceleration” temporarily in settings, or try another browser to confirm it’s GPU-related.

**Stability notes (2025):** The report view uses native `overflow-y-auto` instead of Radix `ScrollArea` (avoids ResizeObserver loops). A root **React error boundary** shows a recovery UI instead of a blank screen if a component throws. **React Query** has `refetchOnWindowFocus: false` by default to reduce request storms when switching back to the tab. Live run status uses **EventSource** with safe teardown; if the backend is down, the stream closes cleanly instead of spinning forever.

- App: http://localhost:3000
- API docs: http://localhost:8000/docs

## LLM configuration

The backend uses **OpenAI** if `OPENAI_API_KEY` is set (optional `OPENAI_BASE_URL`, `OPENAI_MODEL`). Otherwise it uses **Featherless** when `FEATHERLESS_API_KEY` is set and not `"mock"`. See `.env.example` for all variables.

## Mock Mode

When **no** valid LLM key is configured (or `FEATHERLESS_API_KEY` is the literal `"mock"` and OpenAI is unset), the backend runs in mock mode: deterministic mock findings so the UI can be developed without LLM costs.

## n8n workflow automation (optional)

**Ready-made workflow:** Import `n8n/safetyguard-inbound-workflow.json` and follow **`n8n/README.md`** (activate → copy Production URL → paste into SafetyGuard Settings → run a test or analysis).

**Purpose:** Keep SafetyGuard focused on analysis while n8n handles *what happens next*—Slack/Teams alerts, email digests, Jira/Linear tickets, Google Sheets logging, CRM updates, or conditional escalation when scores drop below a threshold.

**How it works:** After each run finishes (success or failure), the backend `POST`s JSON to every configured webhook:

1. **Settings UI (recommended):** **Settings → Workflow automation (n8n)** — add one or more named URLs (e.g. internal vs customer n8n flows), optional per-URL signing secret, **Test** ping, enable/disable.
2. **Server env (global fallback):** In `.env`:
   - `N8N_WEBHOOK_URL=<webhook URL>` — merged with UI-configured URLs (deduped by URL).
   - `N8N_WEBHOOK_SECRET=<optional>` — HMAC for the env URL only.
   - `FRONTEND_BASE_URL=https://your-app.example.com` — used for `links.report` in the payload.

**API:** `GET/POST/PUT/DELETE /api/settings/workflow-webhooks`, `POST /api/settings/workflow-webhooks/test`. Events: `analysis.completed`, `analysis.failed` (see `app/utils/n8n_webhook.py`).

**n8n Public API (optional):** In **Settings** → **n8n Public API**, set your **instance root URL** (e.g. `https://yourname.app.n8n.cloud`) and the key from n8n **Settings → n8n API**. Use **Test n8n API** to verify (`GET /api/v1/workflows`). You can also set `N8N_BASE_URL` and `N8N_API_KEY` in `.env`. *Note: n8n’s REST API may require a paid plan — see [n8n API docs](https://docs.n8n.io/api/).*

**Database:** Webhooks and other app settings are stored in SQLite/Postgres (`workflow_webhooks`, `user_app_settings`). Run `alembic upgrade head` if you use migrations; otherwise `create_all` on startup creates new tables.

**Why this makes the product stronger:** Multiple outbound targets, persisted config, and optional signatures—without redeploying for every new integration.

## Authentication

The API supports JWT login, but the UI can be used **without login**: unauthenticated requests are mapped to a shared **anonymous** user.

## Troubleshooting

### “Failed to create run” / API errors in the UI

1. **Backend must be running** on the URL the frontend uses (`NEXT_PUBLIC_API_URL` in `frontend/.env.local`, default `http://localhost:8000`). Check: `curl http://localhost:8000/health` → `{"status":"ok"}`.
2. **CORS** – The API allows `localhost` and `127.0.0.1` on any port. If you use another origin, adjust `allow_origin_regex` / `allow_origins` in `backend/app/main.py`.
3. **Clear Next cache** if the app behaves oddly: `cd frontend && npm run clean && npm run dev`.
4. The **New analysis** page shows the **real error message** from the API (e.g. connection refused vs. server error).

### Backend env file

- Put your **`.env` in `safetyguard/`** (next to this README). The backend **automatically loads that file** even when you run `uvicorn` from `safetyguard/backend/`.
- Optional: add `backend/.env` for machine-specific overrides.
- **Frontend:** copy `frontend/.env.example` → `frontend/.env.local` so `NEXT_PUBLIC_API_URL` matches the API (default `http://localhost:8000`).

### Quick API check

```bash
curl -s http://localhost:8000/health
# expect: {"status":"ok"}
```
