from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import mapped_column

from .base import Base


class Factor(Base):
    """'factor' テーブルに対応するORMモデル"""

    __tablename__ = "factor"

    factor_id = mapped_column(String(6), primary_key=True)
    factor_name = mapped_column(String, unique=True, nullable=False)
    description = mapped_column(String, nullable=True)
    display_unit_id = mapped_column(Integer, nullable=True)
    sensitivity_type = mapped_column(String, nullable=True)


class Delta(Base):
    """'delta' テーブルに対応するORMモデル"""

    __tablename__ = "delta"

    asof_date = mapped_column(Date, primary_key=True)
    section_code = mapped_column(String, primary_key=True)
    product = mapped_column(String, primary_key=True)
    factor_id = mapped_column(String, primary_key=True)
    grid = mapped_column(String, primary_key=True)
    delta = mapped_column(Numeric)
    dept_name = mapped_column(String, nullable=True)
    # When populated, the row originates from daily-report import.
    imported_datetime = mapped_column(DateTime, nullable=True)


class Vega(Base):
    """'vega' テーブルに対応するORMモデル"""

    __tablename__ = "vega"

    asof_date = mapped_column(Date, primary_key=True)
    section_code = mapped_column(String, primary_key=True)
    product = mapped_column(String, primary_key=True)
    factor_id = mapped_column(String, primary_key=True)
    grid = mapped_column(String, primary_key=True)
    grid2 = mapped_column(String, primary_key=True)
    vega = mapped_column(Numeric)
    dept_name = mapped_column(String, nullable=True)
    # When populated, the row originates from daily-report import.
    imported_datetime = mapped_column(DateTime, nullable=True)


class ValueAtRisk(Base):
    """'var' テーブルに対応するORMモデル"""

    __tablename__ = "var"

    asof_date = mapped_column(Date, primary_key=True)
    section_code = mapped_column(String, primary_key=True)
    var_value = mapped_column(Numeric)
    var_addon_scaled_99 = mapped_column(Numeric)


class ScenarioPLFromMatsuri(Base):
    """'scenario_pl_from_matsuri' テーブルに対応するORMモデル"""

    __tablename__ = "scenario_pl_from_matsuri"

    asof_date = mapped_column(Date, primary_key=True, nullable=False)
    entity = mapped_column(String, primary_key=True, nullable=False)
    section_code = mapped_column(String, primary_key=True, nullable=False)
    product = mapped_column(String, primary_key=True, nullable=False)
    factor_id = mapped_column(String, primary_key=True, nullable=False)
    from_date = mapped_column(Date, primary_key=True, nullable=False)
    to_date = mapped_column(Date, primary_key=True, nullable=False)
    pl_value = mapped_column(Numeric, nullable=False)
    dept_name = mapped_column(String, nullable=True)
    # When populated, the row originates from an external CSV import.
    imported_datetime = mapped_column(DateTime, nullable=True)


class MarketData(Base):
    __tablename__ = "market_data"

    date = mapped_column(Date, primary_key=True, nullable=False)
    factor_id = mapped_column(String, primary_key=True, nullable=False)
    grid = mapped_column(String, primary_key=True, nullable=False)
    grid2 = mapped_column(String, primary_key=True, nullable=False)
    source_entity = mapped_column(String, primary_key=True, nullable=False)
    source_system = mapped_column(String, primary_key=True, nullable=False)
    factor_category = mapped_column(String, nullable=False)
    base_ccy = mapped_column(String, nullable=False)
    counter_ccy = mapped_column(String, nullable=False)
    value = mapped_column(Float, nullable=False)
    approved_flag = mapped_column(Boolean, nullable=False)


class GridMapping(Base):
    __tablename__ = "grid_mapping"

    order = mapped_column(Integer, primary_key=True)
    market_grid = mapped_column(String(10), nullable=True)
    delta_grid = mapped_column(String(10), nullable=True)


class Currencies(Base):
    __tablename__ = "currencies"

    currency_id = mapped_column(Integer, primary_key=True, nullable=False)
    currency_name = mapped_column(String, nullable=False)


class RiskCategories(Base):
    __tablename__ = "risk_categories"

    risk_category_id = mapped_column(Integer, primary_key=True, nullable=False)
    risk_category_name = mapped_column(String, nullable=False)


class DisplayUnit(Base):
    __tablename__ = "display_unit"

    display_unit_id = mapped_column(Integer, primary_key=True, nullable=False)
    display_unit_name = mapped_column(String, nullable=False)
    risk_category_id = mapped_column(Integer, nullable=False)
    currency_id = mapped_column(Integer, nullable=True)


class EntitySectionRelation(Base):
    __tablename__ = "entity_section_relation"

    entity = mapped_column(String, primary_key=True, nullable=False)
    dept_name = mapped_column(String, nullable=False)
    section_code = mapped_column(String, nullable=False)
