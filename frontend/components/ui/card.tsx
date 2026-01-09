import clsx from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  actions?: ReactNode
  footer?: ReactNode
}

export function Card({ title, actions, footer, className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx('rounded-lg border border-border bg-card text-card-foreground shadow-card', className)}
      {...props}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          {title && <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="px-4 py-5">{children}</div>
      {footer && (
        <footer className="border-t border-border px-4 py-3 text-sm text-muted-foreground">{footer}</footer>
      )}
    </div>
  )
}
