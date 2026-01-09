"""API endpoints exposed by the Value at Risk prototype."""

from datetime import date

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import case, desc, func, literal, select
from sqlalchemy.orm import aliased

from ..core.constants import PORTFOLIO_AGGREGATE_RIC
from ..db.models import (
    DriverCommentaryRecord,
    MarketSignalRecord,
    NewsRecord,
    ScenarioDistributionRecord,
    VaRSnapshot,
    VaRTimeSeriesRecord,
)
from ..db.session import SessionLocal
from ..db_pg.models import (
    Currencies,
    Delta,
    DisplayUnit,
    EntityBranchCodeRelation,
    Factor,
    RiskCategories,
    ScenarioPLFromMatsuri,
    Vega,
)
from ..db_pg.session import SessionLocal as SessionLocal_PG
from ..models.var import (
    AssetVaR,
    DriverBreakdown,
    DriverCommentary,
    FactorVaR,
    FactorVarListResponse,
    MarketSignal,
    NewsItem,
    PortfolioVaR,
    ScenarioDistributionResponse,
    VaRSummaryResponse,
    VaRTimeSeriesPoint,
    VaRTimeSeriesResponse,
)

router = APIRouter()


@router.get("/var/factor_var", response_model=FactorVarListResponse)
def get_factor_var(
    as_of: date | None = None,
) -> FactorVarListResponse:
    with SessionLocal_PG() as session:
        # branch_codes CTE
        branch_codes_cte = (select(EntityBranchCodeRelation.branch_code).where(EntityBranchCodeRelation.entity == "invport")).cte("branch_codes")

        # delta_sum CTE
        delta_filtered = aliased(Delta, name="dt")
        delta_sum_cte = (
            select(
                Factor.unit_id,
                literal("Delta").label("name"),
                delta_filtered.asof_date,
                func.sum(delta_filtered.delta).label("dsum"),
            )
            .select_from(Factor)
            .join(
                delta_filtered,
                (Factor.factor_id == delta_filtered.factor_id)
                & (delta_filtered.grid == "AllMember")
                & (delta_filtered.branch_code.in_(select(branch_codes_cte.c.branch_code))),
            )
            .where(Factor.unit_id.isnot(None))
            .group_by(Factor.unit_id, delta_filtered.asof_date)
        ).cte("delta_sum")

        # vega_sum CTE
        vega_filtered = aliased(Vega, name="dt")
        vega_sum_cte = (
            select(
                Factor.unit_id,
                literal("Vega").label("name"),
                vega_filtered.asof_date,
                func.sum(vega_filtered.vega).label("vsum"),
            )
            .select_from(Factor)
            .join(
                vega_filtered,
                (Factor.factor_id == vega_filtered.factor_id)
                & (vega_filtered.grid == "AllMember")
                & (vega_filtered.branch_code.in_(select(branch_codes_cte.c.branch_code))),
            )
            .where(Factor.unit_id.isnot(None))
            .group_by(Factor.unit_id, vega_filtered.asof_date)
        ).cte("vega_sum")

        # display_units CTE
        display_units_cte = (select(DisplayUnit.unit_id, DisplayUnit.risk_category_id, DisplayUnit.currency_id)).cte("display_units")

        # factor_by_unit CTE
        factor_by_unit_cte = (select(Factor.unit_id, Factor.factor_id)).cte("factor_by_unit")

        # scenario_pl_invport CTE
        scenario_pl_invport_cte = (
            select(ScenarioPLFromMatsuri.factor_id, ScenarioPLFromMatsuri.from_date, ScenarioPLFromMatsuri.pl_value).where(
                ScenarioPLFromMatsuri.entity == "invport"
            )
        ).cte("scenario_pl_invport")

        # var_joined CTE
        var_joined_cte = (
            select(
                display_units_cte.c.risk_category_id,
                display_units_cte.c.currency_id,
                display_units_cte.c.unit_id,
                scenario_pl_invport_cte.c.from_date,
                scenario_pl_invport_cte.c.pl_value,
            )
            .select_from(display_units_cte)
            .outerjoin(factor_by_unit_cte, display_units_cte.c.unit_id == factor_by_unit_cte.c.unit_id)
            .outerjoin(scenario_pl_invport_cte, factor_by_unit_cte.c.factor_id == scenario_pl_invport_cte.c.factor_id)
        ).cte("var_joined")

        # var_aggregated CTE
        var_aggregated_cte = (
            select(
                var_joined_cte.c.risk_category_id,
                var_joined_cte.c.currency_id,
                var_joined_cte.c.unit_id,
                var_joined_cte.c.from_date,
                func.sum(var_joined_cte.c.pl_value).label("var"),
            ).group_by(var_joined_cte.c.risk_category_id, var_joined_cte.c.currency_id, var_joined_cte.c.unit_id, var_joined_cte.c.from_date)
        ).cte("var_aggregated")

        # var_ranked CTE
        var_ranked_cte = (
            select(
                var_aggregated_cte,
                func.row_number().over(partition_by=var_aggregated_cte.c.unit_id, order_by=var_aggregated_cte.c.var.asc()).label("rn"),
            )
        ).cte("var_ranked")

        # var_cte CTE
        var_cte = (select(var_ranked_cte.c.unit_id, var_ranked_cte.c.from_date, var_ranked_cte.c.var).where(var_ranked_cte.c.rn == 8)).cte("var_cte")

        # base CTE (最終的なSELECT)
        base_query = (
            select(
                func.coalesce(delta_sum_cte.c.asof_date, vega_sum_cte.c.asof_date).label("asof_date"),
                RiskCategories.risk_category_name,
                Currencies.currency_name,
                DisplayUnit.unit_name,
                func.coalesce(delta_sum_cte.c.name, vega_sum_cte.c.name).label("sensitivity_type"),
                case((func.coalesce(delta_sum_cte.c.dsum, vega_sum_cte.c.vsum) >= 0, "Positive"), else_="Negative").label("sensitivity_direction"),
                var_cte.c.var,
            )
            .select_from(DisplayUnit)
            .outerjoin(RiskCategories, DisplayUnit.risk_category_id == RiskCategories.risk_category_id)
            .outerjoin(Currencies, DisplayUnit.currency_id == Currencies.currency_id)
            .outerjoin(delta_sum_cte, DisplayUnit.unit_id == delta_sum_cte.c.unit_id)
            .outerjoin(vega_sum_cte, DisplayUnit.unit_id == vega_sum_cte.c.unit_id)
            .outerjoin(var_cte, DisplayUnit.unit_id == var_cte.c.unit_id)
            .where(func.coalesce(delta_sum_cte.c.asof_date, vega_sum_cte.c.asof_date) == "2025-09-30")
            .order_by(DisplayUnit.risk_category_id, DisplayUnit.currency_id, DisplayUnit.unit_id)
        )

        results = session.execute(base_query).all()

        res = FactorVarListResponse(
            factor_var_list=[
                FactorVaR(
                    risk_category=result[1],
                    currency=result[2],
                    risk_factor=result[3],
                    risk_direction=result[5],
                    var_amount=result[6],
                    comparison=None,
                )
                for result in results
            ]
        )

        return res


@router.get("/var/summary", response_model=VaRSummaryResponse)
def get_var_summary(
    as_of: date | None = Query(None, description="基準日を指定 (未指定時は最新)"),
) -> VaRSummaryResponse:
    """Return headline VaR figures for the latest valuation date."""

    with SessionLocal() as session:
        stmt = select(VaRSnapshot)
        if as_of:
            stmt = stmt.where(VaRSnapshot.as_of == as_of)
        stmt = stmt.order_by(desc(VaRSnapshot.as_of)).limit(1)
        snapshot = session.scalars(stmt).unique().first()
        if snapshot is None:
            raise HTTPException(status_code=404, detail="VaR snapshot not found")

        signal_stmt = select(MarketSignalRecord).where(MarketSignalRecord.as_of == snapshot.as_of)
        signal_record = session.scalars(signal_stmt).first()
        commentary_stmt = select(DriverCommentaryRecord).where(DriverCommentaryRecord.as_of == snapshot.as_of)
        commentary_record = session.scalars(commentary_stmt).first()
        if signal_record is None or commentary_record is None:
            raise HTTPException(status_code=404, detail="Market context not found for snapshot")

        portfolio = PortfolioVaR(
            total=snapshot.portfolio_total,
            change_amount=snapshot.portfolio_change_amount,
            change_pct=snapshot.portfolio_change_pct,
            diversification_effect=snapshot.diversification_effect,
        )
        assets = [
            AssetVaR(
                ric=asset.ric,
                name=asset.name,
                category=asset.category,
                amount=asset.amount,
                change_amount=asset.change_amount,
                change_pct=asset.change_pct,
                contributions=DriverBreakdown(
                    window_drop=asset.window_drop_contribution,
                    window_add=asset.window_add_contribution,
                    position_change=asset.position_change_contribution,
                    ranking_shift=asset.ranking_shift_contribution,
                ),
            )
            for asset in snapshot.assets
        ]

        driver_totals = DriverBreakdown(
            window_drop=round(sum(asset.window_drop_contribution for asset in snapshot.assets), 3),
            window_add=round(sum(asset.window_add_contribution for asset in snapshot.assets), 3),
            position_change=round(sum(asset.position_change_contribution for asset in snapshot.assets), 3),
            ranking_shift=round(sum(asset.ranking_shift_contribution for asset in snapshot.assets), 3),
        )

        market_signal = MarketSignal(
            as_of=signal_record.as_of,
            score=signal_record.gauge_value,
            label=signal_record.label,
            narrative=signal_record.narrative,
        )
        driver_commentary = DriverCommentary(
            as_of=commentary_record.as_of,
            technical_summary=commentary_record.technical_summary,
            news_summary=commentary_record.news_summary,
            driver_totals=driver_totals,
        )

        return VaRSummaryResponse(
            as_of=snapshot.as_of,
            portfolio=portfolio,
            assets=assets,
            market_signal=market_signal,
            driver_commentary=driver_commentary,
        )


@router.get("/var/timeseries", response_model=VaRTimeSeriesResponse)
def get_var_timeseries(
    ric: str = Query(PORTFOLIO_AGGREGATE_RIC, description="Asset identifier to retrieve"),
    days: int = Query(30, ge=5, le=90),
) -> VaRTimeSeriesResponse:
    """Return a rolling window of VaR observations for an asset."""

    with SessionLocal() as session:
        stmt = select(VaRTimeSeriesRecord).where(VaRTimeSeriesRecord.ric == ric).order_by(desc(VaRTimeSeriesRecord.point_date)).limit(days)
        records = list(session.scalars(stmt))
        if not records:
            raise HTTPException(status_code=404, detail=f"No time series found for {ric}")

        points = [VaRTimeSeriesPoint(date=record.point_date, value=record.value, change=record.change) for record in reversed(records)]
        if points:
            points[0].change = None
        return VaRTimeSeriesResponse(ric=ric, points=points)


@router.get("/news", response_model=list[NewsItem])
def get_news(limit: int = Query(5, ge=1, le=20)) -> list[NewsItem]:
    """Return mocked list of news items related to VaR movements."""

    with SessionLocal() as session:
        stmt = select(NewsRecord).order_by(desc(NewsRecord.published_at)).limit(limit)
        return [
            NewsItem(
                id=str(record.id),
                headline=record.headline,
                published_at=record.published_at.isoformat(),
                source=record.source,
                summary=record.summary,
            )
            for record in session.scalars(stmt)
        ]


@router.get("/var/dates", response_model=list[date])
def list_snapshot_dates() -> list[date]:
    """Return available snapshot dates sorted descending."""

    with SessionLocal() as session:
        stmt = select(VaRSnapshot.as_of).order_by(desc(VaRSnapshot.as_of))
        return [row[0] for row in session.execute(stmt)]


@router.get("/var/scenario-distribution", response_model=ScenarioDistributionResponse)
def get_scenario_distribution(
    ric: str = Query(PORTFOLIO_AGGREGATE_RIC, description="対象資産のRIC (全資産は ALL_ASSETS)"),
) -> ScenarioDistributionResponse:
    """Return histogram-ready scenario P/L samples for the requested asset."""

    with SessionLocal() as session:
        stmt = (
            select(ScenarioDistributionRecord.value).where(ScenarioDistributionRecord.ric == ric).order_by(ScenarioDistributionRecord.scenario_index)
        )
        values = [row[0] for row in session.execute(stmt)]
        if not values:
            raise HTTPException(status_code=404, detail="Scenario distribution not found")
        return ScenarioDistributionResponse(ric=ric, values=values)
