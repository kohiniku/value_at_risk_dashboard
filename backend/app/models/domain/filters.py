from pydantic import BaseModel, Field


class BranchFilterCriteria(BaseModel):
    """
    Branch filterの1つの条件。
    複数項目が指定された場合は、要素内でAND条件となる。
    """

    entity_name: str | None = None
    dept_name: str | None = None
    section_code: str | None = None
    product: str | None = None


class BranchFilters(BaseModel):
    """
    Branch filter全体の条件。
    内部の criteria リストは、要素間でOR条件となる。
    """

    criteria: list[BranchFilterCriteria] = Field(default_factory=list)

    @property
    def is_empty(self) -> bool:
        return len(self.criteria) == 0

    def __iter__(self):
        return iter(self.criteria)

    def __bool__(self) -> bool:
        return not self.is_empty


class SimulationAdjustments(BaseModel):
    """
    シミュレーション用の補正値。
    factor_id をキー、変動値(delta_100m) を値とするマップ、および
    product をキー、倍率 を値とするマップ。
    """

    adjustments: dict[str, float] = Field(default_factory=dict)
    multipliers: dict[str, float] = Field(default_factory=dict)

    @property
    def is_empty(self) -> bool:
        return len(self.adjustments) == 0 and len(self.multipliers) == 0

    def items(self):
        return self.adjustments.items()

    def get(self, key: str, default: float = 0.0) -> float:
        return self.adjustments.get(key, default)

    def __bool__(self) -> bool:
        return not self.is_empty
