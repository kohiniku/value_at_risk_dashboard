from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Date,
    Float,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import mapped_column

from .base import Base


class Factor(Base):
    """'public.factor' テーブルに対応するORMモデル"""

    __tablename__ = "factor"
    __table_args__ = {"schema": "public"}

    factor_id = mapped_column(String(6), primary_key=True)
    factor_name = mapped_column(String, unique=True, nullable=False)
    description = mapped_column(String, nullable=True)
    display_unit_id = mapped_column(Integer, nullable=True)

    def __repr__(self):
        return f"<Factor(factor_id='{self.factor_id}', factor_name='{self.factor_name}')>"


class Delta(Base):
    """'public.delta' テーブルに対応するORMモデル"""

    __tablename__ = "delta"
    __table_args__ = {"schema": "public"}

    asof_date = mapped_column(Date, primary_key=True)
    section_code = mapped_column(String, primary_key=True)
    product = mapped_column(String, primary_key=True)
    factor_id = mapped_column(String, primary_key=True)
    grid = mapped_column(String, primary_key=True)
    delta = mapped_column(Numeric)
    dept_name = mapped_column(String, nullable=True)

    def __repr__(self):
        return f"<Delta(asof_date='{self.asof_date}', factor_id='{self.factor_id}')>"


class Vega(Base):
    """'public.vega' テーブルに対応するORMモデル"""

    __tablename__ = "vega"
    __table_args__ = {"schema": "public"}

    asof_date = mapped_column(Date, primary_key=True)
    section_code = mapped_column(String, primary_key=True)
    product = mapped_column(String, primary_key=True)
    factor_id = mapped_column(String, primary_key=True)
    grid = mapped_column(String, primary_key=True)
    grid2 = mapped_column(String, primary_key=True)
    vega = mapped_column(Numeric)
    dept_name = mapped_column(String, nullable=True)

    def __repr__(self):
        return f"<Vega(asof_date='{self.asof_date}', factor_id='{self.factor_id}')>"


class ValueAtRisk(Base):
    """'public.var' テーブルに対応するORMモデル"""

    __tablename__ = "var"
    __table_args__ = {"schema": "public"}

    asof_date = mapped_column(Date, primary_key=True)
    section_code = mapped_column(String, primary_key=True)
    var_value = mapped_column(Numeric)
    var_addon_scaled_99 = mapped_column(Numeric)

    def __repr__(self):
        return f"<ValueAtRisk(asof_date='{self.asof_date}', section_code='{self.section_code}')>"


class ScenarioPLFromMatsuri(Base):
    """'public.scenario_pl_from_matsuri' テーブルに対応するORMモデル"""

    __tablename__ = "scenario_pl_from_matsuri"
    __table_args__ = {"schema": "public"}

    asof_date = mapped_column(Date, primary_key=True, nullable=False)
    entity = mapped_column(String, primary_key=True, nullable=False)
    section_code = mapped_column(String, primary_key=True, nullable=False)
    product = mapped_column(String, primary_key=True, nullable=False)
    factor_id = mapped_column(String, primary_key=True, nullable=False)
    from_date = mapped_column(Date, primary_key=True, nullable=False)
    to_date = mapped_column(Date, primary_key=True, nullable=False)
    pl_value = mapped_column(Numeric, nullable=False)
    dept_name = mapped_column(String, nullable=True)

    def __repr__(self):
        return (
            f"<ScenarioPL(asof_date='{self.asof_date}', section_code='{self.section_code}', product='{self.product}', factor_id='{self.factor_id}')>"
        )


class MarketDataFromHanabi(Base):
    __tablename__ = "market_data_from_hanabi"
    __table_args__ = {"schema": "public"}

    date = mapped_column(Date, primary_key=True, nullable=False)
    asof_date = mapped_column(Date, primary_key=True, nullable=False)
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
    __table_args__ = {"schema": "public"}

    order = mapped_column(Integer, primary_key=True)
    market_grid = mapped_column(String(10), nullable=True)
    delta_grid = mapped_column(String(10), nullable=True)


class Currencies(Base):
    __tablename__ = "currencies"
    __table_args__ = {"schema": "public"}

    currency_id = mapped_column(Integer, primary_key=True, nullable=False)
    currency_name = mapped_column(String, nullable=False)


class RiskCategories(Base):
    __tablename__ = "risk_categories"
    __table_args__ = {"schema": "public"}

    risk_category_id = mapped_column(Integer, primary_key=True, nullable=False)
    risk_category_name = mapped_column(String, nullable=False)


class DisplayUnit(Base):
    __tablename__ = "display_unit"
    __table_args__ = {"schema": "public"}

    display_unit_id = mapped_column(Integer, primary_key=True, nullable=False)
    display_unit_name = mapped_column(String, nullable=False)
    risk_category_id = mapped_column(Integer, nullable=False)
    currency_id = mapped_column(Integer, nullable=True)


class EntitySectionRelation(Base):
    __tablename__ = "entity_section_relation"
    __table_args__ = {"schema": "public"}

    entity = mapped_column(String, primary_key=True, nullable=False)
    section_code = mapped_column(String, nullable=False)
