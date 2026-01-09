'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { NewsItem } from '@/types/var'

interface NewsPanelProps {
  items: NewsItem[]
  loading?: boolean
}

export function NewsPanel({ items, loading = false }: NewsPanelProps) {
  const formatMeta = (item: NewsItem) => {
    const when = new Date(item.published_at)
    return `${item.source} • ${when.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
  }

  return (
    <Card title="関連ニュース">
      {loading ? (
        <div className="space-y-3">
          <Skeleton heightClass="h-6" />
          <Skeleton heightClass="h-6" />
          <Skeleton heightClass="h-6" />
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="border-b border-border/60 pb-3 last:border-none">
              <p className="text-sm font-semibold">{item.headline}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatMeta(item)}</p>
              {item.summary && (
                <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
              )}
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-sm text-muted-foreground">表示できるニュースはありません。</li>
          )}
        </ul>
      )}
    </Card>
  )
}
