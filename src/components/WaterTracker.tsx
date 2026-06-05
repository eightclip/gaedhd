'use client'

import { motion } from 'framer-motion'
import { RotateCw, Undo2 } from 'lucide-react'
import { TINTS } from '@/lib/theme'
import { Illo } from './Illo'
import { SPARKLES, pickDaily } from '@/lib/illustrations'

const GOAL = 4 // Stanley cups a day
const REMIND_AFTER_MS = 2 * 3_600_000 // nudge if it's been 2h since the last cup

interface WaterTrackerProps {
  log: string[] // ritualLog['water'] completion timestamps
  now: Date
  onRefill: () => void
  onUndo: () => void
}

// Dedicated hydration tracker: 4 Stanley cups, fill-up progress, Refill to log one,
// a nudge when it's been too long, and a win at 4.
export function WaterTracker({ log, now, onRefill, onUndo }: WaterTrackerProps) {
  const sky = TINTS.sky
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const today = log.map(t => new Date(t)).filter(d => d.getTime() >= startOfDay).sort((a, b) => a.getTime() - b.getTime())
  const count = today.length
  const lastAt = today[today.length - 1] ?? null
  const won = count >= GOAL
  const pct = Math.min(1, count / GOAL)

  const inWindow = now.getHours() >= 7 && now.getHours() < 21
  const overdue = !won && inWindow && (lastAt ? now.getTime() - lastAt.getTime() > REMIND_AFTER_MS : now.getHours() >= 9)

  return (
    <section className="mb-10">
      <div
        className="rounded-[1.75rem] p-5 transition-shadow"
        style={{ backgroundColor: sky.tint, boxShadow: overdue ? `0 0 0 2px ${sky.ink}` : undefined }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-bold tracking-tight" style={{ color: sky.ink }}>
            Water
          </h2>
          <span className="font-mono text-sm font-bold" style={{ color: sky.ink }}>
            {count} / {GOAL} cups
          </span>
        </div>

        {/* The four cups, filling as she goes */}
        <div className="flex items-end justify-between gap-2 mb-4">
          {Array.from({ length: GOAL }).map((_, i) => (
            <div key={i} className="flex-1 flex justify-center">
              <Illo
                src="/illustrations/water.png"
                className={`h-12 w-auto transition-opacity duration-300 ${i < count ? 'opacity-100' : 'opacity-20'}`}
              />
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-2.5 rounded-full bg-white/60 overflow-hidden mb-4">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: sky.ink }}
            animate={{ width: `${pct * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 26 }}
          />
        </div>

        {won ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Illo src={pickDaily(SPARKLES)} className="h-8 w-auto" />
              <p className="font-display text-lg font-bold" style={{ color: sky.ink }}>Hydration win</p>
            </div>
            <button onClick={onUndo} className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors">
              <Undo2 size={14} /> undo
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={onRefill}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 font-bold text-white active:scale-[0.98] transition-transform"
              style={{ backgroundColor: sky.ink }}
            >
              <RotateCw size={18} /> Refill
            </button>
            {count > 0 && (
              <button onClick={onUndo} className="p-3 rounded-2xl text-muted hover:bg-white/50 transition-colors" aria-label="Undo">
                <Undo2 size={18} />
              </button>
            )}
          </div>
        )}

        {overdue && (
          <p className="font-mono text-[11px] mt-3 text-center" style={{ color: sky.ink }}>
            it&apos;s been a while, drink up and refill
          </p>
        )}
      </div>
    </section>
  )
}
