'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { ApexOptions } from 'apexcharts'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { SCENARIO_WINDOW } from '@/types/var'

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface ScenarioDistributionChartProps {
  values: number[]
  selectedRic: string
  onRicChange: (ric: string) => void
  options: { value: string; label: string }[]
}

const BUCKET_COUNT = 24

export function ScenarioDistributionChart({ values, selectedRic, onRicChange, options }: ScenarioDistributionChartProps) {
  const { categories, frequencies } = useMemo(() => {
    if (!values.length) {
      return { categories: [], frequencies: [] }
    }
    const min = Math.min(...values)
    const max = Math.max(...values)
    const safeRange = max - min || 1
    const bucketSize = safeRange / BUCKET_COUNT
    const counts = Array.from({ length: BUCKET_COUNT }, () => 0)

    values.forEach((value) => {
      const index = Math.min(BUCKET_COUNT - 1, Math.floor((value - min) / bucketSize))
      counts[index] += 1
    })

    const labels = counts.map((_, idx) => {
      const start = min + bucketSize * idx
      const end = start + bucketSize
      return `${start.toFixed(2)} ~ ${end.toFixed(2)}`
    })

    return { categories: labels, frequencies: counts }
  }, [values])

  const series = useMemo(
    () => [
      {
        name: '頻度',
        data: frequencies,
      },
    ],
    [frequencies],
  )

  const optionsConfig = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'bar',
        background: 'transparent',
        foreColor: '#A0A7C1',
        toolbar: { show: false },
      },
      plotOptions: {
        bar: {
          columnWidth: '80%',
          borderRadius: 3,
        },
      },
      xaxis: {
        categories,
        labels: {
          rotate: -45,
          hideOverlappingLabels: true,
        },
        title: {
          text: 'シナリオPLレンジ (億円)',
        },
      },
      yaxis: {
        title: { text: '出現回数' },
      },
      grid: {
        borderColor: '#1E2743',
      },
      tooltip: {
        shared: false,
        y: {
          formatter: (val: number) => `${val}件`,
        },
      },
      colors: ['#FBBF24'],
    }),
    [categories],
  )

  const footer = `シナリオ件数: ${values.length}件 / ${SCENARIO_WINDOW}件`

  return (
    <Card
      title="シナリオPL分布 (直近800日)"
      actions={
        <div className="min-w-[200px]">
          <Select label="対象資産" value={selectedRic} onChange={(event) => onRicChange(event.target.value)}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      }
      footer={footer}
    >
      <div className="h-96">
        <ApexChart type="bar" options={optionsConfig} series={series} height="100%" />
      </div>
    </Card>
  )
}
