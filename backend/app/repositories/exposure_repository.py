from collections import defaultdict
from datetime import date

import clickhouse_sqlalchemy.types as ch_types
from sqlalchemy import and_, case, desc, func, literal, literal_column, or_, select, union_all

from app.core.constants import HUNDRED_MILLION, get_direct_pl_import_products
from app.db_ch.models import (
    Currencies,
    Delta,
    DisplayUnit,
    Factor,
    GridMapping,
    MarketData,
    RiskCategories,
    ScenarioPLFromMatsuri,
    ValueAtRisk,
    Vega,
)
from app.models.domain.factor_var_result import FactorVarResultRow
from app.models.domain.filters import BranchFilters, SimulationAdjustments
from app.models.domain.specifications import AddonBranchFilterSpec, BranchFilterSpec
from app.models.domain.strategies import DataResolutionStrategy
from app.queries.exposure_query import ExposureQuery
from app.queries.scenario_pl_query import ScenarioPLQuery
from app.repositories.base_repository import BaseRepository
from app.services.date_service import DateService


class ExposureRepository(BaseRepository):
    """エクスポージャーやVaRの要因別シミュレーションクエリを実行するリポジトリ"""

    def fetch_addon_var_raw(self, as_of: date, branch_filters: BranchFilters | None) -> float | None:
        entity_relations = self.fetch_entity_relations()
        spec = AddonBranchFilterSpec(branch_filters, entity_relations=entity_relations)
        expr = spec.to_expr(ValueAtRisk)
        if expr is None:
            return None

        stmt = (
            select(
                func.sum(ValueAtRisk.var_addon_scaled_99).label("addon_sum"),
                func.count().label("row_count"),
            )
            .select_from(ValueAtRisk)
            .where(
                ValueAtRisk.asof_date == as_of,
                expr,
            )
        )

        row = self.fetch_first(stmt)
        if not row:
            return None

        addon_sum, row_count = row[0], row[1]
        if not row_count or addon_sum is None:
            return None

        raw = float(addon_sum)
        return None if raw == 0.0 else raw

    def fetch_available_multiplier_products(
        self,
        as_of: date,
        data_resolution_strategy: DataResolutionStrategy,
        branch_filters: BranchFilters | None = None,
    ) -> list[str]:

        valid_products = get_direct_pl_import_products(data_resolution_strategy.includes_imported_data)

        filters = [ScenarioPLFromMatsuri.asof_date == as_of, ScenarioPLFromMatsuri.product.in_(valid_products)]

        if branch_filters and not branch_filters.is_empty:
            entity_relations = self.fetch_entity_relations()
            if (expr := BranchFilterSpec(branch_filters, entity_relations=entity_relations).to_expr(ScenarioPLFromMatsuri)) is not None:
                filters.append(expr)

        if (expr := data_resolution_strategy.apply_to_model(ScenarioPLFromMatsuri)) is not None:
            filters.append(expr)

        stmt = select(ScenarioPLFromMatsuri.product).select_from(ScenarioPLFromMatsuri).where(*filters).distinct()

        rows = self.fetch_all(stmt)
        return [row[0] for row in rows]

    def fetch_simulated_factor_var_rows(
        self,
        as_of: date,
        adjustments: SimulationAdjustments,
        data_resolution_strategy: DataResolutionStrategy,
        branch_filters: BranchFilters | None = None,
        include_exposures: bool = True,
    ) -> list[FactorVarResultRow]:
        end_date = DateService.get_previous_business_day(as_of)
        approved_or_fallback = MarketData.approved_flag == 1
        valid_products = get_direct_pl_import_products(data_resolution_strategy.includes_imported_data)

        # ====================================================
        # 0. Grid Mapping (market_grid <-> delta_grid lookup)
        # ====================================================
        grid_map = (
            select(
                GridMapping.market_grid,
                GridMapping.delta_grid,
            )
            .select_from(GridMapping)
            .where(GridMapping.delta_grid.isnot(None))
        ).cte("grid_map")
        grid_map2 = grid_map.alias("grid_map2")

        entity_relations = self.fetch_entity_relations()

        # ====================================================
        # 1. Delta Pipeline (grouped by factor_id, grid)
        # ====================================================
        canon_factor_id_delta = ExposureQuery.canonical_factor_id_expr(Delta.factor_id)
        delta_filters = [Delta.grid != "AllMember", Delta.asof_date == as_of]
        if valid_products:
            delta_filters.append(~Delta.product.in_(valid_products))
        if (expr := data_resolution_strategy.apply_to_model(Delta)) is not None:
            delta_filters.append(expr)
        if (
            branch_filters
            and not branch_filters.is_empty
            and (expr := BranchFilterSpec(branch_filters, entity_relations=entity_relations).to_expr(Delta)) is not None
        ):
            delta_filters.append(expr)

        # Get active delta factor IDs
        delta_factor_ids_stmt = select(Delta.factor_id, canon_factor_id_delta).select_from(Delta).where(*delta_filters).distinct()
        delta_factor_ids_rows = self.fetch_all(delta_factor_ids_stmt)
        delta_factor_ids = []
        for r in delta_factor_ids_rows:
            if r[0]:
                delta_factor_ids.append(r[0])
            if r[1]:
                delta_factor_ids.append(r[1])

        # Get active vega factor IDs
        canon_factor_id_vega = ExposureQuery.canonical_factor_id_expr(Vega.factor_id)
        vega_filters = [Vega.grid != "AllMember", Vega.asof_date == as_of]
        if valid_products:
            vega_filters.append(~Vega.product.in_(valid_products))
        if (expr := data_resolution_strategy.apply_to_model(Vega)) is not None:
            vega_filters.append(expr)
        if (
            branch_filters
            and not branch_filters.is_empty
            and (expr := BranchFilterSpec(branch_filters, entity_relations=entity_relations).to_expr(Vega)) is not None
        ):
            vega_filters.append(expr)

        vega_factor_ids_stmt = select(Vega.factor_id, canon_factor_id_vega).select_from(Vega).where(*vega_filters).distinct()
        vega_factor_ids_rows = self.fetch_all(vega_factor_ids_stmt)
        vega_factor_ids = []
        for r in vega_factor_ids_rows:
            if r[0]:
                vega_factor_ids.append(r[0])
            if r[1]:
                vega_factor_ids.append(r[1])

        all_factor_ids = list(set(delta_factor_ids + vega_factor_ids))
        if not all_factor_ids:
            all_factor_ids = ["__NONE__"]

        delta_grid_cte = (
            select(
                canon_factor_id_delta.label("factor_id"),
                Delta.grid.label("grid"),
                func.cast(ExposureQuery.scaled_exposure_sum(Delta.delta), ch_types.Float64()).label("exposure"),
            )
            .select_from(Delta)
            .join(Factor, Factor.factor_id == Delta.factor_id, isouter=True)
            .where(*delta_filters)
            .group_by(canon_factor_id_delta, Delta.grid)
        ).cte("delta_grid_sim")

        delta_base_positions = (
            select(
                delta_grid_cte.c.factor_id,
                delta_grid_cte.c.grid,
                func.sum(delta_grid_cte.c.exposure).label("base_position"),
            )
            .select_from(delta_grid_cte)
            .group_by(delta_grid_cte.c.factor_id, delta_grid_cte.c.grid)
        ).cte("delta_base_positions")

        adjustment_rows = []
        for factor_id, delta_100m in adjustments.adjustments.items():
            try:
                adjustment_rows.append((str(factor_id), float(delta_100m) * HUNDRED_MILLION))
            except (TypeError, ValueError):
                continue

        if adjustment_rows:
            abs_sum_cte = (
                select(delta_base_positions.c.factor_id, func.sum(func.abs(delta_base_positions.c.base_position)).label("abs_total"))
                .select_from(delta_base_positions)
                .group_by(delta_base_positions.c.factor_id)
            ).cte("delta_abs_sum_cte")

            grid_counts_cte = (
                select(delta_base_positions.c.factor_id, func.count().label("grid_count"))
                .select_from(delta_base_positions)
                .group_by(delta_base_positions.c.factor_id)
            ).cte("delta_grid_counts_cte")

            adjustments_cte = union_all(
                *(
                    select(literal(fid).label("factor_id"), func.cast(literal(dval), ch_types.Float64()).label("delta_value"))
                    for fid, dval in adjustment_rows
                )
            ).cte("adjustments_sim")

            delta_adjusted_positions = (
                select(
                    delta_base_positions.c.factor_id,
                    delta_base_positions.c.grid,
                    func.cast(
                        delta_base_positions.c.base_position
                        + func.coalesce(
                            func.cast(adjustments_cte.c.delta_value, ch_types.Float64())
                            * case(
                                (
                                    func.cast(abs_sum_cte.c.abs_total, ch_types.Float64()) == 0,
                                    1.0 / func.cast(grid_counts_cte.c.grid_count, ch_types.Float64()),
                                ),
                                else_=func.abs(func.cast(delta_base_positions.c.base_position, ch_types.Float64()))
                                / func.cast(abs_sum_cte.c.abs_total, ch_types.Float64()),
                            ),
                            0.0,
                        ),
                        ch_types.Float64(),
                    ).label("position_total"),
                )
                .select_from(delta_base_positions)
                .join(abs_sum_cte, delta_base_positions.c.factor_id == abs_sum_cte.c.factor_id)
                .join(grid_counts_cte, delta_base_positions.c.factor_id == grid_counts_cte.c.factor_id)
                .outerjoin(adjustments_cte, delta_base_positions.c.factor_id == adjustments_cte.c.factor_id)
            ).cte("delta_adjusted_positions")
        else:
            delta_adjusted_positions = (
                select(
                    delta_base_positions.c.factor_id,
                    delta_base_positions.c.grid,
                    delta_base_positions.c.base_position.label("position_total"),
                ).select_from(delta_base_positions)
            ).cte("delta_adjusted_positions")

        delta_prices_daily = (
            select(
                MarketData.factor_id.label("factor_id"),
                delta_adjusted_positions.c.grid.label("grid"),
                MarketData.date.label("price_date"),
                func.avg(MarketData.value).label("price"),
            )
            .select_from(MarketData)
            .join(
                grid_map,
                MarketData.grid == grid_map.c.market_grid,
            )
            .join(
                delta_adjusted_positions,
                and_(
                    MarketData.factor_id == delta_adjusted_positions.c.factor_id,
                    grid_map.c.delta_grid == delta_adjusted_positions.c.grid,
                ),
            )
            .where(
                MarketData.date <= end_date,
                approved_or_fallback,
                MarketData.factor_id.in_(all_factor_ids),
            )
            .group_by(MarketData.factor_id, delta_adjusted_positions.c.grid, MarketData.date)
        ).cte("delta_prices_daily_sim")

        delta_price_lag = func.lag(delta_prices_daily.c.price).over(
            partition_by=(delta_prices_daily.c.factor_id, delta_prices_daily.c.grid),
            order_by=delta_prices_daily.c.price_date.asc(),
        )
        delta_price_date_lag = func.lag(delta_prices_daily.c.price_date).over(
            partition_by=(delta_prices_daily.c.factor_id, delta_prices_daily.c.grid),
            order_by=delta_prices_daily.c.price_date.asc(),
        )
        delta_price_rn = func.row_number().over(
            partition_by=(delta_prices_daily.c.factor_id, delta_prices_daily.c.grid),
            order_by=delta_prices_daily.c.price_date.desc(),
        )
        delta_ranked = (
            select(
                delta_prices_daily.c.factor_id,
                delta_prices_daily.c.grid,
                delta_prices_daily.c.price_date,
                delta_prices_daily.c.price,
                delta_price_lag.label("prev_price"),
                delta_price_date_lag.label("prev_price_date"),
                delta_price_rn.label("rn"),
            ).select_from(delta_prices_daily)
        ).cte("delta_ranked_sim")

        delta_returns = (
            select(
                delta_ranked.c.factor_id.label("factor_id"),
                delta_ranked.c.grid.label("grid"),
                delta_ranked.c.prev_price_date.label("scenario_date"),
                func.cast(
                    case(
                        (
                            Factor.sensitivity_type == "bp",
                            (func.cast(delta_ranked.c.price, ch_types.Float64()) - func.cast(delta_ranked.c.prev_price, ch_types.Float64()))
                            * case((Factor.factor_name.like("Gov_FutureBasis%"), 100), else_=10000),
                        ),
                        (
                            Factor.sensitivity_type == "pct",
                            (func.cast(delta_ranked.c.price, ch_types.Float64()) / func.cast(delta_ranked.c.prev_price, ch_types.Float64())) - 1,
                        ),
                    ),
                    ch_types.Float64(),
                ).label("return_rate"),
            )
            .select_from(delta_ranked.join(Factor, delta_ranked.c.factor_id == Factor.factor_id))
            .where(and_(delta_ranked.c.rn <= 800, delta_ranked.c.prev_price.isnot(None)))
        ).cte("delta_returns_sim")

        delta_scenario_pl = select(
            delta_returns.c.factor_id,
            delta_returns.c.scenario_date,
            (
                func.cast(delta_returns.c.return_rate, ch_types.Float64()) * func.cast(delta_adjusted_positions.c.position_total, ch_types.Float64())
            ).label("pl_value"),
        ).select_from(
            delta_returns.join(
                delta_adjusted_positions,
                and_(delta_returns.c.factor_id == delta_adjusted_positions.c.factor_id, delta_returns.c.grid == delta_adjusted_positions.c.grid),
            )
        )

        # ====================================================
        # 2. Vega Pipeline (grouped by factor_id, grid, grid2)
        # ====================================================

        vega_grid_cte = (
            select(
                canon_factor_id_vega.label("factor_id"),
                Vega.grid.label("grid"),
                Vega.grid2.label("grid2"),
                func.cast(ExposureQuery.scaled_exposure_sum(Vega.vega), ch_types.Float64()).label("exposure"),
            )
            .select_from(Vega)
            .join(Factor, Factor.factor_id == Vega.factor_id, isouter=True)
            .where(*vega_filters)
            .group_by(canon_factor_id_vega, Vega.grid, Vega.grid2)
        ).cte("vega_grid_sim")

        vega_base_positions = (
            select(
                vega_grid_cte.c.factor_id,
                vega_grid_cte.c.grid,
                vega_grid_cte.c.grid2,
                func.sum(vega_grid_cte.c.exposure).label("position_total"),
            )
            .select_from(vega_grid_cte)
            .group_by(vega_grid_cte.c.factor_id, vega_grid_cte.c.grid, vega_grid_cte.c.grid2)
        ).cte("vega_base_positions")

        if adjustment_rows:
            vega_abs_sum_cte = (
                select(vega_base_positions.c.factor_id, func.sum(func.abs(vega_base_positions.c.position_total)).label("abs_total"))
                .select_from(vega_base_positions)
                .group_by(vega_base_positions.c.factor_id)
            ).cte("vega_abs_sum_cte")

            vega_grid_counts_cte = (
                select(vega_base_positions.c.factor_id, func.count().label("grid_count"))
                .select_from(vega_base_positions)
                .group_by(vega_base_positions.c.factor_id)
            ).cte("vega_grid_counts_cte")

            vega_adjusted_positions = (
                select(
                    vega_base_positions.c.factor_id,
                    vega_base_positions.c.grid,
                    vega_base_positions.c.grid2,
                    func.cast(
                        vega_base_positions.c.position_total
                        + func.coalesce(
                            func.cast(adjustments_cte.c.delta_value, ch_types.Float64())
                            * case(
                                (
                                    func.cast(vega_abs_sum_cte.c.abs_total, ch_types.Float64()) == 0,
                                    1.0 / func.cast(vega_grid_counts_cte.c.grid_count, ch_types.Float64()),
                                ),
                                else_=func.abs(func.cast(vega_base_positions.c.position_total, ch_types.Float64()))
                                / func.cast(vega_abs_sum_cte.c.abs_total, ch_types.Float64()),
                            ),
                            0.0,
                        ),
                        ch_types.Float64(),
                    ).label("position_total"),
                )
                .select_from(vega_base_positions)
                .join(vega_abs_sum_cte, vega_base_positions.c.factor_id == vega_abs_sum_cte.c.factor_id)
                .join(vega_grid_counts_cte, vega_base_positions.c.factor_id == vega_grid_counts_cte.c.factor_id)
                .outerjoin(adjustments_cte, vega_base_positions.c.factor_id == adjustments_cte.c.factor_id)
            ).cte("vega_adjusted_positions")
        else:
            vega_adjusted_positions = (
                select(
                    vega_base_positions.c.factor_id,
                    vega_base_positions.c.grid,
                    vega_base_positions.c.grid2,
                    vega_base_positions.c.position_total.label("position_total"),
                ).select_from(vega_base_positions)
            ).cte("vega_adjusted_positions")

        vega_prices_daily = (
            select(
                MarketData.factor_id.label("factor_id"),
                vega_adjusted_positions.c.grid.label("grid"),
                vega_adjusted_positions.c.grid2.label("grid2"),
                MarketData.date.label("price_date"),
                func.avg(MarketData.value).label("price"),
            )
            .select_from(MarketData)
            .join(
                grid_map,
                MarketData.grid == grid_map.c.market_grid,
            )
            .join(
                grid_map2,
                MarketData.grid2 == grid_map2.c.market_grid,
            )
            .join(
                vega_adjusted_positions,
                and_(
                    MarketData.factor_id == vega_adjusted_positions.c.factor_id,
                    grid_map.c.delta_grid == vega_adjusted_positions.c.grid,
                    grid_map2.c.delta_grid == vega_adjusted_positions.c.grid2,
                ),
            )
            .where(
                MarketData.date <= end_date,
                approved_or_fallback,
                MarketData.factor_id.in_(all_factor_ids),
            )
            .group_by(MarketData.factor_id, vega_adjusted_positions.c.grid, vega_adjusted_positions.c.grid2, MarketData.date)
        ).cte("vega_prices_daily_sim")

        vega_price_lag = func.lag(vega_prices_daily.c.price).over(
            partition_by=(vega_prices_daily.c.factor_id, vega_prices_daily.c.grid, vega_prices_daily.c.grid2),
            order_by=vega_prices_daily.c.price_date.asc(),
        )
        vega_price_date_lag = func.lag(vega_prices_daily.c.price_date).over(
            partition_by=(vega_prices_daily.c.factor_id, vega_prices_daily.c.grid, vega_prices_daily.c.grid2),
            order_by=vega_prices_daily.c.price_date.asc(),
        )
        vega_price_rn = func.row_number().over(
            partition_by=(vega_prices_daily.c.factor_id, vega_prices_daily.c.grid, vega_prices_daily.c.grid2),
            order_by=vega_prices_daily.c.price_date.desc(),
        )
        vega_ranked = (
            select(
                vega_prices_daily.c.factor_id,
                vega_prices_daily.c.grid,
                vega_prices_daily.c.grid2,
                vega_prices_daily.c.price_date,
                vega_prices_daily.c.price,
                vega_price_lag.label("prev_price"),
                vega_price_date_lag.label("prev_price_date"),
                vega_price_rn.label("rn"),
            ).select_from(vega_prices_daily)
        ).cte("vega_ranked_sim")

        vega_returns = (
            select(
                vega_ranked.c.factor_id.label("factor_id"),
                vega_ranked.c.grid.label("grid"),
                vega_ranked.c.grid2.label("grid2"),
                vega_ranked.c.prev_price_date.label("scenario_date"),
                func.cast(
                    case(
                        (
                            Factor.sensitivity_type == "bp",
                            (func.cast(vega_ranked.c.price, ch_types.Float64()) - func.cast(vega_ranked.c.prev_price, ch_types.Float64()))
                            * case((Factor.factor_name.like("Gov_FutureBasis%"), 100), else_=10000),
                        ),
                        (
                            Factor.sensitivity_type == "pct",
                            (func.cast(vega_ranked.c.price, ch_types.Float64()) / func.cast(vega_ranked.c.prev_price, ch_types.Float64())) - 1,
                        ),
                    ),
                    ch_types.Float64(),
                ).label("return_rate"),
            )
            .select_from(vega_ranked.join(Factor, vega_ranked.c.factor_id == Factor.factor_id))
            .where(and_(vega_ranked.c.rn <= 800, vega_ranked.c.prev_price.isnot(None)))
        ).cte("vega_returns_sim")

        vega_scenario_pl = select(
            vega_returns.c.factor_id,
            vega_returns.c.scenario_date,
            (
                func.cast(vega_returns.c.return_rate, ch_types.Float64()) * func.cast(vega_adjusted_positions.c.position_total, ch_types.Float64())
            ).label("pl_value"),
        ).select_from(
            vega_returns.join(
                vega_adjusted_positions,
                and_(
                    vega_returns.c.factor_id == vega_adjusted_positions.c.factor_id,
                    vega_returns.c.grid == vega_adjusted_positions.c.grid,
                    vega_returns.c.grid2 == vega_adjusted_positions.c.grid2,
                ),
            )
        )

        # ====================================================
        # 3. Combine PLs
        # ====================================================
        scenario_pl_by_factor = (
            select(
                literal_column("combined_pl.factor_id").label("factor_id"),
                literal_column("combined_pl.scenario_date").label("scenario_date"),
                func.sum(literal_column("combined_pl.pl_value")).label("pl_value"),
            )
            .select_from(union_all(delta_scenario_pl, vega_scenario_pl).alias("combined_pl"))
            .group_by(literal_column("combined_pl.factor_id"), literal_column("combined_pl.scenario_date"))
        ).cte("scenario_pl_by_factor_sim")

        # Start of Scenario PL directly imported section
        multiplier_cases = []
        if adjustments.multipliers:
            for prod, mult in adjustments.multipliers.items():
                if prod in valid_products:
                    multiplier_cases.append((ScenarioPLFromMatsuri.product == prod, mult))

        scenario_pl_by_display_unit_stmt = (
            select(
                Factor.display_unit_id.label("display_unit_id"),
                scenario_pl_by_factor.c.scenario_date.label("scenario_date"),
                func.sum(scenario_pl_by_factor.c.pl_value).label("pl_value"),
            )
            .select_from(scenario_pl_by_factor.join(Factor, scenario_pl_by_factor.c.factor_id == Factor.factor_id))
            .where(Factor.display_unit_id.isnot(None))
            .group_by(Factor.display_unit_id, scenario_pl_by_factor.c.scenario_date)
        )

        if valid_products:
            # Get base valid scenario PL statement for the targeted products
            filters = [
                ScenarioPLFromMatsuri.asof_date == as_of,
                ScenarioPLFromMatsuri.product.in_(valid_products),
                Factor.display_unit_id.isnot(None),
            ]
            if (
                branch_filters
                and not branch_filters.is_empty
                and (expr := BranchFilterSpec(branch_filters).to_expr(ScenarioPLFromMatsuri)) is not None
            ):
                filters.append(expr)
            if (expr := data_resolution_strategy.apply_to_model(ScenarioPLFromMatsuri)) is not None:
                filters.append(expr)

            # Apply multipliers
            mult_case_expr = case(*multiplier_cases, else_=1.0) if multiplier_cases else 1.0

            direct_pl_stmt = (
                select(
                    Factor.display_unit_id.label("display_unit_id"),
                    ScenarioPLFromMatsuri.from_date.label("scenario_date"),
                    func.sum(ScenarioPLFromMatsuri.pl_value * mult_case_expr).label("pl_value"),
                )
                .select_from(ScenarioPLFromMatsuri)
                .join(Factor, ScenarioPLFromMatsuri.factor_id == Factor.factor_id)
                .where(and_(*filters))
                .group_by(Factor.display_unit_id, ScenarioPLFromMatsuri.from_date)
            )

            scenario_pl_by_display_unit = (
                select(
                    literal_column("combined_pl.display_unit_id").label("display_unit_id"),
                    literal_column("combined_pl.scenario_date").label("scenario_date"),
                    func.sum(literal_column("combined_pl.pl_value")).label("pl_value"),
                )
                .select_from(union_all(scenario_pl_by_display_unit_stmt, direct_pl_stmt).alias("combined_pl"))
                .group_by(literal_column("combined_pl.display_unit_id"), literal_column("combined_pl.scenario_date"))
            ).cte("scenario_pl_by_display_unit_sim")
        else:
            scenario_pl_by_display_unit = scenario_pl_by_display_unit_stmt.cte("scenario_pl_by_display_unit_sim")

        # ====================================================
        # 4. 中間結果(scenario_pl_by_display_unit)を1度だけ取得する
        #    全体/カテゴリ/資産別のランキングはPython側で行う。
        #    巨大クエリ内でこのCTEを3回参照するとClickHouseが上流を
        #    多重再評価して致命的に遅くなるため、ここで分割する。
        # ====================================================
        intermediate_stmt = select(
            scenario_pl_by_display_unit.c.display_unit_id,
            scenario_pl_by_display_unit.c.scenario_date,
            scenario_pl_by_display_unit.c.pl_value,
        ).select_from(scenario_pl_by_display_unit)
        intermediate_rows = [(r[0], r[1], r[2]) for r in self.fetch_all(intermediate_stmt)]

        if not intermediate_rows:
            return []

        dims = self._fetch_display_unit_dims()
        exposures = (
            self._fetch_simulated_exposures(
                as_of=as_of,
                adjustments=adjustments,
                data_resolution_strategy=data_resolution_strategy,
                branch_filters=branch_filters,
            )
            if include_exposures
            else None
        )

        return self._rank_simulated_rows(intermediate_rows, dims, exposures)

    def _fetch_display_unit_dims(self) -> dict[int, tuple[str, int, str, int, str]]:
        """display_unit_id -> (display_unit_name, risk_category_id, risk_category_name, currency_id, currency_name)

        通貨の正規化(0/None -> 0、空文字/None -> '-')は従来SQLと同一。
        RiskCategories起点のため、対応するリスクカテゴリを持つdisplay_unitのみを返す。
        """
        stmt = (
            select(
                DisplayUnit.display_unit_id,
                DisplayUnit.display_unit_name,
                RiskCategories.risk_category_id,
                RiskCategories.risk_category_name,
                Currencies.currency_id,
                Currencies.currency_name,
            )
            .select_from(RiskCategories)
            .join(DisplayUnit, RiskCategories.risk_category_id == DisplayUnit.risk_category_id, isouter=True)
            .join(Currencies, DisplayUnit.currency_id == Currencies.currency_id, isouter=True)
        )

        dims: dict[int, tuple[str, int, str, int, str]] = {}
        for du_id, du_name, rc_id, rc_name, cur_id, cur_name in self.fetch_all(stmt):
            if du_id is None:
                continue
            norm_cur_id = cur_id if cur_id else 0
            norm_cur_name = cur_name if cur_name else "-"
            dims[du_id] = (du_name, rc_id, rc_name, norm_cur_id, norm_cur_name)
        return dims

    def _fetch_simulated_exposures(
        self,
        as_of: date,
        adjustments: SimulationAdjustments,
        data_resolution_strategy: DataResolutionStrategy,
        branch_filters: BranchFilters | None,
    ) -> dict[int, tuple[float, float | None]]:
        """display_unit_id -> (dsum, vsum)。delta/vegaのエクスポージャを集計する。

        delta側にはシミュレーション調整(ポジション増減)を加算する(従来SQLと同一)。
        market_dataには触れないため軽量。
        従来のClickHouse LEFT JOINの挙動を踏襲し、欠損は dsum=0.0(非Nullable列)、
        vsum=None(Nullable列) とする(この非対称性が risk_direction の判定に影響する)。
        """
        delta_filters = [
            Factor.display_unit_id.isnot(None),
            Delta.grid != "AllMember",
            Delta.asof_date == as_of,
        ]
        if (expr := data_resolution_strategy.apply_to_model(Delta)) is not None:
            delta_filters.append(expr)
        if branch_filters and not branch_filters.is_empty and (expr := BranchFilterSpec(branch_filters).to_expr(Delta)) is not None:
            delta_filters.append(expr)

        delta_stmt = (
            select(Factor.display_unit_id, ExposureQuery.scaled_exposure_sum(Delta.delta))
            .select_from(Delta)
            .join(Factor, Factor.factor_id == Delta.factor_id, isouter=True)
            .where(*delta_filters)
            .group_by(Factor.display_unit_id)
        )
        dsum_map: dict[int, float] = {du: (float(v) if v is not None else 0.0) for du, v in self.fetch_all(delta_stmt) if du is not None}

        # ポジション増減(調整)をdsumへ加算する
        if adjustments.adjustments:
            factor_to_unit = {fid: du for fid, du in self.fetch_all(select(Factor.factor_id, Factor.display_unit_id)) if du is not None}
            for factor_id, delta_100m in adjustments.adjustments.items():
                display_unit_id = factor_to_unit.get(str(factor_id))
                if display_unit_id is None:
                    continue
                try:
                    add_value = float(delta_100m) * HUNDRED_MILLION
                except (TypeError, ValueError):
                    continue
                dsum_map[display_unit_id] = dsum_map.get(display_unit_id, 0.0) + add_value

        vega_filters = [
            Factor.display_unit_id.isnot(None),
            Vega.grid != "AllMember",
            Vega.asof_date == as_of,
        ]
        if (expr := data_resolution_strategy.apply_to_model(Vega)) is not None:
            vega_filters.append(expr)
        if branch_filters and not branch_filters.is_empty and (expr := BranchFilterSpec(branch_filters).to_expr(Vega)) is not None:
            vega_filters.append(expr)

        vega_stmt = (
            select(Factor.display_unit_id, ExposureQuery.scaled_exposure_sum(Vega.vega))
            .select_from(Vega)
            .join(Factor, Factor.factor_id == Vega.factor_id, isouter=True)
            .where(*vega_filters)
            .group_by(Factor.display_unit_id)
        )
        # vsumはNullable列を踏襲し、行が無い/合計がNULLのユニットはNoneのまま(0.0埋めしない)
        vsum_map: dict[int, float] = {du: float(v) for du, v in self.fetch_all(vega_stmt) if du is not None and v is not None}

        exposures: dict[int, tuple[float, float | None]] = {}
        for display_unit_id in set(dsum_map) | set(vsum_map):
            exposures[display_unit_id] = (dsum_map.get(display_unit_id, 0.0), vsum_map.get(display_unit_id))
        return exposures

    @staticmethod
    def _rank_simulated_rows(
        intermediate_rows: list[tuple[int, date, float]],
        dims: dict[int, tuple[str, int, str, int, str]],
        exposures: dict[int, tuple[float, float | None]] | None,
    ) -> list[FactorVarResultRow]:
        """中間PL(display_unit_id, scenario_date, pl_value)から全体/カテゴリ/資産別VaRを算出する。

        各系列を昇順ソートしワースト8番目(従来の rn==8)を採用する。
        全体・カテゴリは「シナリオ日ごとに合算してから」ランキングするため分散効果が保たれる。
        exposuresがNone(include_exposures=False)の場合、資産別のdsum/vsumはNoneにする。
        """
        rank = 8  # ワースト8番目を99%VaRとして採用(従来 rn==8)

        # display_unit_id -> {scenario_date: pl合計}
        du_by_date: dict[int, dict[date, float]] = defaultdict(dict)
        for display_unit_id, scenario_date, pl_value in intermediate_rows:
            if pl_value is None:
                continue
            bucket = du_by_date[display_unit_id]
            bucket[scenario_date] = bucket.get(scenario_date, 0.0) + float(pl_value)

        # 全体: 全display_unitをシナリオ日で合算 / カテゴリ: dimsに存在するdisplay_unitのみ合算
        overall_by_date: dict[date, float] = defaultdict(float)
        category_by_date: dict[int, dict[date, float]] = defaultdict(lambda: defaultdict(float))
        category_names: dict[int, str] = {}
        for display_unit_id, by_date in du_by_date.items():
            dim = dims.get(display_unit_id)
            for scenario_date, pl_value in by_date.items():
                overall_by_date[scenario_date] += pl_value
                if dim is not None:
                    category_by_date[dim[1]][scenario_date] += pl_value
            if dim is not None:
                category_names[dim[1]] = dim[2]

        def nth_worst(values: list[float]) -> tuple[float, int] | None:
            count = len(values)
            if count < rank:
                return None
            return sorted(values)[rank - 1], count

        result: list[FactorVarResultRow] = []

        overall = nth_worst(list(overall_by_date.values()))
        if overall is not None:
            result.append(
                FactorVarResultRow(
                    risk_category_id=0,
                    risk_category_name="全体",
                    currency_id=0,
                    currency_name="-",
                    display_unit_name="全リスク合算",
                    var_amount_raw=overall[0],
                    pl_count=overall[1],
                    dsum=None,
                    vsum=None,
                )
            )

        for risk_category_id in sorted(category_by_date):
            ranked = nth_worst(list(category_by_date[risk_category_id].values()))
            if ranked is None:
                continue
            result.append(
                FactorVarResultRow(
                    risk_category_id=risk_category_id,
                    risk_category_name=category_names.get(risk_category_id, ""),
                    currency_id=0,
                    currency_name="-",
                    display_unit_name="カテゴリ合算",
                    var_amount_raw=ranked[0],
                    pl_count=ranked[1],
                    dsum=None,
                    vsum=None,
                )
            )

        display_rows: list[FactorVarResultRow] = []
        for display_unit_id, by_date in du_by_date.items():
            dim = dims.get(display_unit_id)
            if dim is None:
                continue
            ranked = nth_worst(list(by_date.values()))
            if ranked is None:
                continue
            display_unit_name, risk_category_id, risk_category_name, currency_id, currency_name = dim
            if exposures is None:
                dsum, vsum = None, None
            else:
                dsum, vsum = exposures.get(display_unit_id, (0.0, None))
            display_rows.append(
                FactorVarResultRow(
                    risk_category_id=risk_category_id,
                    risk_category_name=risk_category_name,
                    currency_id=currency_id,
                    currency_name=currency_name,
                    display_unit_name=display_unit_name,
                    var_amount_raw=ranked[0],
                    pl_count=ranked[1],
                    dsum=dsum,
                    vsum=vsum,
                )
            )

        display_rows.sort(key=lambda row: (row.risk_category_id, -(row.var_amount_raw or 0.0)))
        result.extend(display_rows)
        return result

    def fetch_factor_var_rows(
        self,
        as_of: date,
        data_resolution_strategy: DataResolutionStrategy,
        branch_filters: BranchFilters | None = None,
        include_exposures: bool = True,
    ) -> list[FactorVarResultRow]:
        # This will be the pure query

        entity_relations = self.fetch_entity_relations()

        valid_scenario_pl = ScenarioPLQuery.build_valid_stmt(
            asof_date_filter=ScenarioPLFromMatsuri.asof_date == as_of,
            data_resolution_strategy=data_resolution_strategy,
            branch_conditions=branch_filters,
            entity_relations=entity_relations,
        ).cte("valid_scenario_pl")

        var_total_stmt = ScenarioPLQuery.build_var_total_stmt(valid_scenario_pl)
        var_total = var_total_stmt.cte("var_total_outer")

        delta_sum = None
        vega_sum = None
        if include_exposures:
            delta_filters = [
                Factor.display_unit_id.isnot(None),
                Delta.grid != "AllMember",
                Delta.asof_date == as_of,
            ]
            if (expr := data_resolution_strategy.apply_to_model(Delta)) is not None:
                delta_filters.append(expr)
            if (
                branch_filters
                and not branch_filters.is_empty
                and (expr := BranchFilterSpec(branch_filters, entity_relations=entity_relations).to_expr(Delta)) is not None
            ):
                delta_filters.append(expr)

            delta_query = select(
                Factor.display_unit_id.label("display_unit_id"),
                literal("Delta").label("name"),
                Delta.asof_date.label("asof_date"),
                ExposureQuery.scaled_exposure_sum(Delta.delta).label("dsum"),
            ).select_from(Delta)

            delta_sum = (
                delta_query.join(Factor, Factor.factor_id == Delta.factor_id, isouter=True)
                .where(*delta_filters)
                .group_by(Factor.display_unit_id, Delta.asof_date)
            ).cte("delta_sum")

            vega_filters = [
                Factor.display_unit_id.isnot(None),
                Vega.grid != "AllMember",
                Vega.asof_date == as_of,
            ]
            if (expr := data_resolution_strategy.apply_to_model(Vega)) is not None:
                vega_filters.append(expr)
            if (
                branch_filters
                and not branch_filters.is_empty
                and (expr := BranchFilterSpec(branch_filters, entity_relations=entity_relations).to_expr(Vega)) is not None
            ):
                vega_filters.append(expr)

            vega_query = select(
                Factor.display_unit_id.label("display_unit_id"),
                literal("Vega").label("name"),
                Vega.asof_date.label("asof_date"),
                ExposureQuery.scaled_exposure_sum(Vega.vega).label("vsum"),
            ).select_from(Vega)

            vega_sum = (
                vega_query.join(Factor, Factor.factor_id == Vega.factor_id, isouter=True)
                .where(*vega_filters)
                .group_by(Factor.display_unit_id, Vega.asof_date)
            ).cte("vega_sum")

        row_number_var = func.row_number().over(
            partition_by=valid_scenario_pl.c.display_unit_id,
            order_by=func.sum(valid_scenario_pl.c.pl_value).asc(),
        )

        display_unit_var_ranked = (
            select(
                valid_scenario_pl.c.display_unit_id,
                valid_scenario_pl.c.from_date,
                row_number_var.label("rn"),
                func.sum(valid_scenario_pl.c.pl_value).label("var"),
                func.count(valid_scenario_pl.c.pl_value).label("pl_count"),
            )
            .select_from(valid_scenario_pl)
            .group_by(valid_scenario_pl.c.display_unit_id, valid_scenario_pl.c.from_date)
        ).cte("display_unit_var_ranked")

        display_unit_var = (
            select(
                display_unit_var_ranked.c.display_unit_id,
                display_unit_var_ranked.c.var.label("var_amount"),
                display_unit_var_ranked.c.pl_count,
            )
            .select_from(display_unit_var_ranked)
            .where(or_(display_unit_var_ranked.c.rn == 8, display_unit_var_ranked.c.pl_count == 0))
        ).cte("display_unit_var")

        base_query = (
            select(
                RiskCategories.risk_category_id,
                RiskCategories.risk_category_name,
                case((Currencies.currency_id == 0, 0), (Currencies.currency_id.is_(None), 0), else_=Currencies.currency_id).label("currency_id"),
                case((Currencies.currency_name == "", "-"), (Currencies.currency_name.is_(None), "-"), else_=Currencies.currency_name).label(
                    "currency_name"
                ),
                DisplayUnit.display_unit_name,
                display_unit_var.c.var_amount,
                display_unit_var.c.pl_count,
            )
            .select_from(display_unit_var)
            .join(DisplayUnit, DisplayUnit.display_unit_id == display_unit_var.c.display_unit_id)
            .join(RiskCategories, RiskCategories.risk_category_id == DisplayUnit.risk_category_id)
            .join(Currencies, Currencies.currency_id == DisplayUnit.currency_id, isouter=True)
        )

        if include_exposures and delta_sum is not None and vega_sum is not None:
            base_query = (
                base_query.add_columns(
                    delta_sum.c.dsum,
                    vega_sum.c.vsum,
                )
                .join(delta_sum, delta_sum.c.display_unit_id == display_unit_var.c.display_unit_id, isouter=True)
                .join(vega_sum, vega_sum.c.display_unit_id == display_unit_var.c.display_unit_id, isouter=True)
            )
        else:
            base_query = base_query.add_columns(
                literal_column("NULL").label("dsum"),
                literal_column("NULL").label("vsum"),
            )

        base_query_ordered = base_query.order_by(
            RiskCategories.risk_category_id,
            desc(display_unit_var.c.var_amount),
            DisplayUnit.display_unit_id,
        )

        overall_var_amount = var_total.c.var
        overall_pl_count = var_total.c.pl_count

        overall_query = select(
            literal_column("0").label("risk_category_id"),
            literal_column("'全体'").label("risk_category_name"),
            literal_column("0").label("currency_id"),
            literal_column("'-'").label("currency_name"),
            literal_column("'全リスク合算'").label("display_unit_name"),
            overall_var_amount.label("var_amount"),
            overall_pl_count.label("pl_count"),
            literal_column("NULL").label("dsum"),
            literal_column("NULL").label("vsum"),
        ).select_from(var_total)
        category_daily_pl = (
            select(
                RiskCategories.risk_category_id,
                RiskCategories.risk_category_name,
                valid_scenario_pl.c.from_date,
                func.sum(valid_scenario_pl.c.pl_value).label("total_daily_pl"),
            )
            .select_from(valid_scenario_pl)
            .join(DisplayUnit, DisplayUnit.display_unit_id == valid_scenario_pl.c.display_unit_id)
            .join(RiskCategories, RiskCategories.risk_category_id == DisplayUnit.risk_category_id)
            .group_by(RiskCategories.risk_category_id, RiskCategories.risk_category_name, valid_scenario_pl.c.from_date)
        ).cte("category_daily_pl")

        category_ranked = (
            select(
                category_daily_pl.c.risk_category_id,
                category_daily_pl.c.risk_category_name,
                category_daily_pl.c.total_daily_pl,
                func.row_number()
                .over(partition_by=category_daily_pl.c.risk_category_id, order_by=category_daily_pl.c.total_daily_pl.asc())
                .label("rn"),
                func.count().over(partition_by=category_daily_pl.c.risk_category_id).label("pl_count"),
            ).select_from(category_daily_pl)
        ).cte("category_ranked")

        category_query = (
            select(
                category_ranked.c.risk_category_id,
                category_ranked.c.risk_category_name,
                literal_column("0").label("currency_id"),
                literal_column("'-'").label("currency_name"),
                literal_column("'カテゴリ合算'").label("display_unit_name"),
                category_ranked.c.total_daily_pl.label("var_amount"),
                category_ranked.c.pl_count,
                literal_column("NULL").label("dsum"),
                literal_column("NULL").label("vsum"),
            )
            .select_from(category_ranked)
            .where(category_ranked.c.rn == 8)
        )

        addon_query = None
        if not data_resolution_strategy.includes_imported_data:
            addon_expr = (
                AddonBranchFilterSpec(branch_filters, entity_relations=entity_relations).to_expr(ValueAtRisk) if branch_filters else literal(False)
            )
            if addon_expr is not None:
                addon_query = (
                    select(
                        literal_column("999999").label("risk_category_id"),
                        literal_column("'調整'").label("risk_category_name"),
                        literal_column("999999").label("currency_id"),
                        literal_column("'-'").label("currency_name"),
                        literal_column("'アドオン分'").label("display_unit_name"),
                        func.sum(ValueAtRisk.var_addon_scaled_99).label("var_amount"),
                        literal_column("1").label("pl_count"),
                        literal_column("NULL").label("dsum"),
                        literal_column("NULL").label("vsum"),
                    )
                    .select_from(ValueAtRisk)
                    .where(ValueAtRisk.asof_date == as_of)
                    .where(addon_expr)
                )

        if addon_query is not None:
            results_stmt = union_all(overall_query, addon_query, category_query, base_query_ordered)
        else:
            results_stmt = union_all(overall_query, category_query, base_query_ordered)

        results = self.fetch_all(results_stmt)
        if not results:
            return []

        def to_row(r):
            return FactorVarResultRow(
                risk_category_id=r[0],
                risk_category_name=r[1],
                currency_id=r[2],
                currency_name=r[3],
                display_unit_name=r[4],
                var_amount_raw=r[5],
                pl_count=r[6],
                dsum=r[7],
                vsum=r[8],
            )

        mapped = []
        overall = None
        addon = None
        for r in results:
            row = to_row(r)
            if row.risk_category_id == 0:
                overall = row
            elif row.risk_category_id == 999999:
                addon = row
            else:
                mapped.append(row)

        # Calculate overall adjusted
        if addon is not None and overall is not None:
            overall_val = float(overall.var_amount_raw) if overall.var_amount_raw is not None else 0.0
            addon_val = float(addon.var_amount_raw) if addon.var_amount_raw is not None else 0.0
            overall_val = overall_val - abs(addon_val)
            addon.var_amount_raw = -1 * abs(addon_val)
            overall.var_amount_raw = overall_val
        elif addon is not None:
            # アドオン分のみ: 合成「全体」行を生成（var_service.py と同等）
            addon_val = float(addon.var_amount_raw) if addon.var_amount_raw is not None else 0.0
            addon.var_amount_raw = -1 * abs(addon_val)
            overall = FactorVarResultRow(
                risk_category_id=0,
                risk_category_name="全体",
                currency_id=0,
                currency_name="-",
                display_unit_name="全リスク合算",
                var_amount_raw=-1 * abs(addon_val),
                pl_count=1,
                dsum=None,
                vsum=None,
            )

        final_rows = []
        if overall is not None:
            final_rows.append(overall)
        final_rows.extend(mapped)
        if addon is not None:
            final_rows.append(addon)

        return final_rows
