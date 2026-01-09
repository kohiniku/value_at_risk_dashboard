'use client'

import { useId } from 'react'
import { Card } from '@/components/ui/card'
import type { MarketSignal } from '@/types/var'

interface MarketSignalGaugeProps {
  signal: MarketSignal
}

export function MarketSignalGauge({ signal }: MarketSignalGaugeProps) {
  const normalized = Math.min(Math.max(signal.score ?? 0, 0), 100)
  const radius = 90
  const circumference = Math.PI * radius
  const dashOffset = circumference * (1 - normalized / 100)
  const pointerAngle = (normalized / 100) * 180 - 90
  const gradientId = useId()

  return (
    <Card title="市場強気度メーター" footer={`スコア: ${normalized.toFixed(1)}`}>
      <div className="space-y-6">
        <div className="relative mx-auto w-full max-w-md pt-6">
          <svg viewBox="0 0 240 140" className="w-full" role="presentation" aria-hidden="true">
            <path
              d="M30 120 A90 90 0 0 1 210 120"
              stroke="#1e2438"
              strokeWidth="16"
              fill="transparent"
              opacity="0.25"
              strokeLinecap="round"
            />
            <path
              d="M30 120 A90 90 0 0 1 210 120"
              stroke={`url(#${gradientId})`}
              strokeWidth="16"
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-x-0 top-6 flex justify-between px-8 text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            <span className="-translate-y-1">慎重</span>
            <span className="-translate-y-4">中立</span>
            <span className="-translate-y-1">強気</span>
          </div>
          <div
            className="absolute left-1/2 bottom-6 h-28 w-1.5 origin-bottom -translate-x-1/2 rounded-full bg-gradient-to-t from-slate-200 via-emerald-200 to-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]"
            style={{ transform: `rotate(${pointerAngle}deg)` }}
          />
          <div className="pointer-events-none absolute left-1/2 top-[47%] flex -translate-x-1/2 flex-col items-center rounded-xl border border-border/60 bg-background/95 px-4 py-3 text-center shadow-lg">
            <span className="text-[0.55rem] font-semibold uppercase tracking-[0.4em] text-muted-foreground">Score</span>
            <span className="text-3xl font-bold leading-tight text-foreground">{normalized.toFixed(0)}</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">ステータス</span>
          <span className="text-lg font-semibold text-primary">{signal.label}</span>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">現状コメント</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{signal.narrative}</p>
        </div>
      </div>
    </Card>
  )
}
