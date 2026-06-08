'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Heart } from 'lucide-react'

interface FocusSessionProps {
  onClose: () => void
}

const DURATIONS = [15, 25, 50]

// Body doubling: a distraction-free co-working timer she can start, with a
// one-tap ping to John to work alongside her. Lowers the activation energy to
// begin and sustain focus (see RESEARCH.md #11).
export function FocusSession({ onClose }: FocusSessionProps) {
  const [minutes, setMinutes] = useState(25)
  const [running, setRunning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [johnState, setJohnState] = useState<'idle' | 'pinging' | 'pinged' | 'unavailable'>('idle')

  useEffect(() => {
    if (!running || secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft(s => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [running, secondsLeft > 0])

  const start = () => {
    setSecondsLeft(minutes * 60)
    setRunning(true)
  }

  const askJohn = async () => {
    setJohnState('pinging')
    try {
      const res = await fetch('/api/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      })
      const data = await res.json()
      setJohnState(data.pinged ? 'pinged' : 'unavailable')
    } catch {
      setJohnState('unavailable')
    }
  }

  const mm = Math.floor(secondsLeft / 60)
  const ss = (secondsLeft % 60).toString().padStart(2, '0')
  const done = running && secondsLeft === 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full text-muted hover:bg-muted-light transition-colors" aria-label="Close">
        <X size={22} />
      </button>

      {!running ? (
        <>
          <h2 className="font-display text-3xl font-bold mb-1">Focus <span className="italic font-normal">together</span></h2>
          <p className="text-muted text-sm max-w-xs mb-8">Pick a length, then work alongside someone. Showing up next to another person makes starting so much easier.</p>
          <div className="flex gap-3 mb-8">
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => setMinutes(d)}
                className={`rounded-2xl px-5 py-4 transition-colors border ${minutes === d ? 'bg-today-ink text-white border-today-ink' : 'bg-muted-light border-transparent hover:bg-foreground/10'}`}
              >
                <span className="font-display text-2xl font-bold">{d}</span>
                <span className="block font-mono text-[10px] uppercase tracking-widest mt-0.5 opacity-70">min</span>
              </button>
            ))}
          </div>
          <button onClick={start} className="rounded-full bg-today-ink text-white px-8 py-3.5 font-bold hover:opacity-90 active:scale-95 transition-all">
            Start focusing
          </button>
        </>
      ) : (
        <>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted mb-4">{done ? 'session complete' : 'focusing'}</p>
          <div className="font-display text-[5rem] md:text-[7rem] font-extrabold leading-none tabular-nums text-today-ink mb-6">
            {done ? '🎉' : `${mm}:${ss}`}
          </div>

          {done ? (
            <button onClick={onClose} className="rounded-full bg-today-ink text-white px-8 py-3.5 font-bold hover:opacity-90 transition-all">
              Nice work — done
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {johnState === 'pinged' ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-today-ink"><Heart size={15} className="fill-current" /> John&apos;s been pinged 💛</p>
              ) : johnState === 'unavailable' ? (
                <p className="text-sm text-muted">Couldn&apos;t reach John right now — keep going, you&apos;ve got this.</p>
              ) : (
                <button
                  onClick={askJohn}
                  disabled={johnState === 'pinging'}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted-light px-5 py-2.5 text-sm font-semibold hover:bg-foreground/10 transition-colors disabled:opacity-50"
                >
                  <Heart size={15} /> {johnState === 'pinging' ? 'asking…' : 'Ask John to join'}
                </button>
              )}
              <button onClick={onClose} className="text-xs font-mono uppercase tracking-widest text-muted hover:text-foreground transition-colors">
                end session
              </button>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
