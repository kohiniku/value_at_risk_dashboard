from pydantic import BaseModel


class FactorVarResultRow(BaseModel):
    """
    DB(ClickHouse)から取得したVaR計算結果の1行を表す値オブジェクト。
    """

    risk_category_id: int
    risk_category_name: str
    currency_id: int
    currency_name: str
    display_unit_name: str
    var_amount_raw: float | None
    pl_count: int
    dsum: float | None = None
    vsum: float | None = None

    def compute_risk_direction(self) -> bool | None:
        """リスクの方向（デルタ/ベガの符号または全体VaRの符号）を判定する"""
        if self.risk_category_name == "全体":
            val = self.var_amount_raw if self.var_amount_raw is not None else 0.0
            return val >= 0

        if self.dsum is None and self.vsum is None:
            return None

        val = self.dsum if self.dsum is not None else (self.vsum if self.vsum is not None else 0.0)
        return val >= 0

    @property
    def inverted_var_amount(self) -> float:
        """VaRの表示用値（正数・負数の反転など）"""
        return -1 * self.var_amount_raw if self.var_amount_raw is not None else 0.0

    @property
    def has_data(self) -> bool:
        return self.pl_count > 0

    @property
    def comparison_key(self) -> tuple[str, str, str]:
        """前日比較などの突合に使うキー"""
        return (self.risk_category_name, self.currency_name, self.display_unit_name)
