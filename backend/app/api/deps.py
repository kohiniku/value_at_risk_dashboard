from collections.abc import Generator

from sqlalchemy.orm import Session

from app.db_ch.session import SessionLocal


def get_ch_db() -> Generator[Session, None, None]:
    """Yield a ClickHouse database session."""
    with SessionLocal() as session:
        yield session
