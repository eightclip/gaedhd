'use client'

import { format } from 'date-fns'
import type { ScheduleGap, ScheduledTask } from '@/lib/types'

// A free window on the rail, with the next-actions that fit in it.
export function TimelineGap({ gap, scheduledTasks, now }: { gap: ScheduleGap; scheduledTasks: ScheduledTask[]; now: Date }) {
  const start = new Date(gap.startTime)
  const isPast = new Date(gap.endTime).getTime() <= now.getTime()

  return (
    <div className={`flex gap-3 ${isPast ? 'opacity-40' : ''}`}>
      <div className="shrink-0 w-14 pt-0.5 text-right">
        <span className="font-mono text-xs text-muted">{format(start, 'h:mm')}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-wide text-muted mb-1.5">{gap.durationMin} min free</p>
        {scheduledTasks.length > 0 ? (
          <div className="space-y-1.5">
            {scheduledTasks.map((st) => (
              <div key={st.id} className="flex items-center gap-2.5 bg-card rounded-xl px-3 py-2 border border-card-border">
                <span className="text-base shrink-0">{st.goal.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{st.microTask.title}</p>
                  <p className="font-mono text-[11px] text-muted truncate">{st.goal.title} · {st.microTask.durationMin}m</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted/60 italic">open</p>
        )}
      </div>
    </div>
  )
}
