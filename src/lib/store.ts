'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Goal, MicroTask, ParkingLotItem, FixedBlock, ImportantDate } from './types'
import type { Ritual } from './rituals'
import { DEFAULT_RITUALS } from './rituals'
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
  streak: number
  tasksCompletedToday: number
}

const DEFAULT_SETTINGS: AppSettings = {
  anthropicApiKey: '',
  userName: '',
  wakeHour: 7,
  sleepHour: 22,
  transitionBufferMin: 3,
  calendarSources: [],
  userContext: '',
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
  streak: 5,
  tasksCompletedToday: 3,
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

function saveToServer(state: AppState) {
  if (typeof window === 'undefined') return
  fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  }).catch(() => {
    // Offline or sync unavailable — localStorage cache still holds the data.
  })
}

export function useStore() {
  const [state, setState] = useState<AppState>(INITIAL_STATE)
  const [loaded, setLoaded] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load: localStorage cache first (instant paint), then reconcile with the
  // server, which is the source of truth across devices.
  useEffect(() => {
    const cache = loadCache()
    setState(cache)

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/state')
        if (!cancelled && res.ok) {
          const data = await res.json()
          if (data.state) {
            setState(mergeState(data.state))
          } else {
            // Server has nothing yet — first sync, push the local cache up.
            saveToServer(cache)
          }
        }
      } catch {
        // Offline / sync down — keep using the local cache.
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Persist on change: localStorage immediately, server PUT debounced.
  useEffect(() => {
    if (!loaded) return
    saveCache(state)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveToServer(state), 800)
  }, [state, loaded])

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

  const addParkingLotItem = useCallback((text: string) => {
    setState(prev => ({
      ...prev,
      parkingLot: [{
        id: `pl-${Date.now()}`,
        rawText: text,
        processed: false,
        createdAt: new Date().toISOString(),
      }, ...prev.parkingLot],
    }))
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

  const deleteGoal = useCallback((goalId: string) => {
    setState(prev => ({
      ...prev,
      goals: prev.goals.filter(g => g.id !== goalId),
      microTasks: prev.microTasks.filter(t => t.goalId !== goalId),
    }))
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
        const what = d.kind === 'anniversary' ? 'anniversary' : 'birthday'
        newGoals.push({ id: goalId, title: `${d.label} ${what} gift`, description: '', category: 'errands', lifeArea: 'family', priority: 4, progressPct: 0, createdAt: new Date().toISOString(), emoji: '' })
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

  const resetData = useCallback(() => {
    setState(INITIAL_STATE)
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
    completeTask,
    skipTask,
    editGoal,
    deleteGoal,
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
    completeRitual,
    undoRitual,
    updateRituals,
    addRitual,
    updateRitual,
    removeRitual,
    toggleAsyncMeeting,
    resetData,
  }
}
