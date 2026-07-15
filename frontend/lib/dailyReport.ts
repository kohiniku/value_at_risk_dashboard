import type { FactorVaR, SimulationFactor } from '@/types/var'
import { HUNDRED_MILLION } from '@/lib/constants'

// =====================================================================
// 日報用ビューは表示項目名・階層を画像（日報フォーマット）に忠実に固定し、
// 各項目は下記マッチャー経由でリスクファクター行に紐付ける。
// 該当データが存在しない項目は null（画面上は「−」）のまま表示する。
// =====================================================================

export interface ItemMatcher {
  /** risk_category の候補（いずれか一致） */
  categories?: string[]
  /** currency の候補（いずれか一致） */
  currencies?: string[]
  /** currency がこのリストに含まれる行を除外（null 通貨は除外しない） */
  excludeCurrencies?: string[]
  /** risk_factor の候補（いずれか完全一致） */
  factors?: string[]
}

const YEN = ['円', 'JPY']

const matches = (
  m: ItemMatcher,
  category: string | null | undefined,
  currency: string | null | undefined,
  factor: string | null | undefined,
): boolean => {
  if (m.categories && !(category != null && m.categories.includes(category))) return false
  if (m.currencies && !(currency != null && m.currencies.includes(currency))) return false
  if (m.excludeCurrencies && currency != null && m.excludeCurrencies.includes(currency)) return false
  if (m.factors && !(factor != null && m.factors.includes(factor))) return false
  return true
}

export interface ResolvedValue {
  /** 億円 */
  varAmount: number
  /** 億円（比較日）。全行で比較値が無い場合は null */
  comparison: number | null
  /** 億円（前日比） */
  change: number | null
  /** 最初に一致した行のリスク方向 */
  riskDirection: boolean | null
}

const toOku = (value: number) => value / HUNDRED_MILLION

/** 「カテゴリ合算」「全体」を除いた素のファクター行 */
const plainRows = (factorVarList: FactorVaR[]): FactorVaR[] =>
  factorVarList.filter((r) => r.risk_factor !== 'カテゴリ合算' && r.risk_category !== '全体')

const resolveVar = (rows: FactorVaR[], m: ItemMatcher): ResolvedValue | null => {
  const matched = rows.filter((r) => matches(m, r.risk_category, r.currency, r.risk_factor))
  if (!matched.length) return null
  const varAmount = matched.reduce((sum, r) => sum + toOku(r.var_amount), 0)
  const withComparison = matched.filter((r) => r.comparison !== null)
  const comparison = withComparison.length
    ? withComparison.reduce((sum, r) => sum + toOku(r.comparison as number), 0)
    : null
  return {
    varAmount,
    comparison,
    change: comparison !== null ? varAmount - comparison : null,
    riskDirection: matched[0].risk_direction,
  }
}

const resolvePosition = (simulationFactors: SimulationFactor[], m: ItemMatcher): number | null => {
  const matched = simulationFactors.filter((f) => matches(m, f.risk_class, f.currency, f.risk_factor))
  if (!matched.length) return null
  return matched.reduce((sum, f) => sum + toOku(f.base_position), 0)
}

/** リスク方向の日本語ラベル（項目名からスプレッド系/金利系/株系を判定） */
const directionSuffix = (label: string, direction: boolean | null): string | null => {
  if (direction === null) return null
  if (label.includes('スプレッド')) return direction ? '縮小' : '拡大'
  if (label.includes('金利')) return direction ? '低下' : '上昇'
  return null
}

// ---------------------------------------------------------------------
// VAR & PL テーブル（画像の行構成に固定）
// ---------------------------------------------------------------------

interface TableRowDef {
  label: string
  matcher: ItemMatcher
  children?: TableRowDef[]
}

const VAR_PL_ROWS: TableRowDef[] = [
  {
    label: '円金利',
    matcher: { categories: ['金利'], currencies: YEN },
    children: [
      { label: 'ポート', matcher: { categories: ['金利'], currencies: YEN, factors: ['ポート', 'ポートフォリオ'] } },
      { label: '中長期', matcher: { categories: ['金利'], currencies: YEN, factors: ['中長期'] } },
    ],
  },
  {
    label: '外貨金利',
    matcher: { categories: ['金利'], excludeCurrencies: YEN },
    children: [
      { label: '外貨', matcher: { categories: ['金利'], excludeCurrencies: YEN, factors: ['外貨'] } },
      { label: 'ヘッジ', matcher: { categories: ['金利'], excludeCurrencies: YEN, factors: ['ヘッジ'] } },
    ],
  },
  {
    label: '株',
    matcher: { categories: ['株・REIT', '株'] },
    children: [
      { label: '日株', matcher: { categories: ['株・REIT', '株'], factors: ['日株', '日本株', '日経225'] } },
      { label: 'REIT', matcher: { categories: ['株・REIT', '株'], factors: ['REIT', 'REIT指数'] } },
      { label: '外株', matcher: { categories: ['株・REIT', '株'], factors: ['外株', '外国株'] } },
    ],
  },
  {
    label: 'その他',
    matcher: { categories: ['クレジット', 'コモディティ', '為替', '不動産', '調整'] },
  },
]

export interface DailyReportTableRow {
  label: string
  indent: boolean
  position: number | null
  varAmount: number | null
  varChange: number | null
}

// ---------------------------------------------------------------------
// VAR内訳（3重リング）: 大分類 4 区分とファクター内訳（画像のラベルに固定）
// ---------------------------------------------------------------------

interface DonutFactorDef {
  label: string
  matcher: ItemMatcher
}

interface DonutGroupDef {
  label: string
  color: string
  factors: DonutFactorDef[]
}

const DONUT_GROUPS: DonutGroupDef[] = [
  {
    label: '円金利',
    color: '#3987e5',
    factors: [
      { label: '円ベース金利', matcher: { categories: ['金利'], currencies: YEN, factors: ['ベース金利'] } },
      { label: '円SWスプレッド', matcher: { categories: ['金利'], currencies: YEN, factors: ['SWスプレッド'] } },
      { label: '円DOスプレッド', matcher: { categories: ['金利'], currencies: YEN, factors: ['DOスプレッド'] } },
    ],
  },
  {
    label: '外貨金利',
    color: '#9085e9',
    factors: [
      { label: '米ベース金利', matcher: { categories: ['金利'], excludeCurrencies: YEN, factors: ['ベース金利'] } },
      { label: '米SWスプレッド', matcher: { categories: ['金利'], excludeCurrencies: YEN, factors: ['SWスプレッド'] } },
      {
        label: '米モーゲージスプレッド',
        matcher: { categories: ['金利'], excludeCurrencies: YEN, factors: ['モーゲージスプレッド', 'MBSスプレッド'] },
      },
    ],
  },
  {
    label: '株',
    color: '#199e70',
    factors: [
      {
        label: '日本株・REIT',
        matcher: { categories: ['株・REIT', '株'], factors: ['日本株・REIT', '日株', '日本株', '日経225', 'REIT', 'REIT指数'] },
      },
      { label: '外国株', matcher: { categories: ['株・REIT', '株'], factors: ['外国株', '外株'] } },
    ],
  },
  {
    label: 'その他',
    color: '#c98500',
    factors: [
      { label: 'クレジット', matcher: { categories: ['クレジット'] } },
      { label: 'コモディティ', matcher: { categories: ['コモディティ'] } },
      { label: 'その他', matcher: { categories: ['為替', '不動産', '調整'] } },
    ],
  },
]

export interface DonutFactorItem {
  key: string
  label: string
  value: number
  change: number | null
}

export interface DonutGroupItem {
  label: string
  color: string
  value: number
  change: number | null
  factors: DonutFactorItem[]
}

// ---------------------------------------------------------------------
// VAR ブレークダウン（ウォーターフォール。項目名は画像に固定）
// ---------------------------------------------------------------------

export type WaterfallKind = 'increment' | 'decrement' | 'subtotal' | 'total'

interface WaterfallStepDef {
  label: string
  kind: WaterfallKind
  matcher?: ItemMatcher
}

const WATERFALL_STEPS: WaterfallStepDef[] = [
  { label: 'バンキング(ベースリスクグロス)', kind: 'increment', matcher: { categories: ['金利'], factors: ['ベース金利'] } },
  { label: 'バンキング(ベースリスクネット)', kind: 'decrement', matcher: { factors: ['ベースリスクネット'] } },
  { label: '円.SW', kind: 'increment', matcher: { categories: ['金利'], currencies: YEN, factors: ['SWスプレッド'] } },
  { label: '円.DO', kind: 'increment', matcher: { categories: ['金利'], currencies: YEN, factors: ['DOスプレッド'] } },
  { label: '米.SW', kind: 'increment', matcher: { categories: ['金利'], excludeCurrencies: YEN, factors: ['SWスプレッド'] } },
  {
    label: '米.MBS Sprd',
    kind: 'increment',
    matcher: { categories: ['金利'], excludeCurrencies: YEN, factors: ['モーゲージスプレッド', 'MBSスプレッド'] },
  },
  { label: 'クレジット+コモ', kind: 'increment', matcher: { categories: ['クレジット', 'コモディティ'] } },
  { label: 'バンキング(ネット可リスク)', kind: 'subtotal' },
  { label: '本部ネッティングできるもの', kind: 'decrement', matcher: { factors: ['本部ネッティングできるもの', '本部ネッティング'] } },
  { label: 'ファンド投(HIF)等', kind: 'increment', matcher: { factors: ['ファンド投(HIF)等', 'ファンド投'] } },
  { label: 'BEI', kind: 'increment', matcher: { factors: ['BEI'] } },
  { label: 'バンキング(リスク計量)', kind: 'total' },
]

export interface WaterfallStepItem {
  label: string
  kind: WaterfallKind
  /** 増減額（億円）。データ未連携の項目は null（0 として累積） */
  delta: number | null
  range: [number, number]
}

// ---------------------------------------------------------------------
// ファクター別グロスリスク（ドットプロット。項目名・グループは画像に固定）
// ---------------------------------------------------------------------

interface DotItemDef {
  label: string
  matcher?: ItemMatcher
}

interface DotGroupDef {
  title: string
  items: DotItemDef[]
}

const DOTPLOT_GROUPS: DotGroupDef[] = [
  {
    title: 'ベースリスク',
    items: [
      { label: '円金利', matcher: { categories: ['金利'], currencies: YEN, factors: ['ベース金利'] } },
      {
        label: '円株・REIT',
        matcher: { categories: ['株・REIT', '株'], factors: ['日本株・REIT', '日株', '日本株', '日経225', 'REIT', 'REIT指数'] },
      },
      { label: '米金利', matcher: { categories: ['金利'], excludeCurrencies: YEN, factors: ['ベース金利'] } },
      { label: '米株', matcher: { categories: ['株・REIT', '株'], factors: ['外国株', '外株'] } },
    ],
  },
  {
    title: 'その他リスク',
    items: [
      { label: 'ベースリスクポート', matcher: { factors: ['ベースリスクポート'] } },
      { label: '円.SW', matcher: { categories: ['金利'], currencies: YEN, factors: ['SWスプレッド'] } },
      { label: '円.DO', matcher: { categories: ['金利'], currencies: YEN, factors: ['DOスプレッド'] } },
      { label: '米.SW', matcher: { categories: ['金利'], excludeCurrencies: YEN, factors: ['SWスプレッド'] } },
      {
        label: '米.MBS Sprd',
        matcher: { categories: ['金利'], excludeCurrencies: YEN, factors: ['モーゲージスプレッド', 'MBSスプレッド'] },
      },
      { label: 'クレジット+コモ', matcher: { categories: ['クレジット', 'コモディティ'] } },
      { label: 'その他リスク', matcher: { categories: ['為替', '不動産', '調整'] } },
    ],
  },
]

export interface DotPlotItem {
  label: string
  today: number | null
  previous: number | null
}

export interface DotPlotGroup {
  title: string
  items: DotPlotItem[]
}

// ---------------------------------------------------------------------
// ビューモデル構築
// ---------------------------------------------------------------------

export interface DailyReportViewModel {
  table: {
    rows: DailyReportTableRow[]
    total: { position: number | null; varAmount: number | null; varChange: number | null }
  }
  donut: {
    groups: DonutGroupItem[]
    /** 大分類の単純合算（億円） */
    grossSum: number
    total: { varAmount: number; change: number | null; changePct: number | null } | null
    /** 全体VaR ÷ 単純合算（最内リングのメーター） */
    meterRatio: number | null
  }
  waterfall: WaterfallStepItem[]
  dotplot: DotPlotGroup[]
}

export const buildDailyReportViewModel = (
  factorVarList: FactorVaR[],
  simulationFactors: SimulationFactor[] = [],
): DailyReportViewModel => {
  const rows = plainRows(factorVarList)

  // --- 全体行 ---
  const totalRow = factorVarList.find((r) => r.risk_category === '全体') ?? null
  const totalVar = totalRow ? toOku(totalRow.var_amount) : null
  const totalComparison = totalRow && totalRow.comparison !== null ? toOku(totalRow.comparison) : null
  const totalChange = totalVar !== null && totalComparison !== null ? totalVar - totalComparison : null
  const totalChangePct =
    totalChange !== null && totalComparison !== null && totalComparison !== 0
      ? (totalChange / Math.abs(totalComparison)) * 100
      : null

  // --- VAR & PL テーブル ---
  const tableRows: DailyReportTableRow[] = []
  VAR_PL_ROWS.forEach((def) => {
    const childValues = (def.children ?? []).map((child) => ({
      def: child,
      value: resolveVar(rows, child.matcher),
      position: resolvePosition(simulationFactors, child.matcher),
    }))
    const hasChildData = childValues.some((c) => c.value !== null)

    // 親行: 子項目にデータがあれば子の合計、無ければ親マッチャーで直接解決
    let parentValue: ResolvedValue | null
    let parentPosition: number | null
    if (hasChildData) {
      const present = childValues.filter((c) => c.value !== null)
      const varAmount = present.reduce((sum, c) => sum + (c.value as ResolvedValue).varAmount, 0)
      const comparisons = present.filter((c) => (c.value as ResolvedValue).comparison !== null)
      const comparison = comparisons.length
        ? comparisons.reduce((sum, c) => sum + ((c.value as ResolvedValue).comparison as number), 0)
        : null
      parentValue = {
        varAmount,
        comparison,
        change: comparison !== null ? varAmount - comparison : null,
        riskDirection: null,
      }
      const positions = childValues.filter((c) => c.position !== null)
      parentPosition = positions.length ? positions.reduce((sum, c) => sum + (c.position as number), 0) : null
    } else {
      parentValue = resolveVar(rows, def.matcher)
      parentPosition = resolvePosition(simulationFactors, def.matcher)
    }

    tableRows.push({
      label: def.label,
      indent: false,
      position: parentPosition,
      varAmount: parentValue?.varAmount ?? null,
      varChange: parentValue?.change ?? null,
    })
    childValues.forEach((c) => {
      tableRows.push({
        label: c.def.label,
        indent: true,
        position: c.position,
        varAmount: c.value?.varAmount ?? null,
        varChange: c.value?.change ?? null,
      })
    })
  })

  const tablePositions = tableRows.filter((r) => !r.indent && r.position !== null)
  const totalPosition = tablePositions.length
    ? tablePositions.reduce((sum, r) => sum + (r.position as number), 0)
    : null

  // --- VAR内訳（ドーナツ） ---
  const donutGroups: DonutGroupItem[] = DONUT_GROUPS.map((group) => {
    const factors: DonutFactorItem[] = group.factors
      .map((factor) => {
        const value = resolveVar(rows, factor.matcher)
        if (!value || value.varAmount <= 0) return null
        const suffix = directionSuffix(factor.label, value.riskDirection)
        return {
          key: `${group.label}:${factor.label}`,
          label: suffix ? `${factor.label}（${suffix}）` : factor.label,
          value: value.varAmount,
          change: value.change,
        }
      })
      .filter((f): f is DonutFactorItem => f !== null)
    const value = factors.reduce((sum, f) => sum + f.value, 0)
    const changes = factors.filter((f) => f.change !== null)
    const change = changes.length ? changes.reduce((sum, f) => sum + (f.change as number), 0) : null
    return { label: group.label, color: group.color, value, change, factors }
  }).filter((g) => g.value > 0)

  const grossSum = donutGroups.reduce((sum, g) => sum + g.value, 0)
  const meterRatio = totalVar !== null && grossSum > 0 ? totalVar / grossSum : null

  // --- VAR ブレークダウン（ウォーターフォール） ---
  const waterfall: WaterfallStepItem[] = []
  let cumulative = 0
  WATERFALL_STEPS.forEach((step) => {
    if (step.kind === 'subtotal') {
      waterfall.push({ label: step.label, kind: step.kind, delta: cumulative, range: [0, cumulative] })
      return
    }
    if (step.kind === 'total') {
      // 全体行があればそれを最終値とする（未連携項目との差は分散効果・未連携分）
      const finalValue = totalVar ?? cumulative
      waterfall.push({ label: step.label, kind: step.kind, delta: finalValue, range: [0, finalValue] })
      return
    }
    const value = step.matcher ? resolveVar(rows, step.matcher) : null
    const magnitude = value ? Math.abs(value.varAmount) : 0
    if (step.kind === 'decrement') {
      waterfall.push({
        label: step.label,
        kind: step.kind,
        delta: value ? -magnitude : null,
        range: [cumulative - magnitude, cumulative],
      })
      cumulative -= magnitude
    } else {
      waterfall.push({
        label: step.label,
        kind: step.kind,
        delta: value ? magnitude : null,
        range: [cumulative, cumulative + magnitude],
      })
      cumulative += magnitude
    }
  })

  // --- ファクター別グロスリスク（ドットプロット） ---
  const dotplot: DotPlotGroup[] = DOTPLOT_GROUPS.map((group) => ({
    title: group.title,
    items: group.items.map((item) => {
      const value = item.matcher ? resolveVar(rows, item.matcher) : null
      return {
        label: item.label,
        today: value ? Math.abs(value.varAmount) : null,
        previous: value && value.comparison !== null ? Math.abs(value.comparison) : null,
      }
    }),
  }))

  return {
    table: {
      rows: tableRows,
      total: { position: totalPosition, varAmount: totalVar, varChange: totalChange },
    },
    donut: {
      groups: donutGroups,
      grossSum,
      total: totalVar !== null ? { varAmount: totalVar, change: totalChange, changePct: totalChangePct } : null,
      meterRatio,
    },
    waterfall,
    dotplot,
  }
}

/** 億円表示の共通フォーマッタ */
export const formatOku = (value: number | null, options?: { signed?: boolean }): string => {
  if (value === null || !Number.isFinite(value)) return '−'
  return value.toLocaleString('ja-JP', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: options?.signed ? 'exceptZero' : 'auto',
  })
}
