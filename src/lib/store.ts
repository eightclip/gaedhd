'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Goal, MicroTask, ParkingLotItem, FixedBlock, ImportantDate } from './types'
import type { Ritual } from './rituals'
import { DEFAULT_RITUALS } from './rituals'
import { localDateStr } from './momentum'
import { goals as mockGoals, microTasks as mockTasks, parkingLotItems as mockParking } from './mock-data'

// ─── Types ──────────────────────────────────────────────────────
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  // If the assistant proposed a goal breakdown, attach it here
  proposedGoal?: {
    title: string
    category: string
    emoji: string
    tasks: { title: string; durationMin: number; phase: string; energyLevel: string }[]
  }
  accepted?: boolean // user tapped "Add this goal"
  createdAt: string
}

export interface CalendarSource {
  id: string
  name: string
  url: string
  color: string
  type: 'google' | 'ical'
}

// A gentle once-a-day emotional read. Off by default — opt-in only — to avoid
// adding nag load (see RESEARCH.md #5).
export type Mood = 'rough' | 'ok' | 'good'

// How much of the breakdown the AI does for her. Fading this from 'full' toward
// 'prompt' is the core self-sufficiency lever (see RESEARCH.md #8).
export type HelpLevel = 'full' | 'partial' | 'prompt'

export interface AppSettings {
  anthropicApiKey: string
  userName: string
  wakeHour: number   // e.g. 7 = 7am
  sleepHour: number   // e.g. 22 = 10pm
  transitionBufferMin: number // minutes between events
  calendarSources: CalendarSource[]
  userContext: string // her equipment, spaces, preferences — fed to the AI breakdown
  fixedBlocks: FixedBlock[] // her real anchors (school runs, gym) that shape the day
  importantDates: ImportantDate[] // birthdays, anniversaries to never miss
  eveningCheckin: boolean // show the optional "how did today feel?" card in the evening
  helpLevel: HelpLevel // how much the AI breaks goals down vs. coaching her to do it
}

const CALENDAR_COLORS = ['#C85D3E', '#7B9E6B', '#9B7EC8', '#6BA3BE', '#D4845E', '#C87E9E']

export function detectCalendarType(url: string): 'google' | 'ical' {
  return url.toLowerCase().includes('google.com') ? 'google' : 'ical'
}

export interface AppState {
  goals: Goal[]
  microTasks: MicroTask[]
  parkingLot: ParkingLotItem[]
  chatMessages: ChatMessage[]
  settings: AppSettings
  rituals: Ritual[]
  // Completion timestamps per ritual id (ISO strings). The rituals engine reads
  // this to decide what's due now and resets on cadence.
  ritualLog: Record<string, string[]>
  // Meeting titles she's flagged as "this could be async (Slack/email)".
  asyncMeetings: string[]
  // Per important-date occurrence (`${id}-${year}`): 'queued' once its gift-prep was added.
  importantDateLog: Record<string, string>
  // The year she last saw the birthday takeover, so the moment fires once a year.
  birthdayMomentYear: number
  streak: number
  tasksCompletedToday: number
  // Local YYYY-MM-DD strings, one per day she completed anything. Feeds the
  // forgiving momentum streak (see lib/momentum.ts) instead of a brittle counter.
  activeDays: string[]
  // Optional evening mood check-in, keyed by local YYYY-MM-DD.
  moodLog: Record<string, Mood>
  // Private tap-counts for the new surfaces (overwhelm/decide/focus/tiny/reframe),
  // so we can see what she actually uses and prune what she doesn't. Counts only —
  // no content, no timestamps. Lives in her own synced state; surfaced to John via
  // the bot's /usage command.
  featureUsage: Record<string, number>
}

// Stamp today onto the active-days log (idempotent per day).
function recordActiveDay(days: string[]): string[] {
  const today = localDateStr(new Date())
  return days.includes(today) ? days : [...days, today]
}

// The last n calendar days (today first), as local YYYY-MM-DD strings. Used to
// back-fill activeDays for returning users whose blob predates it, so their
// existing streak carries over instead of crashing to a shame-inducing 0.
function seedRecentDays(n: number): string[] {
  const count = Math.min(Math.max(Math.floor(n), 0), 60)
  const t = new Date()
  return Array.from({ length: count }, (_, i) =>
    localDateStr(new Date(t.getFullYear(), t.getMonth(), t.getDate() - i))
  )
}

const DEFAULT_SETTINGS: AppSettings = {
  anthropicApiKey: '',
  userName: '',
  wakeHour: 6.5, // 6:30am
  sleepHour: 22, // 10:00pm
  transitionBufferMin: 3,
  calendarSources: [],
  userContext: '',
  eveningCheckin: false,
  helpLevel: 'full',
  fixedBlocks: [
    { id: 'school-drop', title: 'Take kids to school', emoji: '🏫', startHour: 8, startMin: 0, durationMin: 30, travelMin: 0, days: [1, 2, 3, 4, 5], color: '#C87E9E' },
    { id: 'school-pickup', title: 'Pick up kids', emoji: '🏫', startHour: 15, startMin: 0, durationMin: 30, travelMin: 0, days: [1, 2, 3, 4, 5], color: '#C87E9E' },
  ],
  importantDates: [
    { id: 'bday-her', label: 'Your birthday', month: 6, day: 6, year: 1982, kind: 'birthday' },
    { id: 'anniversary', label: 'Wedding anniversary', month: 10, day: 9, year: 2010, kind: 'anniversary', leadDays: 7 },
    { id: 'kid-2013', label: "Older kiddo's birthday", month: 6, day: 29, year: 2013, kind: 'birthday', leadDays: 5 },
    { id: 'kid-2015', label: "Younger kiddo's birthday", month: 5, day: 20, year: 2015, kind: 'birthday', leadDays: 5 },
  ],
}

const INITIAL_STATE: AppState = {
  goals: mockGoals,
  microTasks: mockTasks,
  parkingLot: mockParking,
  chatMessages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hey! 👋 I'm your GaeDHD assistant. Tell me something you want to get done — big or small — and I'll break it into tiny, doable steps that fit into your day.\n\nTry something like:\n• \"25 RDLs for the booty\"\n• \"deep clean the kitchen\"\n• \"learn 10 Spanish words\"\n• \"finish my watercolor painting\"",
      createdAt: new Date().toISOString(),
    }
  ],
  settings: DEFAULT_SETTINGS,
  rituals: DEFAULT_RITUALS,
  ritualLog: {},
  asyncMeetings: [],
  importantDateLog: {},
  birthdayMomentYear: 0,
  // Start honest: no fabricated streak or active days. A day-one account must not
  // be shown a "5 day streak" it didn't earn (see gaedhd-copy-clarity — plain, true
  // copy for Gaelyn). Her real taps build these up from zero.
  streak: 0,
  tasksCompletedToday: 0,
  activeDays: [],
  moodLog: {},
  featureUsage: {},
}

// A genuinely blank slate for "Reset all data". No mock goals/tasks, no fake
// streak, no fabricated active days, empty logs. resetData() overlays her real
// settings + rituals on top so the app still works after a reset; her actual
// activity rebuilds the streak from 0. Kept separate from INITIAL_STATE (which is
// also the first-paint/first-run seed) so a reset can never re-install demo data.
const EMPTY_STATE: AppState = {
  goals: [],
  microTasks: [],
  parkingLot: [],
  chatMessages: INITIAL_STATE.chatMessages,
  settings: DEFAULT_SETTINGS,
  rituals: DEFAULT_RITUALS,
  ritualLog: {},
  asyncMeetings: [],
  importantDateLog: {},
  birthdayMomentYear: 0,
  streak: 0,
  tasksCompletedToday: 0,
  activeDays: [],
  moodLog: {},
  featureUsage: {},
}

// ─── Hook ───────────────────────────────────────────────────────
const STORAGE_KEY = 'gaedhd-state'

function mergeState(parsed: Partial<AppState> | null | undefined): AppState {
  if (!parsed) return INITIAL_STATE
  return {
    ...INITIAL_STATE,
    ...parsed,
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    // Seed rituals for accounts saved before they existed; keep her edits otherwise.
    rituals: parsed.rituals && parsed.rituals.length ? parsed.rituals : DEFAULT_RITUALS,
    ritualLog: parsed.ritualLog ?? {},
    asyncMeetings: parsed.asyncMeetings ?? [],
    importantDateLog: parsed.importantDateLog ?? {},
    // Returning users predating activeDays: carry their old streak forward so the
    // forgiving counter doesn't open at a punishing 0 (the very thing it prevents).
    activeDays: parsed.activeDays ?? (parsed.streak ? seedRecentDays(parsed.streak) : []),
    moodLog: parsed.moodLog ?? {},
    featureUsage: parsed.featureUsage ?? {},
  }
}

function loadCache(): AppState {
  if (typeof window === 'undefined') return INITIAL_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return INITIAL_STATE
    return mergeState(JSON.parse(raw))
  } catch {
    return INITIAL_STATE
  }
}

function saveCache(state: AppState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage full or unavailable
  }
}

// A dirty marker persisted ALONGSIDE the cache. If she taps something while the
// sync is down and then reloads, this survives the reload so the reconciler knows
// to MERGE her local edits into the server blob instead of blindly adopting it (and
// silently dropping the offline edit).
const DIRTY_KEY = 'gaedhd-dirty'
function loadDirtyMarker(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(DIRTY_KEY) === '1' } catch { return false }
}
function saveDirtyMarker(dirty: boolean) {
  if (typeof window === 'undefined') return
  try {
    if (dirty) localStorage.setItem(DIRTY_KEY, '1')
    else localStorage.removeItem(DIRTY_KEY)
  } catch {
    // localStorage full or unavailable
  }
}

// ─── Field-aware merge (a completion can never be lost) ──────────
// Used when two devices raced (server returns 409 on a stale write) or when we
// reconnect after an outage. Rule of thumb: append-only / monotonic data is
// UNIONed so a tap made on either device always survives; free-form data
// (settings, chat) is last-writer-wins. `local` is THIS device's state (the
// writer's intent); `server` is the other side we're reconciling against.

function unionSorted(a: string[] = [], b: string[] = []): string[] {
  // ISO timestamps and YYYY-MM-DD both sort chronologically as plain strings.
  return Array.from(new Set([...a, ...b])).sort()
}

function mergeRitualLog(
  a: Record<string, string[]> = {},
  b: Record<string, string[]> = {},
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[id] = unionSorted(a[id], b[id])
  }
  return out
}

function mergeFeatureUsage(
  a: Record<string, number> = {},
  b: Record<string, number> = {},
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    // MAX, never sum: a retried PUT must not double-count a tap.
    out[k] = Math.max(a[k] ?? 0, b[k] ?? 0)
  }
  return out
}

// Merge two id-keyed lists. UNION by id so nothing captured on one device is
// dropped, resolving id collisions with `pick`. No tombstones exist, so a delete
// on one device can be resurrected by a stale copy on the other — an accepted
// trade: re-showing a deleted item is recoverable; losing a completion or a
// capture is not.
function mergeById<T extends { id: string }>(
  local: T[] = [],
  server: T[] = [],
  pick: (localItem: T, serverItem: T) => T,
): T[] {
  const merged = new Map<string, T>()
  for (const item of server) merged.set(item.id, item)
  for (const item of local) {
    const other = merged.get(item.id)
    merged.set(item.id, other ? pick(item, other) : item)
  }
  // Keep local's ordering first (new items are prepended), then server-only items.
  const ordered: T[] = []
  const seen = new Set<string>()
  for (const item of local) if (!seen.has(item.id)) { ordered.push(merged.get(item.id)!); seen.add(item.id) }
  for (const item of server) if (!seen.has(item.id)) { ordered.push(merged.get(item.id)!); seen.add(item.id) }
  return ordered
}

function pickTask(local: MicroTask, server: MicroTask): MicroTask {
  const localDone = local.status === 'completed'
  const serverDone = server.status === 'completed'
  // Completion is monotonic: if either side completed it, it stays completed and we
  // keep the later completedAt. Never resurrect a completed task as pending.
  if (localDone && serverDone) return (local.completedAt ?? '') >= (server.completedAt ?? '') ? local : server
  if (localDone) return local
  if (serverDone) return server
  // Neither completed: last-writer (local) wins for in-flight edits (skip, retitle).
  return local
}

function pickParking(local: ParkingLotItem, server: ParkingLotItem): ParkingLotItem {
  // `processed` is monotonic (once drained from the inbox it shouldn't return).
  if (local.processed && !server.processed) return local
  if (server.processed && !local.processed) return server
  return local
}

// Exported so the convergence rules can be exercised directly: this is the one
// function standing between a two-device race and a completion vanishing.
export function mergeAppState(local: AppState, server: AppState): AppState {
  return {
    // Last-writer default for scalars (streak/tasksCompletedToday are derived day
    // counters), settings, chatMessages, and asyncMeetings. settings & chatMessages
    // are free-form, not append-only, so last-writer-wins is acceptable here.
    ...local,
    goals: mergeById(local.goals, server.goals, (l) => l),
    microTasks: mergeById(local.microTasks, server.microTasks, pickTask),
    parkingLot: mergeById(local.parkingLot, server.parkingLot, pickParking),
    ritualLog: mergeRitualLog(local.ritualLog, server.ritualLog),
    activeDays: unionSorted(local.activeDays, server.activeDays),
    birthdayMomentYear: Math.max(local.birthdayMomentYear || 0, server.birthdayMomentYear || 0),
    // Union keys; local wins on a same-day conflict. moodLog is one entry per day.
    moodLog: { ...server.moodLog, ...local.moodLog },
    // Union keys; values are the monotonic 'queued' marker, so either side is fine.
    importantDateLog: { ...server.importantDateLog, ...local.importantDateLog },
    featureUsage: mergeFeatureUsage(local.featureUsage, server.featureUsage),
  }
}

export function useStore() {
  const [state, setState] = useState<AppState>(INITIAL_STATE)
  const [loaded, setLoaded] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // True once we've reconciled with the server at least once. We only push to the
  // cloud after this, so a device whose first load failed can't overwrite good
  // cloud data with its local/mock state.
  const reconciledRef = useRef(false)
  // True while there are local edits not yet confirmed-saved. Pull-sync skips when
  // dirty so an incoming poll can't revert an edit she just made before it's saved.
  const dirtyRef = useRef(false)
  // The server's updated_at we last reconciled with. Sent as `baseUpdatedAt` on PUT
  // so the server can compare-and-swap: if another device has written since, our
  // write is rejected (409) instead of clobbering hers.
  const baseUpdatedRef = useRef<string | null>(null)
  // JSON of the state we last know is on the server. Lets the persist effect tell a
  // real local edit (must push) from merely adopting a pull (must NOT push), so a
  // pulled value doesn't bounce straight back and churn everyone's updated_at.
  const lastSyncedJsonRef = useRef<string | null>(null)
  // Always-latest state, so a debounced/retried push sends the newest value.
  const stateRef = useRef<AppState>(INITIAL_STATE)
  // Serializes pushes so the debounce and the retry loop can't PUT concurrently.
  const savingRef = useRef(false)

  // Push the latest local state up with a compare-and-swap. Serialized via
  // savingRef so the debounce and the retry loop never PUT at once.
  const pushOnce = useCallback(async () => {
    if (savingRef.current) return
    savingRef.current = true
    const snapshot = stateRef.current
    try {
      const res = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: snapshot, baseUpdatedAt: baseUpdatedRef.current }),
      })
      if (res.status === 409) {
        // Another device saved between our base and now. MERGE the server's state
        // into ours additively (a completion/capture can never be lost), show the
        // converged result, and let the persist effect re-push with the fresh base.
        const data = await res.json().catch(() => ({} as { state?: unknown; updatedAt?: string }))
        const serverState = mergeState(data.state as Partial<AppState> | null)
        const merged = mergeAppState(snapshot, serverState)
        baseUpdatedRef.current = data.updatedAt ?? null
        lastSyncedJsonRef.current = JSON.stringify(serverState)
        stateRef.current = merged
        setState(merged) // merged !== serverState → effect schedules the retry push
        return
      }
      if (res.ok) {
        const data = await res.json().catch(() => ({} as { updatedAt?: string }))
        baseUpdatedRef.current = data.updatedAt ?? baseUpdatedRef.current
        lastSyncedJsonRef.current = JSON.stringify(snapshot)
        // Only clear dirty if nothing newer was typed while this save was in flight.
        if (JSON.stringify(stateRef.current) === lastSyncedJsonRef.current) {
          dirtyRef.current = false
          saveDirtyMarker(false)
        }
        return
      }
      // Non-OK (offline, 401, 5xx): keep dirty + marker set so the edit survives a
      // reload and is retried by the interval below. NEVER clear dirty on failure.
    } catch {
      // Network error mid-flight: same as above — stay dirty, retry later.
    } finally {
      savingRef.current = false
    }
  }, [])

  // Load: localStorage cache first (instant paint), then reconcile with the server,
  // which is the source of truth across devices.
  useEffect(() => {
    const cache = loadCache()
    const wasDirty = loadDirtyMarker()
    stateRef.current = cache
    setState(cache)
    dirtyRef.current = wasDirty
    // If a prior session left an unsynced edit, don't treat the cache as a synced
    // baseline — force the reconcile below (or a later edit) to push/merge it.
    lastSyncedJsonRef.current = wasDirty ? null : JSON.stringify(cache)

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/state')
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          reconciledRef.current = true
          if (data.state) {
            const serverState = mergeState(data.state)
            if (wasDirty) {
              // Local edits made before we ever reached the server (an outage, or a
              // reload mid-sync). MERGE them in so nothing offline is lost, then let
              // the persist effect push the merged result.
              const merged = mergeAppState(cache, serverState)
              baseUpdatedRef.current = data.updatedAt ?? null
              lastSyncedJsonRef.current = JSON.stringify(serverState)
              stateRef.current = merged
              setState(merged)
            } else {
              // No pending edits — adopt the server snapshot cleanly.
              baseUpdatedRef.current = data.updatedAt ?? null
              lastSyncedJsonRef.current = JSON.stringify(serverState)
              stateRef.current = serverState
              setState(serverState)
            }
          } else {
            // Server has nothing yet — first sync ever. Force a push of the local
            // cache up (base is null → the server inserts the first row).
            baseUpdatedRef.current = null
            lastSyncedJsonRef.current = null
          }
        }
      } catch {
        // Offline / sync down — keep the cache. reconciledRef stays false so we
        // can't clobber good cloud data; a later pull reconciles (and merges any
        // edits she makes meanwhile, which the persist effect marks dirty).
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Persist on change: localStorage immediately (+ a dirty marker), server PUT
  // debounced. The dirty bookkeeping runs even before we've reconciled, so an edit
  // made during an outage is remembered and MERGED later instead of being dropped.
  useEffect(() => {
    if (!loaded) return
    stateRef.current = state
    saveCache(state)
    const json = JSON.stringify(state)
    // In sync with the server (e.g. we just adopted a pull) — nothing to push.
    if (json === lastSyncedJsonRef.current) return
    dirtyRef.current = true
    saveDirtyMarker(true)
    // Only actually PUT once we've reconciled at least once, so a failed-load
    // device can't overwrite good cloud data with its local/mock state.
    if (!reconciledRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void pushOnce() }, 800)
  }, [state, loaded, pushOnce])

  // Retry loop: if a save failed (still dirty), keep trying so an edit made during a
  // blip eventually lands. Cheap no-op when clean or offline (pushOnce bails).
  useEffect(() => {
    if (!loaded) return
    const id = setInterval(() => {
      if (dirtyRef.current && reconciledRef.current) void pushOnce()
    }, 5_000)
    return () => clearInterval(id)
  }, [loaded, pushOnce])

  // Pull the latest cloud state so a change made on another device (her phone, the
  // computer, John's "coworker" login) shows up here.
  const pullFromServer = useCallback(async () => {
    // Skip a routine converge-poll while we hold unsynced edits that were already
    // reconciled once — the debounced push owns getting them up, and adopting the
    // server now would revert them. But the FIRST reconcile must still run even when
    // dirty, or edits made before we ever reached the server would never sync.
    if (dirtyRef.current && reconciledRef.current) return
    try {
      const res = await fetch('/api/state')
      if (!res.ok) return
      const data = await res.json()
      const firstReconcile = !reconciledRef.current
      reconciledRef.current = true
      const serverState = data.state ? mergeState(data.state) : null

      if (firstReconcile && dirtyRef.current) {
        // Came online with edits made before we ever reached the server. Merge them
        // in (additive) so nothing is lost, then let the persist effect push.
        const local = stateRef.current
        const merged = serverState ? mergeAppState(local, serverState) : local
        baseUpdatedRef.current = data.updatedAt ?? null
        lastSyncedJsonRef.current = serverState ? JSON.stringify(serverState) : null
        stateRef.current = merged
        setState(merged)
        return
      }
      if (serverState) {
        // Routine converge: adopt the server snapshot (we have no pending edits).
        baseUpdatedRef.current = data.updatedAt ?? null
        lastSyncedJsonRef.current = JSON.stringify(serverState)
        stateRef.current = serverState
        setState(serverState)
      }
    } catch {
      // offline — keep current state
    }
  }, [])

  // Converge across devices: pull when this tab regains focus/visibility (she just
  // switched to it) and on a slow background tick.
  useEffect(() => {
    if (!loaded) return
    const onVisible = () => { if (document.visibilityState === 'visible') pullFromServer() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', pullFromServer)
    const id = setInterval(pullFromServer, 30_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', pullFromServer)
      clearInterval(id)
    }
  }, [loaded, pullFromServer])

  const addGoal = useCallback((goal: Goal, tasks: MicroTask[]) => {
    setState(prev => ({
      ...prev,
      goals: [goal, ...prev.goals],
      microTasks: [...tasks, ...prev.microTasks],
    }))
  }, [])

  const addChatMessage = useCallback((msg: ChatMessage) => {
    setState(prev => ({
      ...prev,
      chatMessages: [...prev.chatMessages, msg],
    }))
  }, [])

  const acceptProposedGoal = useCallback((messageId: string) => {
    setState(prev => {
      const msg = prev.chatMessages.find(m => m.id === messageId)
      if (!msg?.proposedGoal) return prev

      const goalId = `goal-${Date.now()}`
      const newGoal: Goal = {
        id: goalId,
        title: msg.proposedGoal.title,
        description: '',
        category: msg.proposedGoal.category as Goal['category'],
        lifeArea: 'personal',
        priority: 3,
        progressPct: 0,
        createdAt: new Date().toISOString(),
        emoji: msg.proposedGoal.emoji,
      }

      const newTasks: MicroTask[] = msg.proposedGoal.tasks.map((t, i) => ({
        id: `mt-${Date.now()}-${i}`,
        goalId,
        title: t.title,
        durationMin: t.durationMin,
        energyLevel: (t.energyLevel || 'medium') as MicroTask['energyLevel'],
        context: 'anywhere' as const,
        cognitiveLoad: 'light' as const,
        toolsNeeded: [],
        phase: t.phase,
        sequenceOrder: i + 1,
        status: 'pending' as const,
      }))

      return {
        ...prev,
        goals: [newGoal, ...prev.goals],
        microTasks: [...newTasks, ...prev.microTasks],
        chatMessages: prev.chatMessages.map(m =>
          m.id === messageId ? { ...m, accepted: true } : m
        ),
      }
    })
  }, [])

  const addParkingLotItem = useCallback((text: string, source?: string) => {
    setState(prev => {
      // Dedup: if the exact text is already in the dump, don't add it again
      // (the inbox-drain can re-run on remounts).
      if (prev.parkingLot.some(p => p.rawText === text)) return prev
      return {
        ...prev,
        parkingLot: [{
          id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          rawText: text,
          processed: false,
          status: 'processing' as const, // the page kicks off the AI breakdown
          createdAt: new Date().toISOString(),
          source,
        }, ...prev.parkingLot],
      }
    })
  }, [])

  // Fill in the AI breakdown once it's computed (status -> 'ready' | 'error').
  const setDumpBreakdown = useCallback((id: string, patch: Partial<ParkingLotItem>) => {
    setState(prev => ({
      ...prev,
      parkingLot: prev.parkingLot.map(p => p.id === id ? { ...p, ...patch } : p),
    }))
  }, [])

  const updateDumpStep = useCallback((itemId: string, stepId: string, title: string) => {
    setState(prev => ({
      ...prev,
      parkingLot: prev.parkingLot.map(p => p.id === itemId
        ? { ...p, steps: (p.steps ?? []).map(s => s.id === stepId ? { ...s, title } : s) }
        : p),
    }))
  }, [])

  const removeDumpStep = useCallback((itemId: string, stepId: string) => {
    setState(prev => ({
      ...prev,
      parkingLot: prev.parkingLot.map(p => p.id === itemId
        ? { ...p, steps: (p.steps ?? []).filter(s => s.id !== stepId) }
        : p),
    }))
  }, [])

  const addDumpStep = useCallback((itemId: string, title: string) => {
    setState(prev => ({
      ...prev,
      parkingLot: prev.parkingLot.map(p => p.id === itemId
        ? { ...p, steps: [...(p.steps ?? []), { id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title }] }
        : p),
    }))
  }, [])

  const reprocessDumpItem = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      parkingLot: prev.parkingLot.map(p => p.id === id ? { ...p, status: 'processing' as const, steps: undefined } : p),
    }))
  }, [])

  // The spark: turn a ready dump (with her edited steps) into a real goal whose
  // tasks flow into her day, and remove it from the dump.
  const promoteDumpToGoal = useCallback((id: string) => {
    setState(prev => {
      const item = prev.parkingLot.find(p => p.id === id)
      if (!item || !item.steps?.length) return prev
      const goalId = `goal-${Date.now()}`
      const newGoal: Goal = {
        id: goalId,
        title: item.title || (item.rawText.length > 60 ? `${item.rawText.slice(0, 57)}…` : item.rawText),
        description: '',
        category: 'custom',
        lifeArea: 'personal',
        priority: 3,
        progressPct: 0,
        createdAt: new Date().toISOString(),
        emoji: item.emoji || '✨',
        sequential: item.sequential === true,
      }
      const newTasks: MicroTask[] = item.steps.map((s, i) => ({
        id: `mt-${Date.now()}-${i}`,
        goalId,
        title: s.title,
        durationMin: s.durationMin ?? 10,
        energyLevel: 'medium',
        context: 'anywhere' as const,
        cognitiveLoad: 'light' as const,
        toolsNeeded: [],
        phase: 'Step',
        sequenceOrder: i + 1,
        status: 'pending' as const,
      }))
      return {
        ...prev,
        goals: [newGoal, ...prev.goals],
        microTasks: [...newTasks, ...prev.microTasks],
        parkingLot: prev.parkingLot.filter(p => p.id !== id),
      }
    })
  }, [])

  const deleteParkingLotItem = useCallback((id: string) => {
    setState(prev => ({ ...prev, parkingLot: prev.parkingLot.filter(p => p.id !== id) }))
  }, [])

  const editParkingLotItem = useCallback((id: string, rawText: string) => {
    setState(prev => ({
      ...prev,
      parkingLot: prev.parkingLot.map(p => p.id === id ? { ...p, rawText } : p),
    }))
  }, [])

  const completeTask = useCallback((taskId: string) => {
    setState(prev => {
      const updatedTasks = prev.microTasks.map(t =>
        t.id === taskId ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString() } : t
      )
      const completedTask = prev.microTasks.find(t => t.id === taskId)
      const goalId = completedTask?.goalId
      let updatedGoals = prev.goals
      if (goalId) {
        const goalTasks = updatedTasks.filter(t => t.goalId === goalId)
        const doneTasks = goalTasks.filter(t => t.status === 'completed')
        const progressPct = goalTasks.length > 0 ? Math.round((doneTasks.length / goalTasks.length) * 100) : 0
        updatedGoals = prev.goals.map(g => g.id === goalId ? { ...g, progressPct } : g)
      }
      return {
        ...prev,
        goals: updatedGoals,
        microTasks: updatedTasks,
        tasksCompletedToday: prev.tasksCompletedToday + 1,
        activeDays: recordActiveDay(prev.activeDays),
      }
    })
  }, [])

  const skipTask = useCallback((taskId: string) => {
    setState(prev => ({
      ...prev,
      microTasks: prev.microTasks.map(t =>
        t.id === taskId ? { ...t, status: 'skipped' as const } : t
      ),
    }))
  }, [])

  const editGoal = useCallback((goalId: string, updates: Partial<Goal>) => {
    setState(prev => ({
      ...prev,
      goals: prev.goals.map(g => g.id === goalId ? { ...g, ...updates } : g),
    }))
  }, [])

  // Swap a goal's whole breakdown (used when she edits the goal to be more
  // specific — the steps are regenerated to match). Resets progress since the
  // steps are new.
  const replaceGoalTasks = useCallback((goalId: string, newTasks: MicroTask[]) => {
    setState(prev => ({
      ...prev,
      microTasks: [...newTasks, ...prev.microTasks.filter(t => t.goalId !== goalId)],
      goals: prev.goals.map(g => g.id === goalId ? { ...g, progressPct: 0 } : g),
    }))
  }, [])

  const deleteGoal = useCallback((goalId: string) => {
    setState(prev => ({
      ...prev,
      goals: prev.goals.filter(g => g.id !== goalId),
      microTasks: prev.microTasks.filter(t => t.goalId !== goalId),
    }))
  }, [])

  // She knocked out the whole goal in one swoop. Mark every remaining step done,
  // which pulls them out of the day's pool so the rest of the time refills around
  // what's left. Recoverable via reopenGoal.
  const completeGoal = useCallback((goalId: string) => {
    setState(prev => {
      const now = new Date().toISOString()
      let newlyDone = 0
      const updatedTasks = prev.microTasks.map(t => {
        if (t.goalId === goalId && t.status !== 'completed') {
          newlyDone++
          return { ...t, status: 'completed' as const, completedAt: now }
        }
        return t
      })
      return {
        ...prev,
        microTasks: updatedTasks,
        goals: prev.goals.map(g => g.id === goalId ? { ...g, progressPct: 100 } : g),
        tasksCompletedToday: prev.tasksCompletedToday + newlyDone,
        activeDays: newlyDone > 0 ? recordActiveDay(prev.activeDays) : prev.activeDays,
      }
    })
  }, [])

  // Undo a completed goal (mis-tap or "actually, not done"): every step back to
  // pending so the goal flows into her day again.
  const reopenGoal = useCallback((goalId: string) => {
    setState(prev => {
      let reverted = 0
      const updatedTasks = prev.microTasks.map(t => {
        if (t.goalId === goalId && t.status === 'completed') {
          reverted++
          return { ...t, status: 'pending' as const, completedAt: undefined }
        }
        return t
      })
      return {
        ...prev,
        microTasks: updatedTasks,
        goals: prev.goals.map(g => g.id === goalId ? { ...g, progressPct: 0 } : g),
        tasksCompletedToday: Math.max(0, prev.tasksCompletedToday - reverted),
      }
    })
  }, [])

  const setMood = useCallback((date: string, mood: Mood) => {
    setState(prev => ({ ...prev, moodLog: { ...prev.moodLog, [date]: mood } }))
  }, [])

  // Bump a private tap-count for a surface (counts only — no content).
  const trackUse = useCallback((key: string) => {
    setState(prev => ({ ...prev, featureUsage: { ...prev.featureUsage, [key]: (prev.featureUsage[key] ?? 0) + 1 } }))
  }, [])

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
    }))
  }, [])

  const addCalendarSource = useCallback((name: string, url: string) => {
    setState(prev => {
      const existing = prev.settings.calendarSources
      const newSource: CalendarSource = {
        id: `cal-${Date.now()}`,
        name: name.trim() || 'Calendar',
        url: url.trim(),
        color: CALENDAR_COLORS[existing.length % CALENDAR_COLORS.length],
        type: detectCalendarType(url),
      }
      return {
        ...prev,
        settings: { ...prev.settings, calendarSources: [...existing, newSource] },
      }
    })
  }, [])

  const removeCalendarSource = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        calendarSources: prev.settings.calendarSources.filter(c => c.id !== id),
      },
    }))
  }, [])

  // Set (or replace) today's gym slot as a one-off fixed block with travel buffers.
  const setGymSlot = useCallback((hour: number, min: number) => {
    setState(prev => {
      const d = new Date()
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const gymId = `gym-${today}`
      const others = prev.settings.fixedBlocks.filter(b => b.id !== gymId)
      const gym: FixedBlock = { id: gymId, title: 'Gym', emoji: '🏋️', startHour: hour, startMin: min, durationMin: 60, travelMin: 30, days: [], date: today, color: '#7B9E6B' }
      return { ...prev, settings: { ...prev.settings, fixedBlocks: [...others, gym] } }
    })
  }, [])

  const clearGym = useCallback(() => {
    setState(prev => {
      const d = new Date()
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { ...prev, settings: { ...prev.settings, fixedBlocks: prev.settings.fixedBlocks.filter(b => b.id !== `gym-${today}`) } }
    })
  }, [])

  const addFixedBlock = useCallback((block: FixedBlock) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, fixedBlocks: [...prev.settings.fixedBlocks, block] } }))
  }, [])

  const updateFixedBlock = useCallback((id: string, updates: Partial<FixedBlock>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, fixedBlocks: prev.settings.fixedBlocks.map(b => b.id === id ? { ...b, ...updates } : b) },
    }))
  }, [])

  const removeFixedBlock = useCallback((id: string) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, fixedBlocks: prev.settings.fixedBlocks.filter(b => b.id !== id) } }))
  }, [])

  const addImportantDate = useCallback((d: ImportantDate) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, importantDates: [...prev.settings.importantDates, d] } }))
  }, [])

  const updateImportantDate = useCallback((id: string, updates: Partial<ImportantDate>) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, importantDates: prev.settings.importantDates.map(d => d.id === id ? { ...d, ...updates } : d) } }))
  }, [])

  const removeImportantDate = useCallback((id: string) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, importantDates: prev.settings.importantDates.filter(d => d.id !== id) } }))
  }, [])

  // Idempotent: for any important date within its lead window whose prep isn't queued
  // yet, drop a gift-prep goal into her list and log the occurrence so it's once a year.
  const queueBirthdayPrep = useCallback((now: Date = new Date()) => {
    setState(prev => {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const log = { ...prev.importantDateLog }
      const newGoals: Goal[] = []
      const newTasks: MicroTask[] = []
      for (const d of prev.settings.importantDates) {
        if (!d.leadDays || d.leadDays <= 0) continue
        let next = new Date(now.getFullYear(), d.month - 1, d.day)
        if (next < today) next = new Date(now.getFullYear() + 1, d.month - 1, d.day)
        const daysUntil = Math.round((next.getTime() - today.getTime()) / 86_400_000)
        const key = `${d.id}-${next.getFullYear()}`
        if (daysUntil > d.leadDays || log[key]) continue
        const goalId = `goal-${key}`
        // The label already names the occasion ("Wedding anniversary", "Older
        // kiddo's birthday"), so just append "gift" — no duplicated kind word
        // ("... anniversary anniversary gift").
        newGoals.push({ id: goalId, title: `${d.label} gift`, description: '', category: 'errands', lifeArea: 'family', priority: 4, progressPct: 0, createdAt: new Date().toISOString(), emoji: '' })
        const steps = [`Think of a gift idea for ${d.label}`, 'Order or buy the gift', 'Get a card', 'Wrap it and set it aside']
        steps.forEach((t, i) => newTasks.push({ id: `${goalId}-mt${i}`, goalId, title: t, durationMin: i === 1 ? 15 : 8, energyLevel: 'low', context: 'anywhere', cognitiveLoad: 'light', toolsNeeded: [], phase: 'Gift', sequenceOrder: i + 1, status: 'pending' }))
        log[key] = 'queued'
      }
      if (newGoals.length === 0) return prev
      return { ...prev, goals: [...newGoals, ...prev.goals], microTasks: [...newTasks, ...prev.microTasks], importantDateLog: log }
    })
  }, [])

  const completeRitual = useCallback((ritualId: string) => {
    setState(prev => ({
      ...prev,
      ritualLog: {
        ...prev.ritualLog,
        [ritualId]: [...(prev.ritualLog[ritualId] ?? []), new Date().toISOString()],
      },
      activeDays: recordActiveDay(prev.activeDays),
    }))
  }, [])

  // Undo the most recent completion of a ritual (mis-tap recovery).
  const undoRitual = useCallback((ritualId: string) => {
    setState(prev => ({
      ...prev,
      ritualLog: {
        ...prev.ritualLog,
        [ritualId]: (prev.ritualLog[ritualId] ?? []).slice(0, -1),
      },
    }))
  }, [])

  const updateRituals = useCallback((rituals: Ritual[]) => {
    setState(prev => ({ ...prev, rituals }))
  }, [])

  const addRitual = useCallback((r: Ritual) => {
    setState(prev => ({ ...prev, rituals: [...prev.rituals, r] }))
  }, [])

  const updateRitual = useCallback((id: string, updates: Partial<Ritual>) => {
    setState(prev => ({ ...prev, rituals: prev.rituals.map(r => r.id === id ? { ...r, ...updates } : r) }))
  }, [])

  const removeRitual = useCallback((id: string) => {
    setState(prev => {
      const { [id]: _drop, ...restLog } = prev.ritualLog
      void _drop
      return { ...prev, rituals: prev.rituals.filter(r => r.id !== id), ritualLog: restLog }
    })
  }, [])

  // Flag/unflag a recurring meeting (by title) as "this could be async".
  const toggleAsyncMeeting = useCallback((title: string) => {
    setState(prev => ({
      ...prev,
      asyncMeetings: prev.asyncMeetings.includes(title)
        ? prev.asyncMeetings.filter(t => t !== title)
        : [...prev.asyncMeetings, title],
    }))
  }, [])

  // Mark this year's birthday takeover as seen so it doesn't fire again.
  const dismissBirthdayMoment = useCallback((year: number) => {
    setState(prev => ({ ...prev, birthdayMomentYear: year }))
  }, [])

  // "Reset all data": wipe her goals/tasks/logs/streak to a genuinely EMPTY state
  // (never the mock demo — that would install a fake 5-day streak and fabricated
  // goals, and the persist effect would push that fiction to every device). Keep her
  // real settings and rituals so the app still works; her real taps rebuild from 0.
  const resetData = useCallback(() => {
    setState(prev => ({ ...EMPTY_STATE, settings: prev.settings, rituals: prev.rituals }))
  }, [])

  return {
    ...state,
    loaded,
    addGoal,
    addChatMessage,
    acceptProposedGoal,
    addParkingLotItem,
    deleteParkingLotItem,
    editParkingLotItem,
    setDumpBreakdown,
    updateDumpStep,
    removeDumpStep,
    addDumpStep,
    reprocessDumpItem,
    promoteDumpToGoal,
    completeTask,
    skipTask,
    editGoal,
    replaceGoalTasks,
    deleteGoal,
    completeGoal,
    reopenGoal,
    updateSettings,
    addCalendarSource,
    removeCalendarSource,
    setGymSlot,
    clearGym,
    addFixedBlock,
    updateFixedBlock,
    removeFixedBlock,
    addImportantDate,
    updateImportantDate,
    removeImportantDate,
    queueBirthdayPrep,
    setMood,
    trackUse,
    completeRitual,
    undoRitual,
    updateRituals,
    addRitual,
    updateRitual,
    removeRitual,
    toggleAsyncMeeting,
    dismissBirthdayMoment,
    resetData,
  }
}
