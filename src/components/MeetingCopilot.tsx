'use client'

import { format } from 'date-fns'
import { Clock, MessageSquare } from 'lucide-react'
import type { CalendarEvent } from '@/lib/types'

interface MeetingCopilotProps {
  events: CalendarEvent[]
  now: Date
  asyncMeetings: string[]
  onToggleAsync: (title: string) => void
}

// While she's in a meeting: a wrap-up countdown that turns urgent near the end,
// and a one-tap flag to mark a recurring meeting as "this could be async".
export function MeetingCopilot({ events, now, asyncMeetings, onToggleAsync }: MeetingCopilotProps) {
  const nowMs = now.getTime()
  const current = events.find(e => new Date(e.startTime).getTime() <= nowMs && nowMs < new Date(e.endTime).getTime())
  if (!current) return null

  const end = new Date(current.endTime)
  const minsLeft = Math.max(0, Math.round((end.getTime() - nowMs) / 60000))
  const total = Math.max(1, Math.round((end.getTime() - new Date(current.startTime).getTime()) / 60000))
  const wrapUp = minsLeft <= Math.min(10, Math.ceil(total * 0.25))
  const isAsync = asyncMeetings.includes(current.title)

  return (
    <section className="mb-8">
      <div className={`rounded-3xl p-5 ${wrapUp ? 'bg-[#C85D3E] text-white' : 'bg-card border border-card-border'}`}>
        <div className="flex items-center justify-between mb-1">
          <p className={`text-xs font-bold uppercase tracking-widest ${wrapUp ? 'text-white/80' : 'text-muted'}`}>In a meeting</p>
          <span className={`flex items-center gap-1.5 font-mono text-sm font-bold ${wrapUp ? 'text-white' : 'text-foreground'}`}>
            <Clock size={14} /> {minsLeft}m left
          </span>
        </div>
        <h2 className="font-display text-2xl font-bold leading-tight">{current.title}</h2>
        <p className={`text-sm mt-1 ${wrapUp ? 'text-white/90' : 'text-muted'}`}>
          {wrapUp ? 'Start landing this. Summarize, assign next steps, end early.' : `Ends ${format(end, 'h:mm a')}.`}
        </p>
        {isAsync && (
          <p className={`text-sm mt-2 font-semibold ${wrapUp ? 'text-white' : 'text-accent'}`}>
            You flagged this one. Could it be a Slack thread instead?
          </p>
        )}
        <button
          onClick={() => onToggleAsync(current.title)}
          className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${wrapUp ? 'bg-white/20 text-white hover:bg-white/30' : isAsync ? 'bg-accent-soft text-accent' : 'bg-muted-light text-muted hover:text-foreground'}`}
        >
          <MessageSquare size={13} /> {isAsync ? 'Async-able ✓' : 'Mark async-able'}
        </button>
      </div>
    </section>
  )
}
