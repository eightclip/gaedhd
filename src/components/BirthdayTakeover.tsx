'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Illo } from './Illo'
import { SPARKLES, pickDaily } from '@/lib/illustrations'
import { NOTE_FROM_JOHN, NOTE_SIGNATURE } from '@/lib/letter'

// Falling confetti for the takeover — richer and longer than the per-task
// ConfettiPop. Deterministic spread so there's no hydration flicker.
const COLORS = ['#C85D3E', '#7B9E6B', '#D4845E', '#9B7EC8', '#6BA3BE', '#FFD700', '#C87E9E']
const PIECES = Array.from({ length: 70 }, (_, i) => ({
  id: i,
  color: COLORS[i % COLORS.length],
  left: (i * 53) % 100,
  delay: (i % 14) * 0.18,
  dur: 2.6 + (i % 6) * 0.45,
  size: 6 + (i % 4) * 3,
  drift: ((i % 7) - 3) * 22,
  spin: (i % 2 ? 1 : -1) * (240 + (i % 4) * 120),
}))

// The one-a-year moment: first open on her birthday. A warm full-screen welcome
// with confetti and John's note, then it melts into the normal Today view.
export function BirthdayTakeover({ name, onDismiss }: { name?: string; onDismiss: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        key="birthday-takeover"
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-6 py-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        style={{ background: 'rgba(26,23,20,0.55)', backdropFilter: 'blur(5px)' }}
      >
        {/* confetti rain, behind the card */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {PIECES.map(p => (
            <motion.div
              key={p.id}
              className="absolute top-0 rounded-[2px]"
              style={{ left: `${p.left}%`, width: p.size, height: p.size * 1.7, backgroundColor: p.color }}
              initial={{ y: '-10vh', opacity: 0, rotate: 0 }}
              animate={{ y: '110vh', x: p.drift, rotate: p.spin, opacity: [0, 1, 1, 0.7] }}
              transition={{ duration: p.dur, delay: p.delay, ease: 'easeIn', repeat: Infinity, repeatDelay: 0.3 }}
            />
          ))}
        </div>

        <motion.div
          className="relative z-10 w-full max-w-md my-auto bg-card rounded-[2rem] p-8 text-center shadow-2xl"
          initial={{ scale: 0.85, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring', damping: 18, stiffness: 200 }}
        >
          <Illo src={pickDaily(SPARKLES)} className="h-16 w-auto mx-auto mb-4" />
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted mb-2">June 6</p>
          <h1 className="font-display text-5xl font-extrabold tracking-tight leading-[0.95] text-today-ink">
            Happy <span className="italic font-normal">birthday</span>{name ? `, ${name}` : ''}
          </h1>

          <div className="mt-6 space-y-3 text-left">
            {NOTE_FROM_JOHN.map((para, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-foreground/90">{para}</p>
            ))}
          </div>
          <p className="mt-5 font-display text-lg italic text-today-ink">— {NOTE_SIGNATURE}</p>

          <button
            onClick={onDismiss}
            className="mt-7 w-full bg-today-ink text-white rounded-full py-4 font-display font-bold text-lg hover:opacity-90 active:scale-[0.98] transition-transform"
          >
            Open my day
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
