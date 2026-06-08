// Vercel functions run in UTC, so `new Date().getHours()` is the UTC hour — wrong
// for anything user-facing like quiet hours (it made the app think she was asleep
// every afternoon/evening Pacific). Compute the current hour in HER timezone.
//
// Defaults to America/Los_Angeles; override with the GAEDHD_TZ env var if she moves.
export const APP_TZ = process.env.GAEDHD_TZ || 'America/Los_Angeles'

// Her local calendar date (year/month/day) in the given timezone. The server runs
// in UTC, so during her evening the UTC date is already tomorrow — using it would
// mis-key date-based logic like the momentum streak. Use this for "her today".
export function localDateParts(tz: string = APP_TZ): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? '0')
  return { year: get('year'), month: get('month'), day: get('day') }
}

// A Date whose local (server-UTC) Y/M/D equals her local date — safe to hand to
// computeMomentum so its date keys line up with the client-written activeDays.
export function localDateAnchor(tz: string = APP_TZ): Date {
  const { year, month, day } = localDateParts(tz)
  return new Date(year, month - 1, day, 12, 0, 0)
}

// Current local hour as a fraction (e.g. 19.5 = 7:30pm) in the given timezone.
export function localHour(tz: string = APP_TZ): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? '0') % 24
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? '0')
  return h + m / 60
}
