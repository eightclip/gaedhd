'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Clock } from 'lucide-react'
import type { TaskWithGoal } from '@/lib/types'
import { categoryColors } from '@/lib/mock-data'

interface DecideHelperProps {
  candidates: TaskWithGoal[] // one next-action per goal
  onPick: (taskId: string) => void
  onClose: () => void
}

// Decision paralysis is a real ADHD symptom — more options trigger the same
// shutdown as high-stakes choices. This doesn't decide FOR her; it teaches a
// transferable framework she can reuse: timebox it (2 min), and pick the one
// that's ~60% right, because done beats perfect. See RESEARCH.md (#7).
export function DecideHelper({ candidates, onPick, onClose }: DecideHelperProps) {
  const [seconds, setSeconds] = useState(120)

  useEffect(() => {
    if (seconds <= 0) return
    const id = setInterval(() => setSeconds(s => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [seconds > 0])

  const mm = Math.floor(seconds / 60)
  const ss = (seconds % 60).toString().padStart(2, '0')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 px-4 pb-4 md:pb-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-md bg-card border border-card-border rounded-3xl p-5 shadow-xl"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-2xl font-bold">Pick one.</h2>
          <button onClick={onClose} className="text-muted p-1" aria-label="Close"><X size={18} /></button>
        </div>
        <p className="text-muted text-sm mb-4">
          You don&apos;t need the best one — just the one that&apos;s <span className="font-semibold text-foreground">60% right</span>. Done beats perfect.
        </p>

        <div className="flex items-center justify-center gap-2 mb-4 text-today-ink">
          <Clock size={16} />
          <span className="font-mono text-lg font-bold tabular-nums">{mm}:{ss}</span>
          <span className="text-xs text-muted">{seconds > 0 ? 'then just go with your gut' : "time's up — trust your gut"}</span>
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {candidates.map((c) => {
            const color = categoryColors[c.goal.category] || '#8B6F5E'
            return (
              <button
                key={c.id}
                onClick={() => onPick(c.id)}
                className="w-full text-left rounded-2xl border border-card-border p-3.5 hover:border-today-ink/40 active:scale-[0.99] transition-all flex items-center gap-3"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="min-w-0">
                  <span className="block text-sm font-bold truncate">{c.microTask.title}</span>
                  <span className="block text-[11px] text-muted truncate">{c.goal.title} · {c.microTask.durationMin} min</span>
                </span>
              </button>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
