'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { format } from 'date-fns'
import type { Ritual } from '@/lib/rituals'
import { rankRituals } from '@/lib/rituals'
import { TINTS } from '@/lib/theme'
import { RITUAL_ILLO } from '@/lib/illustrations'
import { Illo } from './Illo'

// A ritual's hand-drawn icon, or its emoji if there's no illustration for it.
function ritualIcon(id: string, emoji: string, h = 'h-7') {
  return RITUAL_ILLO[id]
    ? <Illo src={RITUAL_ILLO[id]} className={`${h} w-7 object-contain shrink-0`} />
    : <span className="text-xl w-7 text-center shrink-0">{emoji}</span>
}

interface RhythmStripProps {
  rituals: Ritual[]
  ritualLog: Record<string, string[]>
  now: Date
  onComplete: (id: string) => void
  onUndo: (id: string) => void
  hidePrivate?: boolean // shared surfaces (the office TV) never show private rituals
}

// The calm rhythm row: what's due right now, plus what she's already done today.
// Tap a due ritual to check it off; tap a done one to undo a mis-tap. Quiet by design.
export function RhythmStrip({ rituals, ritualLog, now, onComplete, onUndo, hidePrivate }: RhythmStripProps) {
  const visible = hidePrivate ? rituals.filter(r => !r.private) : rituals
  const ranked = rankRituals(visible, ritualLog, now)
  const due = ranked.filter(s => s.due)
  const doneToday = ranked.filter(s => !s.due && s.completedToday > 0)

  if (due.length === 0 && doneToday.length === 0) return null

  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Rhythm</p>
      <div className="bg-card border border-card-border rounded-3xl divide-y divide-card-border overflow-hidden">
        <AnimatePresence initial={false}>
          {due.map(s => {
            const ink = TINTS[s.ritual.tint].ink
            const times = s.ritual.cadence.kind === 'timesPerDay' ? s.ritual.cadence.times : 0
            return (
              <motion.button
                key={s.ritual.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onClick={() => onComplete(s.ritual.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted-light transition-colors"
              >
                {ritualIcon(s.ritual.id, s.ritual.emoji)}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate">{s.ritual.title}</span>
                  <span className="block text-xs text-muted truncate">{s.ritual.nudge}</span>
                </span>
                {times > 1 && (
                  <span className="text-[11px] font-mono text-muted shrink-0">
                    {s.completedToday}/{times}
                  </span>
                )}
                <span
                  className="shrink-0 w-7 h-7 rounded-full border-2"
                  style={{ borderColor: ink }}
                  aria-hidden
                />
              </motion.button>
            )
          })}
        </AnimatePresence>

        {doneToday.map(s => (
          <button
            key={s.ritual.id}
            onClick={() => onUndo(s.ritual.id)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left opacity-50 hover:opacity-75 transition-opacity"
          >
            {ritualIcon(s.ritual.id, s.ritual.emoji, 'h-6')}
            <span className="flex-1 text-sm font-medium line-through truncate">{s.ritual.title}</span>
            {s.nextDueAt && (
              <span className="text-[11px] font-mono text-muted shrink-0">
                next {format(s.nextDueAt, 'h:mm')}
              </span>
            )}
            <span className="shrink-0 w-6 h-6 rounded-full bg-success flex items-center justify-center text-white">
              <Check size={14} strokeWidth={3} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
