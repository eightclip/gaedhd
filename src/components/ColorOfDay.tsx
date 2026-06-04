'use client'

import { useEffect } from 'react'
import { applyColorOfDay } from '@/lib/theme'

// Sets --today-tint / --today-ink on the document for the whole app, and rolls
// the color over at midnight so a fresh day reads as a fresh color. Renders nothing.
export function ColorOfDay() {
  useEffect(() => {
    applyColorOfDay()

    let timer: ReturnType<typeof setTimeout>
    const scheduleNextRollover = () => {
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
      timer = setTimeout(() => {
        applyColorOfDay()
        scheduleNextRollover()
      }, nextMidnight.getTime() - now.getTime())
    }
    scheduleNextRollover()

    return () => clearTimeout(timer)
  }, [])

  return null
}
