'use client'

import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import type { BranchFilterCondition } from '@/lib/branchFilters'

const bf = (conditions: BranchFilterCondition[]) => JSON.stringify(conditions)

export const DEPARTMENT_PRODUCT_MAPPING = [
  {
    label: '投資ポート全体(含むCFH)',
    value: bf([
      { entity_name: 'invport' },
      { entity_name: 'tkyalm', dept_name: 'ALM Operation(non-JPY)', section_code: 'Hedge Operation(non-JPY)', product: 'US IRS Spread' },
      { entity_name: 'tkyalm', dept_name: 'ALM Operation(non-JPY)', section_code: 'Hedge Operation(non-JPY)', product: 'SOFR Factor - Extracted from IRS' },
    ]),
  },
  {
    label: '　∟証券投資部',
    value: bf([{ entity_name: 'invport', dept_name: 'Fixed Income & Equity Investment Dept(IC)' }]),
  },
  {
    label: '　　∟円株',
    value: bf([
      {
        entity_name: 'invport',
        dept_name: 'Fixed Income & Equity Investment Dept(IC)',
        section_code: 'Equity(JPY)(IC)',
      },
    ]),
  },
  {
    label: '　　∟円債',
    value: bf([
      {
        entity_name: 'invport',
        dept_name: 'Fixed Income & Equity Investment Dept(IC)',
        section_code: 'Fixed Income(JPY)',
      },
    ]),
  },
  {
    label: '　∟国際証券投資部(含むCFH)',
    value: bf([
      { entity_name: 'invport', dept_name: "Int'l Fixed Income & Equity Investment Dept(IC)" },
      { entity_name: 'tkyalm', dept_name: 'ALM Operation(non-JPY)', section_code: 'Hedge Operation(non-JPY)', product: 'US IRS Spread' },
      { entity_name: 'tkyalm', dept_name: 'ALM Operation(non-JPY)', section_code: 'Hedge Operation(non-JPY)', product: 'SOFR Factor - Extracted from IRS' },
    ]),
  },
  {
    label: '　　∟外株＆コモディティ',
    value: bf([
      {
        entity_name: 'invport',
        dept_name: "Int'l Fixed Income & Equity Investment Dept(IC)",
        section_code: 'Equity & Commodity(non-JPY)(IC)',
      },
    ]),
  },
  {
    label: '　　∟外債',
    value: bf([
      {
        entity_name: 'invport',
        dept_name: "Int'l Fixed Income & Equity Investment Dept(IC)",
        section_code: 'Fixed Income(non-JPY)',
      },
      { entity_name: 'tkyalm', dept_name: 'ALM Operation(non-JPY)', section_code: 'Hedge Operation(non-JPY)', product: 'US IRS Spread' },
      { entity_name: 'tkyalm', dept_name: 'ALM Operation(non-JPY)', section_code: 'Hedge Operation(non-JPY)', product: 'SOFR Factor - Extracted from IRS' },
    ]),
  },
  {
    label: '　∟グローバルクレジット投資部',
    value: bf([{ entity_name: 'invport', dept_name: 'Credit & Alternative Investment Dept(JPY)(IC)' }]),
  },
  {
    label: '　∟総合資金部',
    value: bf([{ entity_name: 'invport', dept_name: 'Treasury Dept(JPY)' }]),
  },
  {
    label: '海外ポート全体',
    value: bf([
      { entity_name: 'bk_in_sd' },
      { entity_name: 'ny_ln' },
      { entity_name: 'sg_hk' },
      { entity_name: 'sl_tp' },
    ]),
  },
  {
    label: '　∟ニューヨーク',
    value: bf([{ entity_name: 'ny_ln', dept_name: 'NYK Banking' }]),
  },
  {
    label: '　∟ロンドン',
    value: bf([{ entity_name: 'ny_ln', dept_name: 'LDN Banking' }]),
  },
  {
    label: '　∟バンコク',
    value: bf([{ entity_name: 'bk_in_sd', dept_name: 'BKK Banking' }]),
  },
  {
    label: '　∟ムンバイ',
    value: bf([{ entity_name: 'bk_in_sd', dept_name: 'BOM Banking' }]),
  },
  {
    label: '　∟シドニー',
    value: bf([{ entity_name: 'bk_in_sd', dept_name: 'SYD Banking' }]),
  },
  {
    label: '　∟シンガポール',
    value: bf([
      { entity_name: 'sg_hk', dept_name: 'HEG-CF' },
      { entity_name: 'sg_hk', dept_name: 'HEG-FV' },
      { entity_name: 'sg_hk', dept_name: 'FX_DELTA_REPLACE_BANKING_DESK_GROUP' },
    ]),
  },
  {
    label: '　∟香港',
    value: bf([{ entity_name: 'sg_hk', dept_name: 'HKG Banking' }]),
  },
  {
    label: '　∟ソウル',
    value: bf([{ entity_name: 'sl_tp', dept_name: 'SEL Banking' }]),
  },
  {
    label: '　∟台北',
    value: bf([{ entity_name: 'sl_tp', dept_name: 'TPE Banking' }]),
  }
]

interface FiltersBarProps {
  selectedDate: string
  onDateChange: (date: string) => void
  comparisonDate: string
  onComparisonDateChange: (date: string) => void
  selectedBranch: string
  onBranchChange: (branch: string) => void
}

export function FiltersBar({
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
          <div className="flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
            <label htmlFor="selected-date" className="font-medium uppercase tracking-wide">
              基準日
            </label>
            <div className="relative">
              <input
                id="selected-date"
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
            <label htmlFor="comparison-date" className="font-medium uppercase tracking-wide">
              比較基準日
            </label>
            <div className="relative">
              <input
                id="comparison-date"
                type="date"
                value={comparisonDate}
                onChange={(e) => onComparisonDateChange(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
