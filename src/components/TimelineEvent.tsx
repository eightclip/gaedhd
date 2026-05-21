'use client'

import { format } from 'date-fns'
import type { CalendarEvent } from '@/lib/types'

export function TimelineEvent({ event }: { event: CalendarEvent }) {
  const start = new Date(event.startTime)
  const end = new Date(event.endTime)

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center justify-between"
      style={{ backgroundColor: event.color + '18', borderLeft: `3px solid ${event.color}` }}
    >
      <div>
        <p className="font-bold text-sm">{event.title}</p>
        <p className="text-xs text-muted mt-0.5">
          {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
        </p>
      </div>
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: event.color }}
      />
    </div>
  )
}
