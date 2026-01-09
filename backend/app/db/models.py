from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class VaRSnapshot(Base):
    __tablename__ = "var_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    as_of: Mapped[date] = mapped_column(Date, unique=True, nullable=False, index=True)
    portfolio_total: Mapped[float] = mapped_column(Float, nullable=False)
    portfolio_change_amount: Mapped[float] = mapped_column(Float, nullable=False)
    portfolio_change_pct: Mapped[float] = mapped_column(Float, nullable=False)
    diversification_effect: Mapped[float] = mapped_column(Float, nullable=False)

    assets: Mapped[list[AssetVaRRecord]] = relationship(
        "AssetVaRRecord",
        back_populates="snapshot",
        cascade="all, delete-orphan",
        lazy="joined",
    )


class AssetVaRRecord(Base):
    __tablename__ = "asset_var_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("var_snapshots.id", ondelete="CASCADE"), nullable=False)
    ric: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(128))
    category: Mapped[str] = mapped_column(String(32))
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    change_amount: Mapped[float] = mapped_column(Float, nullable=False)
    change_pct: Mapped[float] = mapped_column(Float, nullable=False)
    window_drop_contribution: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    window_add_contribution: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    position_change_contribution: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    ranking_shift_contribution: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    snapshot: Mapped[VaRSnapshot] = relationship("VaRSnapshot", back_populates="assets")


class VaRTimeSeriesRecord(Base):
    __tablename__ = "var_timeseries_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ric: Mapped[str] = mapped_column(String(32), index=True)
    point_date: Mapped[date] = mapped_column(Date, index=True)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    change: Mapped[float | None] = mapped_column(Float, nullable=True)


class NewsRecord(Base):
    __tablename__ = "news_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    headline: Mapped[str] = mapped_column(String(256), nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    summary: Mapped[str | None] = mapped_column(String(512), nullable=True)


class ScenarioDistributionRecord(Base):
    __tablename__ = "scenario_distribution_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ric: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    scenario_index: Mapped[int] = mapped_column(Integer, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)


class MarketSignalRecord(Base):
    __tablename__ = "market_signal_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    as_of: Mapped[date] = mapped_column(Date, unique=True, nullable=False, index=True)
    gauge_value: Mapped[float] = mapped_column(Float, nullable=False)
    label: Mapped[str] = mapped_column(String(32), nullable=False)
    narrative: Mapped[str] = mapped_column(String(512), nullable=False)


class DriverCommentaryRecord(Base):
    __tablename__ = "driver_commentary_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    as_of: Mapped[date] = mapped_column(Date, unique=True, nullable=False, index=True)
    technical_summary: Mapped[str] = mapped_column(String(512), nullable=False)
    news_summary: Mapped[str] = mapped_column(String(512), nullable=False)
