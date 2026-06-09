// Shared calendar fetching/expansion, used by /api/calendar (session) and
// /api/now (token, for the kiosk). Server-only: pulls iCal/Google feeds with node-ical.
import ical from 'node-ical'
import type { CalendarEvent } from './types'
import type { CalendarSource } from './store'

export function normalizeUrl(url: string): string {
  const u = url.trim().replace(/^webcal:\/\//i, 'https://')

  // Google Calendar hands out a few different "public" links, but only the iCal
  // feed (.../ical/<id>/public/basic.ics) is actually fetchable. If she pasted the
  // embed page (?src=…) or a share link (?cid=…) instead, convert it to that feed.
  try {
    const parsed = new URL(u)
    if (/(?:^|\.)calendar\.google\.com$/i.test(parsed.hostname) && !/\/ical\//i.test(parsed.pathname)) {
      let calId = parsed.searchParams.get('src')
      if (!calId) {
        const cid = parsed.searchParams.get('cid')
        // cid is base64url of the calendar id.
        if (cid) {
          try { calId = Buffer.from(cid.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8').trim() } catch { /* not decodable */ }
        }
      }
      if (calId) {
        return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calId)}/public/basic.ics`
      }
    }
  } catch {
    // Not a parseable URL — fall through and return it as-is.
  }

  return u
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Expand one VEVENT (incl. recurrences/overrides/exdates) into the day window.
export function collectOccurrences(
  comp: any,
  dayStart: Date,
  dayEnd: Date,
  src: CalendarSource,
  out: CalendarEvent[]
) {
  const start: Date = comp.start
  if (!(start instanceof Date)) return
  const end: Date = comp.end instanceof Date ? comp.end : new Date(start.getTime() + 30 * 60000)
  const durationMs = Math.max(0, end.getTime() - start.getTime())

  const push = (s: Date, e: Date, title: string) => {
    if (e.getTime() > dayStart.getTime() && s.getTime() < dayEnd.getTime()) {
      out.push({
        id: `${comp.uid ?? 'ev'}-${s.getTime()}`,
        calendarId: src.id,
        title: title || 'Busy',
        startTime: s.toISOString(),
        endTime: e.toISOString(),
        color: src.color,
      })
    }
  }

  if (comp.rrule) {
    const occurrences: Date[] = comp.rrule.between(
      new Date(dayStart.getTime() - durationMs),
      dayEnd,
      true
    )
    const exDates: Date[] = comp.exdate ? Object.values(comp.exdate) : []
    const overrides: Record<string, any> = comp.recurrences ?? {}

    for (const occ of occurrences) {
      if (exDates.some(ex => sameDay(ex, occ))) continue
      const overrideKey = Object.keys(overrides).find(k => sameDay(new Date(overrides[k].start), occ))
      if (overrideKey) {
        const ov = overrides[overrideKey]
        const ovStart: Date = ov.start
        const ovEnd: Date = ov.end instanceof Date ? ov.end : new Date(ovStart.getTime() + durationMs)
        push(ovStart, ovEnd, ov.summary ?? comp.summary)
      } else {
        push(occ, new Date(occ.getTime() + durationMs), comp.summary)
      }
    }
  } else {
    push(start, end, comp.summary)
  }
}

// Fetch and merge all of a user's calendar sources into the day window.
export async function fetchEventsForSources(
  sources: CalendarSource[],
  dayStart: Date,
  dayEnd: Date
): Promise<{ events: CalendarEvent[]; failed: string[] }> {
  const events: CalendarEvent[] = []
  const failed: string[] = []

  await Promise.all(
    sources.map(async (src) => {
      try {
        const parsed = await ical.async.fromURL(normalizeUrl(src.url))
        for (const key of Object.keys(parsed)) {
          const comp = parsed[key] as any
          if (comp?.type === 'VEVENT') {
            collectOccurrences(comp, dayStart, dayEnd, src, events)
          }
        }
      } catch {
        failed.push(src.name)
      }
    })
  )

  events.sort((a, b) => a.startTime.localeCompare(b.startTime))
  return { events, failed }
}
