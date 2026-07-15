from datetime import date

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import PORTFOLIO_AGGREGATE_RIC
from app.db_ch.models import (
    ScenarioPLFromMatsuri,
)
from app.models.domain.factor_var_result import FactorVarResultRow
from app.models.domain.filters import BranchFilters, SimulationAdjustments
from app.models.domain.strategies import DataResolutionStrategy
from app.models.var import (
    FactorVaR,
    FactorVarListResponse,
    VaRSummaryResponse,
    VaRTimeSeriesResponse,
)
from app.repositories.exposure_repository import ExposureRepository
from app.repositories.scenario_pl_repository import ScenarioPLRepository


class VarService:
    """VaRに関連するビジネスロジック・クエリ実行を行うサービス"""

    def __init__(self, session: Session):
        self.session = session
        self.pl_repo = ScenarioPLRepository(session)
        self.exp_repo = ExposureRepository(session)

    def get_factor_var(
        self,
        data_resolution_strategy: DataResolutionStrategy,
        as_of: date | None = None,
        comparison_date: date | None = None,
        branch_filters: BranchFilters | None = None,
        simulation_enabled: bool = False,
        simulation_adjustments: SimulationAdjustments | None = None,
    ) -> FactorVarListResponse:
        branch_conditions = branch_filters

        if simulation_enabled and simulation_adjustments:
            adjustments_dict = simulation_adjustments
        else:
            adjustments_dict = SimulationAdjustments(adjustments={})

        def _fetch_data(
            target_date_val: date,
            simulation_adjustments_dict: SimulationAdjustments | None = None,
            *,
            include_exposures: bool = True,
        ) -> list[FactorVarResultRow]:
            if simulation_adjustments_dict is not None:
                base = self.exp_repo.fetch_simulated_factor_var_rows(
                    as_of=target_date_val,
                    adjustments=simulation_adjustments_dict,
                    data_resolution_strategy=data_resolution_strategy,
                    branch_filters=branch_conditions,
                    include_exposures=include_exposures,
                )
                addon_value_raw = None
                if not data_resolution_strategy.includes_imported_data:
                    addon_value_raw = self.exp_repo.fetch_addon_var_raw(
                        as_of=target_date_val,
                        branch_filters=branch_conditions,
                    )

                if not base:
                    if addon_value_raw is None:
                        return []

                    overall_row = FactorVarResultRow(
                        risk_category_id=0,
                        risk_category_name="全体",
                        currency_id=0,
                        currency_name="-",
                        display_unit_name="全リスク合算",
                        var_amount_raw=-1 * abs(float(addon_value_raw)),
                        pl_count=1,
                        dsum=None,
                        vsum=None,
                    )
                    addon_row = FactorVarResultRow(
                        risk_category_id=999999,
                        risk_category_name="調整",
                        currency_id=999999,
                        currency_name="-",
                        display_unit_name="アドオン分",
                        var_amount_raw=-1 * abs(float(addon_value_raw)),
                        pl_count=1,
                        dsum=None,
                        vsum=None,
                    )
                    return [overall_row, addon_row]

                overall = base[0]
                overall_var_raw = overall.var_amount_raw or 0.0
                if addon_value_raw is not None:
                    overall_var_raw = float(overall_var_raw) - abs(float(addon_value_raw))

                overall_adjusted = overall.model_copy(update={"var_amount_raw": overall_var_raw})

                if addon_value_raw is None:
                    return [overall_adjusted, *base[1:]]

                addon_row = FactorVarResultRow(
                    risk_category_id=999999,
                    risk_category_name="調整",
                    currency_id=999999,
                    currency_name="-",
                    display_unit_name="アドオン分",
                    var_amount_raw=-1 * abs(float(addon_value_raw)),
                    pl_count=1,
                    dsum=None,
                    vsum=None,
                )

                return [overall_adjusted, *base[1:], addon_row]

            return self.exp_repo.fetch_factor_var_rows(
                as_of=target_date_val,
                data_resolution_strategy=data_resolution_strategy,
                branch_filters=branch_conditions,
                include_exposures=include_exposures,
            )

        results_as_of = _fetch_data(as_of, adjustments_dict) if simulation_enabled else _fetch_data(as_of)
        comparison_map = {}
        if comparison_date:
            results_comparison = _fetch_data(comparison_date, adjustments_dict if simulation_enabled else None, include_exposures=False)
            for row_comp in results_comparison:
                comparison_map[row_comp.comparison_key] = row_comp.inverted_var_amount

        response = FactorVarListResponse(
            factor_var_list=[
                FactorVaR(
                    risk_category_id=result.risk_category_id,
                    risk_category=result.risk_category_name,
                    currency_id=result.currency_id,
                    currency=result.currency_name,
                    risk_factor=result.display_unit_name,
                    risk_direction=result.compute_risk_direction(),
                    var_amount=result.inverted_var_amount,
                    comparison=comparison_map.get(result.comparison_key),
                    has_data=result.has_data,
                )
                for result in results_as_of
            ]
        )
        return response

    def get_var_summary(
        self,
        data_resolution_strategy: DataResolutionStrategy,
        as_of: date | None = None,
        comparison_date: date | None = None,
        branch_filters: BranchFilters | None = None,
        simulation_enabled: bool = False,
        simulation_adjustments: SimulationAdjustments | None = None,
    ) -> VaRSummaryResponse:
        if not as_of:
            latest_date_stmt = select(func.max(ScenarioPLFromMatsuri.asof_date))
            as_of = self.session.execute(latest_date_stmt).scalar()
            if not as_of:
                raise HTTPException(status_code=404, detail="No data found")

        # Get factor var list which already includes the overall portfolio VaR and addon
        factor_var_res = self.get_factor_var(
            as_of=as_of,
            comparison_date=comparison_date,
            branch_filters=branch_filters,
            simulation_enabled=simulation_enabled,
            simulation_adjustments=simulation_adjustments,
            data_resolution_strategy=data_resolution_strategy,
        )

        return VaRSummaryResponse(
            as_of=as_of,
            factor_var_list=factor_var_res.factor_var_list,
        )

    def get_var_timeseries(
        self,
        data_resolution_strategy: DataResolutionStrategy,
        ric: str = PORTFOLIO_AGGREGATE_RIC,
        days: int = 30,
        branch_filters: BranchFilters | None = None,
    ) -> VaRTimeSeriesResponse:
        return self.pl_repo.get_var_timeseries(data_resolution_strategy=data_resolution_strategy, ric=ric, days=days, branch_filters=branch_filters)
