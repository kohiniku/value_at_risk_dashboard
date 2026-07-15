'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { ApexOptions } from 'apexcharts'
import { Card } from '@/components/ui/card'
import { formatOku, type DailyReportViewModel } from '@/lib/dailyReport'

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface FactorGrossRiskChartProps {
  dotplot: DailyReportViewModel['dotplot'] | null
  loading?: boolean
}

const TODAY_COLOR = '#3987e5'
const PREVIOUS_COLOR = '#e66767'

export function FactorGrossRiskChart({ dotplot, loading }: FactorGrossRiskChartProps) {
  const { labels, todayValues, previousValues, groupMarkers } = useMemo(() => {
    const labels: string[] = []
    const todayValues: (number | null)[] = []
    const previousValues: (number | null)[] = []
    // グループ名（ベースリスク／その他リスク）をプロット上部に表示するための中央位置
    const groupMarkers: { label: string; title: string }[] = []

    dotplot?.forEach((group) => {
      if (!group.items.length) return
      const middleIndex = Math.floor((group.items.length - 1) / 2)
      group.items.forEach((item, index) => {
        labels.push(item.label)
        todayValues.push(item.today)
        previousValues.push(item.previous)
        if (index === middleIndex) {
          groupMarkers.push({ label: item.label, title: group.title })
        }
      })
    })

    return { labels, todayValues, previousValues, groupMarkers }
  }, [dotplot])

  const series = useMemo(
    () => [
      { name: '当日', data: todayValues },
      { name: '前日', data: previousValues },
    ],
    [todayValues, previousValues],
  )

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        id: 'factor-gross-risk',
        type: 'line',
        toolbar: { show: false },
        animations: { easing: 'easeinout' },
        foreColor: '#A0A7C1',
        background: 'transparent',
      },
      colors: [TODAY_COLOR, PREVIOUS_COLOR],
      // マーカーのみ表示するため線は描画しない
      stroke: { width: 0 },
      markers: {
        size: [7, 4],
        strokeWidth: 0,
        hover: { sizeOffset: 2 },
      },
      grid: {
        borderColor: '#1E2743',
        strokeDashArray: 6,
      },
      dataLabels: { enabled: false },
      xaxis: {
        type: 'category',
        categories: labels,
        labels: {
          rotate: -45,
          rotateAlways: true,
          style: { fontSize: '10px' },
          trim: false,
          maxHeight: 140,
        },
        tooltip: { enabled: false },
      },
      annotations: {
        xaxis: groupMarkers.map((marker) => ({
          x: marker.label,
          borderColor: 'transparent',
          label: {
            text: marker.title,
            position: 'top',
            orientation: 'horizontal',
            borderWidth: 0,
            offsetY: -4,
            style: {
              background: 'transparent',
              color: '#A0A7C1',
              fontSize: '11px',
              fontWeight: 600,
            },
          },
        })),
      },
      yaxis: {
        min: 0,
        labels: { formatter: (value: number) => value.toFixed(1) },
        title: { text: 'グロスVaR（億円）' },
      },
      tooltip: {
        theme: 'dark',
        shared: true,
        intersect: false,
        y: {
          formatter: (value?: number) => (typeof value === 'number' ? `${formatOku(value)} 億円` : '−'),
        },
      },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'right',
        markers: { size: 5 },
        labels: { colors: '#A0A7C1' },
      },
    }),
    [labels, groupMarkers],
  )

  return (
    <Card title="ファクター別グロスリスク" className="relative">
      {loading && (
        <div className="absolute inset-x-0 bottom-0 top-16 z-20 flex items-center justify-center rounded-b-xl bg-background/50 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}
      <div className="h-[26rem]">
        {labels.length === 0 && !loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            データがありません
          </div>
        ) : (
          <ApexChart type="line" options={options} series={series} height="100%" />
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        分散効果を考慮しないファクター単体のVaR（グロス）を当日・前日で比較します。データ未連携の項目は点を表示しません。
      </p>
    </Card>
  )
}
