'use client'

import { useTheme } from '@/hooks/useTheme'
import { Switch } from '@/components/ui/switch'

type TabOption = {
  key: string
  label: string
}

type AppHeaderProps = {
  tabs?: TabOption[]
  activeTab?: string
  onTabChange?: (key: string) => void
}

export function AppHeader({ tabs, activeTab, onTabChange }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const hasTabs = tabs && tabs.length > 0

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto w-full max-w-[108rem] px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold">
              VaR
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">ダッシュボード</p>
              <h1 className="text-lg font-bold">Value at Risk モニター</h1>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            <span>ダークモード</span>
            <Switch aria-label="ダークモード切り替え" pressed={theme === 'dark'} onClick={toggleTheme} />
          </div>
        </div>
        {hasTabs && (
          <nav aria-label="主要アプリケーションタブ" className="mt-3">
            <div className="flex flex-wrap gap-3">
              {tabs?.map((tab) => {
                const isActive = tab.key === activeTab
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onTabChange?.(tab.key)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                      isActive
                        ? 'bg-primary/20 text-primary border border-primary/60'
                        : 'border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                    aria-pressed={isActive}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
