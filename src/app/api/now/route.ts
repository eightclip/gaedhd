import { getSupabaseAdmin, supabaseConfigured, STATE_TABLE } from '@/lib/supabase-server'
import type { Goal, MicroTask, CalendarEvent, ParkingLotItem, ImportantDate } from '@/lib/types'
import type { CalendarSource } from '@/lib/store'
import type { Ritual } from '@/lib/rituals'
import { rankRituals, DEFAULT_RITUALS } from '@/lib/rituals'
import { computeMomentum } from '@/lib/momentum'
import { localDateAnchor, startOfLocalDay, APP_TZ } from '@/lib/clock'
import { currentNextActions, availableActions } from '@/lib/schedule'
import { upcomingDates } from '@/lib/dates'
import { fetchEventsForSources } from '@/lib/ical'
import { nowTokenValid } from '@/lib/now-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Token-protected, read-only "what matters right now" endpoint. Powers the office TV
// kiosk and any ambient device. Prefer an `Authorization: Bearer <token>` header;
// the legacy ?token= query param still works for clients that can't set headers.
export async function GET(request: Request) {
  if (!supabaseConfigured()) {
    return Response.json({ error: 'sync_not_configured' }, { status: 503 })
  }

  const params = new URL(request.url).searchParams
  if (!nowTokenValid(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const email = (
    process.env.GAEDHD_NOW_EMAIL ||
    (process.env.ALLOWED_EMAILS || '').split(',')[0] ||
    ''
  ).trim().toLowerCase()
  if (!email) {
    return Response.json({ error: 'no_user_configured' }, { status: 500 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select('state')
    .eq('user_email', email)
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const state = (data?.state ?? {}) as {
    goals?: Goal[]
    microTasks?: MicroTask[]
    rituals?: Ritual[]
    ritualLog?: Record<string, string[]>
    parkingLot?: ParkingLotItem[]
    streak?: number
    activeDays?: string[]
    featureUsage?: Record<string, number>
    settings?: { calendarSources?: CalendarSource[]; wakeHour?: number; sleepHour?: number; importantDates?: ImportantDate[] }
  }

  const now = new Date()
  const goals = state.goals ?? []
  const microTasks = state.microTasks ?? []

  // Her single next thing, via the same next-action logic the app uses.
  const next = currentNextActions(goals, microTasks)[0]
  const task = next
    ? { title: next.microTask.title, durationMin: next.microTask.durationMin, phase: next.microTask.phase, goal: next.goal.title, emoji: next.goal.emoji }
    : null

  // Rituals (never expose private ones to a shared screen).
  const rituals = (state.rituals && state.rituals.length ? state.rituals : DEFAULT_RITUALS).filter(r => !r.private)
  const ritualLog = state.ritualLog ?? {}
  // Rank in HER timezone. This function runs in UTC, so without the tz the day
  // would roll over at 5pm Pacific and every ritual window would be shifted.
  const statuses = rankRituals(rituals, ritualLog, now, APP_TZ)
  const ritualsDue = statuses
    .filter(s => s.due)
    .map(s => ({ id: s.ritual.id, title: s.ritual.title, emoji: s.ritual.emoji, nudge: s.ritual.nudge, nudgeVariants: s.ritual.nudgeVariants ?? [], tint: s.ritual.tint }))
  // The whole rhythm, for the kiosk's at-a-glance row.
  const rhythm = statuses.map(s => {
    const c = s.ritual.cadence
    const target = c.kind === 'timesPerDay' ? c.times : (c.kind === 'daily' || c.kind === 'dailyAt' || c.kind === 'everyDays' ? 1 : null)
    return { id: s.ritual.id, title: s.ritual.title, emoji: s.ritual.emoji, tint: s.ritual.tint, due: s.due, doneToday: s.completedToday, target }
  })

  // Today's wins. Anchored to the real instant HER day started, not the server's
  // UTC midnight — otherwise the kiosk zeroes her counts at 5pm Pacific.
  const startOfDay = startOfLocalDay(APP_TZ, now)
  const startMs = startOfDay.getTime()
  const doneToday = microTasks.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt) >= startOfDay)
  const completedToday = doneToday.length
  const minutesToday = doneToday.reduce((sum, t) => sum + t.durationMin, 0)

  // Water cups today (the Stanley-cup tracker).
  const waterCount = (ritualLog['water'] ?? []).filter(t => new Date(t).getTime() >= startMs).length

  // Up next: the next few small things she could grab (beyond "right now").
  const pool = availableActions(goals, microTasks)
  const upNext = pool.slice(0, 5).map(a => ({ title: a.microTask.title, goal: a.goal.title, durationMin: a.microTask.durationMin }))

  // Her goals with progress, highest priority first.
  const goalsOut = [...goals]
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 6)
    .map(g => ({ title: g.title, emoji: g.emoji, category: g.category, progressPct: g.progressPct }))

  // Birthdays/anniversaries in the next two weeks. Anchor to her local date, or
  // "days until" is off by one all evening (the UTC date is already tomorrow).
  const upcoming = upcomingDates(state.settings?.importantDates ?? [], localDateAnchor(APP_TZ, now), 14)
    .map(u => ({ label: u.date.label, daysUntil: u.daysUntil, kind: u.date.kind, years: u.years }))

  // Stuff waiting in her dump.
  const dumpCount = (state.parkingLot ?? []).length

  // Forgiving momentum streak (falls back to legacy `streak` for old state blobs).
  // Anchor to HER local date, not the server's UTC date, so the kiosk doesn't
  // drift a day every evening (same class of bug as the quiet-hours TZ fix).
  const momentum = computeMomentum(state.activeDays ?? [], localDateAnchor(APP_TZ, now))
  const streak = state.activeDays?.length ? momentum.streak : (state.streak ?? 0)

  // Today's meetings (client passes its local day window to avoid timezone drift).
  // The kiosk passes its own local day window. Callers that don't (the Telegram
  // bot) get HER day, not the server's UTC one.
  const dayStart = params.get('start') ? new Date(params.get('start')!) : startOfDay
  const dayEnd = params.get('end')
    ? new Date(params.get('end')!)
    : new Date(startOfDay.getTime() + 86_400_000 - 1_000)
  const sources = state.settings?.calendarSources ?? []
  let events: CalendarEvent[] = []
  if (sources.length) {
    const res = await fetchEventsForSources(sources, dayStart, dayEnd)
    events = res.events
  }

  return Response.json({
    task,
    pendingCount: pool.length,
    ritualsDue,
    rhythm,
    water: { count: waterCount, goal: 4 },
    upNext,
    goals: goalsOut,
    upcoming,
    dumpCount,
    streak,
    weekCount: momentum.weekCount,
    featureUsage: state.featureUsage ?? {},
    completedToday,
    minutesToday,
    events,
  })
}
