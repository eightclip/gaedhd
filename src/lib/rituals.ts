// Rituals: the recurring rhythms of her day that aren't goals and never "finish".
// Pills, water, protein, moving, going outside, making content, wrapping up.
// A ritual has a cadence, an active window, and a gentle nudge. The app answers
// "what's due right now" and resets on cadence. No guilt on a miss. See DESIGN.md.

import type { TaskContext } from './types'
import type { TintName } from './theme'

export type RitualCadence =
  | { kind: 'everyHours'; hours: number } // e.g. water every 2h
  | { kind: 'timesPerDay'; times: number } // e.g. protein 3x, outside 2x
  | { kind: 'dailyAt'; hour: number } // once a day, available from this hour on
  | { kind: 'daily' } // once a day, any time in the window
  | { kind: 'everyDays'; days: number } // spans days, e.g. intimacy every other day

export interface Ritual {
  id: string
  title: string
  emoji: string
  nudge: string
  // Alternate phrasings for the same nudge. ADHD brains habituate to identical
  // repeated alerts fast and start filtering them as background noise, so the
  // nudge channel rotates through these instead of sending one fixed string.
  // `nudge` is always the canonical first option; variants are extra phrasings.
  nudgeVariants?: string[]
  cadence: RitualCadence
  tint: TintName
  context?: TaskContext // which room/place this belongs to, for presence surfacing
  window?: { startHour: number; endHour: number } // hours of day it's active
  private?: boolean // phone-only; never shown on the office TV / shared surfaces
}

export interface RitualStatus {
  ritual: Ritual
  completedToday: number
  due: boolean // should we nudge her now
  inWindow: boolean
  nextDueAt: Date | null // when it next becomes due (for "water in 40 min")
}

// Her starting set. Editable later in Settings; this seeds a new account.
export const DEFAULT_RITUALS: Ritual[] = [
  { id: 'pills-am', title: 'Morning meds', emoji: '💊', nudge: 'Take your morning meds with water.', nudgeVariants: ['Meds + water — set yourself up for a good day.', 'Quick one: morning meds with a big sip of water.', 'Brain fuel time — meds and water.'], cadence: { kind: 'dailyAt', hour: 8 }, tint: 'rose', context: 'home', window: { startHour: 7, endHour: 12 } },
  { id: 'water', title: 'Water', emoji: '💧', nudge: 'Finish a Stanley cup and refill.', nudgeVariants: ['Hydrate, gorgeous — top up the Stanley.', 'Been a sec — finish the cup and refill.', 'Water check: drink up and fill it back.'], cadence: { kind: 'timesPerDay', times: 4 }, tint: 'sky', window: { startHour: 7, endHour: 21 } },
  { id: 'protein', title: 'Protein', emoji: '🍳', nudge: 'Get some protein in.', nudgeVariants: ['Fuel those muscles — grab some protein.', 'Snack with a punch: protein time.', 'Quick protein hit will steady you out.'], cadence: { kind: 'timesPerDay', times: 3 }, tint: 'gold', window: { startHour: 8, endHour: 20 } },
  { id: 'move', title: 'Move a little', emoji: '🚶‍♀️', nudge: 'Stand up, walk a lap, shake it out.', nudgeVariants: ['Up and stretch — one lap counts.', 'Shake the stiffness out, just a minute.', 'Stand up and move, even a little.'], cadence: { kind: 'everyHours', hours: 3 }, tint: 'sage', window: { startHour: 9, endHour: 18 } },
  { id: 'outside', title: 'Step outside', emoji: '🌿', nudge: 'Go outside for a minute. Real light, real air.', nudgeVariants: ['Step out for real light and air.', 'A minute outside resets everything.', 'Door, sunshine, deep breath — go.'], cadence: { kind: 'timesPerDay', times: 2 }, tint: 'sage', context: 'home', window: { startHour: 9, endHour: 18 } },
  { id: 'trakmac', title: 'TrakMac content', emoji: '📱', nudge: 'Make one small piece of TrakMac content.', nudgeVariants: ['One tiny TrakMac post — that’s it.', 'Quick content win for TrakMac.', 'Just one small TrakMac thing today.'], cadence: { kind: 'daily' }, tint: 'terracotta', context: 'office', window: { startHour: 9, endHour: 17 } },
  { id: 'wrap-up', title: 'Close the laptop', emoji: '🌙', nudge: 'Work is done for today. Step away from the desk.', nudgeVariants: ['Laptop closed — you did enough today.', 'Call it. Step away from the desk.', 'Work’s done. Go be off the clock.'], cadence: { kind: 'dailyAt', hour: 18 }, tint: 'lavender', window: { startHour: 17, endHour: 22 } },
  { id: 'kiddos', title: 'Kid time', emoji: '🧒', nudge: 'Be with the kids. Phone down, fully there.', nudgeVariants: ['Phone down — kid time, fully there.', 'Go be present with the littles.', 'They’d love you right now — go in.'], cadence: { kind: 'daily' }, tint: 'gold', context: 'home', window: { startHour: 17, endHour: 20 } },
  { id: 'reach-out', title: 'Reach out', emoji: '💬', nudge: 'Text one person you’ve been meaning to. A text counts.', nudgeVariants: ['Send the text you’ve been putting off — keep it short.', 'Reach out to someone today. Even just a “thinking of you.”', 'One small hello to a friend. That’s the whole task.'], cadence: { kind: 'everyDays', days: 3 }, tint: 'lavender', window: { startHour: 9, endHour: 20 } },
  { id: 'intimacy', title: 'You and John', emoji: '❤️', nudge: 'Make a little time for each other tonight.', nudgeVariants: ['Carve out a little you-and-John tonight.', 'A little time for each other — worth it.', 'Don’t let the day end without a moment together.'], cadence: { kind: 'everyDays', days: 2 }, tint: 'rose', window: { startHour: 20, endHour: 23 }, private: true },
]

// Rotate to the next nudge phrasing for a ritual, given how many times it's
// already been nudged. Cycles canonical → variants → back, so the same string
// never fires twice in a row. `count` is the running nudge count for that ritual.
export function pickNudge(ritual: Pick<Ritual, 'nudge' | 'nudgeVariants'>, count: number): string {
  const pool = [ritual.nudge, ...(ritual.nudgeVariants ?? [])].filter(Boolean)
  if (pool.length === 0) return ritual.nudge
  return pool[count % pool.length]
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

// Calendar-day index (local), for comparing dates without time-of-day noise.
function dayIndex(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
}

// Given a ritual and the ISO timestamps it was completed at, decide whether it's
// due right now and when it's next due. `completions` can hold history; we only
// look at today.
export function ritualStatus(ritual: Ritual, completions: string[], now = new Date()): RitualStatus {
  const today = startOfToday(now)
  // Note: do NOT clamp to `now`. `now` ticks once a minute, so a fresh tap is a
  // few seconds ahead of it; clamping would hide the completion until the next
  // tick. Completions are always real (past) events, so today-start is enough.
  const todays = completions
    .map(c => new Date(c))
    .filter(d => d >= today)
    .sort((a, b) => a.getTime() - b.getTime())

  const completedToday = todays.length
  const last = todays[todays.length - 1] ?? null
  const hour = now.getHours()
  const inWindow = !ritual.window || (hour >= ritual.window.startHour && hour < ritual.window.endHour)

  let due = false
  let nextDueAt: Date | null = null

  switch (ritual.cadence.kind) {
    case 'everyHours': {
      const gapMs = ritual.cadence.hours * 3_600_000
      if (!last) {
        due = inWindow
      } else {
        nextDueAt = new Date(last.getTime() + gapMs)
        due = inWindow && now >= nextDueAt
      }
      break
    }
    case 'timesPerDay': {
      due = inWindow && completedToday < ritual.cadence.times
      break
    }
    case 'dailyAt': {
      const at = new Date(today)
      at.setHours(ritual.cadence.hour, 0, 0, 0)
      due = completedToday === 0 && inWindow && now >= at
      nextDueAt = completedToday === 0 ? at : null
      break
    }
    case 'daily': {
      due = completedToday === 0 && inWindow
      break
    }
    case 'everyDays': {
      // Look across all history, not just today.
      const all = completions
        .map(c => new Date(c))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime())
      const lastEver = all[all.length - 1] ?? null
      if (!lastEver) {
        due = inWindow
      } else {
        const elapsed = dayIndex(now) - dayIndex(lastEver)
        due = inWindow && elapsed >= ritual.cadence.days
        const next = new Date(today)
        next.setDate(next.getDate() + (ritual.cadence.days - elapsed))
        next.setHours(ritual.window?.startHour ?? 0, 0, 0, 0)
        nextDueAt = elapsed >= ritual.cadence.days ? null : next
      }
      break
    }
  }

  return { ritual, completedToday, due, inWindow, nextDueAt }
}

// All rituals, scored for "right now", with the due ones first. The single most
// pressing ritual is statuses[0] when it's due — that's what the kiosk and the
// rhythm strip lead with.
export function rankRituals(
  rituals: Ritual[],
  completionsById: Record<string, string[]>,
  now = new Date()
): RitualStatus[] {
  return rituals
    .map(r => ritualStatus(r, completionsById[r.id] ?? [], now))
    .sort((a, b) => {
      if (a.due !== b.due) return a.due ? -1 : 1
      // Among due items, the one overdue longest (earliest nextDueAt) leads.
      const at = a.nextDueAt?.getTime() ?? Infinity
      const bt = b.nextDueAt?.getTime() ?? Infinity
      return at - bt
    })
}
