// The soft tint palette and the color-of-the-day. See DESIGN.md.
// Tints fill cards; ink is the text/accent that sits on a tint.

export type TintName = 'terracotta' | 'sage' | 'lavender' | 'rose' | 'sky' | 'gold'

export const TINTS: Record<TintName, { tint: string; ink: string }> = {
  terracotta: { tint: '#F5E6E0', ink: '#C85D3E' },
  sage:       { tint: '#E8F0E4', ink: '#7B9E6B' },
  lavender:   { tint: '#ECE5F3', ink: '#9B7EC8' },
  rose:       { tint: '#F5E4EC', ink: '#C87E9E' },
  sky:        { tint: '#E2EEF2', ink: '#6BA3BE' },
  gold:       { tint: '#F5ECD9', ink: '#A89060' },
}

const TINT_ORDER: TintName[] = ['terracotta', 'sage', 'lavender', 'rose', 'sky', 'gold']

// One tint per calendar day, rotating. Deterministic from the date so the phone,
// the web dashboard, and the TV all land on the same color without coordinating.
export function colorOfDay(date = new Date()): TintName {
  const dayIndex = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
  )
  return TINT_ORDER[((dayIndex % TINT_ORDER.length) + TINT_ORDER.length) % TINT_ORDER.length]
}

// Push today's tint into the CSS variables the whole app reads. Call from a
// client component on mount (and at midnight) so --today-tint / --today-ink update.
export function applyColorOfDay(date = new Date()) {
  if (typeof document === 'undefined') return
  const { tint, ink } = TINTS[colorOfDay(date)]
  const root = document.documentElement
  root.style.setProperty('--today-tint', tint)
  root.style.setProperty('--today-ink', ink)
}
