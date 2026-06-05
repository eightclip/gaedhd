'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Illo } from './Illo'

interface BreakCardProps {
  label: string
  mins: number
  promptWater: boolean // snack/bathroom: she's up anyway, so nudge a refill
  onRefill: () => void
  onDone: () => void
}

// A short timed break that takes over the "Just do this" slot. Snack/bathroom also
// surface a big "Refill the Water!!!" prompt, since she's already up.
export function BreakCard({ label, mins, promptWater, onRefill, onDone }: BreakCardProps) {
  const [left, setLeft] = useState(mins * 60)
  const [refilled, setRefilled] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setLeft(l => (l > 0 ? l - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [])

  const mm = Math.floor(left / 60)
  const ss = (left % 60).toString().padStart(2, '0')
  const refill = () => { onRefill(); setRefilled(true) }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-[2rem] p-6 text-center"
      style={{ backgroundColor: 'var(--today-tint)' }}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-today-ink">{label} break</p>
      <p className="font-display text-6xl font-extrabold text-today-ink tabular-nums my-3">{mm}:{ss}</p>

      {promptWater && (
        refilled ? (
          <p className="font-display text-lg font-bold text-today-ink mb-4">Nice, water topped up</p>
        ) : (
          <motion.button
            onClick={refill}
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="w-full mb-4 rounded-2xl bg-accent text-white py-4 font-display text-2xl font-bold flex items-center justify-center gap-2"
          >
            <Illo src="/illustrations/water.png" className="h-7 w-auto brightness-0 invert" />
            Refill the Water!!!
          </motion.button>
        )
      )}

      <button onClick={onDone} className="w-full rounded-2xl bg-today-ink text-white py-3 font-bold active:scale-[0.98] transition-transform">
        Done, back to it
      </button>
    </motion.div>
  )
}
