'use client'

import { motion } from 'framer-motion'
import { RotateCw, Undo2 } from 'lucide-react'
import { TINTS } from '@/lib/theme'
import { Illo } from './Illo'

const GOAL = 4 // Stanley cups a day
const REMIND_AFTER_MS = 2 * 3_600_000 // nudge if it's been 2h since the last cup

interface WaterTrackerProps {
  log: string[] // ritualLog['water'] completion timestamps
  now: Date
  onRefill: () => void
  onUndo: () => void
}

// Compact hydration widget: 4 Stanley cups, fill-up progress, Refill to log one,
// a nudge when it's been too long, and a win at 4. Lives atop the goals rail.
export function WaterTracker({ log, now, onRefill, onUndo }: WaterTrackerProps) {
  const sky = TINTS.sky
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const count = log.map(t => new Date(t)).filter(d => d.getTime() >= startOfDay).length
  const lastAt = log.map(t => new Date(t)).filter(d => d.getTime() >= startOfDay).sort((a, b) => a.getTime() - b.getTime()).pop() ?? null
  const won = count >= GOAL
  const pct = Math.min(1, count / GOAL)
  const inWindow = now.getHours() >= 7 && now.getHours() < 21
  const overdue = !won && inWindow && (lastAt ? now.getTime() - lastAt.getTime() > REMIND_AFTER_MS : now.getHours() >= 9)

  return (
    <div
      className="rounded-[1.5rem] p-4"
      style={{ backgroundColor: sky.tint, boxShadow: overdue ? `0 0 0 2px ${sky.ink}` : undefined }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Illo src="/illustrations/water.png" className="h-6 w-auto" />
          <span className="font-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: sky.ink }}>Water</span>
        </div>
        <span className="font-mono text-sm font-bold" style={{ color: sky.ink }}>{count}/{GOAL}</span>
      </div>

      <div className="h-2 rounded-full bg-white/60 overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: sky.ink }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 26 }}
        />
      </div>

      {won ? (
        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-bold" style={{ color: sky.ink }}>Hydration win 💧</span>
          <button onClick={onUndo} className="p-1 text-muted hover:text-foreground transition-colors" aria-label="Undo"><Undo2 size={14} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={onRefill}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold text-white active:scale-[0.98] transition-transform"
            style={{ backgroundColor: sky.ink }}
          >
            <RotateCw size={14} /> Refill
          </button>
          {count > 0 && (
            <button onClick={onUndo} className="p-2 rounded-xl text-muted hover:bg-white/50 transition-colors" aria-label="Undo"><Undo2 size={16} /></button>
          )}
        </div>
      )}

      {overdue && (
        <p className="font-mono text-[10px] mt-2 text-center" style={{ color: sky.ink }}>been a while, drink up</p>
      )}
    </div>
  )
}
