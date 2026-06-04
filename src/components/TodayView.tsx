'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Flame, Plus, CheckCircle2, Clock, CalendarPlus, Loader2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { JustDoThisCard } from './JustDoThisCard'
import { TimelineEvent } from './TimelineEvent'
import { TimelineGap } from './TimelineGap'
import { RhythmStrip } from './RhythmStrip'
import { PresenceBar } from './PresenceBar'
import { MeetingCopilot } from './MeetingCopilot'
import { CaptureSheet } from './CaptureSheet'
import { categoryColors } from '@/lib/mock-data'
import type { CalendarEvent, TimelineItem } from '@/lib/types'
import { useStore } from '@/lib/store'
import { computeGaps, slotTasks, currentNextActions } from '@/lib/schedule'
import { ProgressRing } from './ProgressRing'

export function TodayView() {
  const store = useStore()

  const [now, setNow] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [calLoading, setCalLoading] = useState(true)
  const [calCount, setCalCount] = useState<number | null>(null)
  const [calFailed, setCalFailed] = useState<string[]>([])
  const [captureOpen, setCaptureOpen] = useState(false)
  const [inbox, setInbox] = useState<{ id: string; raw_text: string | null; source: string }[]>([])

  // Tick the clock every minute so the day stays current and past gaps fall away.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Keep the calendar fresh: on mount, every 5 min, and whenever she returns to the tab.
  useEffect(() => {
    let cancelled = false
    const load = () => {
      const d = new Date()
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
      const qs = `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`
      fetch(`/api/calendar${qs}`)
        .then(r => r.json())
        .then(data => {
          if (cancelled) return
          setEvents(Array.isArray(data.events) ? data.events : [])
          setCalCount(typeof data.calendars === 'number' ? data.calendars : 0)
          setCalFailed(Array.isArray(data.failed) ? data.failed : [])
        })
        .catch(() => { if (!cancelled) setCalCount(0) })
        .finally(() => { if (!cancelled) setCalLoading(false) })
    }
    load()
    const interval = setInterval(load, 5 * 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', load)
    }
  }, [])

  // Captures sent in from the Telegram bot, email, or John, waiting for her to accept.
  useEffect(() => {
    const load = () => fetch('/api/inbox')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.items) setInbox(d.items) })
      .catch(() => {})
    load()
    const id = setInterval(load, 2 * 60_000)
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  const processInbox = (id: string) => {
    setInbox(prev => prev.filter(i => i.id !== id))
    fetch(`/api/inbox?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
  }

  // The next-action model: one live step per goal, highest-priority first.
  const nextActions = currentNextActions(store.goals, store.microTasks)
  const topTasks = nextActions.slice(0, 5)

  // The day: events + free gaps with next-actions slotted in.
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), store.settings.wakeHour, 0, 0)
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), store.settings.sleepHour, 0, 0)
  const gaps = computeGaps(events, dayStart, dayEnd)
  const scheduled = slotTasks(gaps, nextActions, now, store.settings.transitionBufferMin)

  const timeline: TimelineItem[] = [
    ...events.map(e => ({ sortTime: e.startTime, item: { type: 'event' as const, data: e } })),
    ...gaps.map(g => ({
      sortTime: g.startTime,
      item: { type: 'gap' as const, data: g, scheduledTasks: scheduled.filter(st => st.gap.id === g.id) },
    })),
  ]
    .sort((a, b) => a.sortTime.localeCompare(b.sortTime))
    .map(x => x.item)

  const completedTasks = store.microTasks.filter(t => t.status === 'completed').length
  const totalMinutes = store.microTasks
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.durationMin, 0)
  const greeting = now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'
  const noCalendars = !calLoading && calCount === 0

  // Where the "now" line sits in the rail.
  const nowMs = now.getTime()
  const firstUpcoming = timeline.findIndex(it => {
    const s = it.type === 'event' ? it.data.startTime : it.data.startTime
    return new Date(s).getTime() > nowMs
  })

  const nowMarker = (
    <div key="now-marker" className="flex gap-3 items-center py-0.5">
      <div className="shrink-0 w-14 text-right">
        <span className="font-mono text-[11px] font-bold text-today-ink">{format(now, 'h:mm')}</span>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-today-ink shrink-0" />
        <span className="flex-1 h-px bg-today-ink/40" />
      </div>
    </div>
  )

  const railRows: React.ReactNode[] = []
  timeline.forEach((item, i) => {
    if (i === firstUpcoming) railRows.push(nowMarker)
    railRows.push(
      item.type === 'event'
        ? <TimelineEvent key={item.data.id} event={item.data} now={now} />
        : <TimelineGap key={item.data.id} gap={item.data} scheduledTasks={item.scheduledTasks} now={now} />
    )
  })
  if (firstUpcoming === -1 && timeline.length > 0) railRows.push(nowMarker)

  // ─── Shared sections ─────────────────────────────────────────────
  const rhythm = (
    <div className="mb-8">
      <RhythmStrip
        rituals={store.rituals}
        ritualLog={store.ritualLog}
        now={now}
        onComplete={store.completeRitual}
        onUndo={store.undoRitual}
      />
    </div>
  )

  const meetingCopilot = (
    <MeetingCopilot
      events={events}
      now={now}
      asyncMeetings={store.asyncMeetings}
      onToggleAsync={store.toggleAsyncMeeting}
    />
  )

  const presence = (
    <PresenceBar
      tasks={nextActions}
      rituals={store.rituals}
      ritualLog={store.ritualLog}
      now={now}
      onCompleteTask={store.completeTask}
      onCompleteRitual={store.completeRitual}
    />
  )

  const justDoThis = (
    <>
      {topTasks.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Just do this</p>
          <JustDoThisCard tasks={topTasks} onComplete={store.completeTask} onSkip={store.skipTask} />
        </section>
      )}
      {topTasks.length === 0 && store.goals.length > 0 && (
        <section className="mb-8">
          <div className="bg-success-soft border border-success/20 rounded-3xl p-8 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="font-display text-2xl font-bold mb-1">All clear</h2>
            <p className="text-muted text-sm">Nothing on the list. Go do something you love.</p>
          </div>
        </section>
      )}
      {store.goals.length === 0 && (
        <section className="mb-8">
          <button
            onClick={() => setCaptureOpen(true)}
            className="w-full bg-today-tint rounded-3xl p-8 text-center hover:opacity-90 transition-opacity"
          >
            <div className="text-4xl mb-2">🌱</div>
            <h2 className="font-display text-2xl font-bold mb-1 text-today-ink">Start your list</h2>
            <p className="text-muted text-sm">Snap a photo of a list, or jot one thing you want to get done.</p>
          </button>
        </section>
      )}
    </>
  )

  const flowSection = (
    <section>
      <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Today&apos;s flow</p>
      {calFailed.length > 0 && (
        <Link href="/settings">
          <div className="mb-3 flex items-start gap-2 bg-accent-soft border border-accent/20 rounded-2xl px-4 py-3 hover:border-accent/40 transition-colors">
            <AlertTriangle size={15} className="text-accent shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-foreground">Couldn&apos;t load: {calFailed.join(', ')}</p>
              <p className="text-muted mt-0.5">That link isn&apos;t a working iCal feed. Tap to fix it in Settings.</p>
            </div>
          </div>
        </Link>
      )}
      {calLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted py-4">
          <Loader2 size={16} className="animate-spin" /> Loading your calendar...
        </div>
      ) : noCalendars ? (
        <Link href="/settings">
          <div className="bg-card border border-card-border border-dashed rounded-2xl p-6 text-center hover:border-accent/40 transition-colors">
            <CalendarPlus size={24} className="text-accent mx-auto mb-2" />
            <p className="text-sm font-semibold">Connect a calendar</p>
            <p className="text-xs text-muted mt-1">Add your Google or iCal links so the day knows your free time.</p>
          </div>
        </Link>
      ) : timeline.length === 0 ? (
        <div className="bg-muted-light rounded-2xl px-4 py-5 text-sm text-muted text-center">
          No events today. Your whole day is open.
        </div>
      ) : (
        <div className="space-y-3">{railRows}</div>
      )}
    </section>
  )

  const fab = (
    <button
      onClick={() => setCaptureOpen(true)}
      className="fixed right-5 bottom-20 md:bottom-8 z-50 w-14 h-14 rounded-full bg-today-ink text-white shadow-lg shadow-today-ink/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      aria-label="Capture"
    >
      <Plus size={26} strokeWidth={2.5} />
      {inbox.length > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center border-2 border-background">
          {inbox.length}
        </span>
      )}
    </button>
  )

  // ─── Desktop ─────────────────────────────────────────────────────
  const desktop = (
    <div className="hidden md:grid md:grid-cols-[1fr_320px] md:gap-8 md:p-8 md:max-w-5xl">
      <div>
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted font-semibold">Good {greeting}</p>
            <div className="flex items-center gap-1.5 bg-today-tint px-3 py-1.5 rounded-full">
              <Flame size={14} className="text-today-ink" />
              <span className="text-sm font-bold text-today-ink">{store.streak} day streak</span>
            </div>
          </div>
          <h1 className="font-display text-6xl font-bold tracking-tight leading-none">{format(now, 'EEEE')}</h1>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="font-display text-8xl font-extrabold leading-none text-today-ink">{format(now, 'd')}</span>
            <div className="flex flex-col">
              <span className="font-mono text-xs uppercase tracking-widest text-muted">{format(now, 'MMMM yyyy')}</span>
              <span className="font-mono text-xs text-muted">{format(now, 'h:mm a')}</span>
            </div>
          </div>
        </div>
        {meetingCopilot}
        {justDoThis}
        {rhythm}
        {presence}
        {flowSection}
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-today-tint rounded-2xl p-4 text-center">
            <Flame size={18} className="text-today-ink mx-auto mb-1" />
            <p className="text-2xl font-extrabold">{store.streak}</p>
            <p className="text-[10px] text-muted font-semibold uppercase">streak</p>
          </div>
          <div className="bg-success-soft rounded-2xl p-4 text-center">
            <CheckCircle2 size={18} className="text-success mx-auto mb-1" />
            <p className="text-2xl font-extrabold">{completedTasks}</p>
            <p className="text-[10px] text-muted font-semibold uppercase">done</p>
          </div>
          <div className="bg-muted-light rounded-2xl p-4 text-center">
            <Clock size={18} className="text-muted mx-auto mb-1" />
            <p className="text-2xl font-extrabold">{totalMinutes}m</p>
            <p className="text-[10px] text-muted font-semibold uppercase">total</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Your goals</p>
            <Link href="/goals" className="p-1.5 bg-today-ink text-white rounded-full hover:opacity-90 transition-opacity">
              <Plus size={14} strokeWidth={2.5} />
            </Link>
          </div>
          {store.goals.length === 0 && (
            <button onClick={() => setCaptureOpen(true)} className="w-full bg-card border border-card-border border-dashed rounded-2xl p-6 text-center text-muted hover:border-today-ink/40 transition-colors">
              <p className="text-2xl mb-1">🌱</p>
              <p className="text-sm font-semibold">Add your first goal</p>
            </button>
          )}
          <div className="space-y-3">
            {store.goals.map((goal, i) => {
              const color = categoryColors[goal.category] || '#8B6F5E'
              const taskCount = store.microTasks.filter(t => t.goalId === goal.id).length
              const doneCount = store.microTasks.filter(t => t.goalId === goal.id && t.status === 'completed').length
              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="bg-card border border-card-border rounded-2xl p-4"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <ProgressRing progress={goal.progressPct} size={44} strokeWidth={5} color={color}>
                      <span className="text-sm">{goal.emoji}</span>
                    </ProgressRing>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{goal.title}</h3>
                      <p className="font-mono text-[10px] text-muted">{doneCount}/{taskCount} steps · {goal.progressPct}%</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted-light rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${goal.progressPct}%` }}
                      transition={{ duration: 0.8, delay: 0.2 + 0.05 * i }}
                    />
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  // ─── Mobile ──────────────────────────────────────────────────────
  const mobile = (
    <div className="md:hidden max-w-lg mx-auto px-5 pt-12">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-muted font-semibold">Good {greeting}</p>
          <div className="flex items-center gap-1.5 bg-today-tint px-2.5 py-1 rounded-full">
            <Flame size={14} className="text-today-ink" />
            <span className="text-xs font-bold text-today-ink">{store.streak} day streak</span>
          </div>
        </div>
        <h1 className="font-display text-5xl font-bold tracking-tight leading-none">{format(now, 'EEEE')}</h1>
        <div className="flex items-baseline gap-3 mt-1">
          <span className="font-display text-7xl font-extrabold leading-none text-today-ink">{format(now, 'd')}</span>
          <div className="flex flex-col">
            <span className="font-mono text-xs uppercase tracking-widest text-muted">{format(now, 'MMMM')}</span>
            <span className="font-mono text-xs text-muted">{format(now, 'h:mm a')}</span>
          </div>
        </div>
      </div>
      {meetingCopilot}
      {justDoThis}
      {rhythm}
      {presence}
      <div className="mb-8">{flowSection}</div>
      <section className="bg-card border border-card-border rounded-2xl p-4 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{store.tasksCompletedToday}</p>
            <p className="text-xs text-muted">tasks done</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{totalMinutes}m</p>
            <p className="text-xs text-muted">productive</p>
          </div>
        </div>
      </section>
    </div>
  )

  return (
    <>
      {desktop}
      {mobile}
      {fab}
      <CaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        apiKey={store.settings.anthropicApiKey}
        userContext={store.settings.userContext}
        onAddGoal={store.addGoal}
        inboxItems={inbox}
        onProcessed={processInbox}
      />
    </>
  )
}
