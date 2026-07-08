'use client'

import { format } from 'date-fns'
import { Dumbbell, X } from 'lucide-react'
import { GYM_SLOTS, GYM_DURATION_MIN, gymConflicts } from '@/lib/schedule'
import type { CalendarEvent, FixedBlock } from '@/lib/types'

interface GymPickerProps {
  events: CalendarEvent[] // meetings + other anchors to check against
  now: Date
  currentGym: FixedBlock | null
  onPick: (hour: number, min: number) => void
  onClear: () => void
}

// Pick today's gym slot — one compact row, not a grid of cards. Slots already
// gone for the day drop off; once every slot has passed the whole thing
// disappears instead of haunting the evening scroll. A meeting on the gym hour
// is a hard conflict (disabled); one only during the drive is fine ("call ok").
export function GymPicker({ events, now, currentGym, onPick, onClear }: GymPickerProps) {
  const slotStart = (hour: number, min: number) => {
    const d = new Date(now)
    d.setHours(hour, min, 0, 0)
    return d
  }

  // Picked: a single settled line until the session is over, then nothing.
  if (currentGym) {
    const start = slotStart(currentGym.startHour, currentGym.startMin)
    const end = new Date(start.getTime() + GYM_DURATION_MIN * 60_000)
    if (end.getTime() <= now.getTime()) return null
    return (
      <section className="mb-10">
        <div className="flex items-center justify-between rounded-2xl bg-[#E8F0E4] px-4 py-3">
          <p className="flex items-center gap-2 font-display text-base font-bold text-[#7B9E6B]">
            <Dumbbell size={16} /> Gym at {format(start, 'h:mm a')} ✓
          </p>
          <button onClick={onClear} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent transition-colors">
            <X size={13} /> change
          </button>
        </div>
      </section>
    )
  }

  const open = GYM_SLOTS.filter(s => slotStart(s.hour, s.min).getTime() > now.getTime())
  if (open.length === 0) return null

  const slots = open.map(s => ({ ...s, c: gymConflicts(s.hour, s.min, events, now) }))
  const anyTravel = slots.some(s => !s.c.coreConflict && s.c.travelConflict)

  return (
    <section className="mb-10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-display text-base font-bold mr-1">
          <Dumbbell size={16} className="text-today-ink" /> Gym today?
        </span>
        {slots.map(s => (
          <button
            key={s.label}
            disabled={s.c.coreConflict}
            onClick={() => onPick(s.hour, s.min)}
            title={s.c.coreConflict ? `meeting: ${s.c.titles[0]}` : s.c.travelConflict ? 'call in transit ok' : undefined}
            className={`rounded-full px-3.5 py-2 text-[13px] font-bold font-mono border transition-all ${
              s.c.coreConflict
                ? 'bg-muted-light border-transparent text-muted/50 line-through cursor-not-allowed'
                : 'bg-card border-card-border hover:border-[#7B9E6B] active:scale-95'
            }`}
          >
            {s.label}{!s.c.coreConflict && s.c.travelConflict ? '*' : ''}
          </button>
        ))}
      </div>
      {anyTravel && (
        <p className="font-mono text-[10px] text-muted mt-2">* a call lands during the drive — doable in transit</p>
      )}
    </section>
  )
}
