'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { FiltersBar } from '@/components/dashboard/FiltersBar'
import { NewsPanel } from '@/components/dashboard/NewsPanel'
import { SummaryCards } from '@/components/dashboard/SummaryCards'
import { VarChartCard } from '@/components/dashboard/VarChartCard'
import { VarContributionChart } from '@/components/dashboard/VarContributionChart'
import { AssetDetailsTable } from '@/components/dashboard/AssetDetailsTable'
import { TimeseriesControls } from '@/components/dashboard/TimeseriesControls'
import { ScenarioDistributionChart } from '@/components/dashboard/ScenarioDistributionChart'
import { MarketSignalGauge } from '@/components/dashboard/MarketSignalGauge'
import { DriverCommentaryPanel } from '@/components/dashboard/DriverCommentaryPanel'
import { DashboardNavigation, DashboardMobileNav } from '@/components/dashboard/DashboardNavigation'
import { Card } from '@/components/ui/card'
import { buildMetrics } from '@/lib/metrics'
import type { FactorVarListResponse, NewsItem, SummaryResponse, TimeSeriesResponse } from '@/types/var'
import { AGGREGATE_RIC } from '@/types/var'
import type { ScenarioDistributionResponse } from '@/types/var'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1'
const NEWS_LIMIT = Number.parseInt(process.env.NEXT_PUBLIC_NEWS_LIMIT ?? '5', 10)
const REFRESH_INTERVAL_MS = Number.parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL_MS ?? '60000', 10)

type TabKey = 'dashboard' | 'assistant'

const TAB_OPTIONS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'ダッシュボード' },
  { key: 'assistant', label: 'AIアシスタント' },
]

const DASHBOARD_SECTIONS: { id: string; label: string; description?: string }[] = [
  { id: 'filters', label: '基準日', description: '全ビュー更新' },
  { id: 'summary', label: '指標カード', description: 'VaR総額など' },
  { id: 'var-comparison', label: 'VaR比較', description: 'ポートフォリオ vs 資産別' },
  { id: 'asset-table', label: '資産別テーブル', description: '分類別詳細' },
  { id: 'market-insights', label: '市場シグナル', description: 'ゲージと解説' },
  { id: 'timeseries', label: '時系列チャート', description: '資産別推移' },
  { id: 'news', label: 'ニュース', description: '最新ヘッドライン' },
  { id: 'scenario', label: 'シナリオ分布', description: '800日ヒストグラム' },
]

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [factorVar, setFactorVar] = useState<FactorVarListResponse | null>(null)
  const [factorVarError, setFactorVarError] = useState<string | null>(null)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [comparisonDate, setComparisonDate] = useState('')
  const [selectedRic, setSelectedRic] = useState(AGGREGATE_RIC)
  const [windowDays, setWindowDays] = useState(30)
  const [timeseries, setTimeseries] = useState<TimeSeriesResponse | null>(null)
  const [timeseriesError, setTimeseriesError] = useState<string | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [scenarioRic, setScenarioRic] = useState(AGGREGATE_RIC)
  const [scenarioValues, setScenarioValues] = useState<number[]>([])
  const [scenarioError, setScenarioError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
  const [pendingSection, setPendingSection] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    const search = selectedDate ? `?as_of=${encodeURIComponent(selectedDate)}` : ''
    const response = await fetch(`${API_BASE}/var/summary${search}`, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Failed summary request: ${response.status}`)
    }
    return (await response.json()) as SummaryResponse
  }, [selectedDate])

  const fetchFactorVaR = useCallback(async () => {
    const params = new URLSearchParams()
    if (selectedDate) {
      params.append('as_of', selectedDate)
    }
    if (comparisonDate) {
      params.append('comparison_date', comparisonDate)
    }
    const search = params.toString() ? `?${params.toString()}` : ''
    const response = await fetch(`${API_BASE}/var/factor_var${search}`, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Failed summary request: ${response.status}`)
    }
    return (await response.json()) as FactorVarListResponse
  }, [selectedDate, comparisonDate])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const payload = await fetchSummary()
        if (!active) {
          return
        }
        setSummary(payload)
        setSummaryError(null)
        if (!selectedDate) {
          setSelectedDate(payload.as_of)
        }
        setSelectedRic((prev) => {
          if (prev === AGGREGATE_RIC) {
            return prev
          }
          if (payload.assets.some((asset) => asset.ric === prev)) {
            return prev
          }
          return payload.assets[0]?.ric ?? AGGREGATE_RIC
        })
      } catch (error) {
        console.error('サマリー取得に失敗しました', error)
        if (active) {
          setSummaryError('サマリーデータの取得に失敗しました')
          setSummary(null)
        }
      }
    }

    load()
    const intervalId = setInterval(load, REFRESH_INTERVAL_MS)

    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [fetchSummary, selectedDate])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const payload = await fetchFactorVaR()
        if (!active) {
          return
        }
        setFactorVar(payload)
        setFactorVarError(null)
      } catch (error) {
        console.error('ファクター別VaR取得に失敗しました', error)
        if (active) {
          setFactorVarError('ファクター別VaRの取得に失敗しました')
          setFactorVar(null)
        }
      }
    }

    load()
    const intervalId = setInterval(load, REFRESH_INTERVAL_MS)

    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [fetchFactorVaR, selectedDate, comparisonDate])

  useEffect(() => {
    let cancelled = false
    const loadDates = async () => {
      try {
        const response = await fetch(`${API_BASE}/var/dates`, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Failed dates request: ${response.status}`)
        }
        const payload: string[] = await response.json()
        if (!cancelled && payload.length) {
          setAvailableDates(payload)
          setSelectedDate((prev) => (prev && payload.includes(prev) ? prev : payload[0]))
          setComparisonDate((prev) => (prev && payload.includes(prev) ? prev : (payload.length > 1 ? payload[1] : '')))
        }
      } catch (error) {
        console.error('基準日リスト取得に失敗しました', error)
      }
    }

    loadDates()

    return () => {
      cancelled = true
    }
  }, [])

  // ensure selected RIC remains valid when summary updates
  useEffect(() => {
    if (!summary || selectedRic === AGGREGATE_RIC) {
      return
    }
    if (!summary.assets.some((asset) => asset.ric === selectedRic) && summary.assets.length) {
      setSelectedRic(summary.assets[0].ric)
    }
  }, [selectedRic, summary])

  const fetchSeries = useCallback(async () => {
    const response = await fetch(
      `${API_BASE}/var/timeseries?ric=${encodeURIComponent(selectedRic)}&days=${windowDays}`,
      { cache: 'no-store' },
    )
    if (!response.ok) {
      throw new Error(`Failed timeseries request: ${response.status}`)
    }
    return (await response.json()) as TimeSeriesResponse
  }, [selectedRic, windowDays])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const payload = await fetchSeries()
        if (active) {
          setTimeseries(payload)
          setTimeseriesError(null)
        }
      } catch (error) {
        if (active) {
          console.error('時系列取得に失敗しました', error)
          setTimeseries(null)
          setTimeseriesError('時系列データの取得に失敗しました')
        }
      }
    }

    load()
    const intervalId = setInterval(load, REFRESH_INTERVAL_MS)

    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [fetchSeries, selectedRic, windowDays])

  // fetch news once
  useEffect(() => {
    let cancelled = false
    const fetchNews = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/news?limit=${Number.isNaN(NEWS_LIMIT) ? 5 : NEWS_LIMIT}`,
          { cache: 'no-store' },
        )
        if (!response.ok) {
          throw new Error(`Failed news request: ${response.status}`)
        }
        const payload: NewsItem[] = await response.json()
        if (!cancelled) {
          setNews(payload)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('ニュース取得に失敗しました', error)
          setNews([])
        }
      } finally {
        if (!cancelled) {
          setLoadingNews(false)
        }
      }
    }

    fetchNews()

    return () => {
      cancelled = true
    }
  }, [])

  const metrics = useMemo(() => (summary ? buildMetrics(summary) : []), [summary])
  const commonAssetOptions = useMemo(() => {
    const base = [{ value: AGGREGATE_RIC, label: '全資産合算' }]
    if (!summary) {
      return base
    }
    return [...base, ...summary.assets.map((asset) => ({ value: asset.ric, label: asset.name }))]
  }, [summary])
  const scenarioOptions = commonAssetOptions

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key as TabKey)
  }, [])

  const handleSectionNavigate = useCallback((sectionId: string) => {
    setPendingSection(sectionId)
    setActiveTab('dashboard')
  }, [])

  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date)
      const idx = availableDates.indexOf(date)
      if (idx >= 0 && idx < availableDates.length - 1) {
        setComparisonDate(availableDates[idx + 1])
      } else {
        setComparisonDate('')
      }
    },
    [availableDates],
  )

  const handleAssetChange = useCallback((asset: string) => {
    setSelectedRic(asset)
  }, [])

  const handleWindowChange = useCallback((window: number) => {
    setWindowDays(window)
  }, [])

  const fetchScenarioDistribution = useCallback(async () => {
    const response = await fetch(
      `${API_BASE}/var/scenario-distribution?ric=${encodeURIComponent(scenarioRic)}`,
      { cache: 'no-store' },
    )
    if (!response.ok) {
      throw new Error(`Failed scenario distribution request: ${response.status}`)
    }
    return (await response.json()) as ScenarioDistributionResponse
  }, [scenarioRic])

  useEffect(() => {
    if (!summary) {
      return
    }
    if (scenarioRic !== AGGREGATE_RIC && !summary.assets.some((asset) => asset.ric === scenarioRic)) {
      setScenarioRic(summary.assets[0]?.ric ?? AGGREGATE_RIC)
    }
  }, [scenarioRic, summary])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const payload = await fetchScenarioDistribution()
        if (active) {
          setScenarioValues(payload.values)
          setScenarioError(null)
        }
      } catch (error) {
        if (active) {
          console.error('シナリオ分布取得に失敗しました', error)
          setScenarioValues([])
          setScenarioError('シナリオPL分布の取得に失敗しました')
        }
      }
    }

    load()
    const intervalId = setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [fetchScenarioDistribution, scenarioRic])

  useEffect(() => {
    if (!pendingSection || activeTab !== 'dashboard') {
      return
    }
    const target = document.getElementById(pendingSection)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setPendingSection(null)
    }
  }, [activeTab, pendingSection, summary, timeseries, news, scenarioValues])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardNavigation sections={DASHBOARD_SECTIONS} onNavigate={handleSectionNavigate} />
      <div className="lg:pl-80">
        <AppHeader tabs={TAB_OPTIONS} activeTab={activeTab} onTabChange={handleTabChange} />
        <main className="mx-auto w-full max-w-[108rem] px-6 py-8 space-y-8">
          <DashboardMobileNav sections={DASHBOARD_SECTIONS} onNavigate={handleSectionNavigate} />

          <div className={activeTab === 'dashboard' ? 'space-y-8' : 'hidden'} aria-hidden={activeTab !== 'dashboard'}>
            <section id="filters" className="scroll-mt-36">
              <FiltersBar
                dates={availableDates}
                selectedDate={selectedDate || summary?.as_of || ''}
                onDateChange={handleDateChange}
                comparisonDate={comparisonDate}
                onComparisonDateChange={setComparisonDate}
              />
            </section>

            {!summary || !factorVar ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">データを取得しています...</p>
                {summaryError && <p className="text-sm text-rose-400">{summaryError}</p>}
              </div>
            ) : (
              <>
                {/* <section id="summary" className="scroll-mt-36">
                  <SummaryCards metrics={metrics} />
                </section>

                <section id="var-comparison" className="scroll-mt-36">
                  <VarContributionChart
                    assets={summary.assets}
                    diversificationEffect={summary.portfolio.diversification_effect}
                    portfolioTotal={summary.portfolio.total}
                  />
                </section> */}

                <section id="asset-table" className="scroll-mt-36">
                  <AssetDetailsTable
                    assets={summary.assets}
                    factorVarList={factorVar.factor_var_list}
                  />
                </section>

                <section id="market-insights" className="scroll-mt-36">
                  <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-1">
                      <MarketSignalGauge signal={summary.market_signal} />
                    </div>
                    <div className="lg:col-span-2">
                      <DriverCommentaryPanel commentary={summary.driver_commentary} />
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-3" aria-label="時系列とニュース">
                  <div id="timeseries" className="space-y-6 lg:col-span-2 scroll-mt-36">
                    <TimeseriesControls
                      options={commonAssetOptions}
                      selectedRic={selectedRic}
                      windowDays={windowDays}
                      onAssetChange={handleAssetChange}
                      onWindowChange={handleWindowChange}
                    />
                    <VarChartCard points={timeseries?.points ?? []} key={selectedRic} />
                    {timeseriesError && <p className="text-xs text-rose-400">{timeseriesError}</p>}
                  </div>
                  <div id="news" className="space-y-6 scroll-mt-36">
                    <NewsPanel items={news} loading={loadingNews} />
                  </div>
                </section>

                <section id="scenario" className="scroll-mt-36">
                  <ScenarioDistributionChart
                    values={scenarioValues}
                    selectedRic={scenarioRic}
                    onRicChange={(ric) => setScenarioRic(ric)}
                    options={scenarioOptions}
                  />
                  {scenarioError && <p className="mt-1 text-xs text-rose-400">{scenarioError}</p>}
                </section>
              </>
            )}
          </div>

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
                src="http://100.66.149.230/chatbot/b7OeyvKGrnpQ1KRt"
              />
            </Card>
          </section>
        </main>
      </div>
    </div>
  )
}
