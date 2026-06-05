import type { CalendarEvent, ScheduleGap, ScheduledTask, TaskWithGoal, GapSize, Goal, MicroTask, FixedBlock } from './types'

// Gym is one hour, with travel before and after. These are her slots.
export const GYM_SLOTS = [
  { label: '5:45 AM', hour: 5, min: 45 },
  { label: '7:00 AM', hour: 7, min: 0 },
  { label: '12:00 PM', hour: 12, min: 0 },
  { label: '4:30 PM', hour: 16, min: 30 },
  { label: '6:00 PM', hour: 18, min: 0 },
]
export const GYM_DURATION_MIN = 60
export const GYM_TRAVEL_MIN = 30

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Today's fixed blocks as calendar events (core + travel) to merge into the day.
export function materializeFixedBlocks(blocks: FixedBlock[], date: Date): CalendarEvent[] {
  const out: CalendarEvent[] = []
  const dayKey = ymd(date)
  const weekday = date.getDay()
  for (const b of blocks) {
    const active = b.date ? b.date === dayKey : b.days.includes(weekday)
    if (!active) continue
    const start = new Date(date); start.setHours(b.startHour, b.startMin, 0, 0)
    const end = new Date(start.getTime() + b.durationMin * 60000)
    out.push({ id: `${b.id}-core`, calendarId: 'fixed', title: `${b.emoji} ${b.title}`, startTime: start.toISOString(), endTime: end.toISOString(), color: b.color })
    if (b.travelMin > 0) {
      const tb = new Date(start.getTime() - b.travelMin * 60000)
      const ta = new Date(end.getTime() + b.travelMin * 60000)
      out.push({ id: `${b.id}-travel-before`, calendarId: 'travel', title: '🚗 Travel', startTime: tb.toISOString(), endTime: start.toISOString(), color: b.color })
      out.push({ id: `${b.id}-travel-after`, calendarId: 'travel', title: '🚗 Travel', startTime: end.toISOString(), endTime: ta.toISOString(), color: b.color })
    }
  }
  return out
}

export interface GymConflict { coreConflict: boolean; travelConflict: boolean; titles: string[] }

// Does a gym slot clash? Core overlap is a real conflict; an overlap only in the
// travel window is fine (she can take the call in transit) but worth flagging.
export function gymConflicts(hour: number, min: number, events: CalendarEvent[], date: Date): GymConflict {
  const start = new Date(date); start.setHours(hour, min, 0, 0)
  const end = new Date(start.getTime() + GYM_DURATION_MIN * 60000)
  const tStart = new Date(start.getTime() - GYM_TRAVEL_MIN * 60000)
  const tEnd = new Date(end.getTime() + GYM_TRAVEL_MIN * 60000)
  let coreConflict = false, travelConflict = false
  const titles: string[] = []
  const overlaps = (es: number, ee: number, a: number, b: number) => es < b && ee > a
  for (const e of events) {
    const es = new Date(e.startTime).getTime(), ee = new Date(e.endTime).getTime()
    if (overlaps(es, ee, start.getTime(), end.getTime())) { coreConflict = true; titles.push(e.title) }
    else if (overlaps(es, ee, tStart.getTime(), start.getTime()) || overlaps(es, ee, end.getTime(), tEnd.getTime())) { travelConflict = true; titles.push(e.title) }
  }
  return { coreConflict, travelConflict, titles: [...new Set(titles)] }
}

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
