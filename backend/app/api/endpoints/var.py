import asyncio
import json
import time
import traceback
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from app.api.dependencies.filters import parse_branch_filters, parse_simulation_adjustments
from app.api.dependencies.strategies import get_data_resolution_strategy
from app.core.constants import PORTFOLIO_AGGREGATE_RIC
from app.db_ch.session import SessionLocal
from app.models.domain.filters import BranchFilters, SimulationAdjustments
from app.models.domain.strategies import DataResolutionStrategy
from app.models.var import (
    DashboardDataResponse,
    FactorVarListResponse,
)
from app.repositories.exposure_repository import ExposureRepository
from app.services.simulation_service import SimulationService
from app.services.var_service import VarService
from app.services.volatility import get_volatility_adjustments as get_vola

router = APIRouter()

# TTL=10sの簡易キャッシュ。重複実行を防ぐためTask（Future）をキャッシュする
_dashboard_cache: dict[str, tuple[float, asyncio.Task]] = {}


@router.get("/var/dashboard", response_model=DashboardDataResponse)
async def get_dashboard_data(
    branch_filters: BranchFilters = Depends(parse_branch_filters),
    simulation_adjustments: SimulationAdjustments = Depends(parse_simulation_adjustments),
    as_of: date | None = None,
    comparison_date: date | None = None,
    simulation_enabled: bool = Query(False, description="シミュレーションを有効化するか"),
    ric: str = Query(PORTFOLIO_AGGREGATE_RIC, description="資産のRICコード"),
    days: int = Query(30, ge=1, le=100, description="取得する日数"),
    data_resolution_strategy: DataResolutionStrategy = Depends(get_data_resolution_strategy),
) -> DashboardDataResponse:
    try:
        cache_key = json.dumps(
            {
                "branch_filters": branch_filters.model_dump() if branch_filters else None,
                "simulation_adjustments": simulation_adjustments.model_dump() if simulation_adjustments else None,
                "as_of": str(as_of) if as_of else None,
                "comparison_date": str(comparison_date) if comparison_date else None,
                "simulation_enabled": simulation_enabled,
                "ric": ric,
                "days": days,
                "prefer_imported": getattr(data_resolution_strategy, "includes_imported_data", False),
            },
            sort_keys=True,
        )

        now = time.time()
        # 古いキャッシュのクリーンアップ
        for k in list(_dashboard_cache.keys()):
            if now - _dashboard_cache[k][0] > 10.0:
                del _dashboard_cache[k]

        if cache_key in _dashboard_cache:
            cache_time, task = _dashboard_cache[cache_key]
            if now - cache_time < 10.0:
                return await task

        async def _fetch_all():
            def fetch_summary():
                with SessionLocal() as db:
                    service = VarService(db)
                    return service.get_var_summary(
                        as_of=as_of,
                        comparison_date=comparison_date,
                        branch_filters=branch_filters,
                        simulation_enabled=simulation_enabled,
                        simulation_adjustments=simulation_adjustments,
                        data_resolution_strategy=data_resolution_strategy,
                    )

            def fetch_sim_factors(target_as_of):
                with SessionLocal() as db:
                    sim_service = SimulationService(db)
                    factors = sim_service.fetch_simulation_factors_rows(
                        as_of=target_as_of,
                        branch_filters=branch_filters,
                        data_resolution_strategy=data_resolution_strategy,
                    )

                    exp_repo = ExposureRepository(db)
                    available_multiplier_products = exp_repo.fetch_available_multiplier_products(
                        as_of=target_as_of,
                        branch_filters=branch_filters,
                        data_resolution_strategy=data_resolution_strategy,
                    )

                    return factors, available_multiplier_products

            def fetch_timeseries():
                with SessionLocal() as db:
                    service = VarService(db)
                    return service.get_var_timeseries(
                        ric=ric,
                        days=days,
                        branch_filters=branch_filters,
                        data_resolution_strategy=data_resolution_strategy,
                    )

            def fetch_vola(target_as_of):
                with SessionLocal() as db:
                    return get_vola(db, target_as_of, branch_filters, data_resolution_strategy)

            if as_of is not None:
                summary, sim_factors_tuple, timeseries, vol_adj = await asyncio.gather(
                    run_in_threadpool(fetch_summary),
                    run_in_threadpool(fetch_sim_factors, as_of),
                    run_in_threadpool(fetch_timeseries),
                    run_in_threadpool(fetch_vola, as_of),
                )
            else:
                summary = await run_in_threadpool(fetch_summary)
                current_as_of = summary.as_of
                sim_factors_tuple, timeseries, vol_adj = await asyncio.gather(
                    run_in_threadpool(fetch_sim_factors, current_as_of),
                    run_in_threadpool(fetch_timeseries),
                    run_in_threadpool(fetch_vola, current_as_of),
                )

            factor_var = FactorVarListResponse(factor_var_list=summary.factor_var_list or [])
            factors, available_multiplier_products = sim_factors_tuple

            return DashboardDataResponse(
                summary=summary,
                factor_var=factor_var,
                simulation_factors={"factors": factors, "available_multiplier_products": available_multiplier_products},
                timeseries=timeseries,
                volatility_adjustments=vol_adj,
            )

        task = asyncio.create_task(_fetch_all())
        _dashboard_cache[cache_key] = (now, task)
        return await task

    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=503, detail="ClickHouseへの接続に失敗しました") from exc
