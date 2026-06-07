'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Check, Palette, Briefcase, Coffee, Moon, Sofa, Leaf, Dumbbell, Car, Sparkles, type LucideIcon } from 'lucide-react'
import type { TaskWithGoal, SpotTask } from '@/lib/types'
import type { Ritual } from '@/lib/rituals'
import { rankRituals } from '@/lib/rituals'
import { RITUAL_ILLO } from '@/lib/illustrations'
import { RITUAL_ICON, categoryIcon } from '@/lib/icons'
import { Illo } from './Illo'

const ROOMS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'studio', label: 'Studio', Icon: Palette },
  { key: 'office', label: 'Office', Icon: Briefcase },
  { key: 'kitchen', label: 'Kitchen', Icon: Coffee },
  { key: 'bedroom', label: 'Bedroom', Icon: Moon },
  { key: 'living_room', label: 'Living room', Icon: Sofa },
  { key: 'yard', label: 'Yard', Icon: Leaf },
  { key: 'gym', label: 'Gym', Icon: Dumbbell },
  { key: 'errands', label: 'Out', Icon: Car },
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
  // Location-tagged one-liners she dropped (via the bot or app) for this room.
  const [spots, setSpots] = useState<SpotTask[]>([])

  const loadWhere = useCallback(() => {
    fetch('/api/where')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.room) setRoom(d.room) })
      .catch(() => {})
  }, [])

  const loadSpots = useCallback((r: string) => {
    fetch(`/api/spot?room=${encodeURIComponent(r)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(d => { if (d?.items) setSpots(d.items as SpotTask[]) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadWhere()
    const id = setInterval(loadWhere, 60_000)
    const onVis = () => { if (document.visibilityState === 'visible') loadWhere() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [loadWhere])

  // Pull this room's spot tasks when the room changes (and refresh on a slow tick).
  useEffect(() => {
    if (!room) { setSpots([]); return }
    loadSpots(room)
    const id = setInterval(() => loadSpots(room), 60_000)
    return () => clearInterval(id)
  }, [room, loadSpots])

  const completeSpot = useCallback((id: string) => {
    setSpots(prev => prev.filter(s => s.id !== id))
    fetch(`/api/spot?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
  }, [])

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
  const MetaIcon = meta?.Icon
  const roomTasks = room ? tasks.filter(t => t.microTask.context === room).slice(0, 3) : []
  const roomRituals = room
    ? rankRituals(rituals.filter(r => r.context === room), ritualLog, now).filter(s => s.due).slice(0, 3)
    : []
  const hasItems = spots.length > 0 || roomTasks.length > 0 || roomRituals.length > 0

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
              <r.Icon size={15} /> {r.label}
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
        {MetaIcon && <MetaIcon size={18} className="text-today-ink" />}
        <p className="text-xs font-bold uppercase tracking-widest text-today-ink">While you&apos;re in the {meta?.label.toLowerCase()}</p>
        <MapPin size={13} className="text-muted" />
      </button>
      {picker}
      {hasItems ? (
        <div className="bg-card border border-card-border rounded-3xl divide-y divide-card-border overflow-hidden mt-1">
          {spots.map(s => (
            <button key={s.id} onClick={() => completeSpot(s.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted-light transition-colors">
              <span className="w-7 flex justify-center shrink-0">
                {s.emoji ? <span className="text-lg leading-none">{s.emoji}</span> : <MapPin size={18} className="text-today-ink" />}
              </span>
              <span className="flex-1 text-sm font-semibold truncate">{s.title}</span>
              <span className="shrink-0 w-6 h-6 rounded-full border-2 border-today-ink" />
            </button>
          ))}
          {roomRituals.map(s => {
            const Fallback = RITUAL_ICON[s.ritual.id] || Sparkles
            return (
              <button key={s.ritual.id} onClick={() => onCompleteRitual(s.ritual.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted-light transition-colors">
                {RITUAL_ILLO[s.ritual.id]
                  ? <Illo src={RITUAL_ILLO[s.ritual.id]} className="h-7 w-7 object-contain shrink-0" />
                  : <span className="w-7 flex justify-center shrink-0"><Fallback size={18} className="text-today-ink" /></span>}
                <span className="flex-1 text-sm font-semibold truncate">{s.ritual.title}</span>
                <span className="shrink-0 w-6 h-6 rounded-full border-2 border-today-ink" />
              </button>
            )
          })}
          {roomTasks.map(t => {
            const GoalIcon = categoryIcon(t.goal.category)
            return (
              <button key={t.id} onClick={() => onCompleteTask(t.microTask.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted-light transition-colors">
                <span className="w-7 flex justify-center shrink-0"><GoalIcon size={18} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate">{t.microTask.title}</span>
                  <span className="block font-mono text-[11px] text-muted truncate">{t.microTask.durationMin}m</span>
                </span>
                <span className="shrink-0 w-6 h-6 rounded-full border-2 border-muted flex items-center justify-center">
                  <Check size={13} className="text-transparent" />
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted mt-1">Nothing needs you here right now. Enjoy it.</p>
      )}
    </section>
  )
}
