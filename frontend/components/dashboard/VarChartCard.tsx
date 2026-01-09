'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { ApexOptions } from 'apexcharts'
import { Card } from '@/components/ui/card'
import type { TimeSeriesPoint } from '@/types/var'

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface VarChartCardProps {
  points: TimeSeriesPoint[]
}

export function VarChartCard({ points }: VarChartCardProps) {
  const series = useMemo(
    () => [
      {
        name: 'VaR',
        data: points.map((point) => ({ x: point.date, y: point.value })),
      },
    ],
    [points],
  )

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        id: 'var-trend',
        toolbar: { show: false },
        animations: { easing: 'easeinout' },
        foreColor: '#A0A7C1',
        background: 'transparent',
      },
      stroke: {
        // curve: 'smooth',
        width: 3,
        // colors: ['#000000'],
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
        y: {
          formatter: (value?: number) => (typeof value === 'number' ? value.toFixed(2) : ''),
        },
      },
      // colors: ['#000000'],
      // fill: {
      //   type: 'solid',
      //   opacity: 0,
      // },
      markers: {
        size: 5,
      },
    }),
    [],
  )

  return (
    <Card title="VaR推移">
      <div className="h-72">
        <ApexChart type="line" options={options} series={series} height="100%" />
      </div>
    </Card>
  )
}
