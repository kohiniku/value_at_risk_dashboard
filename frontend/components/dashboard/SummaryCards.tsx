import { Card } from '@/components/ui/card'
import clsx from 'clsx'
import type { MetricSummary } from '@/lib/metrics'

interface SummaryCardsProps {
  metrics: MetricSummary[]
  loading?: boolean
  useMonthlyVar?: boolean
}

export function SummaryCards({ metrics, loading, useMonthlyVar = false }: SummaryCardsProps) {
  const overallMetric = metrics.find(m => m.label === '全体')
  const categoryMetrics = metrics.filter(m => m.label !== '全体')

  const renderCard = (metric: MetricSummary, isOverall: boolean) => {
    const valueNum = metric.value
    const formattedValue = valueNum === null ? '-' : valueNum.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

    const changeNum = metric.change
    const formattedChange =
      changeNum === null || changeNum === undefined
        ? '-'
        : changeNum < 0
          ? `Δ${Math.abs(changeNum).toFixed(2)}%`
          : changeNum > 0
            ? `+${changeNum.toFixed(2)}%`
            : `${changeNum.toFixed(2)}%`

    const deltaNum = metric.delta
    const formattedDelta = 
      deltaNum === null || deltaNum === undefined
        ? '-'
        : deltaNum < 0
          ? `Δ${Math.abs(deltaNum).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}億円`
          : deltaNum > 0
            ? `+${deltaNum.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}億円`
            : `${deltaNum.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}億円`

    if (isOverall) {
      return (
        <div key={metric.label} className="relative rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-sm overflow-hidden mb-4">
          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-6 relative z-10">
            <div>
              <h2 className="text-sm font-bold tracking-widest text-primary mb-2">全体ポートフォリオ VaR <span className="text-xs font-normal">{(useMonthlyVar ? '（1か月あたり）' : '（1日あたり）')}</span></h2>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-bold tracking-tight text-foreground">
                  {formattedValue}
                </p>
                <span className="text-2xl text-muted-foreground font-medium">億円</span>
              </div>
            </div>
            
            <div className="flex flex-col items-start md:items-end gap-1 border-l-2 border-primary/20 pl-0 md:pl-6 md:border-l md:border-t-0 border-t border-border pt-4 md:pt-0 w-full md:w-auto">
               <p className="text-sm font-medium text-muted-foreground">比較日からの増減</p>
               <div className="flex items-center gap-3">
                 <p className={clsx(
                  'text-2xl font-bold',
                  deltaNum === null || deltaNum === undefined
                    ? 'text-muted-foreground'
                    : deltaNum < 0
                      ? 'text-rose-400'
                      : deltaNum > 0
                        ? 'text-emerald-400'
                        : 'text-muted-foreground',
                )}>
                  {formattedDelta}
                </p>
                <span className={clsx(
                    'text-sm font-semibold px-2.5 py-0.5 rounded-full',
                    changeNum === null || changeNum === undefined
                      ? 'bg-muted text-muted-foreground'
                      : changeNum < 0
                        ? 'bg-rose-400/10 text-rose-400'
                        : changeNum > 0
                          ? 'bg-emerald-400/10 text-emerald-400'
                          : 'bg-muted text-muted-foreground',
                  )}>
                    {formattedChange}
                </span>
               </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <Card
        key={metric.label}
        className="relative h-full flex flex-col"
        title={`${metric.label}`}
        actions={
          <span
            className={clsx(
              'text-xs font-bold px-2 py-0.5 rounded-full',
              changeNum === null || changeNum === undefined
                ? 'bg-muted text-muted-foreground'
                : changeNum < 0
                  ? 'bg-rose-400/10 text-rose-400'
                  : changeNum > 0
                    ? 'bg-emerald-400/10 text-emerald-400'
                    : 'bg-muted text-muted-foreground',
            )}
          >
            {formattedChange}
          </span>
        }
      >
        {loading && (
          <div className="absolute inset-x-0 bottom-0 top-12 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}
        <div className="flex flex-col justify-center flex-1 gap-2 relative z-10 h-full mt-2">
          <p className="text-3xl font-semibold">
            {formattedValue} <span className="text-base text-muted-foreground font-normal">億円</span>
          </p>
          <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-1">
            <span className="text-xs text-muted-foreground">増減額</span>
            <span className={clsx(
              'text-sm font-semibold',
              deltaNum === null || deltaNum === undefined
                ? 'text-muted-foreground'
                : deltaNum < 0
                  ? 'text-rose-400'
                  : deltaNum > 0
                    ? 'text-emerald-400'
                    : 'text-muted-foreground',
            )}>
              {formattedDelta}
            </span>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <section>
      {overallMetric && renderCard(overallMetric, true)}
      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-2 md:gap-4 w-full">
        {categoryMetrics.map(metric => renderCard(metric, false))}
      </div>
    </section>
  )
}
