'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { ApexOptions } from 'apexcharts'
import { Card } from '@/components/ui/card'
import type { Asset } from '@/types/var'

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const CATEGORY_ORDER = [
  { key: '株式', label: '株式' },
  { key: '金利', label: '金利' },
  { key: 'クレジット', label: 'クレジット' },
  { key: 'モーゲージ', label: '不動産（モーゲージ）' },
  { key: 'コモディティ', label: 'コモディティ' },
]
const PORTFOLIO_LABEL = 'ポートフォリオVaR'

interface VarContributionChartProps {
  assets: Asset[]
  diversificationEffect: number
  portfolioTotal: number
}

export function VarContributionChart({
  assets,
  diversificationEffect,
  portfolioTotal,
}: VarContributionChartProps) {
  const categories = useMemo(
    () => [...CATEGORY_ORDER.map((category) => category.label), PORTFOLIO_LABEL],
    [],
  )
  const assetTotal = useMemo(() => assets.reduce((sum, asset) => sum + asset.amount, 0), [assets])

  const categoryTotals = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => {
        const total = assets
          .filter((asset) => asset.category === category.key)
          .reduce((sum, asset) => sum + asset.amount, 0)
        return { ...category, total }
      }),
    [assets],
  )

  const categoryOffsets = useMemo(() => {
    let cumulative = 0
    return categoryTotals.map((category) => {
      const current = cumulative
      cumulative += category.total
      return Number(current.toFixed(2))
    })
  }, [categoryTotals])

  const offsetData = useMemo(() => [...categoryOffsets, 0], [categoryOffsets])

  const assetSeries = useMemo(
    () =>
      assets.map((asset) => ({
        name: asset.name,
        data: categories.map((categoryLabel) => {
          if (categoryLabel === PORTFOLIO_LABEL) {
            return 0
          }
          const category = CATEGORY_ORDER.find((entry) => entry.label === categoryLabel)
          if (!category || category.key !== asset.category) {
            return 0
          }
          return Number(asset.amount.toFixed(2))
        }),
      })),
    [assets, categories],
  )

  const series = useMemo(
    () => {
      const offsetSeries = {
        name: 'オフセット',
        data: offsetData,
        color: 'rgba(0,0,0,0)',
        showInLegend: false,
        dataLabels: {
          enabled: false,
        },
      }

      const portfolioSeries = {
        name: PORTFOLIO_LABEL,
        data: categories.map((category) => (category === PORTFOLIO_LABEL ? Number(portfolioTotal.toFixed(2)) : 0)),
      }

      return [offsetSeries, ...assetSeries, portfolioSeries]
    },
    [assetSeries, categories, offsetData, portfolioTotal],
  )

  const assetSeriesCount = assetSeries.length

  const dataLabelSeries = useMemo(
    () => Array.from({ length: assetSeriesCount }, (_, idx) => idx + 1),
    [assetSeriesCount],
  )

  const colors = useMemo(() => {
    const palette = ['#4F8DF7', '#7C8CFF', '#34D399', '#FBBF24', '#F59E0B', '#60A5FA']
    return ['rgba(0,0,0,0)', ...assets.map((_, index) => palette[index % palette.length]), '#34D399']
  }, [assets])

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'bar',
        stacked: true,
        toolbar: { show: false },
        animations: { easing: 'easeinout' },
        foreColor: '#A0A7C1',
        background: 'transparent',
      },
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '60%',
          dataLabels: {
            position: 'center',
          },
        },
      },
      grid: {
        borderColor: '#1E2743',
        xaxis: {
          lines: { show: true },
        },
        yaxis: {
          lines: { show: false },
        },
      },
      xaxis: {
        categories,
        labels: {
          formatter: (value: string | number) => Number(value).toFixed(1),
        },
        title: {
          text: 'VaR（億円）',
        },
      },
      yaxis: {
        labels: {
          style: { colors: '#A0A7C1' },
        },
      },
      legend: {
        position: 'bottom',
        horizontalAlign: 'left',
        formatter: (seriesName) => (seriesName === 'オフセット' ? '' : seriesName),
      },
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: (value: number, opts) => {
          const name = opts.series?.[opts.seriesIndex]?.name ?? ''
          if (name === 'オフセット') {
            return ''
          }
          return `${name}: ${value.toFixed(2)}`
        },
      },
      },
      colors,
      dataLabels: {
        enabled: true,
        enabledOnSeries: dataLabelSeries,
        textAnchor: 'middle',
        offsetX: 0,
        dropShadow: { enabled: true, blur: 3, opacity: 0.35 },
        style: {
          colors: ['#f8fafc'],
          fontSize: '11px',
          fontWeight: 600,
        },
        background: {
          enabled: false,
        },
        formatter: (val: number, opts) => {
          if (Math.abs(val) < 0.01) {
            return ''
          }
          const name = opts.series?.[opts.seriesIndex]?.name ?? ''
          if (name === 'オフセット') {
            return ''
          }
          const valueLabel = `${val >= 0 ? '+' : ''}${val.toFixed(1)}`
          return `${name}\n${valueLabel}`
        },
      },
    }),
    [categories, colors, dataLabelSeries],
  )

  const diversificationGain = assetTotal - portfolioTotal

  return (
    <Card
      title="VaR比較：単独資産 vs ポートフォリオ"
      footer={`分散効果(億円): ${diversificationGain.toFixed(2)} (${diversificationEffect.toFixed(2)})`}
    >
      <div className="h-80">
        <ApexChart type="bar" series={series} options={options} height="100%" />
      </div>
    </Card>
  )
}
