import { Card } from '@/components/ui/card'
import type { DriverCommentary, DriverContributions } from '@/types/var'

type DriverKey = 'window_drop' | 'window_add' | 'position_change' | 'ranking_shift'

const DRIVER_META: Array<{ key: DriverKey; label: string; accent: string }> = [
  { key: 'window_drop', label: '離脱要因', accent: 'text-rose-400' },
  { key: 'window_add', label: '追加要因', accent: 'text-sky-300' },
  { key: 'position_change', label: 'ポジション調整', accent: 'text-emerald-300' },
  { key: 'ranking_shift', label: '順位変動', accent: 'text-amber-300' },
] as const

const EMPTY_TOTALS: DriverContributions = {
  window_drop: 0,
  window_add: 0,
  position_change: 0,
  ranking_shift: 0,
}

interface DriverCommentaryPanelProps {
  commentary: DriverCommentary
}

export function DriverCommentaryPanel({ commentary }: DriverCommentaryPanelProps) {
  const driverTotals = commentary.driver_totals ?? EMPTY_TOTALS

  return (
    <Card title="要因分析" footer={`対象基準日: ${commentary.as_of}`}>
      <div className="space-y-5 text-sm leading-relaxed">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">＜ニュース要因＞</h3>
          <p className="mt-2 text-foreground">{commentary.news_summary}</p>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">＜テクニカル要因＞</h3>
            <p className="mt-2 text-foreground">{commentary.technical_summary}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {DRIVER_META.map((meta) => {
              const value = typeof driverTotals?.[meta.key] === 'number' ? driverTotals[meta.key] : 0
              return (
                <div
                  key={meta.key}
                  className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-foreground shadow-inner"
                >
                  <p className="text-xs font-semibold text-muted-foreground">{meta.label}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className={`text-lg font-semibold ${meta.accent}`}>{value >= 0 ? '+' : ''}{value.toFixed(2)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </Card>
  )
}
