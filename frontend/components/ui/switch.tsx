'use client'

import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

interface SwitchProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed: boolean
}

export function Switch({ pressed, className, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={clsx(
        'relative inline-flex h-6 w-11 items-center rounded-full border border-border bg-muted transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 rounded-full bg-foreground transition',
          pressed ? 'translate-x-6' : 'translate-x-1',
        )}
      />
      <span className="sr-only">テーマを切り替える</span>
    </button>
  )
}
