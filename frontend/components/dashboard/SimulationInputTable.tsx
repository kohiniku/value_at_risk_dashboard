'use client'

import React, { useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { appendBranchFiltersParam } from '@/lib/branchFilters'
import type { SimulationFactor } from '@/types/var'
import { HUNDRED_MILLION } from '@/lib/constants'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1'

interface SimulationInputTableProps {
  asOf: string
  selectedBranch: string
  preferImportedDelta: boolean
  factors: SimulationFactor[]
  availableMultiplierProducts?: string[]
  simulationInputs: Record<string, number>
  simulationMultipliers: Record<string, number>
  isSimulationEnabled: boolean
  onSimulationEnabledChange: (enabled: boolean) => void
  onInputChange: (factorId: string, val: number) => void
  onMultiplierChange: (product: string, val: number) => void
  onReplaceInputs: (inputs: Record<string, number>) => void
  loading?: boolean
}

// セルごとのローカルStateを管理するためのサブコンポーネント
function SimulationInputCell({
  factorId,
  initialValue,
  disabled,
  onCommit
}: {
  factorId: string
  initialValue: number | undefined
  disabled: boolean
  onCommit: (factorId: string, val: number) => void
}) {
  const [localValue, setLocalValue] = useState<string>(
    initialValue === undefined ? '' : String(initialValue)
  )

  React.useEffect(() => {
    setLocalValue(initialValue === undefined ? '' : String(initialValue))
  }, [initialValue])

  const handleBlur = () => {
    let num = localValue ? Number(localValue) : 0
    if (!Number.isFinite(num)) num = 0
    onCommit(factorId, num)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  return (
    <input
      type="number"
      step="0.01"
      className="w-full rounded-md border border-border bg-background px-2 py-1 text-right text-sm focus:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="0.00"
      disabled={disabled}
    />
  )
}

function MultiplierInputCell({
  product,
  initialValue,
  disabled,
  onCommit
}: {
  product: string
  initialValue: number | undefined
  disabled: boolean
  onCommit: (product: string, val: number) => void
}) {
  const [localValue, setLocalValue] = useState<string>(
    initialValue === undefined ? '1.0' : String(initialValue)
  )

  React.useEffect(() => {
    setLocalValue(initialValue === undefined ? '1.0' : String(initialValue))
  }, [initialValue])

  const handleBlur = () => {
    let num = localValue === '' ? 1.0 : Number(localValue)
    if (!Number.isFinite(num)) num = 1.0
    onCommit(product, num)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  return (
    <input
      type="number"
      step="0.1"
      className="w-full rounded-md border border-border bg-background px-2 py-1 text-right text-sm focus:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="1.0"
      disabled={disabled}
    />
  )
}

export function SimulationInputTable({
  asOf,
  selectedBranch,
  preferImportedDelta,
  factors,
  availableMultiplierProducts,
  simulationInputs,
  simulationMultipliers,
  isSimulationEnabled,
  onSimulationEnabledChange,
  onInputChange,
  onMultiplierChange,
  onReplaceInputs,
  loading,
}: SimulationInputTableProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importNotice, setImportNotice] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const rowsWithSpan = useMemo(() => {
    const result: Array<SimulationFactor & { 
      isFirstInCategory: boolean; categoryRowSpan: number; 
      isFirstInCurrency: boolean; currencyRowSpan: number;
      isFirstInRiskFactor: boolean; riskFactorRowSpan: number;
    }> = [];

    for (let i = 0; i < factors.length; i++) {
      const factor = factors[i];

      let isFirstInCategory = false;
      let categoryRowSpan = 0;
      if (i === 0 || factor.risk_class !== factors[i-1].risk_class) {
        isFirstInCategory = true;
        for (let j = i; j < factors.length; j++) {
          if (factors[j].risk_class === factor.risk_class) {
            categoryRowSpan++;
          } else {
            break;
          }
        }
      }

      let isFirstInCurrency = false;
      let currencyRowSpan = 0;
      if (i === 0 || factor.risk_class !== factors[i-1].risk_class || factor.currency !== factors[i-1].currency) {
        isFirstInCurrency = true;
        for (let j = i; j < factors.length; j++) {
          if (factors[j].risk_class === factor.risk_class && factors[j].currency === factor.currency) {
            currencyRowSpan++;
          } else {
            break;
          }
        }
      }

      let isFirstInRiskFactor = false;
      let riskFactorRowSpan = 0;
      if (i === 0 || factor.risk_class !== factors[i-1].risk_class || factor.currency !== factors[i-1].currency || factor.risk_factor !== factors[i-1].risk_factor) {
        isFirstInRiskFactor = true;
        for (let j = i; j < factors.length; j++) {
          if (factors[j].risk_class === factor.risk_class && factors[j].currency === factor.currency && factors[j].risk_factor === factor.risk_factor) {
            riskFactorRowSpan++;
          } else {
            break;
          }
        }
      }

      result.push({
        ...factor,
        isFirstInCategory,
        categoryRowSpan,
        isFirstInCurrency,
        currencyRowSpan,
        isFirstInRiskFactor,
        riskFactorRowSpan
      });
    }
    return result;
  }, [factors]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (asOf) {
      params.append('as_of', asOf)
    }
    // Keep simulation factor set consistent with dashboard checkbox.
    params.append('prefer_imported_delta', preferImportedDelta ? 'true' : 'false')
    appendBranchFiltersParam(params, selectedBranch)
    const str = params.toString()
    return str ? `?${str}` : ''
  }, [asOf, selectedBranch, preferImportedDelta])

  const handleDownloadTemplate = async () => {
    setImportError(null)
    setImportNotice(null)
    setIsDownloading(true)
    try {
      if (!asOf) {
        throw new Error('基準日が未選択です')
      }
      if (factors.length === 0) {
        throw new Error('ダウンロード対象のファクターがありません')
      }
      const escapeCell = (value: string) => {
        const needsQuote = /[",\n\r]/.test(value)
        const escaped = value.replaceAll('"', '""')
        return needsQuote ? `"${escaped}"` : escaped
      }
      const lines: string[] = []
      lines.push(
        ['基準日', 'リスク分類', '通貨', 'リスクファクター', 'ファクター番号', 'ファクター名', '基準日のポジション量', 'ポジション増減'].map(escapeCell).join(','),
      )
      for (const factor of factors) {
        const basePositionIn100M = factor.base_position / HUNDRED_MILLION
        const delta = Number.isFinite(simulationInputs[factor.factor_id]) ? simulationInputs[factor.factor_id] : 0
        lines.push(
          [
            asOf,
            factor.risk_class ?? '',
            factor.currency ?? '',
            factor.risk_factor ?? '',
            factor.factor_id,
            factor.description || factor.factor_name,
            basePositionIn100M.toFixed(6),
            delta.toString(),
          ].map((cell) => escapeCell(String(cell))).join(','),
        )
      }
      const csv = `\ufeff${lines.join('\r\n')}\r\n`
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `VaRシミュレーション_補正テンプレート_${asOf}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download template', error)
      setImportError(error instanceof Error ? error.message : 'テンプレート取得に失敗しました')
    } finally {
      setIsDownloading(false)
    }
  }

  const applyImportedInputs = (adjustments: Array<{ factor_id: string; position_delta: number }>) => {
    const next: Record<string, number> = {}
    for (const factor of factors) {
      next[factor.factor_id] = 0
    }
    for (const adj of adjustments) {
      if (adj.factor_id in next) {
        next[adj.factor_id] = adj.position_delta
      }
    }
    onReplaceInputs(next)
  }

  const handleImportFile = async (file: File) => {
    setImportError(null)
    setImportNotice(null)
    if (!asOf) {
      setImportError('基準日が未選択です')
      return
    }
    const lowered = file.name.toLowerCase()
    if (!lowered.endsWith('.csv')) {
      setImportError('CSVファイル(.csv)を指定してください')
      return
    }

    setIsImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch(`${API_BASE}/var/simulation_adjustments/import${queryString}`, {
        method: 'POST',
        body: form,
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        let message = `CSV取込に失敗しました (${response.status})`
        if (payload && typeof payload === 'object' && 'detail' in payload) {
          if (typeof payload.detail === 'string') {
            message = payload.detail
          } else if (Array.isArray(payload.detail) && payload.detail.length > 0 && typeof payload.detail[0].msg === 'string') {
            message = `CSV取込エラー: ${payload.detail[0].msg}`
          }
        }
        throw new Error(message)
      }
      const payload = (await response.json()) as {
        as_of: string
        adjustments: Array<{ factor_id: string; position_delta: number }>
      }
      if (payload.as_of !== asOf) {
        throw new Error(`基準日が一致しません（CSV: ${payload.as_of} / 画面: ${asOf}）`)
      }
      applyImportedInputs(payload.adjustments)
      onSimulationEnabledChange(true)
      setImportNotice(`CSVを取り込みました（${payload.adjustments.length}件）`)
    } catch (error) {
      console.error('Failed to import csv', error)
      setImportError(error instanceof Error ? error.message : 'CSV取込に失敗しました')
    } finally {
      setIsImporting(false)
    }
  }

  const handleClearInputs = () => {
    if (window.confirm('すべてのポジション補正を0にリセットしますか？')) {
      const next: Record<string, number> = {}
      for (const factor of factors) {
        next[factor.factor_id] = 0
      }
      onReplaceInputs(next)
      setImportNotice('ポジション補正をリセットしました')
    }
  }

  return (
    <Card
      title="VaRシミュレーション"
      actions={
        <div className="flex items-center gap-4 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">シミュレーション有効化</span>
            <Switch
              pressed={isSimulationEnabled}
              onClick={() => onSimulationEnabledChange(!isSimulationEnabled)}
            />
          </div>
        </div>
      }
      className={clsx('relative', isDragging ? 'ring-2 ring-primary/50' : undefined)}
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        const dropped = e.dataTransfer.files?.[0]
        if (dropped) {
          void handleImportFile(dropped)
        }
      }}
    >
      {loading && (
        <div className="absolute inset-x-0 bottom-0 top-16 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-b-xl">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}
      <div className="relative z-10">
        <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0]
          if (picked) {
            void handleImportFile(picked)
          }
          e.target.value = ''
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          CSV（.csv）をこのタイルにドラッグ＆ドロップしてポジション補正を取り込めます。
        </p>
      </div>

      {(importError || importNotice) && (
        <div className="mt-3 space-y-1">
          {importError && <p className="text-xs text-rose-400">{importError}</p>}
          {importNotice && <p className="text-xs text-emerald-400">{importNotice}</p>}
        </div>
      )}

      {isSimulationEnabled && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-foreground">ポジション補正</h3>
              <p className="text-xs text-muted-foreground">
                ※金利系デルタは1bpあたり増分として計算
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearInputs}
                disabled={!isSimulationEnabled || Object.keys(simulationInputs).length === 0}
                className="border-rose-500 text-rose-700 hover:bg-rose-500/10 dark:border-rose-400 dark:text-rose-400"
              >
                クリア
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                disabled={isDownloading || !asOf || factors.length === 0}
                title={!asOf ? '基準日を選択してください' : 'CSVでダウンロード'}
                className="border-emerald-500 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
              >
                {isDownloading ? 'ダウンロード中...' : 'CSV形式でダウンロード'}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting || !asOf}
                title={!asOf ? '基準日を選択してください' : 'CSVをアップロード'}
                className="bg-sky-600 text-white hover:bg-sky-700"
              >
                {isImporting ? 'アップロード中...' : 'アップロード'}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-border/60 text-sm">
          <thead className="bg-background/80 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-24 px-4 py-3 text-left">リスク分類</th>
              <th className="w-24 px-4 py-3 text-left">通貨</th>
              <th className="w-32 px-4 py-3 text-left">リスクファクター</th>
              <th className="w-48 px-4 py-3 text-left">ファクター名</th>
              <th className="w-32 px-4 py-3 text-right">基準日のポジション量<br/>(億円)</th>
              <th className="w-40 px-4 py-3 text-right">ポジション増減値<br/>(億円)</th>
              <th className="w-32 px-4 py-3 text-right">変化後のポジション総量<br/>(億円)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rowsWithSpan.map((row) => {
              const delta = simulationInputs[row.factor_id] || 0
              const basePositionIn100M = row.base_position / HUNDRED_MILLION
              const newTotalIn100M = basePositionIn100M + delta

  return (
                <tr key={row.factor_id} className="align-middle hover:bg-muted/5">
                  {row.isFirstInCategory && (
                    <td className="px-4 py-3 font-bold text-foreground bg-muted/20" rowSpan={row.categoryRowSpan}>
                      {row.risk_class ?? '-'}
                    </td>
                  )}
                  {row.isFirstInCurrency && (
                    <td className="px-4 py-3 font-semibold text-muted-foreground" rowSpan={row.currencyRowSpan}>
                      {row.currency ?? '-'}
                    </td>
                  )}
                  {row.isFirstInRiskFactor && (
                    <td className="px-4 py-3 font-semibold text-muted-foreground" rowSpan={row.riskFactorRowSpan}>
                      {row.risk_factor ?? '-'}
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">{row.description || row.factor_name}</td>
                  <td className="px-4 py-3 text-right">
                    {basePositionIn100M.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <SimulationInputCell
                      factorId={row.factor_id}
                      initialValue={simulationInputs[row.factor_id]}
                      disabled={!isSimulationEnabled}
                      onCommit={onInputChange}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">
                    {newTotalIn100M.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              )
            })}
            {factors.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  データがありません
                </td>
              </tr>
            )}
          </tbody>
          </table>
          </div>

          {(availableMultiplierProducts && availableMultiplierProducts.length > 0) && (
            <div className="mt-8">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-semibold text-foreground">シナリオPL直接調整（デルタ情報なしファクター）</h3>
                  <p className="text-xs text-muted-foreground">
                    対象ファクターのシナリオPLに直接倍率を掛けてシミュレーション結果に合流させます。
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed divide-y divide-border/60 text-sm">
                  <thead className="bg-background/80 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="w-48 px-4 py-3 text-left">対象プロダクト</th>
                      <th className="w-32 px-4 py-3 text-right">シナリオPL倍率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {availableMultiplierProducts.map((product) => {
                      return (
                        <tr key={product} className="align-middle hover:bg-muted/5">
                          <td className="px-4 py-3 font-medium">{product}</td>
                          <td className="px-4 py-3 text-right">
                            <MultiplierInputCell
                              product={product}
                              initialValue={simulationMultipliers[product]}
                              disabled={!isSimulationEnabled}
                              onCommit={onMultiplierChange}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </Card>
  )
}
