import type { CalendarEvent, ScheduleGap, ScheduledTask, TaskWithGoal, GapSize, Goal, MicroTask } from './types'

// The one live step per goal: the lowest-sequence pending micro-task. This is the
// next-action model — she only ever sees the current step of a project, and it stays
// (repeats day to day) until she completes it, then the next step surfaces.
export function currentNextActions(goals: Goal[], microTasks: MicroTask[]): TaskWithGoal[] {
  return goals
    .map((goal): TaskWithGoal | null => {
      const next = microTasks
        .filter(t => t.goalId === goal.id && t.status === 'pending')
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)[0]
      return next ? { id: next.id, microTask: next, goal } : null
    })
    .filter((x): x is TaskWithGoal => x !== null)
    .sort((a, b) => b.goal.priority - a.goal.priority)
}

function classify(min: number): GapSize {
  if (min < 15) return 'micro'
  if (min < 30) return 'small'
  if (min < 60) return 'medium'
  return 'large'
}

// Free windows between calendar events, within the waking day.
export function computeGaps(
  events: CalendarEvent[],
  dayStart: Date,
  dayEnd: Date,
  minGapMin = 5
): ScheduleGap[] {
  const sorted = [...events].sort((a, b) => a.startTime.localeCompare(b.startTime))

  // Merge overlapping/adjacent events into busy blocks.
  const busy: { start: number; end: number }[] = []
  for (const e of sorted) {
    const s = new Date(e.startTime).getTime()
    const en = new Date(e.endTime).getTime()
    const last = busy[busy.length - 1]
    if (last && s <= last.end) {
      last.end = Math.max(last.end, en)
    } else {
      busy.push({ start: s, end: en })
    }
  }

  const gaps: ScheduleGap[] = []
  const dateStr = dayStart.toISOString().slice(0, 10)
  const endMs = dayEnd.getTime()
  let cursor = dayStart.getTime()

  const pushGap = (start: number, end: number) => {
    const durationMin = Math.round((end - start) / 60000)
    if (durationMin < minGapMin) return
    gaps.push({
      id: `gap-${start}`,
      date: dateStr,
      startTime: new Date(start).toISOString(),
      endTime: new Date(end).toISOString(),
      durationMin,
      gapSize: classify(durationMin),
    })
  }

  for (const b of busy) {
    if (b.start > cursor) pushGap(cursor, Math.min(b.start, endMs))
    cursor = Math.max(cursor, b.end)
    if (cursor >= endMs) break
  }
  if (cursor < endMs) pushGap(cursor, endMs)

  return gaps
}

// Greedily fit pending tasks (already sorted by priority) into future gaps.
export function slotTasks(
  gaps: ScheduleGap[],
  pending: TaskWithGoal[],
  now: Date,
  bufferMin = 0
): ScheduledTask[] {
  const scheduled: ScheduledTask[] = []
  const queue = [...pending]
  const nowMs = now.getTime()

  for (const gap of gaps) {
    const gapEnd = new Date(gap.endTime).getTime()
    if (gapEnd <= nowMs) continue // gap already passed
    let cursor = Math.max(new Date(gap.startTime).getTime(), nowMs)

    while (queue.length) {
      const next = queue[0]
      const durMs = next.microTask.durationMin * 60000
      if (cursor + durMs > gapEnd) break // doesn't fit this gap
      scheduled.push({
        id: `st-${next.microTask.id}`,
        microTask: next.microTask,
        goal: next.goal,
        gap,
        scheduledStart: new Date(cursor).toISOString(),
        scheduledEnd: new Date(cursor + durMs).toISOString(),
        status: 'pending',
      })
      cursor += durMs + bufferMin * 60000
      queue.shift()
    }
  }

  return scheduled
}
