'use client'

import { motion } from 'framer-motion'
import type { Mood } from '@/lib/store'

interface MoodCheckinProps {
  todayMood?: Mood
  onPick: (mood: Mood) => void
}

const OPTIONS: { mood: Mood; emoji: string; label: string }[] = [
  { mood: 'rough', emoji: '😔', label: 'rough' },
  { mood: 'ok', emoji: '😌', label: 'ok' },
  { mood: 'good', emoji: '✨', label: 'good' },
]

// Optional, evening-only, opt-in. Builds emotional self-awareness with the lowest
// possible friction — three taps, no journaling. See RESEARCH.md (#5).
export function MoodCheckin({ todayMood, onPick }: MoodCheckinProps) {
  if (todayMood) {
    const chosen = OPTIONS.find(o => o.mood === todayMood)
    return (
      <div className="rounded-[1.5rem] p-5 bg-muted-light mb-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">today felt</p>
        <p className="font-display text-2xl font-bold mt-1">{chosen?.emoji} {chosen?.label}</p>
        <p className="text-muted text-xs mt-1">Noted. Rest up. 💛</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.5rem] p-5 mb-10"
      style={{ backgroundColor: 'var(--today-tint)' }}
    >
      <p className="font-display text-lg font-bold text-today-ink text-center">How did today feel?</p>
      <div className="grid grid-cols-3 gap-3 mt-4">
        {OPTIONS.map(o => (
          <button
            key={o.mood}
            onClick={() => onPick(o.mood)}
            className="rounded-2xl bg-card/70 border border-card-border py-4 hover:border-today-ink/40 active:scale-[0.97] transition-all flex flex-col items-center gap-1"
          >
            <span className="text-2xl">{o.emoji}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{o.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
