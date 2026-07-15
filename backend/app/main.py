"""Application entrypoint for the Value at Risk API."""

from __future__ import annotations

import asyncio
import functools
import os
from concurrent.futures import ThreadPoolExecutor

import anyio.to_thread
import starlette.concurrency
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as api_router
from .core.config import settings

_threadpool_executor: ThreadPoolExecutor | None = None


def _get_threadpool_executor() -> ThreadPoolExecutor:
    global _threadpool_executor
    if _threadpool_executor is None:
        max_workers = int(os.getenv("VAR_THREADPOOL_WORKERS", "20"))
        _threadpool_executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="var-api")
    return _threadpool_executor


async def _run_in_threadpool(func, *args, **kwargs):
    loop = asyncio.get_running_loop()
    bound = functools.partial(func, *args, **kwargs)
    return await loop.run_in_executor(_get_threadpool_executor(), bound)


if os.getenv("VAR_PATCH_THREADPOOL", "1").strip().lower() not in {"0", "false", "no"}:
    # Patch Starlette's sync execution to use a dedicated executor.
    # This avoids occasional AnyIO deadlocks and also keeps unittest teardown fast,
    # because we can explicitly shut the executor down on app shutdown.
    async def _anyio_run_sync(func, *args, **kwargs):
        # Match anyio.to_thread.run_sync signature; ignore cancellation/limiters here.
        kwargs.pop("cancellable", None)
        kwargs.pop("limiter", None)
        return await _run_in_threadpool(func, *args, **kwargs)

    anyio.to_thread.run_sync = _anyio_run_sync  # type: ignore[assignment]
    starlette.concurrency.run_in_threadpool = _run_in_threadpool  # type: ignore[assignment]

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


@app.on_event("shutdown")
def on_shutdown() -> None:
    global _threadpool_executor
    if _threadpool_executor is None:
        return
    _threadpool_executor.shutdown(wait=True, cancel_futures=True)
    _threadpool_executor = None
