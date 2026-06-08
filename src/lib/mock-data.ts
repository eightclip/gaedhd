import type {
  Calendar, CalendarEvent, Goal, MicroTask, ScheduleGap,
  ScheduledTask, ParkingLotItem, DailyStats,
} from './types'

// ─── Calendars ──────────────────────────────────────────────────
export const calendars: Calendar[] = [
  { id: 'cal-work', name: 'Work', type: 'work', provider: 'google', color: '#8B6F5E', isActive: true },
  { id: 'cal-family', name: 'Family', type: 'family', provider: 'google', color: '#D4845E', isActive: true },
  { id: 'cal-personal', name: 'Personal', type: 'personal', provider: 'google', color: '#7B9E6B', isActive: true },
]

// ─── Today's Events ─────────────────────────────────────────────
export const todayEvents: CalendarEvent[] = [
  { id: 'ev-1', calendarId: 'cal-work', title: 'Standup', startTime: '2026-05-21T09:00:00', endTime: '2026-05-21T09:15:00', color: '#8B6F5E' },
  { id: 'ev-2', calendarId: 'cal-work', title: 'Design Review', startTime: '2026-05-21T09:30:00', endTime: '2026-05-21T10:30:00', color: '#8B6F5E' },
  { id: 'ev-3', calendarId: 'cal-work', title: 'Lunch w/ Team', startTime: '2026-05-21T12:00:00', endTime: '2026-05-21T13:00:00', color: '#D4845E' },
  { id: 'ev-4', calendarId: 'cal-work', title: 'Sprint Planning', startTime: '2026-05-21T14:00:00', endTime: '2026-05-21T15:00:00', color: '#8B6F5E' },
  { id: 'ev-5', calendarId: 'cal-family', title: 'Pick Up Kids', startTime: '2026-05-21T16:30:00', endTime: '2026-05-21T17:00:00', color: '#D4845E' },
]

// ─── Goals ──────────────────────────────────────────────────────
export const goals: Goal[] = [
  {
    id: 'goal-1', title: '25 Strong RDLs', description: 'Get those booty gains with proper RDLs',
    category: 'fitness', lifeArea: 'personal', priority: 3, progressPct: 0,
    createdAt: '2026-05-20T10:00:00', emoji: '🍑',
  },
  {
    id: 'goal-2', title: 'Deep Clean Kitchen', description: 'Full kitchen deep clean, one piece at a time',
    category: 'home', lifeArea: 'family', priority: 2, progressPct: 25,
    createdAt: '2026-05-19T08:00:00', emoji: '✨',
  },
  {
    id: 'goal-3', title: 'Finish Watercolor Piece', description: 'Complete the landscape watercolor',
    category: 'art', lifeArea: 'personal', priority: 1, progressPct: 40,
    createdAt: '2026-05-18T14:00:00', emoji: '🎨',
  },
  {
    id: 'goal-4', title: 'Learn Spanish Basics', description: '10 new words per day',
    category: 'learning', lifeArea: 'personal', priority: 2, progressPct: 15,
    createdAt: '2026-05-17T09:00:00', emoji: '🇪🇸',
  },
]

// ─── Micro-Tasks ────────────────────────────────────────────────
export const microTasks: MicroTask[] = [
  // RDLs (goal-1)
  { id: 'mt-1', goalId: 'goal-1', title: 'Grab your resistance band', durationMin: 1, energyLevel: 'low', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: ['resistance band'], phase: 'Prep', sequenceOrder: 1, status: 'pending' },
  { id: 'mt-2', goalId: 'goal-1', title: 'Find a clear spot, feet hip-width', durationMin: 1, energyLevel: 'low', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: [], phase: 'Prep', sequenceOrder: 2, status: 'pending' },
  { id: 'mt-3', goalId: 'goal-1', title: '5 RDLs — squeeze at the top 🍑', durationMin: 2, energyLevel: 'high', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: ['resistance band'], phase: 'Work', sequenceOrder: 3, status: 'pending' },
  { id: 'mt-4', goalId: 'goal-1', title: 'Rest 30s, shake it out', durationMin: 1, energyLevel: 'low', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: [], phase: 'Work', sequenceOrder: 4, status: 'pending' },
  { id: 'mt-5', goalId: 'goal-1', title: '5 more — slow on the way down', durationMin: 2, energyLevel: 'high', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: ['resistance band'], phase: 'Work', sequenceOrder: 5, status: 'pending' },
  { id: 'mt-6', goalId: 'goal-1', title: 'Rest 30s', durationMin: 1, energyLevel: 'low', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: [], phase: 'Work', sequenceOrder: 6, status: 'pending' },
  { id: 'mt-7', goalId: 'goal-1', title: '5 more — hold the last one 3 sec', durationMin: 2, energyLevel: 'high', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: ['resistance band'], phase: 'Work', sequenceOrder: 7, status: 'pending' },
  { id: 'mt-8', goalId: 'goal-1', title: 'Rest 30s', durationMin: 1, energyLevel: 'low', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: [], phase: 'Work', sequenceOrder: 8, status: 'pending' },
  { id: 'mt-9', goalId: 'goal-1', title: '5 more — you got this', durationMin: 2, energyLevel: 'high', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: ['resistance band'], phase: 'Work', sequenceOrder: 9, status: 'pending' },
  { id: 'mt-10', goalId: 'goal-1', title: 'Last 5 — make them count 🍑', durationMin: 2, energyLevel: 'high', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: ['resistance band'], phase: 'Work', sequenceOrder: 10, status: 'pending' },
  { id: 'mt-11', goalId: 'goal-1', title: 'Stretch hamstrings 30s each side', durationMin: 2, energyLevel: 'low', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: [], phase: 'Cool Down', sequenceOrder: 11, status: 'pending' },
  // Kitchen (goal-2)
  { id: 'mt-20', goalId: 'goal-2', title: 'Clear left side of the counter', durationMin: 3, energyLevel: 'medium', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: [], phase: 'Surfaces', sequenceOrder: 1, status: 'completed', completedAt: '2026-05-20T10:30:00' },
  { id: 'mt-21', goalId: 'goal-2', title: 'Wipe down the stove top', durationMin: 4, energyLevel: 'medium', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: ['sponge', 'cleaner'], phase: 'Surfaces', sequenceOrder: 2, status: 'pending' },
  { id: 'mt-22', goalId: 'goal-2', title: 'Load dishwasher — bottom rack only', durationMin: 3, energyLevel: 'low', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: [], phase: 'Dishes', sequenceOrder: 3, status: 'pending' },
  { id: 'mt-23', goalId: 'goal-2', title: 'Wipe counter where you cleared', durationMin: 2, energyLevel: 'low', context: 'home', cognitiveLoad: 'mindless', toolsNeeded: ['sponge'], phase: 'Surfaces', sequenceOrder: 4, status: 'pending' },
  // Art (goal-3)
  { id: 'mt-30', goalId: 'goal-3', title: 'Set up palette — blues and greens', durationMin: 3, energyLevel: 'low', context: 'home', cognitiveLoad: 'light', toolsNeeded: ['watercolors', 'palette'], phase: 'Setup', sequenceOrder: 1, status: 'pending' },
  { id: 'mt-31', goalId: 'goal-3', title: 'Wet the sky area', durationMin: 5, energyLevel: 'medium', context: 'home', cognitiveLoad: 'deep', toolsNeeded: ['brush', 'water'], phase: 'Paint', sequenceOrder: 2, status: 'pending' },
  // Spanish (goal-4)
  { id: 'mt-40', goalId: 'goal-4', title: 'Review 5 words from yesterday', durationMin: 3, energyLevel: 'low', context: 'anywhere', cognitiveLoad: 'light', toolsNeeded: ['phone'], phase: 'Review', sequenceOrder: 1, status: 'pending' },
  { id: 'mt-41', goalId: 'goal-4', title: 'Learn 5 new food words', durationMin: 5, energyLevel: 'low', context: 'anywhere', cognitiveLoad: 'light', toolsNeeded: ['phone'], phase: 'New Words', sequenceOrder: 2, status: 'pending' },
]

// ─── Schedule Gaps ──────────────────────────────────────────────
export const scheduleGaps: ScheduleGap[] = [
  {
    id: 'gap-1', date: '2026-05-21', startTime: '2026-05-21T09:15:00', endTime: '2026-05-21T09:30:00',
    durationMin: 15, gapSize: 'medium',
    beforeEvent: todayEvents[0], afterEvent: todayEvents[1],
  },
  {
    id: 'gap-2', date: '2026-05-21', startTime: '2026-05-21T10:30:00', endTime: '2026-05-21T12:00:00',
    durationMin: 90, gapSize: 'large',
    beforeEvent: todayEvents[1], afterEvent: todayEvents[2],
  },
  {
    id: 'gap-3', date: '2026-05-21', startTime: '2026-05-21T13:00:00', endTime: '2026-05-21T14:00:00',
    durationMin: 60, gapSize: 'large',
    beforeEvent: todayEvents[2], afterEvent: todayEvents[3],
  },
  {
    id: 'gap-4', date: '2026-05-21', startTime: '2026-05-21T15:00:00', endTime: '2026-05-21T16:30:00',
    durationMin: 90, gapSize: 'large',
    beforeEvent: todayEvents[3], afterEvent: todayEvents[4],
  },
]

// ─── Scheduled Tasks (tasks slotted into gaps) ──────────────────
export const scheduledTasks: ScheduledTask[] = [
  {
    id: 'st-1', microTask: microTasks[18], goal: goals[3], gap: scheduleGaps[0],
    scheduledStart: '2026-05-21T09:15:00', scheduledEnd: '2026-05-21T09:18:00',
    status: 'pending',
  },
  {
    id: 'st-2', microTask: microTasks[0], goal: goals[0], gap: scheduleGaps[1],
    scheduledStart: '2026-05-21T10:30:00', scheduledEnd: '2026-05-21T10:31:00',
    status: 'pending',
  },
  {
    id: 'st-3', microTask: microTasks[1], goal: goals[0], gap: scheduleGaps[1],
    scheduledStart: '2026-05-21T10:31:00', scheduledEnd: '2026-05-21T10:32:00',
    status: 'pending',
  },
  {
    id: 'st-4', microTask: microTasks[2], goal: goals[0], gap: scheduleGaps[1],
    scheduledStart: '2026-05-21T10:32:00', scheduledEnd: '2026-05-21T10:34:00',
    status: 'pending',
  },
  {
    id: 'st-5', microTask: microTasks[13], goal: goals[1], gap: scheduleGaps[2],
    scheduledStart: '2026-05-21T13:00:00', scheduledEnd: '2026-05-21T13:04:00',
    status: 'pending',
  },
  {
    id: 'st-6', microTask: microTasks[14], goal: goals[1], gap: scheduleGaps[2],
    scheduledStart: '2026-05-21T13:04:00', scheduledEnd: '2026-05-21T13:07:00',
    status: 'pending',
  },
]

// ─── Parking Lot ────────────────────────────────────────────────
export const parkingLotItems: ParkingLotItem[] = [
  { id: 'pl-1', rawText: 'Call dentist for cleaning appointment', processed: false, createdAt: '2026-05-21T08:30:00' },
  { id: 'pl-2', rawText: 'Birthday gift ideas for Sarah', processed: false, createdAt: '2026-05-20T22:15:00' },
  { id: 'pl-3', rawText: 'That pasta recipe from Instagram', processed: false, createdAt: '2026-05-20T19:00:00' },
  { id: 'pl-4', rawText: 'Return Amazon package', processed: true, createdGoalId: 'goal-errands', createdAt: '2026-05-19T11:00:00' },
]

// ─── Stats ──────────────────────────────────────────────────────
export const dailyStats: DailyStats = {
  date: '2026-05-21',
  tasksCompleted: 3,
  tasksSkipped: 1,
  totalMinutes: 14,
  streak: 5,
}

// ─── Color helpers ──────────────────────────────────────────────
export const categoryColors: Record<string, string> = {
  fitness: '#C85D3E',
  learning: '#7B9E6B',
  art: '#9B7EC8',
  home: '#D4845E',
  work: '#8B6F5E',
  family: '#C87E9E',
  'self-care': '#6BA3BE',
  relationships: '#C87E9E',
  errands: '#A89060',
}

export const categoryEmojis: Record<string, string> = {
  fitness: '💪',
  learning: '📚',
  art: '🎨',
  home: '🏠',
  work: '💼',
  family: '👨‍👩‍👧‍👦',
  'self-care': '🧘',
  relationships: '💬',
  errands: '🏃',
}
