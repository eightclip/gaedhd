'use client'

import { useState } from 'react'
import { Heart, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { NOTE_FROM_JOHN, NOTE_SIGNATURE } from '@/lib/letter'

// The note from John, re-findable any time in Settings. Same words as the
// birthday takeover, so she can come back to it whenever she wants.
export function NoteFromJohn() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--today-tint)' }}
      >
        <Heart size={18} className="text-today-ink shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-display text-base font-bold text-today-ink">A note from {NOTE_SIGNATURE}</p>
          <p className="text-[11px] text-muted">Why this exists. Open any time.</p>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto px-6 py-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(26,23,20,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="relative z-10 w-full max-w-md my-auto bg-card rounded-[2rem] p-8 shadow-2xl"
              initial={{ scale: 0.9, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 220 }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute right-5 top-5 p-1 text-muted hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>

              <Heart size={22} className="text-today-ink mb-4" />
              <div className="space-y-3 text-left">
                {NOTE_FROM_JOHN.map((para, i) => (
                  <p key={i} className="text-[15px] leading-relaxed text-foreground/90">{para}</p>
                ))}
              </div>
              <p className="mt-5 font-display text-lg italic text-today-ink">— {NOTE_SIGNATURE}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
