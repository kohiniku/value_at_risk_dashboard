'use client'

import clsx from 'clsx'
import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'outline' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-ring',
  outline: 'border border-border bg-transparent text-foreground hover:bg-border/40 focus-visible:outline-ring',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-border/30 focus-visible:outline-ring',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center rounded-md font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        disabled && 'opacity-60 pointer-events-none',
        className,
      )}
      disabled={disabled}
      {...props}
    />
  )
})
