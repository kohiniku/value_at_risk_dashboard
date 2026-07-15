import json

from fastapi import HTTPException, Query

from app.models.domain.filters import BranchFilterCriteria, BranchFilters, SimulationAdjustments


def parse_branch_filters(
    branch_filters: str | None = Query(
        None,
        description="OR条件のリスト。各要素は {entity_name, dept_name, section_code} を持ち、要素内はAND・要素間はOR。",
    ),
) -> BranchFilters:
    if not branch_filters:
        return BranchFilters(criteria=[])
    try:
        parsed = json.loads(branch_filters)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="branch_filters のJSONが不正です") from exc

    if not isinstance(parsed, list):
        raise HTTPException(status_code=400, detail="branch_filters は配列(JSON array)で指定してください")

    criteria_list = []
    for item in parsed:
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail="branch_filters の各要素はオブジェクト(JSON object)で指定してください")

        cond = {}
        for key in ("entity_name", "dept_name", "section_code", "product"):
            value = item.get(key)
            if isinstance(value, str) and value.strip():
                cond[key] = value.strip()
        if cond:
            criteria_list.append(BranchFilterCriteria(**cond))

    return BranchFilters(criteria=criteria_list)


def parse_simulation_adjustments(
    simulation_adjustments: str | None = Query(None, description="シミュレーション補正値 (JSON string)"),
) -> SimulationAdjustments:
    if not simulation_adjustments:
        return SimulationAdjustments(adjustments={}, multipliers={})
    try:
        parsed = json.loads(simulation_adjustments)
        if not isinstance(parsed, dict):
            return SimulationAdjustments(adjustments={}, multipliers={})

        # Backward compatibility / New structure handling
        if "adjustments" in parsed or "multipliers" in parsed:
            adj = parsed.get("adjustments", {})
            mult = parsed.get("multipliers", {})
            return SimulationAdjustments(
                adjustments={str(k): float(v) for k, v in adj.items()} if isinstance(adj, dict) else {},
                multipliers={str(k): float(v) for k, v in mult.items()} if isinstance(mult, dict) else {},
            )
        else:
            return SimulationAdjustments(adjustments={str(k): float(v) for k, v in parsed.items()}, multipliers={})
    except (json.JSONDecodeError, ValueError, TypeError):
        return SimulationAdjustments(adjustments={}, multipliers={})
