'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Goal, MicroTask, ParkingLotItem, ScheduledTask } from './types'
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

export interface AppSettings {
  anthropicApiKey: string
  userName: string
  wakeHour: number   // e.g. 7 = 7am
  sleepHour: number   // e.g. 22 = 10pm
  transitionBufferMin: number // minutes between events
}

export interface AppState {
  goals: Goal[]
  microTasks: MicroTask[]
  parkingLot: ParkingLotItem[]
  chatMessages: ChatMessage[]
  settings: AppSettings
  streak: number
  tasksCompletedToday: number
}

const DEFAULT_SETTINGS: AppSettings = {
  anthropicApiKey: '',
  userName: '',
  wakeHour: 7,
  sleepHour: 22,
  transitionBufferMin: 3,
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
  streak: 5,
  tasksCompletedToday: 3,
}

// ─── Hook ───────────────────────────────────────────────────────
const STORAGE_KEY = 'gaedhd-state'

function loadState(): AppState {
  if (typeof window === 'undefined') return INITIAL_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return INITIAL_STATE
    const parsed = JSON.parse(raw)
    return { ...INITIAL_STATE, ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } }
  } catch {
    return INITIAL_STATE
  }
}

function saveState(state: AppState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage full or unavailable
  }
}

export function useStore() {
  const [state, setState] = useState<AppState>(INITIAL_STATE)
  const [loaded, setLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setState(loadState())
    setLoaded(true)
  }, [])

  // Save on every change (after initial load)
  useEffect(() => {
    if (loaded) saveState(state)
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

  const completeTask = useCallback((taskId: string) => {
    setState(prev => ({
      ...prev,
      microTasks: prev.microTasks.map(t =>
        t.id === taskId ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString() } : t
      ),
      tasksCompletedToday: prev.tasksCompletedToday + 1,
    }))
  }, [])

  const skipTask = useCallback((taskId: string) => {
    setState(prev => ({
      ...prev,
      microTasks: prev.microTasks.map(t =>
        t.id === taskId ? { ...t, status: 'skipped' as const } : t
      ),
    }))
  }, [])

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
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
    completeTask,
    skipTask,
    updateSettings,
    resetData,
  }
}
