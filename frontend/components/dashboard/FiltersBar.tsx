'use client'

import { Card } from '@/components/ui/card'

interface FiltersBarProps {
  dates: string[]
  selectedDate: string
  onDateChange: (date: string) => void
  comparisonDate: string
  onComparisonDateChange: (date: string) => void
}

export function FiltersBar({ dates, selectedDate, onDateChange, comparisonDate, onComparisonDateChange }: FiltersBarProps) {
  return (
    <Card>
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
    </Card>
  )
}
