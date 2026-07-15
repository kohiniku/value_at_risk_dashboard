import { buildDailyReportViewModel } from '@/lib/dailyReport'
import type { FactorVaR, SimulationFactor } from '@/types/var'

const OKU = 100_000_000

const factor = (overrides: Partial<FactorVaR>): FactorVaR => ({
  risk_category_id: 1,
  risk_category: '金利',
  currency_id: 1,
  currency: '円',
  risk_factor: 'ポート',
  risk_direction: true,
  var_amount: 0,
  comparison: null,
  has_data: true,
  ...overrides,
})

const factorVarList: FactorVaR[] = [
  factor({ risk_category: '全体', risk_category_id: 0, currency: null, risk_factor: '全体', var_amount: 10 * OKU, comparison: 9 * OKU }),
  // 円金利（テーブル軸: ポート/中長期、ファクター軸: ベース金利/SW/DO）
  factor({ risk_factor: 'ポート', var_amount: 3 * OKU, comparison: 2.8 * OKU }),
  factor({ risk_factor: '中長期', var_amount: 2 * OKU, comparison: 1.9 * OKU }),
  factor({ risk_factor: 'ベース金利', var_amount: 2.5 * OKU, comparison: 2.4 * OKU }),
  factor({ risk_factor: 'SWスプレッド', var_amount: 1.5 * OKU, comparison: 1.4 * OKU }),
  factor({ risk_factor: 'DOスプレッド', var_amount: 1 * OKU, comparison: 0.9 * OKU }),
  // 外貨金利（子項目データなし → 親はフォールバック）
  factor({ currency_id: 2, currency: '米ドル', risk_factor: 'ベース金利', var_amount: 2 * OKU, comparison: 1.9 * OKU }),
  // 株
  factor({ risk_category: '株・REIT', risk_category_id: 2, risk_factor: '日株', var_amount: 2 * OKU, comparison: 1.8 * OKU }),
  factor({ risk_category: '株・REIT', risk_category_id: 2, currency_id: 2, currency: '米ドル', risk_factor: '外株', var_amount: 1 * OKU, comparison: 0.9 * OKU }),
  // その他
  factor({ risk_category: 'クレジット', risk_category_id: 3, risk_factor: 'クレジット', var_amount: 1.2 * OKU, comparison: 1.3 * OKU }),
  factor({ risk_category: '調整', risk_category_id: 9, currency: null, risk_factor: '調整', risk_direction: null, var_amount: 0.8 * OKU, comparison: 0.8 * OKU }),
]

const simulationFactors: SimulationFactor[] = [
  {
    factor_id: 'f1',
    factor_name: '円金利ポート',
    base_position: 200 * OKU,
    risk_class: '金利',
    currency: '円',
    risk_factor: 'ポート',
  },
]

describe('buildDailyReportViewModel', () => {
  const vm = buildDailyReportViewModel(factorVarList, simulationFactors)

  it('VAR & PL: 画像準拠の行構成で親子を解決する', () => {
    const labels = vm.table.rows.map((r) => r.label)
    expect(labels).toEqual(['円金利', 'ポート', '中長期', '外貨金利', '外貨', 'ヘッジ', '株', '日株', 'REIT', '外株', 'その他'])

    const yenRate = vm.table.rows[0]
    // 親（円金利）= 子（ポート＋中長期）の合計
    expect(yenRate.varAmount).toBeCloseTo(5)
    expect(yenRate.position).toBeCloseTo(200)

    // 外貨金利は子項目データなし → 親マッチャーで直接解決（米ドル金利の合算）
    const fxRate = vm.table.rows[3]
    expect(fxRate.varAmount).toBeCloseTo(2)
    // 子項目（外貨/ヘッジ）はデータ未連携 → null
    expect(vm.table.rows[4].varAmount).toBeNull()

    expect(vm.table.total.varAmount).toBeCloseTo(10)
    expect(vm.table.total.varChange).toBeCloseTo(1)
  })

  it('VAR内訳: 大分類4区分とメーター比率を構築する', () => {
    expect(vm.donut.groups.map((g) => g.label)).toEqual(['円金利', '外貨金利', '株', 'その他'])
    const yenRate = vm.donut.groups[0]
    expect(yenRate.value).toBeCloseTo(5) // ベース金利+SW+DO
    expect(yenRate.factors[0].label).toBe('円ベース金利（低下）')
    expect(vm.donut.groups[2].value).toBeCloseTo(3)

    // grossSum = 5 + 2 + 3 + (1.2 + 0.8) = 12, meter = 10/12
    expect(vm.donut.grossSum).toBeCloseTo(12)
    expect(vm.donut.meterRatio).toBeCloseTo(10 / 12)
    expect(vm.donut.total?.varAmount).toBeCloseTo(10)
  })

  it('VARブレークダウン: 画像準拠のステップと小計・合計を算出する', () => {
    const labels = vm.waterfall.map((s) => s.label)
    expect(labels[0]).toBe('バンキング(ベースリスクグロス)')
    expect(labels[7]).toBe('バンキング(ネット可リスク)')
    expect(labels[11]).toBe('バンキング(リスク計量)')

    // ベースリスクグロス = 円ベース金利 2.5 + 米ベース金利 2
    expect(vm.waterfall[0].delta).toBeCloseTo(4.5)
    // データ未連携項目は null（0として累積）
    expect(vm.waterfall[1].delta).toBeNull()
    // 小計 = 4.5 + 1.5(円SW) + 1(円DO) + 1.2(クレコモ) = 8.2
    expect(vm.waterfall[7].delta).toBeCloseTo(8.2)
    // 合計 = 全体行の VaR
    expect(vm.waterfall[11].delta).toBeCloseTo(10)
  })

  it('ファクター別グロスリスク: グループと未連携項目を扱う', () => {
    expect(vm.dotplot.map((g) => g.title)).toEqual(['ベースリスク', 'その他リスク'])
    const base = vm.dotplot[0]
    expect(base.items[0]).toEqual({ label: '円金利', today: 2.5, previous: 2.4 })
    // ベースリスクポートはデータ未連携 → null
    expect(vm.dotplot[1].items[0].today).toBeNull()
  })

  it('データが無い場合は空の結果を返す', () => {
    const empty = buildDailyReportViewModel([], [])
    expect(empty.donut.groups).toEqual([])
    expect(empty.donut.total).toBeNull()
    expect(empty.table.total.varAmount).toBeNull()
  })
})
