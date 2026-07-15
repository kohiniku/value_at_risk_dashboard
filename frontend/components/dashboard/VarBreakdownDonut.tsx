'use client'

import { useMemo, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { formatOku, type DailyReportViewModel } from '@/lib/dailyReport'

interface VarBreakdownDonutProps {
  donut: DailyReportViewModel['donut'] | null
  loading?: boolean
}

interface Segment {
  key: string
  label: string
  shortLabel: string
  value: number
  change: number | null
  startAngle: number
  endAngle: number
  color: string
  fillOpacity: number
}

const CX = 380
const CY = 210
// 最内周: 単純合算に対する全体VaRの割合を示すグレーのメーターリング
const METER_R0 = 58
const METER_R1 = 84
const INNER_R0 = 88
const INNER_R1 = 126
const OUTER_R0 = 130
const OUTER_R1 = 168
const LABEL_R = 178

const METER_COLOR = '#8b93ad'

// 外周ファクターの濃淡ステップ（大分類色に対する不透明度）
const FACTOR_OPACITY_STEPS = [0.92, 0.66, 0.44, 0.3]

const START_ANGLE = -Math.PI / 2
const FULL_TURN = Math.PI * 2 - 0.0001

const point = (r: number, angle: number): [number, number] => [
  CX + r * Math.cos(angle),
  CY + r * Math.sin(angle),
]

const donutArcPath = (r0: number, r1: number, a0: number, a1: number): string => {
  const largeArc = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = point(r1, a0)
  const [x1, y1] = point(r1, a1)
  const [x2, y2] = point(r0, a1)
  const [x3, y3] = point(r0, a0)
  return [
    `M ${x0.toFixed(2)} ${y0.toFixed(2)}`,
    `A ${r1} ${r1} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `L ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `A ${r0} ${r0} 0 ${largeArc} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    'Z',
  ].join(' ')
}

export function VarBreakdownDonut({ donut, loading }: VarBreakdownDonutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string; body: string } | null>(null)

  const { groupSegments, factorSegments } = useMemo(() => {
    const empty = { groupSegments: [] as Segment[], factorSegments: [] as Segment[] }
    if (!donut || donut.grossSum <= 0) return empty

    const groupSegments: Segment[] = []
    const factorSegments: Segment[] = []
    let angle = START_ANGLE

    donut.groups.forEach((group) => {
      const span = Math.min((group.value / donut.grossSum) * Math.PI * 2, FULL_TURN)
      groupSegments.push({
        key: `group:${group.label}`,
        label: group.label,
        shortLabel: group.label,
        value: group.value,
        change: group.change,
        startAngle: angle,
        endAngle: angle + span,
        color: group.color,
        fillOpacity: 1,
      })

      let factorAngle = angle
      group.factors.forEach((factor, index) => {
        const factorSpan = (factor.value / group.value) * span
        factorSegments.push({
          key: factor.key,
          label: factor.label,
          shortLabel: factor.label,
          value: factor.value,
          change: factor.change,
          startAngle: factorAngle,
          endAngle: factorAngle + factorSpan,
          color: group.color,
          fillOpacity: FACTOR_OPACITY_STEPS[index % FACTOR_OPACITY_STEPS.length],
        })
        factorAngle += factorSpan
      })
      angle += span
    })

    return { groupSegments, factorSegments }
  }, [donut])

  const handleHover = (event: React.MouseEvent, segment: Segment) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      title: segment.label,
      body: `${formatOku(segment.value)} 億円${segment.change !== null ? `（前日比 ${formatOku(segment.change, { signed: true })}）` : ''}`,
    })
  }

  const total = donut?.total ?? null
  const meterRatio = donut?.meterRatio ?? null
  const hasData = groupSegments.length > 0

  return (
    <Card title="VAR内訳" className="relative">
      {loading && (
        <div className="absolute inset-x-0 bottom-0 top-16 z-20 flex items-center justify-center rounded-b-xl bg-background/50 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}
      <div ref={containerRef} className="relative" onMouseLeave={() => setTooltip(null)}>
        {!hasData && !loading ? (
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            データがありません
          </div>
        ) : (
          <svg
            viewBox="0 0 760 420"
            role="img"
            aria-label="大分類別・ファクター別のVaR構成比"
            className="mx-auto w-full max-w-[640px]"
          >
            {factorSegments.map((segment) => (
              <path
                key={segment.key}
                d={donutArcPath(OUTER_R0, OUTER_R1, segment.startAngle, segment.endAngle)}
                fill={segment.color}
                fillOpacity={segment.fillOpacity}
                stroke="var(--card)"
                strokeWidth={2}
                onMouseMove={(event) => handleHover(event, segment)}
              />
            ))}
            {groupSegments.map((segment) => (
              <path
                key={segment.key}
                d={donutArcPath(INNER_R0, INNER_R1, segment.startAngle, segment.endAngle)}
                fill={segment.color}
                stroke="var(--card)"
                strokeWidth={2}
                onMouseMove={(event) => handleHover(event, segment)}
              />
            ))}

            {/* 最内周メーター: 単純合算に対する全体VaRの割合（グレー） */}
            {meterRatio !== null && total && (
              <g
                onMouseMove={(event) => {
                  const rect = containerRef.current?.getBoundingClientRect()
                  if (!rect) return
                  setTooltip({
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                    title: '分散効果考慮後の割合',
                    body: `全体VaR ${formatOku(total.varAmount)} ÷ 単純合算 ${formatOku(donut?.grossSum ?? null)} = ${(meterRatio * 100).toFixed(1)}%`,
                  })
                }}
              >
                <path
                  d={donutArcPath(METER_R0, METER_R1, START_ANGLE, START_ANGLE + FULL_TURN)}
                  fill="var(--muted)"
                  stroke="var(--card)"
                  strokeWidth={2}
                />
                <path
                  d={donutArcPath(
                    METER_R0,
                    METER_R1,
                    START_ANGLE,
                    START_ANGLE + Math.min(Math.min(Math.max(meterRatio, 0), 1) * Math.PI * 2, FULL_TURN),
                  )}
                  fill={METER_COLOR}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              </g>
            )}

            {/* 大分類の直接ラベル（十分な角度がある場合のみ） */}
            {groupSegments
              .filter((segment) => segment.endAngle - segment.startAngle > 0.34)
              .map((segment) => {
                const mid = (segment.startAngle + segment.endAngle) / 2
                // 中央テキストとの干渉を避けるため、わずかに外周側へ寄せる
                const [x, y] = point((INNER_R0 + INNER_R1) / 2 + 5, mid)
                return (
                  <text
                    key={`label:${segment.key}`}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    fill="#ffffff"
                    stroke={segment.color}
                    strokeWidth={4}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    fontSize={11}
                    fontWeight={700}
                  >
                    <tspan x={x} dy={-2}>{segment.shortLabel}</tspan>
                    <tspan x={x} dy={13} fontWeight={500}>{formatOku(segment.value)}</tspan>
                  </text>
                )
              })}

            {/* ファクターの外周ラベル（十分な角度がある場合のみ。残りはツールチップ） */}
            {factorSegments
              .filter((segment) => segment.endAngle - segment.startAngle > 0.17)
              .map((segment) => {
                const mid = (segment.startAngle + segment.endAngle) / 2
                const [x, y] = point(LABEL_R, mid)
                const onRight = Math.cos(mid) >= 0
                return (
                  <text
                    key={`label:${segment.key}`}
                    x={x}
                    y={y}
                    textAnchor={onRight ? 'start' : 'end'}
                    className="pointer-events-none select-none"
                    fill="var(--card-foreground)"
                    fontSize={10}
                  >
                    <tspan x={x} dy={-1}>{segment.label}</tspan>
                    <tspan x={x} dy={12} fill="var(--muted-foreground)">{formatOku(segment.value)}</tspan>
                  </text>
                )
              })}

            {/* 中央: 全体VaR・単純合算比・前日比 */}
            {total && (
              <text x={CX} y={CY} textAnchor="middle" className="pointer-events-none select-none">
                <tspan x={CX} dy={-12} fontSize={18} fontWeight={700} fill="var(--card-foreground)">
                  {formatOku(total.varAmount)}億円
                </tspan>
                {meterRatio !== null && (
                  <tspan x={CX} dy={20} fontSize={13} fontWeight={600} fill="var(--muted-foreground)">
                    {(meterRatio * 100).toFixed(1)}%
                  </tspan>
                )}
                <tspan
                  x={CX}
                  dy={16}
                  fontSize={10.5}
                  fontWeight={600}
                  fill={total.changePct !== null && total.changePct < 0 ? '#e66767' : '#199e70'}
                >
                  {total.changePct !== null
                    ? `前日比 ${total.changePct.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' })}%`
                    : ''}
                </tspan>
              </text>
            )}
          </svg>
        )}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-30 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-card"
            style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
          >
            <p className="font-semibold text-card-foreground">{tooltip.title}</p>
            <p className="text-muted-foreground">{tooltip.body}</p>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        外側リング: ファクター別VaR ／ 中間リング: 大分類別VaR（グロス構成比）／
        最内リング（グレー）: 大分類単純合算に対する全体VaR（分散効果考慮後）の割合。中央は全体VaRと同割合。
      </p>
    </Card>
  )
}
