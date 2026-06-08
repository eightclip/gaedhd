import { auth } from '@/auth'
import { getSupabaseAdmin, supabaseConfigured, STATE_TABLE } from '@/lib/supabase-server'
import type { CalendarSource } from '@/lib/store'
import type { CalendarEvent } from '@/lib/types'
import { normalizeUrl, collectOccurrences, fetchEventsForSources } from '@/lib/ical'
import ical from 'node-ical'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(request: Request) {
  if (!supabaseConfigured()) {
    return Response.json({ events: [], calendars: 0, error: 'sync_not_configured' })
  }

  const params = new URL(request.url).searchParams
  const now = new Date()
  const dayStart = params.get('start')
    ? new Date(params.get('start')!)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const dayEnd = params.get('end')
    ? new Date(params.get('end')!)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  if (!email) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Optional per-user diagnostic: ?debug=1 reports feed health for the CALLER's
  // own calendar sources only (event counts + a sample, scoped to their session).
  // The old debugToken backdoor that dumped every account's feeds was removed.
  const debug = params.get('debug') === '1'

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from(STATE_TABLE)
    .select('state')
    .eq('user_email', email)
    .maybeSingle()

  const sources: CalendarSource[] =
    (data?.state as { settings?: { calendarSources?: CalendarSource[] } } | null)?.settings
      ?.calendarSources ?? []

  if (debug) {
    const wideEnd = new Date(dayStart.getTime() + 14 * 86400000)
    const report: unknown[] = []
    for (const src of sources) {
      const norm = normalizeUrl(src.url)
      let host = ''
      try { host = new URL(norm).host } catch { host = 'invalid-url' }
      const looksLikeIcs = /\/ical\//i.test(norm) || /\.ics(\?|$)/i.test(norm)
      let status = 'ok', totalVevents = 0, recurring = 0, eventsToday = 0, eventsNext14 = 0, err = ''
      const sample: string[] = []
      try {
        const parsed = await ical.async.fromURL(norm)
        const evsToday: CalendarEvent[] = []
        const evsWide: CalendarEvent[] = []
        for (const k of Object.keys(parsed)) {
          const comp = parsed[k] as any
          if (comp?.type === 'VEVENT') {
            totalVevents++
            if (comp.rrule) recurring++
            collectOccurrences(comp, dayStart, dayEnd, src, evsToday)
            collectOccurrences(comp, dayStart, wideEnd, src, evsWide)
          }
        }
        eventsToday = evsToday.length
        eventsNext14 = evsWide.length
        for (const e of evsWide.slice(0, 6)) sample.push(`${e.title} @ ${e.startTime}`)
      } catch (e) {
        status = 'FETCH_FAILED'
        err = e instanceof Error ? e.message : 'unknown'
      }
      report.push({ name: src.name, type: src.type, host, looksLikeIcs, status, totalVevents, recurring, eventsToday, eventsNext14, sample, err })
    }
    return Response.json({ debug: true, dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString(), report })
  }

  if (!sources.length) {
    return Response.json({ events: [], calendars: 0 })
  }

  const { events, failed } = await fetchEventsForSources(sources, dayStart, dayEnd)
  return Response.json({ events, calendars: sources.length, failed })
}
