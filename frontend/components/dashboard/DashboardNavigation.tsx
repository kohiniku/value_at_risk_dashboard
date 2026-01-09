'use client'

import type { MouseEvent } from 'react'

type Section = {
  id: string
  label: string
  description?: string
}

type DashboardNavigationProps = {
  sections: Section[]
  onNavigate?: (sectionId: string) => void
}

export function DashboardNavigation({ sections, onNavigate }: DashboardNavigationProps) {
  if (!sections.length) {
    return null
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    if (onNavigate) {
      event.preventDefault()
      onNavigate(sectionId)
    }
  }

  return (
    <nav
      aria-label="ダッシュボードナビゲーションバー"
      className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-border/60 bg-gradient-to-b from-background/95 via-background/90 to-background/95 px-5 py-6 text-sm shadow-[0_25px_60px_rgba(0,0,0,0.35)] backdrop-blur lg:flex"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-foreground">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-lg font-semibold text-primary">
            VaR
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.5em] text-muted-foreground/80">Value at Risk</p>
            <p className="text-base font-bold">リスクモニター</p>
          </div>
        </div>
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.45em] text-muted-foreground/80">NAVIGATION</p>
          <p className="text-sm text-muted-foreground/80">主要セクションへジャンプ</p>
        </div>
      </div>
      <div className="mt-6 flex-1 space-y-2 overflow-y-auto pr-1">
        {sections.map((section, index) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            onClick={(event) => handleClick(event, section.id)}
            className="group relative flex items-start gap-3 rounded-2xl border border-transparent px-4 py-3 text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-[0.7rem] font-semibold text-primary">
              {(index + 1).toString().padStart(2, '0')}
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide">{section.label}</span>
              {section.description && (
                <span className="text-xs font-normal text-muted-foreground/80">{section.description}</span>
              )}
            </span>
            <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-transparent transition group-hover:bg-primary" />
          </a>
        ))}
      </div>
      <div className="border-t border-border/50 pt-4 text-xs text-muted-foreground">
        <p className="font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">ショートカット</p>
        <p className="mt-1 text-muted-foreground/70">セクション名をクリックして即座に移動できます。</p>
      </div>
    </nav>
  )
}

export function DashboardMobileNav({ sections, onNavigate }: DashboardNavigationProps) {
  if (!sections.length) {
    return null
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    if (onNavigate) {
      event.preventDefault()
      onNavigate(sectionId)
    }
  }

  return (
    <div className="lg:hidden">
      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-border/60 bg-background/95 px-4 py-3 shadow-inner">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-sm font-semibold text-primary">
          VaR
        </span>
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">Value at Risk</p>
          <p className="text-sm font-bold text-foreground">リスクモニター</p>
        </div>
      </div>
      <div className="flex snap-x gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-background/90 px-3 py-3 shadow-inner">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            onClick={(event) => handleClick(event, section.id)}
            className="flex-shrink-0 rounded-full border border-border/60 px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {section.label}
          </a>
        ))}
      </div>
    </div>
  )
}
