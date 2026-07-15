'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { DEPARTMENT_PRODUCT_MAPPING, FiltersBar } from '@/components/dashboard/FiltersBar'
import { SummaryCards } from '@/components/dashboard/SummaryCards'
import { VarChartCard } from '@/components/dashboard/VarChartCard'
import { AssetDetailsTable } from '@/components/dashboard/AssetDetailsTable'
import { SimulationInputTable } from '@/components/dashboard/SimulationInputTable'
import { DashboardNavigation, DashboardMobileNav } from '@/components/dashboard/DashboardNavigation'
import { DailyReportView } from '@/components/dashboard/DailyReportView'
import { SettingsPanel } from '@/components/SettingsPanel'
import { Card } from '@/components/ui/card'
import { buildMetrics } from '@/lib/metrics'
import { appendBranchFiltersParam } from '@/lib/branchFilters'
import type { FactorVarListResponse, SummaryResponse, TimeSeriesResponse, SimulationFactorListResponse, DashboardDataResponse } from '@/types/var'
import { AGGREGATE_RIC } from '@/types/var'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1'

const REFRESH_INTERVAL_MS = (() => {
  const raw = process.env.NEXT_PUBLIC_REFRESH_INTERVAL_MS
  const parsed = Number.parseInt(raw ?? '60000', 10)
  return Number.isFinite(parsed) ? parsed : 60000
})()

// 0以下で自動更新停止（初回ロードと依存変更時の再取得のみ）
const AUTO_REFRESH_ENABLED = REFRESH_INTERVAL_MS > 0

type TabKey = 'dashboard' | 'daily-report' | 'assistant'

const TAB_OPTIONS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'ダッシュボード' },
  { key: 'daily-report', label: '日報用ビュー' },
  { key: 'assistant', label: 'AIアシスタント' },
]

const DASHBOARD_SECTIONS: { id: string; label: string; description?: string }[] = [
  { id: 'filters', label: '基準日', description: '全ビュー更新' },
  { id: 'summary', label: '指標カード', description: 'VaR総額など' },
  { id: 'asset-table', label: '資産別テーブル', description: '分類別詳細' },
  { id: 'simulation-input', label: 'シミュレーション入力', description: '変動要因の調整' },
  { id: 'timeseries', label: '時系列チャート', description: '資産別推移' },
]

const getPreviousBusinessDay = (date: Date = new Date()) => {
  const d = new Date(date)
  const day = d.getDay()
  if (day === 1) d.setDate(d.getDate() - 3)
  else if (day === 0) d.setDate(d.getDate() - 2)
  else d.setDate(d.getDate() - 1)
  return d
}

const formatYYYYMMDD = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [factorVar, setFactorVar] = useState<FactorVarListResponse | null>(null)
  const [factorVarError, setFactorVarError] = useState<string | null>(null)
  const [simulationFactors, setSimulationFactors] = useState<SimulationFactorListResponse | null>(null)
  const [simulationFactorsError, setSimulationFactorsError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => formatYYYYMMDD(getPreviousBusinessDay()))
  const [comparisonDate, setComparisonDate] = useState(() => {
    const prev = getPreviousBusinessDay()
    return formatYYYYMMDD(getPreviousBusinessDay(prev))
  })
  const [selectedBranch, setSelectedBranch] = useState(DEPARTMENT_PRODUCT_MAPPING[0]?.value ?? '')
  const [selectedRic, setSelectedRic] = useState(AGGREGATE_RIC)
  const [windowDays, setWindowDays] = useState(90)
  const [timeseries, setTimeseries] = useState<TimeSeriesResponse | null>(null)
  const [timeseriesLoading, setTimeseriesLoading] = useState(false)
  const [timeseriesError, setTimeseriesError] = useState<string | null>(null)
  
  
  

  // Settings
  const [preferImportedDelta, setPreferImportedDelta] = useState(true)
  const [useMonthlyVar, setUseMonthlyVar] = useState(true)
  const [useVolatilityAdjustment, setUseVolatilityAdjustment] = useState(true)
  

  // Loading states
  const [isSummaryLoading, setIsSummaryLoading] = useState(true)
  const [isFactorVarLoading, setIsFactorVarLoading] = useState(true)
  const [isSimulationFactorsLoading, setIsSimulationFactorsLoading] = useState(true)
  

  const [pendingSection, setPendingSection] = useState<string | null>(null)
  const [isSimulationEnabled, setIsSimulationEnabled] = useState(false)
  const [simulationInputs, setSimulationInputs] = useState<Record<string, number>>({})
  const [simulationMultipliers, setSimulationMultipliers] = useState<Record<string, number>>({})

    const [volAdjMap, setVolAdjMap] = useState<Record<string, number>>({})

  const fetchDashboardData = useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams()
    if (selectedDate) params.append('as_of', selectedDate)
    if (comparisonDate) params.append('comparison_date', comparisonDate)
    if (isSimulationEnabled) {
      params.append('simulation_enabled', 'true')
      params.append('simulation_adjustments', JSON.stringify({
        adjustments: simulationInputs,
        multipliers: simulationMultipliers
      }))
    }
    params.append('prefer_imported_delta', preferImportedDelta ? 'true' : 'false')
    params.append('days', windowDays.toString())
    params.append('ric', selectedRic)
    appendBranchFiltersParam(params, selectedBranch)

    const search = params.toString() ? `?${params.toString()}` : ''
    const response = await fetch(`${API_BASE}/var/dashboard${search}`, { cache: 'no-store', signal })
    if (response.status === 404) {
      return null
    }
    if (!response.ok) {
      throw new Error(`Failed dashboard request: ${response.status}`)
    }
    return (await response.json()) as DashboardDataResponse
  }, [selectedDate, comparisonDate, selectedBranch, isSimulationEnabled, simulationInputs, simulationMultipliers, preferImportedDelta, windowDays, selectedRic])

  // 基準日・部門・オプション変更時のみ、シミュレーション要素の読込状態（ロード中）にする
  useEffect(() => {
    setIsSimulationFactorsLoading(true)
    setSimulationFactors(null)
  }, [selectedDate, selectedBranch, preferImportedDelta])

  useEffect(() => {
    let active = true
    const abortController = new AbortController()

    const load = async () => {
      setIsSummaryLoading(true)
      setIsFactorVarLoading(true)
      setTimeseriesLoading(true)
      try {
        const payload = await fetchDashboardData(abortController.signal)
        if (!active || !payload) return

        setSummary(payload.summary)
        setFactorVar(payload.factor_var)
        setSimulationFactors(payload.simulation_factors)
        setTimeseries(payload.timeseries)
        setVolAdjMap(payload.volatility_adjustments)

        setSummaryError(null)
        setFactorVarError(null)
        setSimulationFactorsError(null)
        setTimeseriesError(null)
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return // Ignore abort errors
        }
        console.error('ダッシュボードデータの取得に失敗しました', error)
        if (active) {
          setSummaryError('データの取得に失敗しました')
          setSummary(null)
          setFactorVar(null)
          setSimulationFactors(null)
          setTimeseries(null)
          setVolAdjMap({})
        }
      } finally {
        if (active) {
          setIsSummaryLoading(false)
          setIsFactorVarLoading(false)
          setIsSimulationFactorsLoading(false)
          setTimeseriesLoading(false)
        }
      }
    }

    load()
    const intervalId = AUTO_REFRESH_ENABLED ? setInterval(load, REFRESH_INTERVAL_MS) : null

    return () => {
      active = false
      abortController.abort()
      if (intervalId !== null) clearInterval(intervalId)
    }
  }, [fetchDashboardData])

  // Multiplier logic
  const displayMultiplier = useMonthlyVar ? Math.sqrt(22) : 1
  const getVolAdj = useCallback((key: string) => {
    if (!useVolatilityAdjustment) return 1.0
    return volAdjMap[key] ?? 1.0
  }, [useVolatilityAdjustment, volAdjMap])

  const displaySummary = useMemo(() => {
    if (!summary) return null
    if (!useMonthlyVar && !useVolatilityAdjustment) return summary

    const copy = structuredClone(summary) as SummaryResponse
    return copy
  }, [summary, useMonthlyVar, useVolatilityAdjustment])

  const displayFactorVar = useMemo(() => {
    if (!factorVar) return null
    if (!useMonthlyVar && !useVolatilityAdjustment) return factorVar

    const copy = structuredClone(factorVar) as FactorVarListResponse
    const addonRow = copy.factor_var_list.find(f => f.risk_category === '調整')
    const addonAmount = addonRow?.var_amount ?? 0
    const addonComparison = addonRow?.comparison ?? null

    copy.factor_var_list.forEach(f => {
      let adj = 1.0
      if (useVolatilityAdjustment) {
        if (f.risk_category === "全体") adj = getVolAdj("total")
        else if (f.risk_factor === "カテゴリ合算") adj = getVolAdj(`cat:${f.risk_category}`)
        else adj = getVolAdj(`fac:${f.risk_category}:${f.currency ?? "null"}:${f.risk_factor}`)
      }
      if (f.risk_category === "全体") {
        const scenarioVar = f.var_amount - addonAmount
        f.var_amount = (scenarioVar * adj + addonAmount) * displayMultiplier
        if (f.comparison !== null) {
          const compAddon = addonComparison ?? addonAmount
          f.comparison = ((f.comparison - compAddon) * adj + compAddon) * displayMultiplier
        }
      } else {
        f.var_amount *= displayMultiplier * adj
        if (f.comparison !== null) f.comparison *= displayMultiplier * adj
      }
    })
    return copy
  }, [factorVar, displayMultiplier, getVolAdj, useMonthlyVar, useVolatilityAdjustment])

  const displayTimeseries = useMemo(() => {
    if (!timeseries) return null

    const copy = structuredClone(timeseries) as TimeSeriesResponse
    copy.points.forEach(p => {
      const adj = useVolatilityAdjustment ? (p.vol_adj ?? 1.0) : 1.0
      const addon = p.addon ?? 0
      p.value = (p.value * adj + addon) * displayMultiplier
      if (p.category_var) {
        const catVolAdj = p.category_vol_adj ?? {}
        const adjusted: Record<string, number> = {}
        for (const [cat, val] of Object.entries(p.category_var)) {
          const catAdj = useVolatilityAdjustment ? (catVolAdj[cat] ?? 1.0) : 1.0
          adjusted[cat] = val * displayMultiplier * catAdj
        }
        p.category_var = adjusted
      }
    })
    for (let i = 0; i < copy.points.length; i++) {
      copy.points[i].change = i > 0 ? copy.points[i].value - copy.points[i - 1].value : null
    }
    return copy
  }, [timeseries, displayMultiplier, useVolatilityAdjustment])

  const metrics = useMemo(
    () => (displaySummary && displayFactorVar ? buildMetrics(displaySummary, displayFactorVar.factor_var_list) : []),
    [displaySummary, displayFactorVar],
  )
  
  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key as TabKey)
  }, [])

  const handleSectionNavigate = useCallback((sectionId: string) => {
    setPendingSection(sectionId)
    setActiveTab('dashboard')
  }, [])

  const handleDateChange = useCallback(
    async (date: string) => {
      setSelectedDate(date)
      try {
        const response = await fetch(`${API_BASE}/var/previous_business_day?target_date=${date}`, { cache: 'no-store' })
        if (response.ok) {
          const payload = await response.json()
          setComparisonDate(payload.previous_business_day)
        } else {
          setComparisonDate(formatYYYYMMDD(getPreviousBusinessDay(new Date(date))))
        }
      } catch (error) {
        console.error('Failed to fetch previous business day', error)
        setComparisonDate(formatYYYYMMDD(getPreviousBusinessDay(new Date(date))))
      }
    },
    [],
  )

  const handleWindowChange = useCallback((window: number) => {
    setWindowDays(window)
  }, [])

  const handleSimulationInputChange = useCallback((factorName: string, value: number) => {
    setSimulationInputs((prev) => ({
      ...prev,
      [factorName]: value,
    }))
  }, [])

  const handleSimulationInputsReplace = useCallback((next: Record<string, number>) => {
    setSimulationInputs(next)
  }, [])




  useEffect(() => {
    if (!pendingSection || activeTab !== 'dashboard') {
      return
    }
    const target = document.getElementById(pendingSection)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setPendingSection(null)
    }
  }, [activeTab, pendingSection, displaySummary, displayTimeseries])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardNavigation sections={DASHBOARD_SECTIONS} onNavigate={handleSectionNavigate} />
      <div className="lg:pl-80">
        <AppHeader tabs={TAB_OPTIONS} activeTab={activeTab} onTabChange={handleTabChange}>
          <SettingsPanel 
            preferImportedDelta={preferImportedDelta}
            onPreferImportedDeltaChange={setPreferImportedDelta}
            useMonthlyVar={useMonthlyVar}
            onUseMonthlyVarChange={setUseMonthlyVar}
            useVolatilityAdjustment={useVolatilityAdjustment}
            onUseVolatilityAdjustmentChange={setUseVolatilityAdjustment}
          />
        </AppHeader>
        <main className="mx-auto w-full max-w-[108rem] px-6 py-8 space-y-8">
          <DashboardMobileNav sections={DASHBOARD_SECTIONS} onNavigate={handleSectionNavigate} />

          <div className={activeTab === 'dashboard' ? 'space-y-8' : 'hidden'} aria-hidden={activeTab !== 'dashboard'}>
            <section id="filters" className="scroll-mt-36">
              <FiltersBar
                selectedDate={selectedDate || displaySummary?.as_of || ''}
                onDateChange={handleDateChange}
                comparisonDate={comparisonDate}
                onComparisonDateChange={setComparisonDate}
                selectedBranch={selectedBranch}
                onBranchChange={setSelectedBranch}
              />
            </section>

            {(!displaySummary && summaryError) ? (
              <div className="space-y-4">
                <p className="text-sm text-rose-400">{summaryError}</p>
              </div>
            ) : (
              <>
                <section id="summary" className="scroll-mt-36">
                  {displaySummary && metrics.length > 0 ? (
                    <SummaryCards metrics={metrics} loading={isSummaryLoading || isFactorVarLoading} useMonthlyVar={useMonthlyVar} />
                  ) : (
                    <SummaryCards loading={isSummaryLoading || isFactorVarLoading} useMonthlyVar={useMonthlyVar} metrics={[
                      { label: "全体", value: null as any, delta: null as any, change: null as any },
                      { label: "金利", value: null as any, delta: null as any, change: null as any },
                      { label: "株・REIT", value: null as any, delta: null as any, change: null as any },
                      { label: "クレジット", value: null as any, delta: null as any, change: null as any },
                      { label: "コモディティ", value: null as any, delta: null as any, change: null as any },
                      { label: "為替", value: null as any, delta: null as any, change: null as any },
                      { label: "調整", value: null as any, delta: null as any, change: null as any },
                    ]} />
                  )}
                </section>

                <section id="asset-table" className="scroll-mt-36">
                  {displaySummary && displayFactorVar ? (
                    <AssetDetailsTable
                      factorVarList={displayFactorVar.factor_var_list}
                      loading={isSummaryLoading || isFactorVarLoading}
                      volAdjMap={volAdjMap}
                      useVolatilityAdjustment={useVolatilityAdjustment}
                    />
                  ) : (
                    <AssetDetailsTable
                      factorVarList={[]}
                      loading={isSummaryLoading || isFactorVarLoading}
                      volAdjMap={volAdjMap}
                      useVolatilityAdjustment={useVolatilityAdjustment}
                    />
                  )}
                </section>

                <section id="simulation-input" className="scroll-mt-36">
                  {simulationFactors ? (
                    <SimulationInputTable
                        asOf={selectedDate || displaySummary?.as_of || ''}
                        selectedBranch={selectedBranch}
                        preferImportedDelta={preferImportedDelta}
                        factors={simulationFactors.factors}
                        availableMultiplierProducts={simulationFactors.available_multiplier_products}
                        simulationInputs={simulationInputs}
                        simulationMultipliers={simulationMultipliers}
                        isSimulationEnabled={isSimulationEnabled}
                        onSimulationEnabledChange={setIsSimulationEnabled}
                        onInputChange={handleSimulationInputChange}
                        onMultiplierChange={(product, value) => setSimulationMultipliers(prev => ({ ...prev, [product]: value }))}
                        onReplaceInputs={handleSimulationInputsReplace}
                        loading={isSimulationFactorsLoading}
                      />
                  ) : (
                    <SimulationInputTable
                        asOf={selectedDate || ''}
                        selectedBranch={selectedBranch}
                        preferImportedDelta={preferImportedDelta}
                        factors={[]}
                        availableMultiplierProducts={[]}
                        simulationInputs={simulationInputs}
                        simulationMultipliers={simulationMultipliers}
                        isSimulationEnabled={isSimulationEnabled}
                        onSimulationEnabledChange={setIsSimulationEnabled}
                        onInputChange={handleSimulationInputChange}
                        onMultiplierChange={(product, value) => setSimulationMultipliers(prev => ({ ...prev, [product]: value }))}
                        onReplaceInputs={handleSimulationInputsReplace}
                        loading={isSimulationFactorsLoading}
                      />
                  )}
                </section>

                <section id="timeseries" className="scroll-mt-36" aria-label="時系列">
                  <div className="space-y-6">
                    <VarChartCard
                      points={timeseriesLoading ? [] : (displayTimeseries?.points ?? [])}
                      key={selectedBranch}
                      loading={timeseriesLoading}
                      windowDays={windowDays}
                      onWindowChange={handleWindowChange}
                      isSimulationEnabled={isSimulationEnabled}
                    />
                    {timeseriesError && <p className="text-xs text-rose-400">{timeseriesError}</p>}
                  </div>
                </section>
              </>
            )}
          </div>

          <section
            className={activeTab === 'daily-report' ? 'space-y-6' : 'hidden'}
            aria-hidden={activeTab !== 'daily-report'}
          >
            <DailyReportView
              factorVarList={displayFactorVar?.factor_var_list ?? []}
              simulationFactors={simulationFactors?.factors ?? []}
              asOf={selectedDate || displaySummary?.as_of || ''}
              comparisonDate={comparisonDate}
              loading={isSummaryLoading || isFactorVarLoading}
            />
            {factorVarError && <p className="text-sm text-rose-400">{factorVarError}</p>}
          </section>

          <section
            className={activeTab === 'assistant' ? 'space-y-6' : 'hidden'}
            aria-hidden={activeTab !== 'assistant'}
          >
            <Card title="会話型AIアシスタント" className="overflow-hidden">
              <p className="mb-4 text-sm text-muted-foreground">
                リスク管理に関する問いかけや解釈支援を行えるAIアシスタントです。知りたい情報を具体的に教えてください。
                <br />
                （例）「25年7月の日経225のシナリオPL推移を見せて。」
              </p>
              <iframe
                title="Dify chatbot preview"
                className="h-[900px] w-full rounded-lg border border-border"
                src="https://fei-dify.mhbk-gmc.com/chatbot/oM28hXDGJKm1M1v0"
              />
            </Card>
          </section>
        </main>
      </div>
    </div>
  )
}
