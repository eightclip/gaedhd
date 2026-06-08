'use client'

import { motion } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'
import type { Ritual } from '@/lib/rituals'
import { TINTS } from '@/lib/theme'
import { RITUAL_ILLO } from '@/lib/illustrations'
import { RITUAL_ICON } from '@/lib/icons'
import { Illo } from './Illo'

interface RitualFocusCardProps {
  ritual: Ritual
  onComplete: () => void
  onLater: () => void
}

// A due time-anchored ritual (meds, wrap-up, kid time…) promoted into the
// single-focus "Just do this" slot, so the rhythm of her day lands in the same
// one-thing-at-a-time flow as her tasks — not just a side grid. Done logs it;
// Later steps past it (it stays in the rhythm strip, no guilt). The high-frequency
// ambient rituals (water, move, protein) stay in the strip.
export function RitualFocusCard({ ritual, onComplete, onLater }: RitualFocusCardProps) {
  const { ink } = TINTS[ritual.tint]
  const Fallback = RITUAL_ICON[ritual.id] || Sparkles

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0, y: 16 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative overflow-hidden rounded-3xl"
      style={{ backgroundColor: ink }}
    >
      <div className="p-6 pt-7 text-white min-h-[220px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold opacity-80 uppercase tracking-wider">Your rhythm</span>
          {RITUAL_ILLO[ritual.id]
            ? <Illo src={RITUAL_ILLO[ritual.id]} className="h-12 w-auto" />
            : <Fallback size={32} className="opacity-90" />}
        </div>

        <h2 className="font-display text-3xl font-bold leading-tight mb-2">{ritual.title}</h2>
        <p className="text-white/85 text-sm leading-relaxed flex-1">{ritual.nudge}</p>

        <div className="flex items-center gap-2.5 mt-5">
          <button
            onClick={onComplete}
            className="inline-flex items-center gap-2 rounded-full bg-white text-foreground px-6 py-3 font-bold hover:opacity-90 active:scale-95 transition-all"
          >
            <Check size={18} strokeWidth={3} /> Done
          </button>
          <button
            onClick={onLater}
            className="rounded-full bg-white/15 text-white px-5 py-3 font-semibold hover:bg-white/25 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </motion.div>
  )
}
