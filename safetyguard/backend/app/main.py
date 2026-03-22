from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import runs, reports, uploads, simulator, playground, settings

# Register all models for create_all()
import app.models  # noqa: F401

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SafetyGuard MAS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ],
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
