'use client'

import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'

export const DEPARTMENT_PRODUCT_MAPPING = [
  { label: '全部署 / 全商品', value: '' },
  { label: '総合資金部_ALM', value: 'ALM Operation' },
  { label: 'グローバルクレジット投資部_クレジット', value: 'Credit(JPY)' },
  { label: '国際証券投資部_海外株&コモディティ', value: 'Equity & Commodity(non-JPY)(IC)' },
  { label: '証券投資部_日本株', value: 'Equity(JPY)(IC)' },
  { label: '証券投資部_日本金利', value: 'Fixed Income(JPY)' },
  { label: '国際証券投資部_海外金利', value: 'Fixed Income(non-JPY)' },
]

interface FiltersBarProps {
  dates: string[]
  selectedDate: string
  onDateChange: (date: string) => void
  comparisonDate: string
  onComparisonDateChange: (date: string) => void
  selectedBranch: string
  onBranchChange: (branch: string) => void
}

export function FiltersBar({
  dates,
  selectedDate,
  onDateChange,
  comparisonDate,
  onComparisonDateChange,
  selectedBranch,
  onBranchChange,
}: FiltersBarProps) {
  return (
    <Card>
      <div className="flex flex-col gap-4 p-4">
        <div className="w-full">
          <Select
            label="部署 / 商品"
            value={selectedBranch}
            onChange={(e) => onBranchChange(e.target.value)}
          >
            {DEPARTMENT_PRODUCT_MAPPING.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <label className="flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">基準日</span>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </label>
          <label className="flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">比較基準日</span>
            <div className="relative">
              <input
                type="date"
                value={comparisonDate}
                onChange={(e) => onComparisonDateChange(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </label>
        </div>
      </div>
    </Card>
  )
}
