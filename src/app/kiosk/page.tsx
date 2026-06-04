'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'

interface KioskEvent { id: string; title: string; startTime: string; endTime: string; color: string }
interface KioskRitual { id: string; title: string; emoji: string; nudge: string; tint: string }
interface KioskData {
  task: { title: string; durationMin: number; phase: string; goal: string; emoji: string } | null
  pendingCount: number
  ritualsDue: KioskRitual[]
  streak: number
  completedToday: number
  minutesToday: number
  events: KioskEvent[]
}

// The office TV. A 10-foot, glanceable view. Calm, no interaction, auto-refreshing.
export default function KioskPage() {
  const [now, setNow] = useState(() => new Date())
  const [data, setData] = useState<KioskData | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Token lives in the URL on the TV; read it once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(new URLSearchParams(window.location.search).get('token'))
  }, [])

  // Live clock.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
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
      <div className="min-h-screen flex items-center justify-center text-center p-10">
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
  const ritual = data?.ritualsDue?.[0] ?? null
  const freeNow = !currentMeeting && !data?.task

  return (
    <div className="min-h-screen w-full p-[3vw] flex flex-col gap-[2vw]">
      {/* Hero: date + clock */}
      <div className="flex items-end justify-between">
        <div>
          <p className="font-display text-[3vw] font-bold leading-none text-muted">{format(now, 'EEEE')}</p>
          <div className="flex items-baseline gap-[1.5vw]">
            <span className="font-display text-[12vw] font-extrabold leading-[0.85] text-today-ink">{format(now, 'd')}</span>
            <span className="font-mono text-[2vw] uppercase tracking-widest text-muted">{format(now, 'MMM yyyy')}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-[7vw] font-extrabold leading-none tabular-nums">{format(now, 'h:mm')}</p>
          <p className="font-mono text-[1.6vw] text-muted uppercase">{format(now, 'a')}</p>
        </div>
      </div>

      {/* Bento grid */}
      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-[2vw]">
        {/* Right now (the one thing) — spans 2 cols */}
        <div className="col-span-2 rounded-[2vw] bg-today-tint p-[2.5vw] flex flex-col justify-between">
          <p className="font-mono text-[1.3vw] uppercase tracking-widest text-today-ink/70">
            {freeNow ? 'Your time' : 'Right now'}
          </p>
          {data?.task && !freeNow ? (
            <div>
              <p className="font-display text-[4.5vw] font-bold leading-[1.05] text-foreground">{data.task.title}</p>
              <p className="font-mono text-[1.4vw] text-today-ink mt-[1vw]">
                {data.task.emoji} {data.task.goal} · {data.task.durationMin}m
              </p>
            </div>
          ) : (
            <p className="font-display text-[4vw] font-bold leading-[1.05] text-foreground">
              Go make something you love.
            </p>
          )}
        </div>

        {/* Next up / meeting */}
        <div className={`rounded-[2vw] p-[2vw] flex flex-col justify-between ${wrapUp ? 'bg-[#C85D3E] text-white' : 'bg-card border border-card-border'}`}>
          <p className={`font-mono text-[1.1vw] uppercase tracking-widest ${wrapUp ? 'text-white/80' : 'text-muted'}`}>
            {currentMeeting ? 'In a meeting' : 'Next up'}
          </p>
          {currentMeeting ? (
            <div>
              <p className="font-display text-[2.4vw] font-bold leading-tight">{currentMeeting.title}</p>
              <p className={`font-mono text-[1.6vw] mt-[0.5vw] ${wrapUp ? 'text-white' : 'text-muted'}`}>
                {minsLeft} min left{wrapUp ? ' — start wrapping up' : ''}
              </p>
            </div>
          ) : nextMeeting ? (
            <div>
              <p className="font-display text-[2.2vw] font-bold leading-tight">{nextMeeting.title}</p>
              <p className="font-mono text-[1.4vw] text-muted mt-[0.5vw]">{format(new Date(nextMeeting.startTime), 'h:mm a')}</p>
            </div>
          ) : (
            <p className="font-display text-[2vw] font-bold text-muted">Nothing scheduled</p>
          )}
        </div>

        {/* Rhythm */}
        <div className="rounded-[2vw] bg-card border border-card-border p-[2vw] flex flex-col justify-between">
          <p className="font-mono text-[1.1vw] uppercase tracking-widest text-muted">Rhythm</p>
          {ritual ? (
            <div>
              <p className="text-[3.5vw] leading-none">{ritual.emoji}</p>
              <p className="font-display text-[2vw] font-bold leading-tight mt-[0.5vw]">{ritual.title}</p>
              <p className="font-mono text-[1.1vw] text-muted mt-[0.3vw]">{ritual.nudge}</p>
            </div>
          ) : (
            <p className="font-display text-[1.8vw] font-bold text-muted">All caught up 🌿</p>
          )}
        </div>

        {/* Wins — spans 2 cols */}
        <div className="col-span-2 rounded-[2vw] bg-success-soft p-[2vw] flex items-center justify-around">
          <div className="text-center">
            <p className="font-display text-[4vw] font-extrabold leading-none text-success">{data?.streak ?? 0}</p>
            <p className="font-mono text-[1vw] uppercase tracking-widest text-muted mt-[0.5vw]">day streak</p>
          </div>
          <div className="text-center">
            <p className="font-display text-[4vw] font-extrabold leading-none">{data?.completedToday ?? 0}</p>
            <p className="font-mono text-[1vw] uppercase tracking-widest text-muted mt-[0.5vw]">done today</p>
          </div>
          <div className="text-center">
            <p className="font-display text-[4vw] font-extrabold leading-none">{data?.minutesToday ?? 0}m</p>
            <p className="font-mono text-[1vw] uppercase tracking-widest text-muted mt-[0.5vw]">focused</p>
          </div>
        </div>
      </div>

      {error && (
        <p className="absolute bottom-2 right-3 font-mono text-xs text-muted/50">{error}</p>
      )}
    </div>
  )
}
