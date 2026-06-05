'use client'

import { Heart, Calendar } from 'lucide-react'
import { upcomingDates } from '@/lib/dates'
import type { ImportantDate } from '@/lib/types'
import { Illo } from './Illo'
import { SPARKLES, pickDaily } from '@/lib/illustrations'

// Birthdays/anniversaries landing within two weeks. The day-of gets a celebration.
export function ImportantDates({ dates, now }: { dates: ImportantDate[]; now: Date }) {
  const upcoming = upcomingDates(dates, now, 14)
  if (upcoming.length === 0) return null

  return (
    <section className="mb-10">
      <h2 className="font-display text-3xl font-bold tracking-tight mb-4">Coming <span className="italic font-normal">up</span></h2>
      <div className="space-y-2">
        {upcoming.map(u => {
          const today = u.daysUntil === 0
          const Icon = u.date.kind === 'anniversary' ? Heart : Calendar
          const when = today ? 'today' : u.daysUntil === 1 ? 'tomorrow' : `in ${u.daysUntil} days`
          const detail = u.years != null ? (u.date.kind === 'anniversary' ? `${u.years} years` : `turns ${u.years}`) : null
          return (
            <div
              key={u.date.id}
              className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${today ? '' : 'bg-card border border-card-border'}`}
              style={today ? { backgroundColor: 'var(--today-tint)' } : undefined}
            >
              {today
                ? <Illo src={pickDaily(SPARKLES)} className="h-8 w-auto shrink-0" />
                : <Icon size={18} className="text-today-ink shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-display text-base font-bold truncate" style={today ? { color: 'var(--today-ink)' } : undefined}>
                  {u.date.label}{today ? '!' : ''}
                </p>
                {detail && <p className="font-mono text-[11px] text-muted">{detail}</p>}
              </div>
              <span className="font-mono text-xs font-bold shrink-0" style={today ? { color: 'var(--today-ink)' } : undefined}>{when}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
