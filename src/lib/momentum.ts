// Forgiving "momentum" instead of a brittle streak.
//
// Why: a single all-or-nothing streak counter that resets to 0 on one missed day
// is a known abandonment trigger for ADHD (and especially women with RSD) — the
// shame of breaking it makes people quit the tool. So we compute a streak that
// forgives an isolated missed day, and pair it with a calmer "X of the last 7
// days" view that can never display a punishing zero in a shameful way.
//
// Source of truth is `activeDays`: local YYYY-MM-DD strings, one per day she did
// anything (completed a task or a ritual). Recorded in the store on completion.

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface Momentum {
  streak: number // forgiving run of active days ending today (or yesterday)
  weekCount: number // distinct active days in the last 7 (including today)
  week: boolean[] // 7 booleans, oldest → newest (index 6 is today)
}

export function computeMomentum(activeDays: string[], now: Date = new Date()): Momentum {
  const set = new Set(activeDays)

  // Last 7 days, oldest first.
  const week: boolean[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    week.push(set.has(localDateStr(d)))
  }
  const weekCount = week.filter(Boolean).length

  // Forgiving streak: walk backward from today. Today not-yet-active is a free
  // pass (the day isn't over). A single missed day is forgiven (skipped, not
  // counted); two missed days in a row ends the run.
  let streak = 0
  let misses = 0
  const todayActive = set.has(localDateStr(now))
  for (let i = todayActive ? 0 : 1; i < 400; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    if (set.has(localDateStr(d))) {
      streak++
      misses = 0
    } else {
      misses++
      if (misses >= 2) break
    }
  }

  return { streak, weekCount, week }
}
