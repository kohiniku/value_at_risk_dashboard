'use client'

import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const STORAGE_KEY = 'theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored)
      document.documentElement.classList.toggle('dark', stored === 'dark')
      return
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const defaultTheme: Theme = prefersDark ? 'dark' : 'light'
    setTheme(defaultTheme)
    document.documentElement.classList.toggle('dark', defaultTheme === 'dark')
  }, [])

  const applyTheme = useCallback((next: Theme) => {
    setTheme(next)
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', next === 'dark')
      window.localStorage.setItem(STORAGE_KEY, next)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark')
  }, [applyTheme, theme])

  return { theme, applyTheme, toggleTheme }
}
