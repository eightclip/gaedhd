// Her hand-drawn illustration set (transparent PNGs in /public/illustrations).
// Black line art that sits on any tint. See DESIGN.md (the warmth layer).

export const RITUAL_ILLO: Record<string, string> = {
  'pills-am': '/illustrations/pills.png',
  water: '/illustrations/water.png',
  protein: '/illustrations/protein.png',
  move: '/illustrations/move.png',
  outside: '/illustrations/outside.png',
  'wrap-up': '/illustrations/close-laptop.png',
  kiddos: '/illustrations/kiddos.png',
  intimacy: '/illustrations/intimacy.png',
}

export const ILLO = {
  startList: '/illustrations/start-list.png',
  yourTime: '/illustrations/your-time.png',
  snapList: '/illustrations/snap-list.png',
}

export const DONE_ILLOS = [
  '/illustrations/done-1.png',
  '/illustrations/done-2.png',
  '/illustrations/done-3.png',
]

export const SPARKLES = [
  '/illustrations/sparkle-1.png',
  '/illustrations/sparkle-2.png',
  '/illustrations/sparkle-3.png',
  '/illustrations/sparkle-4.png',
]

// Stable-within-a-day pick so the "done" and sparkle art vary day to day.
export function pickDaily<T>(arr: T[]): T {
  return arr[new Date().getDate() % arr.length]
}

// Random pick (for the per-completion celebration sparkle).
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
