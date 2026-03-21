from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth, runs, reports, uploads, simulator, playground, settings

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SafetyGuard MAS API", version="1.0.0")

# Dev: allow localhost / 127.0.0.1 on any port (3000 vs 3001, hostname mismatch, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["uploads"])
app.include_router(simulator.router, prefix="/api/simulator", tags=["simulator"])
app.include_router(playground.router, prefix="/api/playground", tags=["playground"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])


@app.get("/health")
async def health():
    return {"status": "ok"}
