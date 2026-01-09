'use client'

import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'

interface TimeseriesControlsProps {
  options: { value: string; label: string }[]
  selectedRic: string
  windowDays: number
  onAssetChange: (ric: string) => void
  onWindowChange: (days: number) => void
}

export function TimeseriesControls({ options, selectedRic, windowDays, onAssetChange, onWindowChange }: TimeseriesControlsProps) {
  return (
    <Card>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Select value={selectedRic} label="資産" onChange={(event) => onAssetChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={String(windowDays)} label="観測日数" onChange={(event) => onWindowChange(Number(event.target.value))}>
          <option value="14">14日</option>
          <option value="30">30日</option>
          <option value="60">60日</option>
        </Select>
      </div>
    </Card>
  )
}
