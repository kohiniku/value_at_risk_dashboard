import type { SummaryResponse } from '@/types/var'

export interface MetricSummary {
  label: string
  value: number
  delta: number
  change: number
}

export const buildMetrics = (summary: SummaryResponse): MetricSummary[] => {
  const primaryAsset = summary.assets[0]
  return [
    {
      label: 'ポートフォリオVaR',
      value: summary.portfolio.total,
      delta: summary.portfolio.change_amount,
      change: summary.portfolio.change_pct,
    },
    {
      label: '最大寄与資産',
      value: primaryAsset?.amount ?? 0,
      delta: primaryAsset?.change_amount ?? 0,
      change: primaryAsset?.change_pct ?? 0,
    },
    {
      label: '分散効果',
      value: summary.portfolio.diversification_effect,
      delta: summary.portfolio.diversification_effect,
      change: summary.portfolio.change_pct,
    },
  ]
}
