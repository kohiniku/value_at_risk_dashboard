"""Database engine and session management."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ..core.config import settings

engine = create_engine(
    f"postgresql://{settings.pgdb_user}:{settings.pgdb_password}@{settings.pgdb_url}:{settings.pgdb_port}/{settings.pgdb_database}"
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
