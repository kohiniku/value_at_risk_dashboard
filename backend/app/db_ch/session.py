"""Database engine and session management.

ClickHouse is optional for unit tests. Importing this module
must not block on network connectivity, so the engine is initialized lazily.
"""

from __future__ import annotations

import os
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from ..core.config import settings


@lru_cache
def _get_engine() -> Engine:
    url = f"clickhouse+native://{settings.chdb_user}:{settings.chdb_password}@{settings.chdb_url}:{settings.chdb_port}/{settings.chdb_database}"
    connect_timeout = float(os.getenv("CH_CONNECT_TIMEOUT", "2"))
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=50,
        max_overflow=100,
        connect_args={"connect_timeout": connect_timeout},
    )


@lru_cache
def _get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=_get_engine(), autoflush=False, autocommit=False)


def SessionLocal() -> Session:
    return _get_sessionmaker()()
