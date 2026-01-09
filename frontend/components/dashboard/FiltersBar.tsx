'use client'

import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'

interface FiltersBarProps {
  dates: string[]
  selectedDate: string
  onDateChange: (date: string) => void
}

export function FiltersBar({ dates, selectedDate, onDateChange }: FiltersBarProps) {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

  return (
    <Card>
      <Select value={selectedDate} label="基準日" onChange={(event) => onDateChange(event.target.value)}>
        {dates.map((iso) => (
          <option key={iso} value={iso}>
            {formatDate(iso)}
          </option>
        ))}
      </Select>
    </Card>
  )
}
