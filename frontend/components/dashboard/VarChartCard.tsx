'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { ApexOptions } from 'apexcharts'
import { Card } from '@/components/ui/card'
import type { TimeSeriesPoint } from '@/types/var'

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

import { Select } from '@/components/ui/select'

const CATEGORY_ORDER = ['金利', '株・REIT', 'クレジット', 'コモディティ', '為替', '調整'] as const

const CATEGORY_COLORS: Record<string, string> = {
  '金利': '#3B82F6',
  '株・REIT': '#EF4444',
  'クレジット': '#F59E0B',
  'コモディティ': '#8B5CF6',
  '為替': '#10B981',
  '調整': '#6B7280',
}

const LINE_COLOR = '#E2E8F0'

interface VarChartCardProps {
  points: TimeSeriesPoint[]
  loading?: boolean
  windowDays: number
  onWindowChange: (days: number) => void
  isSimulationEnabled?: boolean
}

export function VarChartCard({ points, loading, windowDays, onWindowChange, isSimulationEnabled }: VarChartCardProps) {
  const hasCategoryData = useMemo(
    () => points.some((p) => p.category_var && Object.keys(p.category_var).length > 0),
    [points],
  )

  const series = useMemo(() => {
    if (!hasCategoryData) {
      return [
        {
          name: '合算VaR',
          type: 'line' as const,
          data: points.map((p) => ({ x: p.date, y: p.value })),
        },
      ]
    }

    const categorySeries = CATEGORY_ORDER.map((cat) => ({
      name: cat,
      type: 'column' as const,
      data: points.map((p) => ({ x: p.date, y: p.category_var?.[cat] ?? 0 })),
    }))

    const lineSeries = {
      name: '合算VaR',
      type: 'line' as const,
      data: points.map((p) => ({ x: p.date, y: p.value })),
    }

    return [...categorySeries, lineSeries]
  }, [points, hasCategoryData])

  const options = useMemo<ApexOptions>(() => {
    const colors = hasCategoryData
      ? [...CATEGORY_ORDER.map((cat) => CATEGORY_COLORS[cat]), LINE_COLOR]
      : [LINE_COLOR]

    const strokeWidths = hasCategoryData
      ? [...CATEGORY_ORDER.map(() => 0), 3]
      : [3]

    return {
      chart: {
        id: 'var-trend',
        type: 'line',
        stacked: true,
        toolbar: { show: false },
        animations: { easing: 'easeinout' },
        foreColor: '#A0A7C1',
        background: 'transparent',
      },
      colors,
      plotOptions: {
        bar: {
          columnWidth: '60%',
          borderRadius: 2,
        },
      },
      stroke: {
        width: strokeWidths,
        curve: 'smooth',
      },
      grid: {
        borderColor: '#1E2743',
        strokeDashArray: 6,
      },
      xaxis: {
        type: 'datetime',
        labels: {
          style: {
            colors: '#A0A7C1',
          },
        },
      },
      yaxis: {
        labels: {
          formatter: (value: number) => value.toFixed(1),
        },
        title: { text: 'VaR（億円）' },
      },
      tooltip: {
        theme: 'dark',
        shared: true,
        intersect: false,
        y: {
          formatter: (value?: number) => (typeof value === 'number' ? value.toFixed(2) : ''),
        },
      },
      legend: {
        show: hasCategoryData,
        position: 'bottom',
        horizontalAlign: 'left',
        labels: {
          colors: '#A0A7C1',
        },
      },
      dataLabels: {
        enabled: false,
      },
    }
  }, [hasCategoryData])

  return (
    <Card
      title={isSimulationEnabled ? "VaR推移（シミュレーションOFF時）" : "VaR推移"}
      actions={
        <div className="w-32">
          <Select
            value={windowDays.toString()}
            onChange={(e) => onWindowChange(Number(e.target.value))}
            aria-label="観測日数"
          >
            <option value="30">30日</option>
            <option value="90">90日</option>
          </Select>
        </div>
      }
    >
      <div className="h-80 relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}
        <ApexChart type="line" options={options} series={series} height="100%" />
      </div>
    </Card>
  )
}
