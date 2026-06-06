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
export type TaskContext =
  | 'anywhere'
  | 'home'
  | 'office'
  | 'studio'
  | 'kitchen'
  | 'bedroom'
  | 'backyard'
  | 'gym'
  | 'car'
  | 'errands'
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
  // false = steps are independent and can be sprinkled across the day in any order.
  // true/undefined = steps depend on each other; only the current one is available.
  sequential?: boolean
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

// ─── Fixed timeboxes ────────────────────────────────────────────
// Her real anchors that aren't on the shared calendar (school runs, gym).
// They block time so movable tasks schedule around them. Travel is "soft":
// it can overlap a meeting (a call in transit), the core cannot.
export interface FixedBlock {
  id: string
  title: string
  emoji: string
  startHour: number
  startMin: number
  durationMin: number
  travelMin: number // buffer before AND after (0 for none)
  days: number[] // recurring weekdays (0=Sun..6=Sat); empty for one-off
  date?: string // YYYY-MM-DD for a one-off (e.g. today's gym)
  color: string
}

// ─── Important dates ────────────────────────────────────────────
// Annual dates she should never miss: birthdays, anniversaries. Surface a
// heads-up as they approach and a celebration on the day.
export interface ImportantDate {
  id: string
  label: string
  month: number // 1-12
  day: number // 1-31
  year?: number // origin year, to show "turns N"
  kind: 'birthday' | 'anniversary' | 'date'
  leadDays?: number // if set, queue a gift-prep goal this many days before (0/undefined = celebrate only)
}

// ─── Parking Lot ────────────────────────────────────────────────
// One bite-size step in a dump's AI breakdown. Editable by her before she sparks it.
export interface DumpStep {
  id: string
  title: string
  durationMin?: number
}

export interface ParkingLotItem {
  id: string
  rawText: string
  processed: boolean
  createdGoalId?: string
  createdAt: string
  // The moment it lands, the AI breaks it into bite-size steps she can see + edit.
  status?: 'processing' | 'ready' | 'error'
  steps?: DumpStep[]
  title?: string   // AI's short title for the eventual goal
  emoji?: string
  sequential?: boolean // do the steps have to be done in order?
}

// ─── Timeline ───────────────────────────────────────────────────
export type TimelineItem =
  | { type: 'event'; data: CalendarEvent }
  | { type: 'gap'; data: ScheduleGap; scheduledTasks: ScheduledTask[] }

// ─── Task + Goal pairing (for JustDoThisCard) ───────────────────
export interface TaskWithGoal {
  id: string
  microTask: MicroTask
  goal: Goal
}

// ─── User Stats ─────────────────────────────────────────────────
export interface DailyStats {
  date: string
  tasksCompleted: number
  tasksSkipped: number
  totalMinutes: number
  streak: number
}
