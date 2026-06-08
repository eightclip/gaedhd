'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X } from 'lucide-react'
import type { TaskWithGoal } from '@/lib/types'

interface OverwhelmResetProps {
  // The single lightest thing she could do — picked by the caller. May be null
  // if there's genuinely nothing small pending (then we just hold space to breathe).
  task: TaskWithGoal | null
  onCompleteTask: (taskId: string) => void
  onClose: () => void
}

// A grace-first panel for when she's flooded. Emotional dysregulation is core to
// adult ADHD (worse in women / RSD), and the standard move is to lower the demand
// to a single action and regulate the body first. So this hides the whole day,
// paces a few breaths, and offers exactly one tiny thing — or just rest. See
// RESEARCH.md (#3).
export function OverwhelmReset({ task, onCompleteTask, onClose }: OverwhelmResetProps) {
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const [done, setDone] = useState(false)

  // Pace breathing ~4s in / 4s out.
  useEffect(() => {
    const id = setInterval(() => setPhase(p => (p === 'in' ? 'out' : 'in')), 4000)
    return () => clearInterval(id)
  }, [])

  const handleDone = () => {
    if (!task) return
    onCompleteTask(task.microTask.id)
    setDone(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full text-muted hover:bg-muted-light transition-colors"
        aria-label="Close"
      >
        <X size={22} />
      </button>

      <h2 className="font-display text-3xl font-bold mb-2">
        Hey. <span className="italic font-normal">Breathe.</span>
      </h2>
      <p className="text-muted text-sm max-w-xs mb-8">
        You don&apos;t have to do all of it. That feeling is the ADHD, not you. Just be here a second.
      </p>

      {/* Breathing pacer */}
      <div className="relative h-44 w-44 mb-8 flex items-center justify-center">
        <motion.div
          className="absolute rounded-full"
          style={{ backgroundColor: 'var(--today-tint)' }}
          animate={{ scale: phase === 'in' ? 1.25 : 0.85 }}
          transition={{ duration: 4, ease: 'easeInOut' }}
        />
        <div className="absolute h-44 w-44 rounded-full" style={{ boxShadow: '0 0 0 2px var(--today-ink)', opacity: 0.25 }} />
        <span className="relative font-mono text-xs uppercase tracking-[0.25em] text-today-ink">
          {phase === 'in' ? 'breathe in' : 'and out'}
        </span>
      </div>

      {/* One tiny thing — or permission to rest */}
      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-3xl bg-success-soft p-6">
              <div className="text-3xl mb-1">💛</div>
              <p className="font-display text-xl font-bold">That counts. Really.</p>
              <button onClick={onClose} className="mt-4 text-sm font-semibold text-today-ink underline underline-offset-4">
                Back to my day
              </button>
            </motion.div>
          ) : task ? (
            <motion.div key="task" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="rounded-3xl p-6" style={{ backgroundColor: 'var(--today-tint)' }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted mb-2">just this one thing</p>
              <p className="font-display text-2xl font-bold text-today-ink leading-tight mb-5">{task.microTask.title}</p>
              <button
                onClick={handleDone}
                className="inline-flex items-center gap-2 rounded-full bg-today-ink text-white px-6 py-3 font-semibold hover:opacity-90 active:scale-95 transition-all"
              >
                <Check size={18} strokeWidth={3} /> Did it
              </button>
            </motion.div>
          ) : (
            <motion.div key="rest" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="rounded-3xl bg-muted-light p-6">
              <p className="font-display text-xl font-bold">Nothing tiny is waiting.</p>
              <p className="text-muted text-sm mt-1">So just rest. You&apos;ve earned it.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={onClose} className="mt-6 text-xs font-mono uppercase tracking-widest text-muted hover:text-foreground transition-colors">
          I&apos;m okay now
        </button>
      </div>
    </motion.div>
  )
}
