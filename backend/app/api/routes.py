"""API endpoints exposed by the Value at Risk prototype."""

from datetime import date

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import Date, case, desc, func, literal, select, union_all
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
    comparison_date: date | None = None,
) -> FactorVarListResponse:
    with SessionLocal_PG() as session:

        def _fetch_data(target_date_val: date):
            asof_date_value = target_date_val.strftime("%Y-%m-%d")

            # --- CTE: target_date -------------------------------------------------------
            target_date = select(
                literal(asof_date_value).cast(Date).label("asof_date"),
            ).cte("target_date")

            # --- CTE: entity_branches ---------------------------------------------------
            entity_branches = (
                select(
                    EntityBranchCodeRelation.branch_code,
                ).where(
                    EntityBranchCodeRelation.entity == "invport",
                )
            ).cte("entity_branches")

            # --- CTE: delta_sum ---------------------------------------------------------
            delta_alias = aliased(Delta, name="dt_delta")

            delta_sum = (
                select(
                    Factor.unit_id.label("unit_id"),
                    literal("Delta").label("name"),
                    delta_alias.asof_date.label("asof_date"),
                    func.sum(delta_alias.delta).label("dsum"),
                )
                .join(delta_alias, Factor.factor_id == delta_alias.factor_id)
                .where(
                    Factor.unit_id.isnot(None),
                    delta_alias.grid == "AllMember",
                    delta_alias.branch_code.in_(select(entity_branches.c.branch_code)),
                )
                .group_by(Factor.unit_id, delta_alias.asof_date)
            ).cte("delta_sum")

            # --- CTE: vega_sum ----------------------------------------------------------
            vega_alias = aliased(Vega, name="dt_vega")

            vega_sum = (
                select(
                    Factor.unit_id.label("unit_id"),
                    literal("Vega").label("name"),
                    vega_alias.asof_date.label("asof_date"),
                    func.sum(vega_alias.vega).label("vsum"),
                )
                .join(vega_alias, Factor.factor_id == vega_alias.factor_id)
                .where(
                    Factor.unit_id.isnot(None),
                    vega_alias.grid == "AllMember",
                    vega_alias.branch_code.in_(select(entity_branches.c.branch_code)),
                )
                .group_by(Factor.unit_id, vega_alias.asof_date)
            ).cte("vega_sum")

            # --- CTE: var_ranked --------------------------------------------------------
            r = aliased(RiskCategories, name="r")
            d = aliased(DisplayUnit, name="d")
            c = aliased(Currencies, name="c")
            f = aliased(Factor, name="f")
            pl = aliased(ScenarioPLFromMatsuri, name="pl")

            # ウィンドウ関数: ROW_NUMBER() OVER (PARTITION BY d.unit_id ORDER BY SUM(pl.pl_value) ASC)
            row_number_over = func.row_number().over(
                partition_by=d.unit_id,
                order_by=func.sum(pl.pl_value).asc(),
            )

            var_ranked = (
                select(
                    r.risk_category_id,
                    r.risk_category_name,
                    c.currency_id,
                    c.currency_name,
                    d.unit_id,
                    d.unit_name,
                    pl.from_date,
                    row_number_over.label("rn"),
                    func.sum(pl.pl_value).label("var"),
                )
                .select_from(r)
                .join(d, r.risk_category_id == d.risk_category_id, isouter=True)
                .join(c, d.currency_id == c.currency_id, isouter=True)
                .join(f, d.unit_id == f.unit_id, isouter=True)
                .join(
                    pl,
                    (f.factor_id == pl.factor_id) & (pl.entity == "invport") & (pl.asof_date == select(target_date.c.asof_date).scalar_subquery()),
                    isouter=True,
                )
                .group_by(
                    r.risk_category_id,
                    r.risk_category_name,
                    c.currency_id,
                    c.currency_name,
                    d.unit_id,
                    d.unit_name,
                    pl.from_date,
                )
            ).cte("var_ranked")

            # --- CTE: var (rn = 8 のみ残す) ---------------------------------------------
            var = (
                select(
                    var_ranked.c.unit_id,
                    var_ranked.c.risk_category_name,
                    var_ranked.c.currency_name,
                    var_ranked.c.unit_name,
                    var_ranked.c.from_date,
                    var_ranked.c.var,
                ).where(var_ranked.c.rn == 8)
            ).cte("var")

            # --- 最終 SELECT ------------------------------------------------------------
            base_query = (
                select(
                    var.c.risk_category_name,
                    var.c.currency_name,
                    var.c.unit_name,
                    case(
                        (
                            0 <= func.coalesce(delta_sum.c.dsum, vega_sum.c.vsum),
                            literal(True),
                        ),
                        else_=literal(False),
                    ).label("sensitivity_direction"),
                    var.c.var,
                )
                .outerjoin(delta_sum, var.c.unit_id == delta_sum.c.unit_id)
                .outerjoin(vega_sum, var.c.unit_id == vega_sum.c.unit_id)
                .where(func.coalesce(delta_sum.c.asof_date, vega_sum.c.asof_date) == select(target_date.c.asof_date).scalar_subquery())
                .order_by(var.c.unit_id)
            )

            # --- CTE: var_ranked_total（invport全体のシナリオ別PL合計）---

            pl_total = aliased(ScenarioPLFromMatsuri, name="pl_total")

            row_number_total = func.row_number().over(
                # 「factor方向に sum したあと」の値を、
                # 全シナリオで通し番号（1,2,3,...）を振る
                order_by=func.sum(pl_total.pl_value).asc(),
            )

            var_ranked_total = (
                select(
                    pl_total.from_date,  # シナリオ軸
                    row_number_total.label("rn"),  # 低い方からの順位
                    func.sum(pl_total.pl_value).label("var"),  # factor方向に sum
                )
                .select_from(pl_total)
                .where(
                    pl_total.entity == "invport",
                    pl_total.asof_date == select(target_date.c.asof_date).scalar_subquery(),  # 特定 asof_date
                )
                .group_by(pl_total.from_date)
            ).cte("var_ranked_total")

            # --- CTE: var_total（全体VaR）---
            var_total = (
                select(
                    var_ranked_total.c.from_date,
                    var_ranked_total.c.var,
                ).where(var_ranked_total.c.rn == 8)
            ).cte("var_total")

            overall_row_query = select(
                literal("全体").label("risk_category_name"),  # 好きなラベルに変更可
                literal("-").label("currency_name"),
                literal("全リスク合算").label("unit_name"),
                case(
                    (var_total.c.var >= 0, literal(True)),
                    else_=literal(False),
                ).label("sensitivity_direction"),
                var_total.c.var,
            )

            combined_query = union_all(
                overall_row_query,
                base_query,
            )

            return session.execute(combined_query).all()

        # Fetch data for as_of
        results_as_of = _fetch_data(as_of)

        # Fetch data for comparison_date if provided
        comparison_map = {}
        if comparison_date:
            results_comparison = _fetch_data(comparison_date)
            # Create a map for easy lookup: (risk_category, currency, risk_factor) -> var_amount
            for res in results_comparison:
                key = (res[0], res[1], res[2])
                comparison_map[key] = -1 * res[4]

        res = FactorVarListResponse(
            factor_var_list=[
                FactorVaR(
                    risk_category=result[0],
                    currency=result[1],
                    risk_factor=result[2],
                    risk_direction=result[3],
                    var_amount=-1 * result[4],
                    comparison=comparison_map.get((result[0], result[1], result[2])),
                )
                for result in results_as_of
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
