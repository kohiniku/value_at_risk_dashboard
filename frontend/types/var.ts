export interface DriverContributions {
  window_drop: number
  window_add: number
  position_change: number
  ranking_shift: number
}





export interface FactorVaR {
  risk_category_id: number
  risk_category: string
  currency_id: number | null
  currency: string | null
  risk_factor: string
  risk_direction: boolean | null
  var_amount: number
  comparison: number | null
  has_data: boolean
}

export interface FactorVarListResponse {
  factor_var_list: FactorVaR[]
}

export interface SimulationFactor {
  factor_id: string
  factor_name: string
  description?: string | null
  base_position: number
  risk_class?: string | null
  currency?: string | null
  risk_factor?: string | null
}

export interface SimulationFactorListResponse {
  factors: SimulationFactor[]
  available_multiplier_products?: string[]
}

export interface SummaryResponse {
  as_of: string
  portfolio: any
  assets: any[]
  market_signal: any
  driver_commentary: any
}

export interface TimeSeriesPoint {
  date: string
  value: number
  addon?: number
  change?: number | null
  category_var?: Record<string, number> | null
  vol_adj?: number
  category_vol_adj?: Record<string, number> | null
}

export interface TimeSeriesResponse {
  ric: string
  points: TimeSeriesPoint[]
}


export interface DashboardDataResponse {
  summary: SummaryResponse
  factor_var: FactorVarListResponse
  simulation_factors: SimulationFactorListResponse
  timeseries: TimeSeriesResponse
  volatility_adjustments: Record<string, number>
}

export const AGGREGATE_RIC = 'ALL_ASSETS'
export const SCENARIO_WINDOW = 800
