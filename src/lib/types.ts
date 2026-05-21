// ─── Life Areas & Categories ────────────────────────────────────
export type LifeArea = 'work' | 'family' | 'personal'

export type GoalCategory =
  | 'fitness'
  | 'learning'
  | 'art'
  | 'home'
  | 'work'
  | 'family'
  | 'self-care'
  | 'errands'
  | 'custom'

export type EnergyLevel = 'low' | 'medium' | 'high'
export type CognitiveLoad = 'mindless' | 'light' | 'deep'
export type TaskContext = 'home' | 'office' | 'anywhere' | 'gym' | 'car'
export type GapSize = 'micro' | 'small' | 'medium' | 'large'
export type TaskStatus = 'pending' | 'scheduled' | 'active' | 'completed' | 'skipped'

// ─── Calendar ───────────────────────────────────────────────────
export interface Calendar {
  id: string
  name: string
  type: LifeArea | 'custom'
  provider: 'google' | 'apple' | 'mock'
  color: string
  isActive: boolean
}

export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  startTime: string // ISO string
  endTime: string   // ISO string
  color: string
}

// ─── Goals ──────────────────────────────────────────────────────
export interface Goal {
  id: string
  title: string
  description: string
  category: GoalCategory
  lifeArea: LifeArea
  priority: number // 1-5
  targetDate?: string
  progressPct: number
  createdAt: string
  emoji: string
}

// ─── Micro-Tasks ────────────────────────────────────────────────
export interface MicroTask {
  id: string
  goalId: string
  title: string
  durationMin: number
  energyLevel: EnergyLevel
  context: TaskContext
  cognitiveLoad: CognitiveLoad
  toolsNeeded: string[]
  phase: string
  sequenceOrder: number
  status: TaskStatus
  completedAt?: string
}

// ─── Schedule Gaps ──────────────────────────────────────────────
export interface ScheduleGap {
  id: string
  date: string
  startTime: string
  endTime: string
  durationMin: number
  gapSize: GapSize
  beforeEvent?: CalendarEvent
  afterEvent?: CalendarEvent
}

// ─── Scheduled Tasks ────────────────────────────────────────────
export interface ScheduledTask {
  id: string
  microTask: MicroTask
  goal: Goal
  gap: ScheduleGap
  scheduledStart: string
  scheduledEnd: string
  status: TaskStatus
  completedAt?: string
}

// ─── Parking Lot ────────────────────────────────────────────────
export interface ParkingLotItem {
  id: string
  rawText: string
  processed: boolean
  createdGoalId?: string
  createdAt: string
}

// ─── Timeline ───────────────────────────────────────────────────
export type TimelineItem =
  | { type: 'event'; data: CalendarEvent }
  | { type: 'gap'; data: ScheduleGap; scheduledTasks: ScheduledTask[] }

// ─── User Stats ─────────────────────────────────────────────────
export interface DailyStats {
  date: string
  tasksCompleted: number
  tasksSkipped: number
  totalMinutes: number
  streak: number
}
