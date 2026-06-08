// Vercel functions run in UTC, so `new Date().getHours()` is the UTC hour — wrong
// for anything user-facing like quiet hours (it made the app think she was asleep
// every afternoon/evening Pacific). Compute the current hour in HER timezone.
//
// Defaults to America/Los_Angeles; override with the GAEDHD_TZ env var if she moves.
export const APP_TZ = process.env.GAEDHD_TZ || 'America/Los_Angeles'

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
