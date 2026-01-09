"""Application entrypoint for the Value at Risk API."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as api_router
from .core.config import settings
from .db.seed import init_db

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_str)


@app.get("/health", tags=["system"])
def healthcheck() -> dict[str, str]:
    """Lightweight health endpoint for monitoring."""

    return {"status": "ok"}


@app.on_event("startup")
def on_startup() -> None:
    """Ensure database schema and demo data are ready."""

    init_db()
