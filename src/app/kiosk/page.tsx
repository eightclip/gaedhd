'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { Illo } from '@/components/Illo'
import { categoryColors } from '@/lib/mock-data'

interface KioskEvent { id: string; title: string; startTime: string; endTime: string; color: string }
interface KioskRitual { id: string; title: string; emoji: string; nudge: string; tint: string }
interface RhythmItem { id: string; title: string; emoji: string; tint: string; due: boolean; doneToday: number; target: number | null }
interface KioskData {
  task: { title: string; durationMin: number; phase: string; goal: string; emoji: string } | null
  pendingCount: number
  ritualsDue: KioskRitual[]
  rhythm: RhythmItem[]
  water: { count: number; goal: number }
  upNext: { title: string; goal: string; durationMin: number }[]
  goals: { title: string; emoji: string; category: string; progressPct: number }[]
  upcoming: { label: string; daysUntil: number; kind: string; years: number | null }[]
  dumpCount: number
  streak: number
  weekCount?: number
  completedToday: number
  minutesToday: number
  events: KioskEvent[]
}

// Her studio TV. A 10-foot, glanceable command-center, calm, no interaction,
// auto-refreshing every 45s. Pulls everything live from GaeDHD via /api/now.
export default function KioskPage() {
  const [now, setNow] = useState(() => new Date())
  const [data, setData] = useState<KioskData | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shift, setShift] = useState({ x: 0, y: 0 })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(new URLSearchParams(window.location.search).get('token'))
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Anti burn-in: the live clock already changes pixels every second, and on top
  // of that we nudge the whole UI a few px on a slow cycle so nothing static sits
  // on the exact same pixels all day. Imperceptible at 10 feet. Plus a full reload
  // every few hours for resilience.
  useEffect(() => {
    const steps = [[0, 0], [4, 2], [6, 0], [3, 4], [0, 6], [-3, 3], [-6, 0], [-3, -3]]
    let i = 0
    const shiftId = setInterval(() => { i = (i + 1) % steps.length; setShift({ x: steps[i][0], y: steps[i][1] }) }, 60_000)
    const reloadId = setInterval(() => window.location.reload(), 4 * 3_600_000)
    return () => { clearInterval(shiftId); clearInterval(reloadId) }
  }, [])

  const load = useCallback(() => {
    if (!token) return
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
    const qs = `?token=${encodeURIComponent(token)}&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`
    fetch(`/api/now${qs}`)
      .then(async r => {
        if (!r.ok) { setError(r.status === 401 ? 'Bad or missing token' : 'Could not load'); return }
        setError(null)
        setData(await r.json())
      })
      .catch(() => setError('Offline'))
  }, [token])

  useEffect(() => {
    load()
    const id = setInterval(load, 45_000)
    return () => clearInterval(id)
  }, [load])

  if (!token) {
    return (
      <div className="h-screen flex items-center justify-center text-center p-10">
        <div>
          <p className="font-display text-3xl font-bold mb-2">Kiosk needs a token</p>
          <p className="text-muted font-mono text-sm">open /kiosk?token=YOUR_GAEDHD_NOW_TOKEN</p>
        </div>
      </div>
    )
  }

  const nowMs = now.getTime()
  const events = data?.events ?? []
  const currentMeeting = events.find(e => new Date(e.startTime).getTime() <= nowMs && nowMs < new Date(e.endTime).getTime())
  const nextMeeting = events.find(e => new Date(e.startTime).getTime() > nowMs)
  const minsLeft = currentMeeting ? Math.max(0, Math.round((new Date(currentMeeting.endTime).getTime() - nowMs) / 60000)) : null
  const wrapUp = minsLeft !== null && minsLeft <= 10
  const freeNow = !currentMeeting && !data?.task
  const rhythm = (data?.rhythm ?? []).filter(r => r.id !== 'water')
  const upNext = (data?.upNext ?? []).slice(1, 5) // [0] is the "right now" task
  const water = data?.water ?? { count: 0, goal: 4 }

  const label = (t: string) => <p className="font-mono text-[0.95vw] uppercase tracking-[0.2em] text-muted">{t}</p>

  return (
    <div className="h-screen w-screen overflow-hidden p-[1.8vw] flex flex-col gap-[1.2vw] text-foreground"
      style={{ transform: `translate(${shift.x}px, ${shift.y}px)`, transition: 'transform 3s ease-in-out' }}>
      {/* Top bar: brand + date, and the clock */}
      <header className="flex items-end justify-between shrink-0">
        <div className="flex items-center gap-[1vw]">
          <Illo src="/avatar.png" alt="" className="h-[3.4vw] w-auto rounded-[0.8vw]" />
          <div>
            <p className="font-display text-[2.4vw] font-bold leading-none">{format(now, 'EEEE')}</p>
            <p className="font-mono text-[1.1vw] uppercase tracking-widest text-muted mt-[0.3vw]">
              <span className="text-today-ink font-bold">{format(now, 'MMM d')}</span> · {format(now, 'yyyy')}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="font-display text-[5.5vw] font-extrabold leading-none tabular-nums">{format(now, 'h:mm')}</span>
          <span className="font-mono text-[1.4vw] text-muted uppercase ml-[0.5vw]">{format(now, 'a')}</span>
        </div>
      </header>

      {/* Band 1: Right Now (wide) · Up Next · Next meeting */}
      <div className="grid grid-cols-12 gap-[1.2vw] flex-[1.5] min-h-0">
        {/* Right now */}
        <div className="col-span-6 rounded-[1.5vw] bg-today-tint p-[1.8vw] flex flex-col justify-between min-h-0 overflow-hidden">
          {label(freeNow ? 'Your time' : 'Right now')}
          {data?.task && !freeNow ? (
            <div>
              <p className="font-display text-[3.4vw] font-bold leading-[1.03]">{data.task.title}</p>
              <p className="font-mono text-[1.2vw] text-today-ink mt-[0.6vw]">{data.task.goal} · {data.task.durationMin}m</p>
            </div>
          ) : (
            <p className="font-display text-[3vw] font-bold leading-[1.05]">Go make something you love.</p>
          )}
        </div>

        {/* Up next */}
        <div className="col-span-3 rounded-[1.5vw] bg-card border border-card-border p-[1.4vw] flex flex-col min-h-0 overflow-hidden">
          {label('Up next')}
          <div className="mt-[0.8vw] flex flex-col gap-[0.7vw] min-h-0 overflow-hidden">
            {upNext.length ? upNext.map((t, i) => (
              <div key={i} className="flex items-baseline gap-[0.6vw]">
                <span className="font-mono text-[0.9vw] text-today-ink shrink-0 mt-[0.2vw]">{t.durationMin}m</span>
                <span className="font-display text-[1.35vw] font-semibold leading-tight truncate">{t.title}</span>
              </div>
            )) : <p className="font-display text-[1.5vw] text-muted">All clear ✨</p>}
          </div>
        </div>

        {/* Next meeting */}
        <div className={`col-span-3 rounded-[1.5vw] p-[1.4vw] flex flex-col justify-between min-h-0 overflow-hidden ${wrapUp ? 'bg-[#C85D3E] text-white' : 'bg-card border border-card-border'}`}>
          <p className={`font-mono text-[0.95vw] uppercase tracking-[0.2em] ${wrapUp ? 'text-white/80' : 'text-muted'}`}>{currentMeeting ? 'In a meeting' : 'Next up'}</p>
          {currentMeeting ? (
            <div>
              <p className="font-display text-[1.9vw] font-bold leading-tight">{currentMeeting.title}</p>
              <p className={`font-mono text-[1.2vw] mt-[0.4vw] ${wrapUp ? 'text-white' : 'text-muted'}`}>{minsLeft} min left{wrapUp ? ' — wrap up' : ''}</p>
            </div>
          ) : nextMeeting ? (
            <div>
              <p className="font-display text-[1.8vw] font-bold leading-tight">{nextMeeting.title}</p>
              <p className="font-mono text-[1.1vw] text-muted mt-[0.4vw]">{format(new Date(nextMeeting.startTime), 'h:mm a')}</p>
            </div>
          ) : (
            <p className="font-display text-[1.6vw] font-bold text-muted">Nothing scheduled</p>
          )}
        </div>
      </div>

      {/* Band 2: Rhythm (wide) · Water · Coming up */}
      <div className="grid grid-cols-12 gap-[1.2vw] flex-1 min-h-0">
        {/* Rhythm chips */}
        <div className="col-span-7 rounded-[1.5vw] bg-card border border-card-border p-[1.4vw] flex flex-col min-h-0 overflow-hidden">
          {label('Rhythm')}
          <div className="mt-[0.8vw] flex flex-wrap gap-[0.7vw] content-start min-h-0 overflow-hidden">
            {rhythm.map(r => {
              const done = r.target != null && r.doneToday >= r.target
              return (
                <div key={r.id}
                  className={`flex items-center gap-[0.5vw] rounded-full px-[1vw] py-[0.5vw] ${r.due ? 'bg-today-tint ring-1 ring-today-ink/30' : done ? 'bg-success-soft' : 'bg-muted-light'}`}>
                  <span className="text-[1.5vw] leading-none">{r.emoji}</span>
                  <span className={`font-display text-[1.15vw] font-semibold ${done ? 'text-success' : ''}`}>{r.title}</span>
                  {r.target && r.target > 1 && <span className="font-mono text-[0.85vw] text-muted">{r.doneToday}/{r.target}</span>}
                  {done && <span className="text-[1vw]">✓</span>}
                  {r.due && <span className="w-[0.6vw] h-[0.6vw] rounded-full bg-today-ink" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Water */}
        <div className="col-span-2 rounded-[1.5vw] bg-[#E3EEF2] p-[1.4vw] flex flex-col justify-between min-h-0 overflow-hidden">
          {label('Water')}
          <div className="flex items-end gap-[0.5vw]">
            {Array.from({ length: water.goal }).map((_, i) => (
              <div key={i} className={`flex-1 rounded-[0.4vw] ${i < water.count ? 'bg-[#6BA3BE]' : 'bg-[#6BA3BE]/20'}`} style={{ height: `${2 + i * 0.6}vw` }} />
            ))}
          </div>
          <p className="font-display text-[1.4vw] font-bold text-[#3C6B7E]">{water.count}/{water.goal} cups</p>
        </div>

        {/* Coming up + dump */}
        <div className="col-span-3 rounded-[1.5vw] bg-card border border-card-border p-[1.4vw] flex flex-col min-h-0 overflow-hidden">
          {label('Coming up')}
          <div className="mt-[0.6vw] flex-1 flex flex-col gap-[0.5vw] min-h-0 overflow-hidden">
            {(data?.upcoming ?? []).length ? (data!.upcoming).slice(0, 3).map((u, i) => (
              <div key={i} className="flex items-baseline justify-between gap-[0.6vw]">
                <span className="font-display text-[1.2vw] font-semibold truncate">{u.kind === 'anniversary' ? '💍' : '🎂'} {u.label}</span>
                <span className="font-mono text-[0.95vw] text-today-ink shrink-0">{u.daysUntil === 0 ? 'today' : u.daysUntil === 1 ? '1 day' : `${u.daysUntil}d`}</span>
              </div>
            )) : <p className="font-display text-[1.3vw] text-muted">Nothing soon</p>}
          </div>
          {(data?.dumpCount ?? 0) > 0 && (
            <p className="font-mono text-[0.95vw] text-muted mt-[0.5vw]">🧠 {data!.dumpCount} in your dump</p>
          )}
        </div>
      </div>

      {/* Band 3: Goals · Wins */}
      <div className="grid grid-cols-12 gap-[1.2vw] flex-1 min-h-0">
        {/* Goals progress */}
        <div className="col-span-8 rounded-[1.5vw] bg-card border border-card-border p-[1.4vw] flex flex-col min-h-0 overflow-hidden">
          {label('Goals')}
          <div className="mt-[0.7vw] grid grid-cols-2 gap-x-[1.6vw] gap-y-[0.7vw] min-h-0 overflow-hidden">
            {(data?.goals ?? []).slice(0, 4).map((g, i) => {
              const color = categoryColors[g.category] || '#8B6F5E'
              return (
                <div key={i}>
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-[1.2vw] font-semibold truncate">{g.emoji} {g.title}</span>
                    <span className="font-mono text-[0.9vw] text-muted shrink-0">{g.progressPct}%</span>
                  </div>
                  <div className="h-[0.6vw] rounded-full bg-muted-light overflow-hidden mt-[0.3vw]">
                    <div className="h-full rounded-full" style={{ width: `${g.progressPct}%`, backgroundColor: color }} />
                  </div>
                </div>
              )
            })}
            {(data?.goals ?? []).length === 0 && <p className="font-display text-[1.4vw] text-muted">No goals yet</p>}
          </div>
        </div>

        {/* Wins */}
        <div className="col-span-4 rounded-[1.5vw] bg-success-soft p-[1.4vw] flex items-center justify-around min-h-0 overflow-hidden">
          <div className="text-center">
            <p className="font-display text-[3vw] font-extrabold leading-none text-success">{data?.streak ?? 0}</p>
            <p className="font-mono text-[0.85vw] uppercase tracking-widest text-muted mt-[0.4vw]">{data?.weekCount != null ? `${data.weekCount}/7 wk` : 'streak'}</p>
          </div>
          <div className="text-center">
            <p className="font-display text-[3vw] font-extrabold leading-none">{data?.completedToday ?? 0}</p>
            <p className="font-mono text-[0.85vw] uppercase tracking-widest text-muted mt-[0.4vw]">done</p>
          </div>
          <div className="text-center">
            <p className="font-display text-[3vw] font-extrabold leading-none">{data?.minutesToday ?? 0}m</p>
            <p className="font-mono text-[0.85vw] uppercase tracking-widest text-muted mt-[0.4vw]">focused</p>
          </div>
        </div>
      </div>

      {error && <p className="absolute bottom-1 right-2 font-mono text-[0.7vw] text-muted/40">{error}</p>}
    </div>
  )
}
