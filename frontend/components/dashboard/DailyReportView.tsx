'use client'

import { useMemo } from 'react'
import { VarPlTable } from '@/components/dashboard/VarPlTable'
import { VarBreakdownDonut } from '@/components/dashboard/VarBreakdownDonut'
import { VarWaterfallChart } from '@/components/dashboard/VarWaterfallChart'
import { FactorGrossRiskChart } from '@/components/dashboard/FactorGrossRiskChart'
import { buildDailyReportViewModel } from '@/lib/dailyReport'
import type { FactorVaR, SimulationFactor } from '@/types/var'

interface DailyReportViewProps {
  factorVarList: FactorVaR[]
  simulationFactors: SimulationFactor[]
  asOf: string
  comparisonDate: string
  loading?: boolean
}

export function DailyReportView({
  factorVarList,
  simulationFactors,
  asOf,
  comparisonDate,
  loading,
}: DailyReportViewProps) {
  const viewModel = useMemo(
    () => (factorVarList.length ? buildDailyReportViewModel(factorVarList, simulationFactors) : null),
    [factorVarList, simulationFactors],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h2 className="text-lg font-bold text-foreground">日報用ビュー</h2>
        <p className="text-sm text-muted-foreground">
          基準日: <span className="font-semibold text-foreground">{asOf || '−'}</span>
          {comparisonDate && (
            <>
              {' '}／ 比較日: <span className="font-semibold text-foreground">{comparisonDate}</span>
            </>
          )}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <VarPlTable table={viewModel?.table ?? null} loading={loading} />
        <VarBreakdownDonut donut={viewModel?.donut ?? null} loading={loading} />
        <VarWaterfallChart waterfall={viewModel?.waterfall ?? null} loading={loading} />
        <FactorGrossRiskChart dotplot={viewModel?.dotplot ?? null} loading={loading} />
      </div>
    </div>
  )
}
