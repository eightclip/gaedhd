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
import { RitualFocusCard } from './RitualFocusCard'
import { rankRituals, isAnchoredCadence } from '@/lib/rituals'
import { PresenceBar } from './PresenceBar'
import { MeetingCopilot } from './MeetingCopilot'
import { WaterTracker } from './WaterTracker'
import { ImportantDates } from './ImportantDates'
import { BreakCard } from './BreakCard'
import { GymPicker } from './GymPicker'
import { CaptureSheet } from './CaptureSheet'
import { BirthdayTakeover } from './BirthdayTakeover'
import { OverwhelmReset } from './OverwhelmReset'
import { MoodCheckin } from './MoodCheckin'
import { DecideHelper } from './DecideHelper'
import { FocusSession } from './FocusSession'
import { RECIPIENT_NAME } from '@/lib/letter'
import { Illo } from './Illo'
import { ILLO, DONE_ILLOS, pickDaily } from '@/lib/illustrations'
import { categoryIcon, BREAK_ICON } from '@/lib/icons'
import { categoryColors } from '@/lib/mock-data'
import type { CalendarEvent, TimelineItem } from '@/lib/types'
import { useStore } from '@/lib/store'
import { computeMomentum, localDateStr } from '@/lib/momentum'
import { computeGaps, slotTasks, currentNextActions, availableActions, materializeFixedBlocks, ymd } from '@/lib/schedule'
import { ProgressRing } from './ProgressRing'

// Quick timed breaks. Snack/bathroom prompt a water refill since she's already up.
const BREAKS = [
  { kind: 'snack', label: 'Snack', mins: 5, promptWater: true, emoji: '🍎' },
  { kind: 'bathroom', label: 'Bathroom', mins: 3, promptWater: true, emoji: '🚻' },
  { kind: 'break', label: 'Break', mins: 5, promptWater: false, emoji: '☕' },
]

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
  const [breakMode, setBreakMode] = useState<{ label: string; mins: number; promptWater: boolean } | null>(null)
  const [inbox, setInbox] = useState<{ id: string; raw_text: string | null; source: string }[]>([])
  const [birthdayDismissed, setBirthdayDismissed] = useState(false)
  const [overwhelmed, setOverwhelmed] = useState(false)
  const [deciding, setDeciding] = useState(false)
  const [focusing, setFocusing] = useState(false)
  // When she uses the decide helper to commit to one thing, it jumps to the front.
  const [focusId, setFocusId] = useState<string | null>(null)
  // Anchored rituals she's tapped "Later" on — stepped past in the focus card for
  // now (session-only); they stay visible in the rhythm strip, no guilt.
  const [laterRituals, setLaterRituals] = useState<Set<string>>(new Set())
  // Preview the takeover any day via /?birthday-preview (won't burn the real
  // once-a-year moment). Safe to read window lazily: the takeover is gated on
  // store.loaded, which is false at hydration, so there's no markup mismatch.
  const [birthdayPreview] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('birthday-preview')
  )

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

  // Once her data is loaded, queue any gift-prep that's within its lead window.
  useEffect(() => {
    if (store.loaded) store.queueBirthdayPrep(new Date())
  }, [store.loaded, store.queueBirthdayPrep])

  // currentNextActions = one step per goal (used for room/presence matching).
  // availableActions = the fuller pool (flexible goals offer all their steps),
  // which is what fills her day and the "Just do this" stack.
  const nextActions = currentNextActions(store.goals, store.microTasks)
  const available = availableActions(store.goals, store.microTasks)
  // If she committed to one via the decide helper, float it to the front.
  const orderedAvailable = (() => {
    if (!focusId) return available
    const idx = available.findIndex(t => t.id === focusId)
    if (idx <= 0) return available
    return [available[idx], ...available.slice(0, idx), ...available.slice(idx + 1)]
  })()
  const topTasks = orderedAvailable.slice(0, 5)
  // Drop a stale focus pick once that task is done/gone, so it can't linger.
  const focusStillValid = !focusId || available.some(t => t.id === focusId)
  useEffect(() => { if (!focusStillValid) setFocusId(null) }, [focusStillValid])
  // The single lightest thing she could do — shortest, least cognitively heavy —
  // for the overwhelm reset, which collapses the day down to just one tiny step.
  const LOAD_RANK = { mindless: 0, light: 1, deep: 2 } as const
  const lightestTask = [...available].sort((a, b) =>
    a.microTask.durationMin - b.microTask.durationMin ||
    LOAD_RANK[a.microTask.cognitiveLoad] - LOAD_RANK[b.microTask.cognitiveLoad]
  )[0] ?? null

  // The single most-pressing due, time-anchored ritual (meds, wrap-up, kid time…)
  // gets pulled into the focus card so the rhythm of her day lands in the same
  // one-thing-at-a-time flow as her tasks. High-frequency ambient ones (water,
  // move, protein) stay in the rhythm strip.
  const focusRitual = rankRituals(store.rituals, store.ritualLog, now)
    .find(s => s.due && isAnchoredCadence(s.ritual.cadence) && !laterRituals.has(s.ritual.id))
    ?.ritual ?? null

  // Her real anchors (school runs, gym) become hard blocks the day schedules around.
  const fixedEvents = materializeFixedBlocks(store.settings.fixedBlocks, now)
  const allEvents = [...events, ...fixedEvents]
  const gymId = `gym-${ymd(now)}`
  const currentGym = store.settings.fixedBlocks.find(b => b.id === gymId) ?? null
  // Gym conflicts check against meetings + other anchors, not the gym's own blocks.
  const conflictEvents = [...events, ...fixedEvents.filter(e => !e.id.startsWith(gymId))]

  // wake/sleep can be half-hours (e.g. 6.5 = 6:30am), so split into hours + minutes.
  const wh = Math.floor(store.settings.wakeHour), wm = Math.round((store.settings.wakeHour % 1) * 60)
  const sh = Math.floor(store.settings.sleepHour), sm = Math.round((store.settings.sleepHour % 1) * 60)
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), wh, wm, 0)
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0)
  const gaps = computeGaps(allEvents, dayStart, dayEnd)
  const scheduled = slotTasks(gaps, available, now, store.settings.transitionBufferMin)

  const timeline: TimelineItem[] = [
    ...allEvents.map(e => ({ sortTime: e.startTime, item: { type: 'event' as const, data: e } })),
    ...gaps.map(g => ({
      sortTime: g.startTime,
      item: { type: 'gap' as const, data: g, scheduledTasks: scheduled.filter(st => st.gap.id === g.id) },
    })),
  ]
    .sort((a, b) => a.sortTime.localeCompare(b.sortTime))
    .map(x => x.item)

  const completedTasks = store.microTasks.filter(t => t.status === 'completed').length
  const totalMinutes = store.microTasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.durationMin, 0)
  const momentum = computeMomentum(store.activeDays, now)
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
        Good {greeting}{momentum.streak > 0 ? ` · ${momentum.streak} day streak` : ` · ${momentum.weekCount} active days this week`}
      </p>
      <h1 className={`font-display font-bold tracking-tight leading-[0.95] ${sizes.day}`}>{format(now, 'EEEE')}</h1>
      <div className="flex items-end gap-3 mt-1">
        <span className={`font-display font-extrabold leading-[0.78] text-today-ink ${sizes.num}`}>{format(now, 'd')}</span>
        <div className="pb-2">
          <p className={`font-display font-bold leading-none ${sizes.month}`}>{format(now, 'MMMM')}</p>
          <p className="font-mono text-xs text-muted mt-1.5">{format(now, 'h:mm a')}</p>
        </div>
      </div>
      <button
        onClick={() => { store.trackUse('overwhelm'); setDeciding(false); setFocusing(false); setOverwhelmed(true) }}
        className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-3 text-base font-bold text-today-ink hover:opacity-90 active:scale-95 transition-all"
        style={{ backgroundColor: 'var(--today-tint)', boxShadow: 'inset 0 0 0 1.5px var(--today-ink)' }}
      >
        <span className="text-xl">🫧</span> Feeling overwhelmed?
      </button>
    </div>
  )

  const rhythm = (
    <RhythmStrip
      rituals={store.rituals}
      ritualLog={store.ritualLog}
      now={now}
      excludeId={focusRitual?.id}
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

  const gymPicker = (
    <GymPicker events={conflictEvents} now={now} currentGym={currentGym} onPick={store.setGymSlot} onClear={store.clearGym} />
  )

  const datesCard = <ImportantDates dates={store.settings.importantDates} now={now} />

  // Optional evening mood check-in (opt-in). Shows in the last ~2h before sleep.
  // Guard the window so a post-midnight sleepHour doesn't make it negative (always-on).
  const todayKey = localDateStr(now)
  const eveningStartHour = Math.floor(store.settings.sleepHour) - 2
  const showCheckin = store.settings.eveningCheckin && eveningStartHour >= 0 && now.getHours() >= eveningStartHour
  const moodCheckin = showCheckin
    ? <MoodCheckin todayMood={store.moodLog[todayKey]} onPick={(m) => { store.trackUse('mood'); store.setMood(todayKey, m) }} />
    : null

  const water = (
    <WaterTracker
      log={store.ritualLog['water'] ?? []}
      now={now}
      onRefill={() => store.completeRitual('water')}
      onUndo={() => store.undoRitual('water')}
    />
  )

  const justDoThis = (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <Head lead="Just do" accent="this" />
        {!breakMode && nextActions.length >= 2 && (
          <button
            onClick={() => { store.trackUse('decide'); setOverwhelmed(false); setFocusing(false); setDeciding(true) }}
            className="shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-today-ink hover:opacity-90 active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--today-tint)', boxShadow: 'inset 0 0 0 1.5px var(--today-ink)' }}
          >
            <span className="text-lg">🤔</span> Stuck deciding?
          </button>
        )}
      </div>
      {breakMode ? (
        <BreakCard
          label={breakMode.label}
          mins={breakMode.mins}
          promptWater={breakMode.promptWater}
          onRefill={() => store.completeRitual('water')}
          onDone={() => setBreakMode(null)}
        />
      ) : (
        <>
          {focusRitual ? (
            <RitualFocusCard
              ritual={focusRitual}
              onComplete={() => { store.trackUse('ritual_focus'); store.completeRitual(focusRitual.id) }}
              onLater={() => setLaterRituals(prev => new Set(prev).add(focusRitual.id))}
            />
          ) : topTasks.length > 0 ? (
            <JustDoThisCard tasks={topTasks} onComplete={store.completeTask} onSkip={store.skipTask} onEvent={store.trackUse} />
          ) : store.goals.length > 0 ? (
            <div className="bg-success-soft rounded-[2rem] p-10 text-center">
              <Illo src={pickDaily(DONE_ILLOS)} className="h-28 w-auto mx-auto mb-4" />
              <h2 className="font-display text-3xl font-bold">All <span className="italic font-normal">clear</span></h2>
              <p className="text-muted text-sm mt-1">Nothing needs you right now. Enjoy it.</p>
            </div>
          ) : (
            <button onClick={() => setCaptureOpen(true)} className="w-full bg-today-tint rounded-[2rem] p-10 text-center hover:opacity-90 transition-opacity">
              <Illo src={ILLO.startList} className="h-24 w-auto mx-auto mb-4 animate-float" />
              <h2 className="font-display text-3xl font-bold text-today-ink">Start your <span className="italic font-normal">list</span></h2>
              <p className="text-muted text-sm mt-1">Snap a photo of a list, or jot one thing you want to get done.</p>
            </button>
          )}

          {/* Quick breaks: a timed 3-5 min step away, with a water nudge */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {BREAKS.map(b => {
              const Icon = BREAK_ICON[b.kind]
              return (
                <button
                  key={b.kind}
                  onClick={() => setBreakMode({ label: b.label, mins: b.mins, promptWater: b.promptWater })}
                  className="rounded-2xl bg-card border border-card-border py-4 hover:border-today-ink/40 active:scale-[0.97] transition-all flex flex-col items-center"
                >
                  <Icon size={26} className="mb-1.5 text-today-ink" />
                  <span className="font-display text-base font-bold">{b.label}</span>
                </button>
              )
            })}
          </div>

          {/* Body doubling: start a co-working focus block, optionally with John */}
          <button
            onClick={() => { store.trackUse('focus'); setOverwhelmed(false); setDeciding(false); setFocusing(true) }}
            className="w-full mt-3 rounded-2xl py-4 text-base font-bold text-today-ink hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--today-tint)', boxShadow: 'inset 0 0 0 1.5px var(--today-ink)' }}
          >
            <span className="text-xl">🤝</span> Focus together
          </button>
        </>
      )}
    </section>
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
      ) : timeline.length > 0 ? (
        <div className="rounded-[1.75rem] p-5 space-y-3" style={{ backgroundColor: 'var(--today-tint)' }}>
          {railRows}
        </div>
      ) : noCalendars ? (
        <Link href="/settings">
          <div className="rounded-[1.75rem] p-8 text-center" style={{ backgroundColor: 'var(--today-tint)' }}>
            <p className="font-display text-xl font-bold text-today-ink">Connect a calendar</p>
            <p className="text-xs text-muted mt-1">Add your Google or iCal links so the day knows your free time.</p>
          </div>
        </Link>
      ) : (
        <div className="rounded-[1.75rem] p-8 text-center font-mono text-sm text-muted" style={{ backgroundColor: 'var(--today-tint)' }}>
          No events today. Your whole day is open.
        </div>
      )}
    </section>
  )

  const winsTiles = (
    <div className="grid grid-cols-3 gap-3 mb-10">
      <div className="rounded-[1.5rem] p-5" style={{ backgroundColor: 'var(--today-tint)' }}>
        <p className="font-display text-4xl font-extrabold leading-none text-today-ink">{momentum.streak}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mt-2">day streak</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mt-1">{momentum.weekCount}/7 this week</p>
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
          const GoalIcon = categoryIcon(goal.category)
          const taskCount = store.microTasks.filter(t => t.goalId === goal.id).length
          const doneCount = store.microTasks.filter(t => t.goalId === goal.id && t.status === 'completed').length
          return (
            <motion.div key={goal.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} className="bg-card border border-card-border rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <ProgressRing progress={goal.progressPct} size={44} strokeWidth={5} color={color}>
                  <GoalIcon size={16} style={{ color }} />
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
        {datesCard}
        {meetingCopilot}
        {presence}
        {justDoThis}
        {rhythm}
        {gymPicker}
        {flowSection}
      </div>
      <div className="space-y-10 pt-2">
        {moodCheckin}
        {water}
        {winsTiles}
        {goalsRail}
      </div>
    </div>
  )

  // ── Mobile ──
  const mobile = (
    <div className="md:hidden max-w-lg mx-auto px-5 pt-12">
      <div className="flex items-center gap-2 mb-6">
        <Illo src="/avatar.png" alt="" className="w-8 h-8 rounded-lg" />
        <span className="font-display text-base font-bold">GaeDHD</span>
      </div>
      {header({ day: 'text-6xl', num: 'text-[7rem]', month: 'text-xl' })}
      {datesCard}
      {moodCheckin}
      <div className="mb-10">{water}</div>
      {meetingCopilot}
      {presence}
      {justDoThis}
      {rhythm}
      {gymPicker}
      {flowSection}
      {winsTiles}
    </div>
  )

  // The birthday takeover: fires the first time she opens the app on her own
  // birthday, then once a year after. Preview mode shows it any day, unpersisted.
  const herBday = store.settings.importantDates.find(d => d.id === 'bday-her')
  const isHerBirthday = !!herBday && now.getMonth() + 1 === herBday.month && now.getDate() === herBday.day
  const showBirthday = store.loaded && !birthdayDismissed
    && (birthdayPreview || (isHerBirthday && store.birthdayMomentYear !== now.getFullYear()))
  const dismissBirthday = () => {
    setBirthdayDismissed(true)
    if (!birthdayPreview) store.dismissBirthdayMoment(now.getFullYear())
  }

  return (
    <>
      {showBirthday && (
        <BirthdayTakeover name={store.settings.userName || RECIPIENT_NAME} onDismiss={dismissBirthday} />
      )}
      {overwhelmed && !showBirthday && (
        <OverwhelmReset
          task={lightestTask}
          onCompleteTask={store.completeTask}
          onClose={() => setOverwhelmed(false)}
        />
      )}
      {deciding && !showBirthday && (
        <DecideHelper
          candidates={nextActions}
          onPick={(id) => { setFocusId(id); setDeciding(false) }}
          onClose={() => setDeciding(false)}
        />
      )}
      {focusing && !showBirthday && <FocusSession onClose={() => setFocusing(false)} />}
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
