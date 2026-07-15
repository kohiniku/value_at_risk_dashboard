'use client'

import clsx from 'clsx'
import { Card } from '@/components/ui/card'
import { formatOku, type DailyReportViewModel } from '@/lib/dailyReport'

interface VarPlTableProps {
  table: DailyReportViewModel['table'] | null
  loading?: boolean
}

const changeClass = (value: number | null) => {
  if (value === null) return 'text-muted-foreground'
  if (value < 0) return 'text-rose-400'
  if (value > 0) return 'text-emerald-400'
  return 'text-muted-foreground'
}

function ValueCell({ value }: { value: number | null }) {
  return <td className="px-3 py-2 text-right tabular-nums">{formatOku(value)}</td>
}

function ChangeCell({ value }: { value: number | null }) {
  return (
    <td className={clsx('px-3 py-2 text-right tabular-nums text-xs', changeClass(value))}>
      {value !== null ? formatOku(value, { signed: true }) : '−'}
    </td>
  )
}

function MissingCells() {
  return (
    <>
      <td className="px-3 py-2 text-right text-muted-foreground">−</td>
      <td className="px-3 py-2 text-right text-muted-foreground">−</td>
    </>
  )
}

// 画像下部の補助ボックス（ネット/外株/グロ株 × 米/欧/他）: データ未連携のためプレースホルダ
const EQUITY_BREAKOUT_ROWS = ['米', '欧', '他'] as const
const EQUITY_BREAKOUT_COLS = ['ネット', '外株', 'グロ株'] as const

export function VarPlTable({ table, loading }: VarPlTableProps) {
  const rows = table?.rows ?? []
  const hasRows = rows.length > 0

  return (
    <Card title="VAR & PL" className="relative">
      {loading && (
        <div className="absolute inset-x-0 bottom-0 top-16 z-20 flex items-center justify-center rounded-b-xl bg-background/50 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border/60">
              <th className="px-3 py-2 text-left font-semibold" rowSpan={2}>項目</th>
              <th className="bg-muted/40 px-3 py-2 text-right font-semibold" colSpan={2}>ポジション</th>
              <th className="px-3 py-2 text-right font-semibold" colSpan={2}>VaR</th>
              <th className="bg-muted/40 px-3 py-2 text-right font-semibold" colSpan={2}>MTM</th>
              <th className="px-3 py-2 text-right font-semibold" colSpan={2}>実現</th>
            </tr>
            <tr className="border-b border-border/60">
              <th className="bg-muted/40 px-3 py-1 text-right font-normal">億円</th>
              <th className="bg-muted/40 px-3 py-1 text-right font-normal italic">Chg</th>
              <th className="px-3 py-1 text-right font-normal">億円</th>
              <th className="px-3 py-1 text-right font-normal italic">Chg</th>
              <th className="bg-muted/40 px-3 py-1 text-right font-normal">億円</th>
              <th className="bg-muted/40 px-3 py-1 text-right font-normal italic">Chg</th>
              <th className="px-3 py-1 text-right font-normal">億円</th>
              <th className="px-3 py-1 text-right font-normal italic">Chg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {!hasRows && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  データがありません
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.label}
                className={clsx('hover:bg-muted/5', row.indent && 'text-muted-foreground')}
              >
                <td className={clsx('py-2 pr-3', row.indent ? 'pl-8' : 'px-3 font-bold text-foreground')}>
                  {row.label}
                </td>
                <td className="bg-muted/20 px-3 py-2 text-right tabular-nums">{formatOku(row.position)}</td>
                <td className="bg-muted/20 px-3 py-2 text-right text-muted-foreground">−</td>
                <ValueCell value={row.varAmount} />
                <ChangeCell value={row.varChange} />
                <MissingCells />
                <MissingCells />
              </tr>
            ))}
            {table && hasRows && (
              <tr className="border-t-2 border-border font-bold hover:bg-muted/5">
                <td className="px-3 py-2 text-foreground">投資ポート全体</td>
                <td className="bg-muted/20 px-3 py-2 text-right tabular-nums">{formatOku(table.total.position)}</td>
                <td className="bg-muted/20 px-3 py-2 text-right text-muted-foreground">−</td>
                <ValueCell value={table.total.varAmount} />
                <ChangeCell value={table.total.varChange} />
                <MissingCells />
                <MissingCells />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 画像下部の補助ボックス（データ未連携のため「−」） */}
      <div className="mt-4 flex flex-wrap gap-4">
        <div className="rounded-md border border-border px-4 py-3">
          <table className="text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="px-2 py-1 text-left" />
                {EQUITY_BREAKOUT_COLS.map((col) => (
                  <th key={col} className="px-3 py-1 text-right font-semibold">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EQUITY_BREAKOUT_ROWS.map((row) => (
                <tr key={row}>
                  <td className="px-2 py-1 font-semibold text-foreground">{row}</td>
                  {EQUITY_BREAKOUT_COLS.map((col) => (
                    <td key={col} className="px-3 py-1 text-right text-muted-foreground">−</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-md border border-border px-4 py-3 text-xs">
          <div className="flex items-center justify-between gap-6 py-1">
            <span className="font-semibold text-foreground">ポジション変化</span>
            <span className="text-muted-foreground">−</span>
          </div>
          <div className="flex items-center justify-between gap-6 py-1">
            <span className="font-semibold text-foreground">シナリオ変化</span>
            <span className="text-muted-foreground">−</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        MTM・実現損益・ポジション増減・株内訳・変化要因はデータ未連携のため「−」を表示しています。
      </p>
    </Card>
  )
}
