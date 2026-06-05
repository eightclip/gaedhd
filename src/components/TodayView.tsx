'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { JustDoThisCard } from './JustDoThisCard'
import { TimelineEvent } from './TimelineEvent'
import { TimelineGap } from './TimelineGap'
import { RhythmStrip } from './RhythmStrip'
import { PresenceBar } from './PresenceBar'
import { MeetingCopilot } from './MeetingCopilot'
import { CaptureSheet } from './CaptureSheet'
import { Illo } from './Illo'
import { ILLO, DONE_ILLOS, pickDaily } from '@/lib/illustrations'
import { categoryColors } from '@/lib/mock-data'
import type { CalendarEvent, TimelineItem } from '@/lib/types'
import { useStore } from '@/lib/store'
import { computeGaps, slotTasks, currentNextActions } from '@/lib/schedule'
import { ProgressRing } from './ProgressRing'

// An italic-accent serif section header: "Just do this" → "Just do *this*".
function Head({ lead, accent, className = '' }: { lead: string; accent: string; className?: string }) {
  return (
    <h2 className={`font-display text-3xl font-bold tracking-tight ${className}`}>
      {lead} <span className="italic font-normal">{accent}</span>
    </h2>
  )
}

export function TodayView() {
  const store = useStore()

  const [now, setNow] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [calLoading, setCalLoading] = useState(true)
  const [calCount, setCalCount] = useState<number | null>(null)
  const [calFailed, setCalFailed] = useState<string[]>([])
  const [captureOpen, setCaptureOpen] = useState(false)
  const [inbox, setInbox] = useState<{ id: string; raw_text: string | null; source: string }[]>([])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

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

  const nextActions = currentNextActions(store.goals, store.microTasks)
  const topTasks = nextActions.slice(0, 5)

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
  const totalMinutes = store.microTasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.durationMin, 0)
  const greeting = now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'
  const noCalendars = !calLoading && calCount === 0

  const nowMs = now.getTime()
  const firstUpcoming = timeline.findIndex(it => new Date(it.type === 'event' ? it.data.startTime : it.data.startTime).getTime() > nowMs)

  const nowMarker = (
    <div key="now-marker" className="flex gap-3 items-center py-0.5">
      <div className="shrink-0 w-14 text-right">
        <span className="font-mono text-[11px] font-bold text-today-ink">{format(now, 'h:mm')}</span>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-today-ink shrink-0" />
        <span className="flex-1 h-px bg-today-ink/30" />
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

  // ── Header (the date as the art) ──
  const header = (sizes: { day: string; num: string; month: string }) => (
    <div className="mb-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted mb-3">
        Good {greeting} · {store.streak} day streak
      </p>
      <h1 className={`font-display font-bold tracking-tight leading-[0.95] ${sizes.day}`}>{format(now, 'EEEE')}</h1>
      <div className="flex items-end gap-3 mt-1">
        <span className={`font-display font-extrabold leading-[0.78] text-today-ink ${sizes.num}`}>{format(now, 'd')}</span>
        <div className="pb-2">
          <p className={`font-display font-bold leading-none ${sizes.month}`}>{format(now, 'MMMM')}</p>
          <p className="font-mono text-xs text-muted mt-1.5">{format(now, 'h:mm a')}</p>
        </div>
      </div>
    </div>
  )

  const rhythm = (
    <RhythmStrip
      rituals={store.rituals}
      ritualLog={store.ritualLog}
      now={now}
      onComplete={store.completeRitual}
      onUndo={store.undoRitual}
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

  const meetingCopilot = (
    <MeetingCopilot events={events} now={now} asyncMeetings={store.asyncMeetings} onToggleAsync={store.toggleAsyncMeeting} />
  )

  const justDoThis = (
    <>
      {topTasks.length > 0 && (
        <section className="mb-10">
          <Head lead="Just do" accent="this" className="mb-4" />
          <JustDoThisCard tasks={topTasks} onComplete={store.completeTask} onSkip={store.skipTask} />
        </section>
      )}
      {topTasks.length === 0 && store.goals.length > 0 && (
        <section className="mb-10">
          <div className="bg-success-soft rounded-[2rem] p-10 text-center">
            <Illo src={pickDaily(DONE_ILLOS)} className="h-28 w-auto mx-auto mb-4" />
            <h2 className="font-display text-3xl font-bold">All <span className="italic font-normal">clear</span></h2>
            <p className="text-muted text-sm mt-1">Nothing on the list. Go do something you love.</p>
          </div>
        </section>
      )}
      {store.goals.length === 0 && (
        <section className="mb-10">
          <button onClick={() => setCaptureOpen(true)} className="w-full bg-today-tint rounded-[2rem] p-10 text-center hover:opacity-90 transition-opacity">
            <Illo src={ILLO.startList} className="h-24 w-auto mx-auto mb-4 animate-float" />
            <h2 className="font-display text-3xl font-bold text-today-ink">Start your <span className="italic font-normal">list</span></h2>
            <p className="text-muted text-sm mt-1">Snap a photo of a list, or jot one thing you want to get done.</p>
          </button>
        </section>
      )}
    </>
  )

  const flowSection = (
    <section className="mb-10">
      <Head lead="Today's" accent="flow" className="mb-4" />
      {calFailed.length > 0 && (
        <Link href="/settings">
          <div className="mb-3 bg-accent-soft border border-accent/20 rounded-2xl px-4 py-3 text-xs">
            <p className="font-semibold">Couldn&apos;t load: {calFailed.join(', ')}</p>
            <p className="text-muted mt-0.5">That link isn&apos;t a working iCal feed. Tap to fix it in Settings.</p>
          </div>
        </Link>
      )}
      {calLoading ? (
        <p className="font-mono text-xs text-muted py-4">loading your calendar...</p>
      ) : noCalendars ? (
        <Link href="/settings">
          <div className="rounded-[1.75rem] p-8 text-center" style={{ backgroundColor: 'var(--today-tint)' }}>
            <p className="font-display text-xl font-bold text-today-ink">Connect a calendar</p>
            <p className="text-xs text-muted mt-1">Add your Google or iCal links so the day knows your free time.</p>
          </div>
        </Link>
      ) : timeline.length === 0 ? (
        <div className="rounded-[1.75rem] p-8 text-center font-mono text-sm text-muted" style={{ backgroundColor: 'var(--today-tint)' }}>
          No events today. Your whole day is open.
        </div>
      ) : (
        <div className="rounded-[1.75rem] p-5 space-y-3" style={{ backgroundColor: 'var(--today-tint)' }}>
          {railRows}
        </div>
      )}
    </section>
  )

  const winsTiles = (
    <div className="grid grid-cols-3 gap-3 mb-10">
      <div className="rounded-[1.5rem] p-5" style={{ backgroundColor: 'var(--today-tint)' }}>
        <p className="font-display text-4xl font-extrabold leading-none text-today-ink">{store.streak}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mt-2">streak</p>
      </div>
      <div className="rounded-[1.5rem] p-5 bg-success-soft">
        <p className="font-display text-4xl font-extrabold leading-none text-success">{completedTasks}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mt-2">done</p>
      </div>
      <div className="rounded-[1.5rem] p-5 bg-muted-light">
        <p className="font-display text-4xl font-extrabold leading-none">{totalMinutes}<span className="text-xl">m</span></p>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mt-2">focused</p>
      </div>
    </div>
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

  const goalsRail = (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Head lead="Your" accent="goals" />
        <Link href="/goals" className="p-1.5 bg-today-ink text-white rounded-full hover:opacity-90 transition-opacity">
          <Plus size={14} strokeWidth={2.5} />
        </Link>
      </div>
      {store.goals.length === 0 && (
        <button onClick={() => setCaptureOpen(true)} className="w-full rounded-[1.5rem] p-6 text-center text-muted" style={{ backgroundColor: 'var(--today-tint)' }}>
          <p className="font-display text-lg font-bold text-today-ink">Add your first goal</p>
        </button>
      )}
      <div className="space-y-3">
        {store.goals.map((goal, i) => {
          const color = categoryColors[goal.category] || '#8B6F5E'
          const taskCount = store.microTasks.filter(t => t.goalId === goal.id).length
          const doneCount = store.microTasks.filter(t => t.goalId === goal.id && t.status === 'completed').length
          return (
            <motion.div key={goal.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} className="bg-card border border-card-border rounded-2xl p-4">
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
                <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} initial={{ width: 0 }} animate={{ width: `${goal.progressPct}%` }} transition={{ duration: 0.8, delay: 0.2 + 0.05 * i }} />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )

  // ── Desktop: editorial left column + bento rail ──
  const desktop = (
    <div className="hidden md:grid md:grid-cols-[1fr_340px] md:gap-10 md:p-10 md:max-w-6xl">
      <div>
        {header({ day: 'text-7xl', num: 'text-[9rem]', month: 'text-2xl' })}
        {meetingCopilot}
        {justDoThis}
        {rhythm}
        {presence}
        {flowSection}
      </div>
      <div className="space-y-10 pt-2">
        {winsTiles}
        {goalsRail}
      </div>
    </div>
  )

  // ── Mobile ──
  const mobile = (
    <div className="md:hidden max-w-lg mx-auto px-5 pt-12">
      {header({ day: 'text-6xl', num: 'text-[7rem]', month: 'text-xl' })}
      {meetingCopilot}
      {justDoThis}
      {rhythm}
      {presence}
      {flowSection}
      {winsTiles}
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
