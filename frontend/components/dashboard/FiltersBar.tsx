'use client'

import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'

export const DEPARTMENT_PRODUCT_MAPPING = [
  { label: '投資ポート全体', value: '' },
  {
    label: '　∟証券投資部',
    value: JSON.stringify({ dept_name: 'Fixed Income & Equity Investment Dept(IC)' }),
  },
  {
    label: '　　∟円株',
    value: JSON.stringify({
      dept_name: 'Fixed Income & Equity Investment Dept(IC)',
      section_code: 'Equity(JPY)(IC)',
    }),
  },
  {
    label: '　　∟円債',
    value: JSON.stringify({
      dept_name: 'Fixed Income & Equity Investment Dept(IC)',
      section_code: 'Fixed Income(JPY)',
    }),
  },
  {
    label: '　∟国際証券投資部',
    value: JSON.stringify({ dept_name: "Int'l Fixed Income & Equity Investment Dept(IC)" }),
  },
  {
    label: '　　∟外株＆コモディティ',
    value: JSON.stringify({
      dept_name: "Int'l Fixed Income & Equity Investment Dept(IC)",
      section_code: 'Equity & Commodity(non-JPY)(IC)',
    }),
  },
  {
    label: '　　∟外債',
    value: JSON.stringify({
      dept_name: "Int'l Fixed Income & Equity Investment Dept(IC)",
      section_code: 'Fixed Income(non-JPY)',
    }),
  },
  {
    label: '　∟グローバルクレジット投資部',
    value: JSON.stringify({ dept_name: 'Credit & Alternative Investment Dept(JPY)(IC)' }),
  },
  { label: '　∟総合資金部', value: JSON.stringify({ dept_name: 'Treasury Dept(JPY)' }) },
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
