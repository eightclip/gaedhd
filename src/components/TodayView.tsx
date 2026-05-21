'use client'

import { format } from 'date-fns'
import { Flame } from 'lucide-react'
import { JustDoThisCard } from './JustDoThisCard'
import { TimelineEvent } from './TimelineEvent'
import { TimelineGap } from './TimelineGap'
import { todayEvents, scheduleGaps, scheduledTasks, dailyStats } from '@/lib/mock-data'
import type { TimelineItem } from '@/lib/types'

// Build interleaved timeline from events + gaps
function buildTimeline(): TimelineItem[] {
  const items: TimelineItem[] = []
  const allSlots = [
    ...todayEvents.map(e => ({ sortTime: e.startTime, type: 'event' as const, data: e })),
    ...scheduleGaps.map(g => ({
      sortTime: g.startTime,
      type: 'gap' as const,
      data: g,
      scheduledTasks: scheduledTasks.filter(st => st.gap.id === g.id),
    })),
  ].sort((a, b) => a.sortTime.localeCompare(b.sortTime))

  for (const slot of allSlots) {
    if (slot.type === 'event') {
      items.push({ type: 'event', data: slot.data })
    } else {
      items.push({ type: 'gap', data: slot.data, scheduledTasks: slot.scheduledTasks })
    }
  }
  return items
}

export function TodayView() {
  const now = new Date()
  const timeline = buildTimeline()

  // Get current gap's tasks for the "Just Do This" card
  const currentGapTasks = scheduledTasks.filter(st => {
    const gapEnd = new Date(st.gap.endTime)
    return gapEnd >= now
  })

  return (
    <div className="max-w-lg mx-auto px-5 pt-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-muted font-semibold">
            Good {now.getHours() < 12 ? 'Morning' : now.getHours() < 17 ? 'Afternoon' : 'Evening'} ✨
          </p>
          <div className="flex items-center gap-1.5 bg-accent-soft px-2.5 py-1 rounded-full">
            <Flame size={14} className="text-accent" />
            <span className="text-xs font-bold text-accent">{dailyStats.streak} day streak</span>
          </div>
        </div>

        {/* Big date — inspired by the 2044.png reference */}
        <h1 className="font-display text-5xl font-bold tracking-tight leading-none">
          {format(now, 'EEEE')}
        </h1>
        <div className="flex items-baseline gap-3 mt-1">
          <span className="font-display text-7xl font-extrabold leading-none">
            {format(now, 'd')}
          </span>
          <div className="flex flex-col">
            <span className="text-lg font-bold uppercase tracking-widest text-muted">
              {format(now, 'MMMM')}
            </span>
            <span className="text-sm text-muted">
              {format(now, 'h:mm a')}
            </span>
          </div>
        </div>
      </div>

      {/* Just Do This — the star of the show */}
      {currentGapTasks.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">
            Just do this
          </p>
          <JustDoThisCard tasks={currentGapTasks} />
        </section>
      )}

      {/* Today's Timeline */}
      <section className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">
          Today&apos;s flow
        </p>
        <div className="space-y-3">
          {timeline.map((item, i) => {
            if (item.type === 'event') {
              return <TimelineEvent key={item.data.id} event={item.data} />
            }
            return (
              <TimelineGap
                key={item.data.id}
                gap={item.data}
                scheduledTasks={item.scheduledTasks}
              />
            )
          })}
        </div>
      </section>

      {/* Daily summary */}
      <section className="bg-card border border-card-border rounded-2xl p-4 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{dailyStats.tasksCompleted}</p>
            <p className="text-xs text-muted">tasks done</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{dailyStats.totalMinutes}m</p>
            <p className="text-xs text-muted">productive</p>
          </div>
        </div>
      </section>
    </div>
  )
}
