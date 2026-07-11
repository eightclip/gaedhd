'use client'

import { useEffect, useRef } from 'react'
import type { Goal, MicroTask } from './types'
import { isDry, completedTitles, type IncomingStep } from './goals'

// Keeps her goals from running dry.
//
// When an active goal has no pending steps left, ask /api/goal-next for the next few,
// given everything she has already done. She sees none of this — the goal simply keeps
// offering her one thing. Claude closes finite projects that are genuinely finished.
//
// Silent by design: a card asking "want more steps?" is a decision point, and an
// ignored decision point is precisely the dead end this app exists to prevent.

// At most this many attempts per goal per session. A goal whose top-up keeps coming
// back empty (offline, no API key, or a model that only restates completed steps)
// must not spin, and must not quietly run up a bill.
const MAX_ATTEMPTS = 2

interface Options {
  goals: Goal[]
  microTasks: MicroTask[]
  loaded: boolean
  apiKey?: string
  userContext?: string
  topUpGoal: (goalId: string, steps: IncomingStep[]) => void
  markGoalDone: (goalId: string, reason?: string) => void
}

export function useGoalTopUp({ goals, microTasks, loaded, apiKey, userContext, topUpGoal, markGoalDone }: Options) {
  const inFlight = useRef<Set<string>>(new Set())
  // goalId -> attempts made this session. Cleared once a goal has steps again, so a
  // goal that legitimately runs dry again next week gets a fresh allowance.
  const attempts = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (!loaded) return

    // A goal with steps is healthy: forget any past failures against it.
    for (const goal of goals) {
      if (!isDry(goal, microTasks)) attempts.current.delete(goal.id)
    }

    // One goal at a time. Topping up mutates state, which re-runs this effect and
    // picks up the next dry goal — so a serial chain, never a burst of API calls.
    const target = goals.find(
      g => isDry(g, microTasks) &&
        !inFlight.current.has(g.id) &&
        (attempts.current.get(g.id) ?? 0) < MAX_ATTEMPTS
    )
    if (!target) return

    inFlight.current.add(target.id)
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/goal-next', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: {
              title: target.title,
              description: target.description,
              category: target.category,
            },
            completedTitles: completedTitles(target.id, microTasks),
            apiKey: apiKey || undefined,
            userContext: userContext || undefined,
          }),
        })
        // Count the attempt the moment the request lands, BEFORE checking `cancelled`.
        // The effect re-runs whenever she completes anything, which cancels us — and if
        // a cancelled attempt went uncounted we'd re-issue the same paid request every
        // time she taps.
        attempts.current.set(target.id, (attempts.current.get(target.id) ?? 0) + 1)
        if (cancelled || !res.ok) return

        const data = await res.json()
        if (cancelled) return

        if (data.goalComplete) {
          markGoalDone(target.id, typeof data.why === 'string' ? data.why : '')
        } else if (Array.isArray(data.tasks) && data.tasks.length > 0) {
          topUpGoal(target.id, data.tasks as IncomingStep[])
        }
        // Empty tasks and not complete: leave it dry. The attempt counter stops us
        // asking again this session, and nothing false is shown to her.
      } catch {
        // Offline or the request died. Count it and move on; she keeps her cached day.
        if (!cancelled) attempts.current.set(target.id, (attempts.current.get(target.id) ?? 0) + 1)
      } finally {
        inFlight.current.delete(target.id)
      }
    })()

    return () => { cancelled = true }
  }, [goals, microTasks, loaded, apiKey, userContext, topUpGoal, markGoalDone])
}
