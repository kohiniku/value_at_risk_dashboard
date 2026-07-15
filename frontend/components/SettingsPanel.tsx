'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Settings } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

interface SettingsPanelProps {
  preferImportedDelta: boolean
  onPreferImportedDeltaChange: (checked: boolean) => void
  useMonthlyVar: boolean
  onUseMonthlyVarChange: (checked: boolean) => void
  useVolatilityAdjustment: boolean
  onUseVolatilityAdjustmentChange: (checked: boolean) => void
}

export function SettingsPanel({
  preferImportedDelta,
  onPreferImportedDeltaChange,
  useMonthlyVar,
  onUseMonthlyVarChange,
  useVolatilityAdjustment,
  onUseVolatilityAdjustmentChange,
}: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="relative inline-block text-left" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="表示設定"
        title="表示設定"
      >
        <Settings className="h-5 w-5 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right rounded-md border border-border bg-card p-4 shadow-lg">
          <h3 className="mb-4 text-sm font-semibold text-foreground">表示設定</h3>
          
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="preferImportedDelta" className="text-sm leading-snug text-foreground cursor-pointer select-none flex-1">
                日報から取り込んだデルタを優先して反映する(フロント閲覧用)
              </label>
              <Switch
                id="preferImportedDelta"
                pressed={preferImportedDelta}
                onClick={() => onPreferImportedDeltaChange(!preferImportedDelta)}
                className="scale-90 origin-right flex-shrink-0"
              />
            </div>
            
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="useMonthlyVar" className="text-sm leading-snug text-foreground cursor-pointer select-none flex-1">
                一か月あたりVaRで表示する
              </label>
              <Switch
                id="useMonthlyVar"
                pressed={useMonthlyVar}
                onClick={() => onUseMonthlyVarChange(!useMonthlyVar)}
                className="scale-90 origin-right flex-shrink-0"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <label htmlFor="useVolatilityAdjustment" className="text-sm leading-snug text-foreground cursor-pointer select-none flex-1">
                ボラティリティ調整係数を加味して計算する
              </label>
              <Switch
                id="useVolatilityAdjustment"
                pressed={useVolatilityAdjustment}
                onClick={() => onUseVolatilityAdjustmentChange(!useVolatilityAdjustment)}
                className="scale-90 origin-right flex-shrink-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
