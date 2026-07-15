'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { ApexOptions } from 'apexcharts'
import { Card } from '@/components/ui/card'
import { formatOku, type DailyReportViewModel, type WaterfallStepItem } from '@/lib/dailyReport'

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface VarWaterfallChartProps {
  waterfall: DailyReportViewModel['waterfall'] | null
  loading?: boolean
}

// 画像準拠: 増分=水色 / 減分=グレー / 小計・合計=アンバー
const KIND_COLORS: Record<WaterfallStepItem['kind'], string> = {
  increment: '#86b6ef',
  decrement: '#8b93ad',
  subtotal: '#c98500',
  total: '#c98500',
}

// 画像のバナー: 相関の効くファクター（小計まで）／ 相関の効かないファクター ／ 合計
const CORRELATED_COLS = 8
const UNCORRELATED_COLS = 3

export function VarWaterfallChart({ waterfall, loading }: VarWaterfallChartProps) {
  const steps = useMemo(() => waterfall ?? [], [waterfall])

  const series = useMemo(
    () => [
      {
        name: 'VaR',
        data: steps.map((step) => ({
          x: step.label,
          y: [
            Number(Math.min(...step.range).toFixed(4)),
            Number(Math.max(...step.range).toFixed(4)),
          ],
          fillColor: KIND_COLORS[step.kind],
        })),
      },
    ],
    [steps],
  )

  const options = useMemo<ApexOptions>(() => {
    const groups: { title: string; cols: number }[] = []
    if (steps.length === CORRELATED_COLS + UNCORRELATED_COLS + 1) {
      groups.push({ title: '相関の効くファクター', cols: CORRELATED_COLS })
      groups.push({ title: '相関の効かないファクター', cols: UNCORRELATED_COLS })
      // 「相関の効かないファクター」のタイトル幅が1列分を超えて重なるため、合計列の見出しは空にする
      groups.push({ title: '　', cols: 1 })
    }

    return {
      chart: {
        id: 'var-waterfall',
        type: 'rangeBar',
        toolbar: { show: false },
        animations: { easing: 'easeinout' },
        foreColor: '#A0A7C1',
        background: 'transparent',
      },
      plotOptions: {
        bar: {
          columnWidth: '60%',
          borderRadius: 2,
        },
      },
      grid: {
        borderColor: '#1E2743',
        strokeDashArray: 6,
      },
      dataLabels: { enabled: false },
      xaxis: {
        type: 'category',
        labels: {
          rotate: -45,
          rotateAlways: true,
          style: { fontSize: '10px' },
          trim: false,
          maxHeight: 170,
        },
        group: groups.length
          ? {
              style: { fontSize: '11px', fontWeight: 600, colors: Array(groups.length).fill('#A0A7C1') },
              groups,
            }
          : undefined,
      },
      yaxis: {
        labels: { formatter: (value: number) => value.toFixed(1) },
        title: { text: 'VaR（億円）' },
      },
      tooltip: {
        theme: 'dark',
        custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
          const step = steps[dataPointIndex]
          if (!step) return ''
          const body =
            step.delta === null
              ? 'データ未連携'
              : step.kind === 'subtotal' || step.kind === 'total'
                ? `${formatOku(step.delta)} 億円`
                : `${formatOku(step.delta, { signed: true })} 億円`
          return `<div style="padding:6px 10px"><strong>${step.label}</strong><br/>${body}</div>`
        },
      },
      legend: { show: false },
    }
  }, [steps])

  return (
    <Card title="VAR ブレークダウン" className="relative">
      {loading && (
        <div className="absolute inset-x-0 bottom-0 top-16 z-20 flex items-center justify-center rounded-b-xl bg-background/50 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}
      <div className="h-[28rem]">
        {steps.length === 0 && !loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            データがありません
          </div>
        ) : (
          <ApexChart type="rangeBar" options={options} series={series} height="100%" />
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        ファクター別VaRを積み上げ、バンキング(ネット可リスク)を経てバンキング(リスク計量)＝全体VaRへ到達する内訳。
        データ未連携の項目（ベースリスクネット・本部ネッティング等）は0として表示しています。
      </p>
    </Card>
  )
}
