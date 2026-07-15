from typing import Any

from sqlalchemy import desc, func, or_, select

from app.db_ch.models import DisplayUnit, Factor, ScenarioPLFromMatsuri, ValueAtRisk
from app.models.domain.filters import BranchFilters
from app.models.domain.specifications import BranchFilterSpec
from app.models.domain.strategies import DataResolutionStrategy


class ScenarioPLQuery:
    """シナリオPLに関するクエリ構築をカプセル化するQuery Object"""

    @staticmethod
    def build_valid_stmt(
        asof_date_filter: Any,
        data_resolution_strategy: DataResolutionStrategy,
        branch_conditions: BranchFilters | None = None,
        entity_relations: dict[str, dict[str, list[str]]] | None = None,
    ) -> Any:
        filters = [asof_date_filter]

        if (expr := data_resolution_strategy.apply_to_model(ScenarioPLFromMatsuri)) is not None:
            filters.append(expr)

        if branch_conditions:
            spec = BranchFilterSpec(branch_conditions, entity_relations=entity_relations)
            if (expr := spec.to_expr(ScenarioPLFromMatsuri)) is not None:
                filters.append(expr)

        return (
            select(
                ScenarioPLFromMatsuri.asof_date.label("asof_date"),
                Factor.display_unit_id.label("display_unit_id"),
                ScenarioPLFromMatsuri.from_date.label("from_date"),
                ScenarioPLFromMatsuri.pl_value.label("pl_value"),
                ScenarioPLFromMatsuri.section_code.label("section_code"),
                ScenarioPLFromMatsuri.product.label("product"),
            )
            .select_from(ScenarioPLFromMatsuri)
            .join(Factor, Factor.factor_id == ScenarioPLFromMatsuri.factor_id)
            .join(DisplayUnit, DisplayUnit.display_unit_id == Factor.display_unit_id)
            .where(*filters)
        )

    @staticmethod
    def build_var_total_stmt(valid_scenario_pl: Any) -> Any:
        row_number_total = func.row_number().over(
            order_by=func.sum(valid_scenario_pl.c.pl_value).asc(),
        )
        var_ranked_total = (
            select(
                valid_scenario_pl.c.from_date,
                row_number_total.label("rn"),
                func.sum(valid_scenario_pl.c.pl_value).label("var"),
                func.count(valid_scenario_pl.c.pl_value).label("pl_count"),
            )
            .select_from(valid_scenario_pl)
            .group_by(valid_scenario_pl.c.from_date)
        ).cte("var_ranked_total")

        var_total = (
            select(
                var_ranked_total.c.from_date.label("from_date"),
                var_ranked_total.c.var.label("var"),
                var_ranked_total.c.pl_count.label("pl_count"),
            )
            .select_from(var_ranked_total)
            .where(or_(var_ranked_total.c.rn == 8, var_ranked_total.c.pl_count == 0))
        ).cte("var_total")

        return select(var_total.c.var, var_total.c.pl_count).select_from(var_total)

    @staticmethod
    def build_latest_date_stmt(branch_filters: BranchFilters | None = None) -> Any:
        latest_stmt = select(func.max(ValueAtRisk.asof_date))
        # 常に全体の日付から取得する（アドオンVaRが存在しないセクションのフィルタで0件になるのを防ぐため）
        return latest_stmt

    @staticmethod
    def build_dates_stmt(latest_date: Any, days: int, branch_filters: BranchFilters | None = None) -> Any:
        dates_stmt = select(ValueAtRisk.asof_date)
        # 常に全体の日付から取得する
        return dates_stmt.where(ValueAtRisk.asof_date <= latest_date).distinct().order_by(desc(ValueAtRisk.asof_date)).limit(days)
