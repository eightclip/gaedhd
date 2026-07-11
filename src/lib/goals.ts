import type { Goal, MicroTask } from './types'

// Goal lifecycle helpers.
//
// The old model: a goal was decomposed once, into 3-8 steps. When the last step was
// ticked, progressPct hit 100 and the goal both vanished from her day and was marked
// finished. That quietly retired "get stronger" after five taps.
//
// The new model: running out of steps means "ask Claude for the next few" (see
// /api/goal-next). A goal is finished only when `doneAt` is set — by her, or by
// Claude recognising a finite project is genuinely complete.

// An active goal is one that still wants her attention. Note this deliberately
// ignores progressPct: legacy goals stranded at 100% with no doneAt are active
// again, and their first top-up asks Claude, who closes the truly-finished ones.
export function isGoalActive(goal: Goal): boolean {
  return !goal.doneAt
}

export function goalTasks(goalId: string, microTasks: MicroTask[]): MicroTask[] {
  return microTasks.filter(t => t.goalId === goalId)
}

export function pendingTasks(goalId: string, microTasks: MicroTask[]): MicroTask[] {
  return microTasks.filter(t => t.goalId === goalId && t.status === 'pending')
}

// How many steps of this goal she has actually finished. This is the number we show
// her: it only ever goes up, so a top-up can never look like she lost ground.
export function stepsDone(goalId: string, microTasks: MicroTask[]): number {
  return microTasks.filter(t => t.goalId === goalId && t.status === 'completed').length
}

// Completed step titles, oldest first — the history Claude needs to continue rather
// than repeat itself.
export function completedTitles(goalId: string, microTasks: MicroTask[]): string[] {
  return microTasks
    .filter(t => t.goalId === goalId && t.status === 'completed')
    .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))
    .map(t => t.title)
}

// A goal has run dry when it's active but has nothing left for her to do.
export function isDry(goal: Goal, microTasks: MicroTask[]): boolean {
  return isGoalActive(goal) && pendingTasks(goal.id, microTasks).length === 0
}

// Loose match, so "Buy the paint" and "buy paint." don't both end up on her list.
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

export function nextSequenceOrder(goalId: string, microTasks: MicroTask[]): number {
  const orders = microTasks.filter(t => t.goalId === goalId).map(t => t.sequenceOrder)
  return orders.length ? Math.max(...orders) + 1 : 1
}

export interface IncomingStep {
  title: string
  durationMin?: number
  phase?: string
  energyLevel?: string
  cognitiveLoad?: string
}

// Turn Claude's steps into real MicroTasks for an EXISTING goal.
//
// Drops anything she has already seen for this goal (done or pending). Two reasons:
// the model occasionally restates a completed step despite being told not to, and if
// two of her devices top up the same goal at once, the merge unions by id — so this
// is the only thing stopping a duplicate step landing on her list.
export function buildTopUpTasks(
  goalId: string,
  incoming: IncomingStep[],
  existing: MicroTask[],
  now: number,
): MicroTask[] {
  const seen = new Set(goalTasks(goalId, existing).map(t => normalizeTitle(t.title)))
  let order = nextSequenceOrder(goalId, existing)

  const out: MicroTask[] = []
  for (const step of incoming) {
    const title = String(step.title ?? '').trim()
    const key = normalizeTitle(title)
    if (!title || !key || seen.has(key)) continue
    seen.add(key)
    out.push({
      // Deterministic-ish per goal+order so a retry of the same batch collides rather
      // than duplicating. `now` still separates genuinely distinct batches.
      id: `mt-${goalId}-${order}-${now}`,
      goalId,
      title,
      durationMin: typeof step.durationMin === 'number' && step.durationMin > 0 ? Math.min(120, step.durationMin) : 10,
      energyLevel: (['low', 'medium', 'high'].includes(String(step.energyLevel)) ? step.energyLevel : 'medium') as MicroTask['energyLevel'],
      context: 'anywhere',
      cognitiveLoad: (['mindless', 'light', 'deep'].includes(String(step.cognitiveLoad)) ? step.cognitiveLoad : 'light') as MicroTask['cognitiveLoad'],
      toolsNeeded: [],
      phase: step.phase || 'Step',
      sequenceOrder: order,
      status: 'pending',
    })
    order++
  }
  return out
}
