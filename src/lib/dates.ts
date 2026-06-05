import type { ImportantDate } from './types'

export interface UpcomingDate {
  date: ImportantDate
  daysUntil: number
  next: Date
  years: number | null // age / years-married on the next occurrence, if year known
}

// Important dates landing within `withinDays`, soonest first.
export function upcomingDates(dates: ImportantDate[], now: Date, withinDays = 14): UpcomingDate[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return dates
    .map(d => {
      let next = new Date(now.getFullYear(), d.month - 1, d.day)
      if (next < today) next = new Date(now.getFullYear() + 1, d.month - 1, d.day)
      const daysUntil = Math.round((next.getTime() - today.getTime()) / 86_400_000)
      const years = d.year ? next.getFullYear() - d.year : null
      return { date: d, daysUntil, next, years }
    })
    .filter(u => u.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil)
}
