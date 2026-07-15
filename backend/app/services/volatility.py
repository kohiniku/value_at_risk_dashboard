import math
import statistics
from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from app.models.domain.filters import BranchFilters
from app.models.domain.strategies import DataResolutionStrategy
from app.repositories.volatility_repository import VolatilityRepository


def calc_adj(daily_map: dict) -> float:
    """日次PL辞書 {date: pl_total} からボラティリティ調整係数を算出する"""
    if not daily_map or len(daily_map) < 2:
        return 1.0

    sorted_dates = sorted(daily_map.keys())
    cutoff_date = sorted_dates[-132] if len(sorted_dates) >= 132 else sorted_dates[0]

    all_vals = list(daily_map.values())
    recent_vals = [daily_map[d] for d in sorted_dates if d >= cutoff_date]

    if len(all_vals) < 2 or len(recent_vals) < 2:
        return 1.0

    std800 = statistics.stdev(all_vals)
    std132 = statistics.stdev(recent_vals)

    if std800 == 0:
        return 1.0

    # 社内ルール: 小数第3位を切り上げて小数第2位までにする
    return max((math.ceil(std132 * 100 / std800) / 100) * 1.17, 1.0)


def get_volatility_adjustments(
    session: Session,
    as_of: date,
    branch_filters: BranchFilters | None,
    data_resolution_strategy: DataResolutionStrategy,
) -> dict[str, float]:

    repo = VolatilityRepository(session)
    rows = repo.fetch_volatility_raw_data(as_of, data_resolution_strategy, branch_filters)

    if not rows:
        return {}

    daily_tot = defaultdict(float)
    daily_ric = defaultdict(lambda: defaultdict(float))
    daily_cat = defaultdict(lambda: defaultdict(float))
    daily_fac = defaultdict(lambda: defaultdict(float))

    for row in rows:
        from_date, section_code, product, cat_name, cur_name, fac_name, pl_value = row
        val = float(pl_value) if pl_value is not None else 0.0

        daily_tot[from_date] += val

        cat_name = cat_name or ""
        cur_name = cur_name or "-"
        fac_name = fac_name or ""

        if cat_name:
            daily_cat[cat_name][from_date] += val

        if section_code:
            daily_ric[section_code][from_date] += val
        if product:
            daily_ric[product][from_date] += val

        if cat_name and fac_name:
            fac_key = f"{cat_name}:{cur_name}:{fac_name}"
            daily_fac[fac_key][from_date] += val

    res = {}
    res["total"] = calc_adj(daily_tot)

    for cat_name, dmap in daily_cat.items():
        res[f"cat:{cat_name}"] = calc_adj(dmap)

    for ric_name, dmap in daily_ric.items():
        res[f"ric:{ric_name}"] = calc_adj(dmap)

    for fac_key, dmap in daily_fac.items():
        res[f"fac:{fac_key}"] = calc_adj(dmap)

    return res
