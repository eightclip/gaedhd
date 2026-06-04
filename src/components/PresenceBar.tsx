'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Check } from 'lucide-react'
import type { TaskWithGoal } from '@/lib/types'
import type { Ritual } from '@/lib/rituals'
import { rankRituals } from '@/lib/rituals'

const ROOMS: { key: string; label: string; emoji: string }[] = [
  { key: 'studio', label: 'Studio', emoji: '🎨' },
  { key: 'office', label: 'Office', emoji: '💻' },
  { key: 'kitchen', label: 'Kitchen', emoji: '🍳' },
  { key: 'bedroom', label: 'Bedroom', emoji: '🛏️' },
  { key: 'backyard', label: 'Yard', emoji: '🌿' },
  { key: 'gym', label: 'Gym', emoji: '💪' },
  { key: 'errands', label: 'Out', emoji: '🚗' },
]

interface PresenceBarProps {
  tasks: TaskWithGoal[]
  rituals: Ritual[]
  ritualLog: Record<string, string[]>
  now: Date
  onCompleteTask: (microTaskId: string) => void
  onCompleteRitual: (ritualId: string) => void
}

// "While you're here." Reads her current room from /api/where (set by Home Assistant,
// NFC, or the manual picker) and surfaces the short things she can knock out right here.
export function PresenceBar({ tasks, rituals, ritualLog, now, onCompleteTask, onCompleteRitual }: PresenceBarProps) {
  const [room, setRoom] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  const loadWhere = useCallback(() => {
    fetch('/api/where')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.room) setRoom(d.room) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadWhere()
    const id = setInterval(loadWhere, 60_000)
    const onVis = () => { if (document.visibilityState === 'visible') loadWhere() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [loadWhere])

  const choose = useCallback((r: string) => {
    setRoom(r)
    setPicking(false)
    fetch('/api/here', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: r, source: 'app' }),
    }).catch(() => {})
  }, [])

  const meta = ROOMS.find(r => r.key === room)
  const roomTasks = room ? tasks.filter(t => t.microTask.context === room).slice(0, 3) : []
  const roomRituals = room
    ? rankRituals(rituals.filter(r => r.context === room), ritualLog, now).filter(s => s.due).slice(0, 3)
    : []
  const hasItems = roomTasks.length > 0 || roomRituals.length > 0

  const picker = (
    <AnimatePresence>
      {picking && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          className="flex flex-wrap gap-2 mt-3"
        >
          {ROOMS.map(r => (
            <button
              key={r.key}
              onClick={() => choose(r.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold border transition-colors ${room === r.key ? 'bg-today-ink text-white border-today-ink' : 'bg-card border-card-border hover:border-today-ink/40'}`}
            >
              <span>{r.emoji}</span> {r.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )

  if (!room) {
    return (
      <section className="mb-8">
        <button
          onClick={() => setPicking(p => !p)}
          className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground transition-colors"
        >
          <MapPin size={16} /> Where are you right now?
        </button>
        {picker}
      </section>
    )
  }

  return (
    <section className="mb-8">
      <button onClick={() => setPicking(p => !p)} className="flex items-center gap-2 mb-3">
        <span className="text-lg">{meta?.emoji}</span>
        <p className="text-xs font-bold uppercase tracking-widest text-today-ink">While you&apos;re in the {meta?.label.toLowerCase()}</p>
        <MapPin size={13} className="text-muted" />
      </button>
      {picker}
      {hasItems ? (
        <div className="bg-card border border-card-border rounded-3xl divide-y divide-card-border overflow-hidden mt-1">
          {roomRituals.map(s => (
            <button key={s.ritual.id} onClick={() => onCompleteRitual(s.ritual.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted-light transition-colors">
              <span className="text-xl w-7 text-center shrink-0">{s.ritual.emoji}</span>
              <span className="flex-1 text-sm font-semibold truncate">{s.ritual.title}</span>
              <span className="shrink-0 w-6 h-6 rounded-full border-2 border-today-ink" />
            </button>
          ))}
          {roomTasks.map(t => (
            <button key={t.id} onClick={() => onCompleteTask(t.microTask.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted-light transition-colors">
              <span className="text-xl w-7 text-center shrink-0">{t.goal.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold truncate">{t.microTask.title}</span>
                <span className="block font-mono text-[11px] text-muted truncate">{t.microTask.durationMin}m</span>
              </span>
              <span className="shrink-0 w-6 h-6 rounded-full border-2 border-muted flex items-center justify-center">
                <Check size={13} className="text-transparent" />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted mt-1">Nothing needs you here right now. Enjoy it.</p>
      )}
    </section>
  )
}
