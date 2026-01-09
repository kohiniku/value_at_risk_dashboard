from __future__ import annotations

from datetime import date, datetime, timedelta
from math import sin
from random import Random
from typing import Any

from sqlalchemy.orm import Session

from ..core.constants import PORTFOLIO_AGGREGATE_RIC, SCENARIO_WINDOW
from .base import Base
from .models import (
    AssetVaRRecord,
    DriverCommentaryRecord,
    MarketSignalRecord,
    NewsRecord,
    ScenarioDistributionRecord,
    VaRSnapshot,
    VaRTimeSeriesRecord,
)
from .session import SessionLocal, engine

ASSET_DEFINITIONS = [
    {"ric": "JP_EQ_LARGE", "name": "日本株式（大型）", "category": "株式", "base_amount": 10.8, "volatility": 0.35},
    {"ric": "JP_EQ_MID", "name": "日本株式（中型）", "category": "株式", "base_amount": 6.2, "volatility": 0.28},
    {"ric": "US_EQ_TECH", "name": "米国株式（テック）", "category": "株式", "base_amount": 9.4, "volatility": 0.45},
    {"ric": "EU_EQ_BANKS", "name": "欧州株式（金融）", "category": "株式", "base_amount": 5.3, "volatility": 0.25},
    {"ric": "EM_EQ", "name": "新興国株式", "category": "株式", "base_amount": 7.1, "volatility": 0.4},
    {"ric": "US_RATES_CORE", "name": "米国金利（10Y）", "category": "金利", "base_amount": 8.5, "volatility": 0.22},
    {"ric": "EU_RATES_CORE", "name": "欧州金利", "category": "金利", "base_amount": 6.7, "volatility": 0.18},
    {"ric": "JP_RATES", "name": "日本金利", "category": "金利", "base_amount": 4.2, "volatility": 0.12},
    {"ric": "UK_RATES", "name": "英国金利", "category": "金利", "base_amount": 3.9, "volatility": 0.2},
    {"ric": "AU_RATES", "name": "豪州金利", "category": "金利", "base_amount": 3.5, "volatility": 0.18},
    {"ric": "IG_CREDIT_US", "name": "米国IGクレジット", "category": "クレジット", "base_amount": 6.0, "volatility": 0.21},
    {"ric": "IG_CREDIT_EU", "name": "欧州IGクレジット", "category": "クレジット", "base_amount": 5.5, "volatility": 0.19},
    {"ric": "HY_CREDIT_US", "name": "米国HYクレジット", "category": "クレジット", "base_amount": 7.4, "volatility": 0.3},
    {"ric": "HY_CREDIT_EU", "name": "欧州HYクレジット", "category": "クレジット", "base_amount": 5.9, "volatility": 0.27},
    {"ric": "ASIA_CREDIT", "name": "アジアクレジット", "category": "クレジット", "base_amount": 4.8, "volatility": 0.22},
    {"ric": "MBS_AGENCY", "name": "エージェンシーMBS", "category": "モーゲージ", "base_amount": 6.3, "volatility": 0.2},
    {"ric": "MBS_NONAGENCY", "name": "ノンエージェンシーMBS", "category": "モーゲージ", "base_amount": 4.1, "volatility": 0.25},
    {"ric": "CMBS_CORE", "name": "CMBSコア", "category": "モーゲージ", "base_amount": 3.6, "volatility": 0.23},
    {"ric": "RMBS_HE", "name": "住宅RMBS（HE）", "category": "モーゲージ", "base_amount": 3.2, "volatility": 0.19},
    {"ric": "GOLD", "name": "金（ロング）", "category": "コモディティ", "base_amount": 2.8, "volatility": 0.2},
]

CONTRIBUTION_PROFILES = {
    "株式": {"window_drop": 0.28, "window_add": 0.12, "position_change": 0.35, "ranking_shift": 0.25},
    "金利": {"window_drop": 0.22, "window_add": 0.25, "position_change": 0.28, "ranking_shift": 0.25},
    "クレジット": {"window_drop": 0.26, "window_add": 0.14, "position_change": 0.30, "ranking_shift": 0.30},
    "モーゲージ": {"window_drop": 0.24, "window_add": 0.16, "position_change": 0.32, "ranking_shift": 0.28},
    "コモディティ": {"window_drop": 0.25, "window_add": 0.20, "position_change": 0.25, "ranking_shift": 0.30},
}

SNAPSHOT_DAYS = 5

DRIVER_LABELS = {
    "window_drop": "離脱要因",
    "window_add": "追加要因",
    "position_change": "ポジション調整",
    "ranking_shift": "順位シフト",
}

NEWS_TEMPLATES = [
    {
        "headline": "日銀、長期金利の許容レンジ拡大を示唆",
        "source": "日本経済新聞",
        "summary": "長期ゾーンのJGB利回りがじり高となり、国内機関投資家のポジション調整が波及。",
        "angle": "金利の変動が離脱要因を押し上げ、国内債券と株式のリスク許容度を左右",
    },
    {
        "headline": "米CPI鈍化で長期債が続伸、ヘッジ需要も増加",
        "source": "Bloomberg",
        "summary": "コアCPIが予想を下回り、デュレーション・ヘッジへの需要が再び活発化。",
        "angle": "米金利の落ち着きが追加要因を抑え、ポートフォリオ全体のVaR低下を後押し",
    },
    {
        "headline": "OPECプラス減産協議でコモディティ相場が上昇",
        "source": "Reuters",
        "summary": "需給引き締まり観測でエネルギー関連コモディティが急伸し、関連株も反応。",
        "angle": "コモディティとクレジットでポジション調整が発生し、順位シフトを誘発",
    },
    {
        "headline": "米住宅ローン金利が1年ぶり低水準、MBSに買い戻し",
        "source": "WSJ",
        "summary": "モーゲージスプレッドがタイト化し、エージェンシーMBSへの資金回帰が進展。",
        "angle": "モーゲージ資産で追加要因がプラス寄与し、分散効果の底上げに寄与",
    },
    {
        "headline": "中国人民銀が預金準備率を引き下げ",
        "source": "Caixin",
        "summary": "国内景気の下支え策として主要銀行の預金準備率を引き下げ、元建て資産が買い戻された。",
        "angle": "アジアクレジットのスプレッド縮小がテクニカルなプラス寄与を拡大",
    },
    {
        "headline": "ECB理事会、量的引き締めの減速を示唆",
        "source": "Handelsblatt",
        "summary": "バランスシート圧縮のペースを緩める示唆が出て欧州債が急伸、銀行株も小幅高。",
        "angle": "欧州金利と金融セクターのVaRが同時に低下し分散効果を押し上げた",
    },
    {
        "headline": "WTIが85ドル台に到達、シェール増産期待が後退",
        "source": "CNBC",
        "summary": "在庫統計の急減を受けてWTI先物が大幅高、シェール企業の増産計画が慎重姿勢へ。",
        "angle": "エネルギー関連ポジションのボラティリティ上昇でコモディティVaRが拡大",
    },
    {
        "headline": "ドル円150円台を維持、当局の口先介入が影響",
        "source": "Nikkei Asia",
        "summary": "為替当局の連日の発言がドル円を150円台に定着させ、輸出株に資金が流入した。",
        "angle": "円安が株式セクターの順張り需要を創出し、ポジション調整要因が顕在化",
    },
    {
        "headline": "米地銀の与信費用見通しが悪化、社債スプレッド拡大",
        "source": "Financial Times",
        "summary": "地方銀行の決算で貸倒引当金の積み増しが相次ぎ、IG/HYスプレッドが同時に拡大。",
        "angle": "クレジット要因のウエイトが高まり、離脱要因のマイナス寄与が強まった",
    },
    {
        "headline": "テック大型株が決算でサプライズ、NASDAQ先物が急伸",
        "source": "Wall Street Journal",
        "summary": "AI関連投資の強気指針を受けてSOX指数も連れ高となり、金利観測も好転。",
        "angle": "米国株テック銘柄のプラス寄与がポートフォリオの最大ドライバーとなった",
    },
]


def init_db() -> None:
    """Reset schema and seed demo data."""

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_demo_data(session)


def seed_demo_data(session: Session) -> None:
    today = date.today()
    as_of_dates = sorted({today - timedelta(days=offset) for offset in range(SNAPSHOT_DAYS)}, reverse=False)

    prev_amounts = {definition["ric"]: definition["base_amount"] for definition in ASSET_DEFINITIONS}
    prev_portfolio_total = None
    daily_contexts: list[dict[str, Any]] = []

    for as_of in as_of_dates:
        asset_records: list[AssetVaRRecord] = []
        sum_amount = 0.0
        for idx, definition in enumerate(ASSET_DEFINITIONS):
            drift = sin((as_of.toordinal() + idx * 13) / 5) * definition["volatility"]
            amount = round(definition["base_amount"] + drift, 2)
            prev_amount = prev_amounts.get(definition["ric"], amount)
            change_amount = round(amount - prev_amount, 2)
            change_pct = round((change_amount / prev_amount * 100) if prev_amount else 0.0, 2)
            prev_amounts[definition["ric"]] = amount

            contributions = _build_contributions(definition["category"], change_amount)
            record = AssetVaRRecord(
                ric=definition["ric"],
                name=definition["name"],
                category=definition["category"],
                amount=amount,
                change_amount=change_amount,
                change_pct=change_pct,
                window_drop_contribution=contributions["window_drop"],
                window_add_contribution=contributions["window_add"],
                position_change_contribution=contributions["position_change"],
                ranking_shift_contribution=contributions["ranking_shift"],
            )
            asset_records.append(record)
            sum_amount += amount

        diversification_effect = round(sum_amount * -0.18, 2)
        portfolio_total = round(sum_amount + diversification_effect, 2)
        if prev_portfolio_total is None:
            portfolio_change_amount = 0.0
            portfolio_change_pct = 0.0
        else:
            portfolio_change_amount = round(portfolio_total - prev_portfolio_total, 2)
            portfolio_change_pct = round(
                (portfolio_change_amount / prev_portfolio_total * 100) if prev_portfolio_total else 0.0,
                2,
            )
        prev_portfolio_total = portfolio_total

        snapshot = VaRSnapshot(
            as_of=as_of,
            portfolio_total=portfolio_total,
            portfolio_change_amount=portfolio_change_amount,
            portfolio_change_pct=portfolio_change_pct,
            diversification_effect=diversification_effect,
        )
        snapshot.assets = asset_records
        session.add(snapshot)
        driver_totals = _aggregate_driver_totals(asset_records)
        leading_asset_record = max(asset_records, key=lambda record: record.amount, default=None)
        daily_contexts.append(
            {
                "as_of": as_of,
                "driver_totals": driver_totals,
                "leading_asset": leading_asset_record.name if leading_asset_record else "主要資産",
                "leading_category": leading_asset_record.category if leading_asset_record else "ポートフォリオ",
                "portfolio_change_pct": portfolio_change_pct,
                "portfolio_total": portfolio_total,
                "diversification_effect": diversification_effect,
            }
        )

    session.flush()
    news_map = _seed_news(session, as_of_dates)
    _seed_market_signals(session, daily_contexts)
    _seed_driver_commentaries(session, daily_contexts, news_map)
    _seed_timeseries(session, today)
    _seed_scenario_distribution(session)
    session.commit()


def _build_contributions(category: str, change_amount: float) -> dict[str, float]:
    profile = CONTRIBUTION_PROFILES.get(category, CONTRIBUTION_PROFILES["株式"])
    if change_amount == 0:
        return {key: 0.0 for key in profile}
    return {key: round(change_amount * weight, 3) for key, weight in profile.items()}


def _aggregate_driver_totals(records: list[AssetVaRRecord]) -> dict[str, float]:
    totals = {key: 0.0 for key in DRIVER_LABELS}
    for record in records:
        totals["window_drop"] += record.window_drop_contribution
        totals["window_add"] += record.window_add_contribution
        totals["position_change"] += record.position_change_contribution
        totals["ranking_shift"] += record.ranking_shift_contribution
    return {key: round(value, 3) for key, value in totals.items()}


def _seed_market_signals(session: Session, contexts: list[dict[str, Any]]) -> None:
    records: list[MarketSignalRecord] = []
    for context in contexts:
        as_of: date = context["as_of"]  # type: ignore[assignment]
        driver_totals: dict[str, float] = context["driver_totals"]  # type: ignore[assignment]
        diversification_effect = float(context["diversification_effect"])
        portfolio_total = float(context["portfolio_total"]) or 1.0
        change_pct = float(context["portfolio_change_pct"])
        leading_asset = str(context["leading_asset"])
        leading_category = str(context["leading_category"])
        noise = sin(as_of.toordinal() / 3) * 7
        ratio = diversification_effect / portfolio_total
        raw_score = 55 + noise + ratio * -220
        raw_score += driver_totals["position_change"] * 6
        raw_score += driver_totals["window_add"] * 3
        raw_score -= abs(driver_totals["window_drop"]) * 4
        raw_score -= change_pct * 0.8
        score = max(5.0, min(95.0, round(raw_score, 1)))
        label = _derive_signal_label(score)
        resilience = "底堅さ" if score >= 55 else "警戒感"
        narrative = f"{leading_category}の{leading_asset}がリスクを牽引。分散効果{diversification_effect:+.2f}億円が{resilience}を示唆。"
        records.append(
            MarketSignalRecord(
                as_of=as_of,
                gauge_value=score,
                label=label,
                narrative=narrative,
            )
        )
    session.add_all(records)


def _derive_signal_label(score: float) -> str:
    if score >= 66:
        return "強気ゾーン"
    if score >= 40:
        return "中立ゾーン"
    return "慎重ゾーン"


def _seed_driver_commentaries(
    session: Session,
    contexts: list[dict[str, Any]],
    news_map: dict[date, list[dict[str, str]]],
) -> None:
    records: list[DriverCommentaryRecord] = []
    for context in contexts:
        as_of: date = context["as_of"]  # type: ignore[assignment]
        driver_totals: dict[str, float] = context["driver_totals"]  # type: ignore[assignment]
        leading_asset = str(context["leading_asset"])
        leading_category = str(context["leading_category"])
        diversification_effect = float(context["diversification_effect"])
        technical_summary, news_summary = _build_commentary_sections(
            as_of,
            driver_totals,
            leading_asset,
            leading_category,
            diversification_effect,
            news_map.get(as_of, []),
        )
        records.append(
            DriverCommentaryRecord(
                as_of=as_of,
                technical_summary=technical_summary,
                news_summary=news_summary,
            )
        )
    session.add_all(records)


def _build_commentary_sections(
    as_of: date,
    driver_totals: dict[str, float],
    leading_asset: str,
    leading_category: str,
    diversification_effect: float,
    news_entries: list[dict[str, str]],
) -> tuple[str, str]:
    day_label = f"{as_of.month}/{as_of.day}"
    ranked = sorted(driver_totals.items(), key=lambda item: abs(item[1]), reverse=True)
    primary_key, primary_value = ranked[0]
    secondary_key, secondary_value = ranked[1] if len(ranked) > 1 else ranked[0]
    technical_summary = (
        f"{day_label}のテクニカル要因は{DRIVER_LABELS[primary_key]} {primary_value:+.2f}億円が最大、"
        f"次いで{DRIVER_LABELS[secondary_key]} {secondary_value:+.2f}億円。"
        f"{leading_category}（{leading_asset}）が分散効果{diversification_effect:+.2f}億円で振れを吸収。"
    )
    news_entry = news_entries[0] if news_entries else None
    if news_entry:
        angle = news_entry.get("angle", "")
        if angle and not angle.endswith("。"):
            angle = f"{angle}。"
        news_summary = f"{news_entry['headline']}（{news_entry['source']}）。{angle or '外部環境がVaRシグナルに直結。'}"
    else:
        news_summary = "当日は特筆すべき外部ヘッドラインがなく、内部要因がVaRを主導。"
    return (technical_summary, news_summary)


def _seed_news(session: Session, as_of_dates: list[date]) -> dict[date, list[dict[str, str]]]:
    news_records: list[NewsRecord] = []
    grouped: dict[date, list[dict[str, str]]] = {}
    for idx, as_of in enumerate(as_of_dates):
        for variant in range(2):
            template_index = (idx * 2 + variant) % len(NEWS_TEMPLATES)
            template = NEWS_TEMPLATES[template_index]
            published_at = datetime.combine(as_of, datetime.min.time()) + timedelta(hours=variant * 6 + idx)
            stamp = as_of.strftime("%m/%d")
            headline = f"{template['headline']}｜{stamp}"
            summary = f"{template['summary']}（基準日 {stamp}）"
            record = NewsRecord(
                headline=headline,
                published_at=published_at,
                source=template["source"],
                summary=summary,
            )
            news_records.append(record)
            grouped.setdefault(as_of, []).append(
                {
                    "headline": headline,
                    "source": template["source"],
                    "angle": template["angle"],
                }
            )
    session.add_all(news_records)
    return grouped


def _seed_timeseries(session: Session, today: date) -> None:
    offsets = list(range(120, -1, -1))
    portfolio_buckets = {offset: 0.0 for offset in offsets}

    for definition in ASSET_DEFINITIONS:
        points: list[VaRTimeSeriesRecord] = []
        base = definition["base_amount"]
        for offset in offsets:
            point_date = today - timedelta(days=offset)
            value = round(base + sin((offset + len(definition["ric"])) / 4) * definition["volatility"] * 3, 3)
            change = None
            if points:
                change = round(value - points[-1].value, 3)
            points.append(
                VaRTimeSeriesRecord(
                    ric=definition["ric"],
                    point_date=point_date,
                    value=value,
                    change=change,
                )
            )
            portfolio_buckets[offset] += value
        session.add_all(points)

    portfolio_points: list[VaRTimeSeriesRecord] = []
    prev_value = None
    for offset in offsets:
        point_date = today - timedelta(days=offset)
        standalone = portfolio_buckets[offset]
        portfolio_value = round(standalone * 0.82, 3)
        change = None if prev_value is None else round(portfolio_value - prev_value, 3)
        portfolio_points.append(
            VaRTimeSeriesRecord(
                ric=PORTFOLIO_AGGREGATE_RIC,
                point_date=point_date,
                value=portfolio_value,
                change=change,
            )
        )
        prev_value = portfolio_value

    session.add_all(portfolio_points)


def _seed_scenario_distribution(session: Session) -> None:
    rng_cache: dict[str, Random] = {}
    portfolio_accumulator = [0.0 for _ in range(SCENARIO_WINDOW)]
    records: list[ScenarioDistributionRecord] = []

    for definition in ASSET_DEFINITIONS:
        generator = rng_cache.setdefault(definition["ric"], Random(sum(ord(ch) for ch in definition["ric"])))
        values = _build_scenario_series(definition["base_amount"], definition["volatility"], generator)
        for idx, value in enumerate(values):
            records.append(
                ScenarioDistributionRecord(
                    ric=definition["ric"],
                    scenario_index=idx,
                    value=value,
                )
            )
            portfolio_accumulator[idx] += value * 0.6

    for idx, value in enumerate(portfolio_accumulator):
        records.append(
            ScenarioDistributionRecord(
                ric=PORTFOLIO_AGGREGATE_RIC,
                scenario_index=idx,
                value=round(value, 3),
            )
        )

    session.add_all(records)


def _build_scenario_series(base_amount: float, volatility: float, rng: Random) -> list[float]:
    """Return pseudo Gaussian loss samples to mimic正規分布寄りのシナリオPL."""

    values: list[float] = []
    mean_scale = base_amount * 0.12
    drift_amplitude = max(0.2, volatility * 0.35)
    shock_scale = max(0.25, base_amount * 0.03)

    for idx in range(SCENARIO_WINDOW):
        seasonal = sin((idx + base_amount) / 32) * drift_amplitude
        gaussian = rng.gauss(0, 1)
        value = round(-(mean_scale + seasonal + gaussian * shock_scale), 3)
        values.append(value)

    return values


if __name__ == "__main__":
    init_db()
