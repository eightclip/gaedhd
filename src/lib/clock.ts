// Vercel functions run in UTC, so `new Date().getHours()` is the UTC hour — wrong
// for anything user-facing like quiet hours (it made the app think she was asleep
// every afternoon/evening Pacific). Compute the current hour in HER timezone.
//
// Defaults to America/Los_Angeles; override with the GAEDHD_TZ env var if she moves.
export const APP_TZ = process.env.GAEDHD_TZ || 'America/Los_Angeles'

// Her local calendar date (year/month/day) at a given instant. The server runs in
// UTC, so during her evening the UTC date is already tomorrow — using it would
// mis-key date-based logic like the momentum streak. Use this for "her today".
export function localDatePartsAt(
  at: Date,
  tz: string = APP_TZ
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? '0')
  return { year: get('year'), month: get('month'), day: get('day') }
}

export function localDateParts(tz: string = APP_TZ) {
  return localDatePartsAt(new Date(), tz)
}

// A Date whose local (server-UTC) Y/M/D equals her local date — safe to hand to
// computeMomentum and upcomingDates so their date keys line up with the
// client-written activeDays. Noon avoids any DST edge landing on a day boundary.
export function localDateAnchor(tz: string = APP_TZ, at: Date = new Date()): Date {
  const { year, month, day } = localDatePartsAt(at, tz)
  return new Date(year, month - 1, day, 12, 0, 0)
}

// How far `tz` is ahead of UTC at a given instant, in milliseconds. Derived by
// rendering the instant in `tz` and reading it back as if it were UTC — the gap
// between the two IS the offset. Handles DST because Intl applies the rules that
// were in force at that instant.
function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? '0')
  // Intl can render midnight as hour 24 with hour12:false; normalize it.
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  // Drop sub-second noise so the difference lands on a clean offset.
  return asIfUtc - Math.floor(at.getTime() / 1000) * 1000
}

// The real UTC instant of midnight at the start of her local day. This is the
// correct lower bound for "did this happen today?" — completions are absolute
// timestamps, so comparing them against a server-UTC midnight would roll her day
// over at 5pm Pacific.
//
// Resolved in two passes: guess using the offset at `at`, then re-resolve using
// the offset that actually applies at the guessed midnight. That second pass is
// what makes it correct on the two DST-transition days each year.
export function startOfLocalDay(tz: string = APP_TZ, at: Date = new Date()): Date {
  const { year, month, day } = localDatePartsAt(at, tz)
  const localMidnightAsUtc = Date.UTC(year, month - 1, day)
  let ts = localMidnightAsUtc - tzOffsetMs(at, tz)
  ts = localMidnightAsUtc - tzOffsetMs(new Date(ts), tz)
  return new Date(ts)
}

// Which calendar day (in her timezone) an absolute instant falls on, as an integer
// day number. Use this to compare dates across instants without time-of-day noise.
export function localDayIndex(at: Date, tz: string = APP_TZ): number {
  const { year, month, day } = localDatePartsAt(at, tz)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

// Current local hour as a fraction (e.g. 19.5 = 7:30pm) in the given timezone.
export function localHourAt(at: Date, tz: string = APP_TZ): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at)
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? '0') % 24
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? '0')
  return h + m / 60
}

export function localHour(tz: string = APP_TZ): number {
  return localHourAt(new Date(), tz)
}
