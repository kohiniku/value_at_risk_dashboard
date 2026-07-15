from datetime import date

from pydantic import BaseModel, Field


class FactorVaR(BaseModel):
    """VaR value at factor level."""

    risk_category_id: int
    risk_category: str
    currency_id: int | None = None
    currency: str | None = None
    risk_factor: str
    risk_direction: bool | None = None
    var_amount: float | None = None
    comparison: float | None = None
    has_data: bool = True


class FactorVarListResponse(BaseModel):
    """Collection of Factor VaR list."""

    factor_var_list: list[FactorVaR]


class SimulationFactor(BaseModel):
    """Factor information for simulation input."""

    risk_class: str | None = None
    currency: str | None = None
    risk_factor: str | None = None
    factor_id: str
    factor_name: str
    description: str | None = None
    base_position: float


class SimulationFactorListResponse(BaseModel):
    """Collection of Simulation Factors."""

    factors: list[SimulationFactor]
    available_multiplier_products: list[str] = Field(default_factory=list)


class SimulationAdjustment(BaseModel):
    """Position adjustment input for VaR simulation."""

    factor_id: str
    position_delta: float = Field(..., description="Position delta in 億円 (OKU JPY)")


class SimulationAdjustmentsImportResponse(BaseModel):
    """Parsed adjustments imported from an Excel template."""

    as_of: date
    adjustments: list[SimulationAdjustment]


class VaRSummaryResponse(BaseModel):
    """Summary payload containing VaR details for a specific valuation date."""

    as_of: date
    factor_var_list: list[FactorVaR] | None = None


class VaRTimeSeriesPoint(BaseModel):
    """Data point representing a single day's VaR measurement."""

    date: date
    value: float
    addon: float = 0.0
    change: float | None = None
    category_var: dict[str, float] | None = None
    vol_adj: float = 1.0
    category_vol_adj: dict[str, float] | None = None


class VaRTimeSeriesResponse(BaseModel):
    """Collection of VaR time series points for charting."""

    ric: str
    points: list[VaRTimeSeriesPoint]


class DashboardDataResponse(BaseModel):
    """Aggregated response containing all dashboard data."""

    summary: VaRSummaryResponse
    factor_var: FactorVarListResponse
    simulation_factors: SimulationFactorListResponse
    timeseries: VaRTimeSeriesResponse
    volatility_adjustments: dict[str, float]
