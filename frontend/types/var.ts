export interface DriverContributions {
  window_drop: number
  window_add: number
  position_change: number
  ranking_shift: number
}

export interface Asset {
  ric: string
  name: string
  category: string
  amount: number
  change_amount: number
  change_pct: number
  contributions: DriverContributions
}

export interface Portfolio {
  total: number
  change_amount: number
  change_pct: number
  diversification_effect: number
}

export interface MarketSignal {
  as_of: string
  score: number
  label: string
  narrative: string
}

export interface DriverCommentary {
  as_of: string
  technical_summary: string
  news_summary: string
  driver_totals: DriverContributions
}

export interface FactorVaR {
  risk_category: string
  currency: string | null
  risk_factor: string
  risk_direction: boolean
  var_amount: number
  comparison: number | null
}

export interface FactorVarListResponse {
  factor_var_list: FactorVaR[]
}

export interface SummaryResponse {
  as_of: string
  portfolio: Portfolio
  assets: Asset[]
  market_signal: MarketSignal
  driver_commentary: DriverCommentary
}

export interface TimeSeriesPoint {
  date: string
  value: number
  change?: number | null
}

export interface TimeSeriesResponse {
  ric: string
  points: TimeSeriesPoint[]
}

export interface NewsItem {
  id: string
  headline: string
  published_at: string
  source: string
  summary?: string
}

export interface ScenarioDistributionResponse {
  ric: string
  values: number[]
}

export const AGGREGATE_RIC = 'ALL_ASSETS'
export const SCENARIO_WINDOW = 800
