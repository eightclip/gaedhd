'use client'

import { Dumbbell, X } from 'lucide-react'
import { GYM_SLOTS, gymConflicts } from '@/lib/schedule'
import type { CalendarEvent, FixedBlock } from '@/lib/types'

interface GymPickerProps {
  events: CalendarEvent[] // meetings + other anchors to check against
  now: Date
  currentGym: FixedBlock | null
  onPick: (hour: number, min: number) => void
  onClear: () => void
}

// Pick today's gym slot. A meeting on the gym hour is a hard conflict (disabled);
// a meeting only during the drive is fine, flagged "call in transit".
export function GymPicker({ events, now, currentGym, onPick, onClear }: GymPickerProps) {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-3xl font-bold tracking-tight">Gym <span className="italic font-normal">today</span></h2>
        {currentGym && (
          <button onClick={onClear} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent transition-colors">
            <X size={13} /> clear
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {GYM_SLOTS.map(s => {
          const picked = !!currentGym && currentGym.startHour === s.hour && currentGym.startMin === s.min
          const c = gymConflicts(s.hour, s.min, events, now)
          const disabled = c.coreConflict && !picked
          return (
            <button
              key={s.label}
              disabled={disabled}
              onClick={() => onPick(s.hour, s.min)}
              className={`rounded-2xl p-4 text-left border transition-all ${
                picked ? 'bg-[#7B9E6B] text-white border-transparent'
                : disabled ? 'bg-muted-light border-transparent opacity-50 cursor-not-allowed'
                : 'bg-card border-card-border hover:border-[#7B9E6B] active:scale-[0.98]'
              }`}
            >
              <div className="flex items-center gap-1.5 font-display text-lg font-bold">
                <Dumbbell size={16} /> {s.label}
              </div>
              {c.coreConflict ? (
                <p className="font-mono text-[10px] mt-1 opacity-80 truncate">meeting: {c.titles[0]}</p>
              ) : c.travelConflict ? (
                <p className={`font-mono text-[10px] mt-1 ${picked ? 'text-white/90' : 'text-accent'}`}>call in transit ok</p>
              ) : (
                <p className={`font-mono text-[10px] mt-1 ${picked ? 'text-white/80' : 'text-muted'}`}>clear · +30 travel</p>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
