import clsx from 'clsx'
import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function Select({ label, className, children, ...props }: SelectProps) {
  return (
    <label className="flex w-full flex-col gap-2 text-sm text-muted-foreground">
      {label && <span className="font-medium uppercase tracking-wide">{label}</span>}
      <select
        className={clsx(
          'rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}
