'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import type { Ritual } from '@/lib/rituals'
import { rankRituals } from '@/lib/rituals'
import { TINTS } from '@/lib/theme'
import { RITUAL_ILLO } from '@/lib/illustrations'
import { Illo } from './Illo'

interface RhythmStripProps {
  rituals: Ritual[]
  ritualLog: Record<string, string[]>
  now: Date
  onComplete: (id: string) => void
  onUndo: (id: string) => void
  hidePrivate?: boolean
}

// Rhythm as a grid of solid color-blocked tiles, each ritual in its own tint.
// What's done shrinks to quiet pills underneath. Editorial, not a list. See DESIGN.md.
export function RhythmStrip({ rituals, ritualLog, now, onComplete, onUndo, hidePrivate }: RhythmStripProps) {
  // Water has its own dedicated tracker, so keep it out of the generic grid.
  const visible = (hidePrivate ? rituals.filter(r => !r.private) : rituals).filter(r => r.id !== 'water')
  const ranked = rankRituals(visible, ritualLog, now)
  const due = ranked.filter(s => s.due)
  const done = ranked.filter(s => !s.due && s.completedToday > 0)

  if (due.length === 0 && done.length === 0) return null

  return (
    <section className="mb-10">
      <h2 className="font-display text-3xl font-bold tracking-tight mb-4">
        Your <span className="italic font-normal">rhythm</span>
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <AnimatePresence initial={false}>
          {due.map(s => {
            const { tint, ink } = TINTS[s.ritual.tint]
            const times = s.ritual.cadence.kind === 'timesPerDay' ? s.ritual.cadence.times : 0
            return (
              <motion.button
                key={s.ritual.id}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                onClick={() => onComplete(s.ritual.id)}
                className="relative rounded-[1.75rem] p-4 pt-5 text-left min-h-[8.5rem] flex flex-col justify-between active:scale-[0.97] transition-transform"
                style={{ backgroundColor: tint }}
              >
                <div className="flex items-start justify-between">
                  {RITUAL_ILLO[s.ritual.id]
                    ? <Illo src={RITUAL_ILLO[s.ritual.id]} className="h-12 w-auto" />
                    : <span className="text-4xl leading-none">{s.ritual.emoji}</span>}
                  {times > 1 && (
                    <span className="font-mono text-xs font-bold" style={{ color: ink }}>
                      {s.completedToday}/{times}
                    </span>
                  )}
                </div>
                <p className="font-display text-xl font-bold leading-[1.05]" style={{ color: ink }}>
                  {s.ritual.title}
                </p>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>

      {done.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {done.map(s => (
            <button
              key={s.ritual.id}
              onClick={() => onUndo(s.ritual.id)}
              className="flex items-center gap-1.5 rounded-full bg-card border border-card-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
            >
              <Check size={12} className="text-success" />
              <span className="line-through">{s.ritual.title}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
