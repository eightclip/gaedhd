'use client'

import { format } from 'date-fns'
import type { CalendarEvent } from '@/lib/types'

// A meeting on the rail. Color-blocked and solid while it's happening, a soft tint
// when it's upcoming, dimmed once it's past.
export function TimelineEvent({ event, now }: { event: CalendarEvent; now: Date }) {
  const start = new Date(event.startTime)
  const end = new Date(event.endTime)
  const t = now.getTime()
  const isPast = end.getTime() <= t
  const isNow = start.getTime() <= t && t < end.getTime()

  return (
    <div className={`flex gap-3 ${isPast ? 'opacity-40' : ''}`}>
      <div className="shrink-0 w-14 pt-1.5 text-right">
        <span className="font-mono text-xs text-muted">{format(start, 'h:mm')}</span>
      </div>
      <div
        className="flex-1 rounded-2xl px-4 py-3"
        style={{
          backgroundColor: isNow ? event.color : event.color + '22',
          color: isNow ? '#fff' : undefined,
          boxShadow: isNow ? `0 0 0 2px ${event.color}55` : undefined,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-sm">{event.title}</p>
          {isNow && (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-white/25 px-2 py-0.5 rounded-full">
              now
            </span>
          )}
        </div>
        <p className={`font-mono text-[11px] mt-0.5 ${isNow ? 'text-white/80' : 'text-muted'}`}>
          {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
        </p>
      </div>
    </div>
  )
}
