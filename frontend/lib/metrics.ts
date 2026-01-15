import type { FactorVaR, SummaryResponse } from '@/types/var'

export interface MetricSummary {
  label: string
  value: number
  delta?: number
  change: number
}

const HUNDRED_MILLION = 100000000

export const buildMetrics = (
  summary: SummaryResponse,
  factorVarList?: FactorVaR[],
): MetricSummary[] => {
  if (!factorVarList) {
    return []
  }

  const overall = factorVarList.find((f) => f.risk_category === '全体')
  if (!overall) {
    return []
  }

  const current = overall.var_amount / HUNDRED_MILLION
  const comparison =
    overall.comparison !== null ? overall.comparison / HUNDRED_MILLION : null
  const delta = comparison !== null ? current - comparison : 0
  const changePct = comparison ? (delta / comparison) * 100 : 0

  return [
    {
      label: '全体VaR',
      value: current,
      delta: delta,
      change: changePct,
    },
    {
      label: '比較日からの増減',
      value: delta,
      delta: undefined,
      change: changePct,
    },
  ]
}
