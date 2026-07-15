from typing import Any

from clickhouse_sqlalchemy import types as ch_types
from sqlalchemy import case, func, literal, or_, select, union_all

from app.core.constants import CANONICAL_FACTOR_ID_OVERRIDES
from app.db_ch.models import Delta, Factor, Vega
from app.models.domain.filters import BranchFilters
from app.models.domain.specifications import BranchFilterSpec
from app.models.domain.strategies import DataResolutionStrategy


class ExposureQuery:
    """エクスポージャー(Delta/Vega)に関するクエリ構築"""

    @staticmethod
    def canonical_factor_id_expr(factor_id_col: Any) -> Any:
        if not CANONICAL_FACTOR_ID_OVERRIDES:
            return factor_id_col

        whens = [(factor_id_col == src, literal(dst)) for src, dst in sorted(CANONICAL_FACTOR_ID_OVERRIDES.items())]
        return case(*whens, else_=factor_id_col)

    @staticmethod
    def scaled_exposure_sum(value_col: Any) -> Any:
        return func.sum(case((Factor.sensitivity_type == "pct", value_col * 100), else_=value_col))

    @staticmethod
    def build_delta_sum_factor_cte(as_of: Any, data_resolution_strategy: DataResolutionStrategy, branch_filters: BranchFilters | None) -> Any:
        canon_factor_id_delta = ExposureQuery.canonical_factor_id_expr(Delta.factor_id)
        delta_filters = [Delta.grid != "AllMember", Delta.asof_date == as_of]

        if (expr := data_resolution_strategy.apply_to_model(Delta)) is not None:
            delta_filters.append(expr)

        if branch_filters and not branch_filters.is_empty:
            spec = BranchFilterSpec(branch_filters)
            if (expr := spec.to_expr(Delta)) is not None:
                delta_filters.append(expr)

        return (
            select(
                canon_factor_id_delta.label("factor_id"),
                func.cast(
                    ExposureQuery.scaled_exposure_sum(Delta.delta),
                    ch_types.Float64(),
                ).label("dsum"),
            )
            .select_from(Delta)
            .join(Factor, Factor.factor_id == Delta.factor_id, isouter=True)
            .where(
                *delta_filters,
                or_(Factor.display_unit_id.isnot(None), canon_factor_id_delta != Delta.factor_id),
            )
            .group_by(canon_factor_id_delta)
        ).cte("delta_sum_factor_sim")

    @staticmethod
    def build_vega_sum_factor_cte(as_of: Any, data_resolution_strategy: DataResolutionStrategy, branch_filters: BranchFilters | None) -> Any:
        canon_factor_id_vega = ExposureQuery.canonical_factor_id_expr(Vega.factor_id)
        vega_filters = [Vega.grid != "AllMember", Vega.asof_date == as_of]

        if (expr := data_resolution_strategy.apply_to_model(Vega)) is not None:
            vega_filters.append(expr)

        if branch_filters and not branch_filters.is_empty:
            spec = BranchFilterSpec(branch_filters)
            if (expr := spec.to_expr(Vega)) is not None:
                vega_filters.append(expr)

        return (
            select(
                canon_factor_id_vega.label("factor_id"),
                func.cast(
                    ExposureQuery.scaled_exposure_sum(Vega.vega),
                    ch_types.Float64(),
                ).label("vsum"),
            )
            .select_from(Vega)
            .join(Factor, Factor.factor_id == Vega.factor_id, isouter=True)
            .where(
                *vega_filters,
                or_(Factor.display_unit_id.isnot(None), canon_factor_id_vega != Vega.factor_id),
            )
            .group_by(canon_factor_id_vega)
        ).cte("vega_sum_factor_sim")

    @staticmethod
    def build_exposure_union_cte(delta_sum_factor: Any, vega_sum_factor: Any) -> Any:
        return union_all(
            select(delta_sum_factor.c.factor_id.label("factor_id"), delta_sum_factor.c.dsum.label("exposure")),
            select(vega_sum_factor.c.factor_id.label("factor_id"), vega_sum_factor.c.vsum.label("exposure")),
        ).cte("exposure_union_sim")

    @staticmethod
    def build_base_positions_cte(exposure_union: Any) -> Any:
        return (
            select(
                exposure_union.c.factor_id,
                func.sum(exposure_union.c.exposure).label("base_position"),
            )
            .select_from(exposure_union)
            .group_by(exposure_union.c.factor_id)
        ).cte("base_positions_sim")
