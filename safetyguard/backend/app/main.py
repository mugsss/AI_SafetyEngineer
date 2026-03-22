import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import Base, engine
from app.routers import runs, reports, uploads, simulator, playground, settings

# Register all models for create_all()
import app.models  # noqa: F401

logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SafetyGuard MAS API", version="1.0.0")


@app.middleware("http")
async def log_unhandled_exceptions(request: Request, call_next):
    """Catch real server bugs; let HTTPException / validation pass through."""
    try:
        return await call_next(request)
    except (HTTPException, RequestValidationError):
        raise
    except Exception:
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error. Check backend terminal logs."},
        )

# Dev: allow localhost / 127.0.0.1 on any port (3000 vs 3001, hostname mismatch, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["uploads"])
app.include_router(simulator.router, prefix="/api/simulator", tags=["simulator"])
app.include_router(playground.router, prefix="/api/playground", tags=["playground"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])


@app.get("/health")
async def health():
    return {"status": "ok"}
