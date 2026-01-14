from datetime import date

from pydantic import BaseModel, Field


class DriverBreakdown(BaseModel):
    """Quantifies contribution of each driver category."""

    window_drop: float = 0.0
    window_add: float = 0.0
    position_change: float = 0.0
    ranking_shift: float = 0.0


class AssetVaR(BaseModel):
    """VaR value at asset level."""

    ric: str
    name: str
    category: str
    amount: float
    change_amount: float
    change_pct: float
    contributions: DriverBreakdown


class FactorVaR(BaseModel):
    """VaR value at factor level."""

    risk_category: str
    currency: str | None = None
    risk_factor: str
    risk_direction: str
    var_amount: float | None = None
    comparison: float | None = None


class FactorVarListResponse(BaseModel):
    """Collection of Factor VaR list."""

    factor_var_list: list[FactorVaR]


class PortfolioVaR(BaseModel):
    """Overall portfolio VaR information."""

    total: float
    change_amount: float
    change_pct: float
    diversification_effect: float = Field(..., description="Difference between sum of asset VaR and portfolio VaR")


class MarketSignal(BaseModel):
    """Gauge style indicator describing macro risk appetite."""

    as_of: date
    score: float = Field(..., ge=0.0, le=100.0)
    label: str
    narrative: str


class DriverCommentary(BaseModel):
    """Textual summary of daily driver contributions and related news."""

    as_of: date
    technical_summary: str
    news_summary: str
    driver_totals: DriverBreakdown


class VaRSummaryResponse(BaseModel):
    """Summary payload containing VaR details for a specific valuation date."""

    as_of: date
    portfolio: PortfolioVaR
    assets: list[AssetVaR]
    market_signal: MarketSignal
    driver_commentary: DriverCommentary


class VaRTimeSeriesPoint(BaseModel):
    """Data point representing a single day's VaR measurement."""

    date: date
    value: float
    change: float | None = None


class VaRTimeSeriesResponse(BaseModel):
    """Collection of VaR time series points for charting."""

    ric: str
    points: list[VaRTimeSeriesPoint]


class NewsItem(BaseModel):
    """News headline related to VaR movements."""

    id: str
    headline: str
    published_at: str
    source: str
    summary: str | None = None


class ScenarioDistributionResponse(BaseModel):
    """Distribution of scenario P/L values for histogram chart."""

    ric: str
    values: list[float]
