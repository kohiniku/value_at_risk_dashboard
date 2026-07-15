import type { FactorVaR, SummaryResponse } from '@/types/var'
import { HUNDRED_MILLION } from '@/lib/constants'

export interface MetricSummary {
  label: string
  value: number | null
  delta: number | null
  change: number | null
}

const CATEGORY_ORDER = ['金利', '株・REIT', 'クレジット', 'コモディティ', '為替', '調整'];

export const buildMetrics = (
  summary: SummaryResponse,
  factorVarList?: FactorVaR[],
): MetricSummary[] => {
  const metrics: MetricSummary[] = []

  // "全体" の抽出
  const overall = factorVarList?.find((f) => f.risk_category === '全体')
  if (overall) {
    const current = overall.var_amount / HUNDRED_MILLION
    const comparison = overall.comparison !== null ? overall.comparison / HUNDRED_MILLION : null
    const delta = comparison !== null ? current - comparison : null
    const changePct = comparison && comparison !== 0 ? ((current - comparison) / Math.abs(comparison)) * 100 : null

    metrics.push({
      label: '全体',
      value: current,
      delta: delta,
      change: changePct,
    })
  } else {
    metrics.push({ label: '全体', value: null, delta: null, change: null })
  }

  // カテゴリ別 (6個固定)
  const categoryMap = new Map<string, { amount: number | null; comparison: number | null }>()

  CATEGORY_ORDER.forEach(cat => {
    categoryMap.set(cat, { amount: null, comparison: null })
  })

  factorVarList?.forEach((f) => {
    if (f.risk_category === '全体') return;

    let targetCat = f.risk_category
    if (!categoryMap.has(targetCat)) {
      if (targetCat.includes('不動産')) targetCat = 'コモディティ' // 不動産は現在無効なのでマッピングしないか、近似のコモディティへ
      else if (targetCat.includes('コモディティ')) targetCat = 'コモディティ'
      
      if (!categoryMap.has(targetCat)) return // 無視
    }

    if (targetCat === '調整' && f.risk_category === '調整') {
      const existing = categoryMap.get(targetCat)!
      categoryMap.set(targetCat, {
        amount: f.var_amount,
        comparison: f.comparison,
      })
      return
    }

    // 分散効果を加味した真のカテゴリVaRは "カテゴリ合算" という名称で返ってくる
    if (f.risk_factor === 'カテゴリ合算') {
      categoryMap.set(targetCat, {
        amount: f.var_amount,
        comparison: f.comparison,
      })
    }
  })

  CATEGORY_ORDER.forEach(cat => {
    const data = categoryMap.get(cat)
    if (!data || data.amount === null) {
      metrics.push({ label: cat, value: null, delta: null, change: null })
      return
    }

    const current = data.amount / HUNDRED_MILLION
    const comparison = data.comparison !== null ? data.comparison / HUNDRED_MILLION : null
    const delta = comparison !== null ? current - comparison : null
    const changePct = comparison && comparison !== 0 ? ((current - comparison) / Math.abs(comparison)) * 100 : null

    metrics.push({
      label: cat,
      value: current,
      delta: delta,
      change: changePct,
    })
  })

  return metrics
}
