import math
from datetime import date

from fastapi import HTTPException
from sqlalchemy import case, func, select

from app.core.constants import PORTFOLIO_AGGREGATE_RIC
from app.db_ch.models import DisplayUnit, RiskCategories, ScenarioPLFromMatsuri, ValueAtRisk
from app.models.domain.filters import BranchFilters
from app.models.domain.specifications import AddonBranchFilterSpec
from app.models.domain.strategies import DataResolutionStrategy
from app.models.var import VaRTimeSeriesPoint, VaRTimeSeriesResponse
from app.queries.scenario_pl_query import ScenarioPLQuery
from app.repositories.base_repository import BaseRepository


def _compute_vol_adj(std_all: float | None, std_132: float | None) -> float:
    """stddev値ペアからボラティリティ調整係数を算出する"""
    if not std_all or std_all == 0 or not std_132:
        return 1.0
    return max((math.ceil(std_132 * 100 / std_all) / 100) * 1.17, 1.0)


class ScenarioPLRepository(BaseRepository):
    """シナリオPLに関するデータアクセスを担うリポジトリ"""

    def get_latest_scenario_date(self, branch_filters: BranchFilters | None = None) -> date | None:
        stmt = ScenarioPLQuery.build_latest_date_stmt(branch_filters)
        return self.fetch_scalar(stmt)

    def get_scenario_dates(self, latest_date: date, days: int, branch_filters: BranchFilters | None = None) -> list[date]:
        stmt = ScenarioPLQuery.build_dates_stmt(latest_date, days, branch_filters)
        rows = self.fetch_all(stmt)
        return [row[0] for row in rows]

    def get_var_timeseries(
        self,
        data_resolution_strategy: DataResolutionStrategy,
        ric: str = PORTFOLIO_AGGREGATE_RIC,
        days: int = 30,
        branch_filters: BranchFilters | None = None,
    ) -> VaRTimeSeriesResponse:
        latest_date = self.get_latest_scenario_date(branch_filters)
        if not latest_date:
            raise HTTPException(status_code=404, detail="No data found")

        target_dates = self.get_scenario_dates(latest_date, days, branch_filters)
        if not target_dates:
            raise HTTPException(status_code=404, detail="No data found")

        entity_relations = self.fetch_entity_relations()

        valid_scenario_pl = ScenarioPLQuery.build_valid_stmt(
            asof_date_filter=ScenarioPLFromMatsuri.asof_date.in_(target_dates),
            data_resolution_strategy=data_resolution_strategy,
            branch_conditions=branch_filters,
            entity_relations=entity_relations,
        ).cte("valid_scenario_pl")

        # --- 全体VaR + ボラ調整: ClickHouse側で集約し結果行のみ取得 ---
        if ric == PORTFOLIO_AGGREGATE_RIC:
            daily_sums = (
                select(
                    valid_scenario_pl.c.asof_date,
                    valid_scenario_pl.c.from_date,
                    func.sum(valid_scenario_pl.c.pl_value).label("daily_total"),
                )
                .select_from(valid_scenario_pl)
                .group_by(valid_scenario_pl.c.asof_date, valid_scenario_pl.c.from_date)
            ).cte("daily_sums")
        else:
            daily_sums = (
                select(
                    valid_scenario_pl.c.asof_date,
                    valid_scenario_pl.c.from_date,
                    func.sum(valid_scenario_pl.c.pl_value).label("daily_total"),
                )
                .select_from(valid_scenario_pl)
                .join(DisplayUnit, valid_scenario_pl.c.display_unit_id == DisplayUnit.display_unit_id)
                .where(DisplayUnit.display_unit_name == ric)
                .group_by(valid_scenario_pl.c.asof_date, valid_scenario_pl.c.from_date)
            ).cte("daily_sums")

        date_rn = func.row_number().over(
            partition_by=daily_sums.c.asof_date,
            order_by=daily_sums.c.from_date.desc(),
        )
        daily_ranked = (
            select(
                daily_sums.c.asof_date,
                daily_sums.c.daily_total,
                date_rn.label("date_rn"),
            )
        ).cte("daily_ranked")

        var_ts_stmt = (
            select(
                daily_ranked.c.asof_date,
                func.arrayElement(
                    func.arraySort(func.groupArray(daily_ranked.c.daily_total)), 8
                ).label("var_8th"),
                func.stddevSamp(daily_ranked.c.daily_total).label("std_all"),
                func.stddevSamp(
                    case((daily_ranked.c.date_rn <= 132, daily_ranked.c.daily_total))
                ).label("std_132"),
                func.count().label("scenario_count"),
            )
            .group_by(daily_ranked.c.asof_date)
        )

        var_rows = self.fetch_all(var_ts_stmt)

        var_by_date: dict[date, float] = {}
        vol_adj_by_date: dict[date, float] = {}
        for asof, var_8th, std_all, std_132, cnt in var_rows:
            if cnt >= 8 and var_8th is not None:
                var_by_date[asof] = float(var_8th)
            vol_adj_by_date[asof] = _compute_vol_adj(
                float(std_all) if std_all else None,
                float(std_132) if std_132 else None,
            )

        # --- addon ---
        addon_by_date: dict[date, float] = {}
        if ric == PORTFOLIO_AGGREGATE_RIC and not data_resolution_strategy.includes_imported_data:
            spec = AddonBranchFilterSpec(branch_filters, entity_relations=entity_relations)
            addon_expr = spec.to_expr(ValueAtRisk)

            addon_stmt = select(ValueAtRisk.asof_date, func.sum(ValueAtRisk.var_addon_scaled_99)).where(ValueAtRisk.asof_date.in_(target_dates))
            if addon_expr is not None:
                addon_stmt = addon_stmt.where(addon_expr)
            addon_stmt = addon_stmt.group_by(ValueAtRisk.asof_date)

            addon_by_date = {row[0]: float(row[1]) for row in self.fetch_all(addon_stmt) if row[1] is not None}

        # --- カテゴリ別VaR + ボラ調整: ClickHouse側で集約 ---
        cat_var_by_date: dict[date, dict[str, float]] = {}
        cat_vol_adj_by_date: dict[date, dict[str, float]] = {}

        if ric == PORTFOLIO_AGGREGATE_RIC:
            cat_daily_sums = (
                select(
                    valid_scenario_pl.c.asof_date,
                    RiskCategories.risk_category_name.label("category"),
                    valid_scenario_pl.c.from_date,
                    func.sum(valid_scenario_pl.c.pl_value).label("daily_total"),
                )
                .select_from(valid_scenario_pl)
                .join(DisplayUnit, valid_scenario_pl.c.display_unit_id == DisplayUnit.display_unit_id)
                .join(RiskCategories, DisplayUnit.risk_category_id == RiskCategories.risk_category_id)
                .group_by(valid_scenario_pl.c.asof_date, RiskCategories.risk_category_name, valid_scenario_pl.c.from_date)
            ).cte("cat_daily_sums")

            cat_date_rn = func.row_number().over(
                partition_by=[cat_daily_sums.c.asof_date, cat_daily_sums.c.category],
                order_by=cat_daily_sums.c.from_date.desc(),
            )
            cat_ranked = (
                select(
                    cat_daily_sums.c.asof_date,
                    cat_daily_sums.c.category,
                    cat_daily_sums.c.daily_total,
                    cat_date_rn.label("date_rn"),
                )
            ).cte("cat_daily_ranked")

            cat_var_stmt = (
                select(
                    cat_ranked.c.asof_date,
                    cat_ranked.c.category,
                    func.arrayElement(
                        func.arraySort(func.groupArray(cat_ranked.c.daily_total)), 8
                    ).label("var_8th"),
                    func.stddevSamp(cat_ranked.c.daily_total).label("std_all"),
                    func.stddevSamp(
                        case((cat_ranked.c.date_rn <= 132, cat_ranked.c.daily_total))
                    ).label("std_132"),
                    func.count().label("scenario_count"),
                )
                .group_by(cat_ranked.c.asof_date, cat_ranked.c.category)
            )
            cat_rows = self.fetch_all(cat_var_stmt)

            for asof, cat_name, var_8th, std_all, std_132, cnt in cat_rows:
                if asof not in cat_var_by_date:
                    cat_var_by_date[asof] = {}
                    cat_vol_adj_by_date[asof] = {}
                if cnt >= 8 and var_8th is not None:
                    cat_var_by_date[asof][cat_name] = (-1 * float(var_8th)) / 100_000_000
                cat_vol_adj_by_date[asof][cat_name] = _compute_vol_adj(
                    float(std_all) if std_all else None,
                    float(std_132) if std_132 else None,
                )

        # --- ポイント構築 ---
        points: list[VaRTimeSeriesPoint] = []
        prev_value: float | None = None
        for target_date in reversed(target_dates):
            var_value = var_by_date.get(target_date)
            if var_value is not None:
                addon = addon_by_date.get(target_date, 0.0)
                scenario_var = (-1 * float(var_value)) / 100_000_000
                addon_amount = abs(addon) / 100_000_000
                total = scenario_var + addon_amount

                diff_amount = None
                if prev_value is not None and prev_value != 0:
                    diff_amount = total - prev_value

                category_var = cat_var_by_date.get(target_date)
                if category_var is not None and addon != 0.0:
                    category_var["調整"] = addon_amount

                points.append(
                    VaRTimeSeriesPoint(
                        date=target_date,
                        value=scenario_var,
                        addon=addon_amount,
                        change=diff_amount,
                        category_var=category_var,
                        vol_adj=vol_adj_by_date.get(target_date, 1.0),
                        category_vol_adj=cat_vol_adj_by_date.get(target_date),
                    )
                )
                prev_value = total
            else:
                points.append(
                    VaRTimeSeriesPoint(
                        date=target_date,
                        value=0.0,
                        change=None,
                        category_var=None,
                    )
                )

        points.reverse()
        return VaRTimeSeriesResponse(ric=ric, points=points)
