# SafetyGuard MAS

A production-ready, full-stack multi-agent AI safety evaluation platform. Point SafetyGuard at any AI-powered codebase (via Git URL or zip upload), run a battery of specialized safety agents, and receive a structured report covering: Risk, Security, Hallucinations, Failure Modes, Cost, Privacy, Observability, Performance, Resources, and Red Team.

## Architecture

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** FastAPI (Python 3.11) + LangGraph + SQLite (dev) / PostgreSQL (prod) + Redis (job queue)

## Quick Start (Development)

```bash
# 1. Copy env
cp .env.example .env
# Edit .env with your OPENAI_API_KEY and SECRET_KEY

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

When `OPENAI_API_KEY` is not set or set to `"mock"`, the backend returns deterministic mock findings so the UI can be developed without LLM costs.
