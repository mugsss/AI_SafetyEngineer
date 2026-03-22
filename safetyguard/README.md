# SafetyGuard MAS

A production-ready, full-stack multi-agent AI safety evaluation platform. Point SafetyGuard at any AI-powered codebase (via Git URL or zip upload), run a battery of specialized safety agents, and receive a structured report covering: Risk, Security, Hallucinations, Failure Modes, Cost, Privacy, Observability, Performance, Resources, and Red Team.

## Architecture

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** FastAPI (Python 3.11) + LangGraph + SQLite (dev) / PostgreSQL (prod) + Redis (job queue)

## Quick Start (Development)

```bash
# 1. Copy env
cp .env.example .env
# Edit .env with your FEATHERLESS_API_KEY (or use mock mode)

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
```

- App: http://localhost:3000
- API docs: http://localhost:8000/docs

## Mock Mode

When `FEATHERLESS_API_KEY` is not set or set to `"mock"`, the backend returns deterministic mock findings so the UI can be developed without LLM costs.

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

This app ships **without login**: the API uses a single local **Guest** user for all runs and settings.
