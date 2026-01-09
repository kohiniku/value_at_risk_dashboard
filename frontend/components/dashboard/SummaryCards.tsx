import { Card } from '@/components/ui/card'
import clsx from 'clsx'
import type { MetricSummary } from '@/lib/metrics'

interface SummaryCardsProps {
  metrics: MetricSummary[]
}

export function SummaryCards({ metrics }: SummaryCardsProps) {
  return (
    <section className="grid gap-6 md:grid-cols-3">
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          className="relative overflow-hidden"
          title={`${metric.label}（億円）`}
          actions={
            <span
              className={clsx(
                'text-xs font-medium',
                metric.change >= 0 ? 'text-emerald-400' : 'text-rose-400',
              )}
            >
              {metric.change >= 0 ? '+' : ''}
              {metric.change.toFixed(2)}%
            </span>
          }
        >
          <div className="flex flex-col gap-2">
            <p className="text-3xl font-semibold">{metric.value.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">
              前日差(億円): {metric.delta >= 0 ? '+' : ''}
              {metric.delta.toFixed(2)}
            </p>
          </div>
        </Card>
      ))}
    </section>
  )
}
