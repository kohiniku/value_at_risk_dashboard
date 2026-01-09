import clsx from 'clsx'
import type { HTMLAttributes } from 'react'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  widthClass?: string
  heightClass?: string
}

export function Skeleton({ widthClass = 'w-full', heightClass = 'h-6', className, ...props }: SkeletonProps) {
  return (
    <div
      className={clsx('animate-pulse rounded-md bg-muted/40', widthClass, heightClass, className)}
      {...props}
    />
  )
}
