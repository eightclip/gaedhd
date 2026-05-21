'use client'

import { format } from 'date-fns'
import { Sparkles } from 'lucide-react'
import type { ScheduleGap, ScheduledTask } from '@/lib/types'
import { categoryColors } from '@/lib/mock-data'

interface TimelineGapProps {
  gap: ScheduleGap
  scheduledTasks: ScheduledTask[]
}

export function TimelineGap({ gap, scheduledTasks }: TimelineGapProps) {
  const start = new Date(gap.startTime)
  const end = new Date(gap.endTime)

  return (
    <div className="relative pl-4 border-l-2 border-dashed border-foreground/10 ml-2">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={12} className="text-accent" />
        <span className="text-xs font-semibold text-accent">
          {gap.durationMin} min free
        </span>
        <span className="text-xs text-muted">
          {format(start, 'h:mm')} – {format(end, 'h:mm a')}
        </span>
      </div>

      {scheduledTasks.length > 0 ? (
        <div className="space-y-1.5">
          {scheduledTasks.map((st) => {
            const color = categoryColors[st.goal.category] || '#8B6F5E'
            return (
              <div
                key={st.id}
                className="flex items-center gap-2.5 bg-card rounded-xl px-3 py-2 border border-card-border"
              >
                <div
                  className="w-1.5 h-8 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {st.microTask.title}
                  </p>
                  <p className="text-xs text-muted">
                    {st.goal.emoji} {st.goal.title} · {st.microTask.durationMin}m
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-muted-light rounded-xl px-3 py-2 text-xs text-muted italic">
          Open slot — add a goal to fill it
        </div>
      )}
    </div>
  )
}
