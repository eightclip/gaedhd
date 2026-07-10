import {
  getSupabaseAdmin,
  supabaseConfigured,
  PRESENCE_TABLE,
  STATE_TABLE,
  ARRIVAL_LOG_TABLE,
  SPOT_TASKS_TABLE,
} from '@/lib/supabase-server'
import { sendTelegram, sendWebPush } from '@/lib/notify'
import { nowTokenEmail } from '@/lib/now-auth'
import { localHour, APP_TZ } from '@/lib/clock'
import { rankRituals, DEFAULT_RITUALS, type Ritual } from '@/lib/rituals'
import type { MicroTask } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// In-house room entry, reported by the ESPresense presence bridge:
//   GET /api/enter?room=living_room&token=XXX
//
// Sets her current room (same as /api/here) AND, if something is tied to that
// area — a spot task, a room-tagged task, or a due room ritual — fires ONE calm
// nudge. This is the noisy sibling of /api/here, which stays silent (the in-app
// room picker uses it).
//
// Dedup is by AREA TRANSITION, not a timer. She gets ONE ping when she enters an
// area that has something tied to it; it won't ping again while she's still there
// (or returns) until she's actually been nudged in a DIFFERENT area in between —
// the last area she was pinged for is the "anchor" (presence.last_ping_room). On
// top of that, an area won't re-ping within FLOOR_MIN, so two task-rooms can't
// ping-pong if she paces between them. After ANCHOR_TTL_MIN with no ping the
// anchor is treated as cleared, so returning the next morning pings again.

// Rooms whose beacons physically overlap and should count as ONE area, so
// flapping between them never re-pings. Kitchen + living room sit close together.
// To merge more overlapping rooms, add them to a group here (slugs, e.g. 'office').
const AREA_GROUPS: string[][] = [['kitchen', 'living_room']]

// She must be nudged in a DIFFERENT area before a given area can ping again.
const FLOOR_MIN = 15
// No ping for this long → treat the anchor as cleared (a fresh session).
const ANCHOR_TTL_MIN = 180

const humanRoom = (room: string) => room.replace(/_/g, ' ')

// All rooms that share an area with `room` (itself if it's in no group).
function roomsInArea(room: string): string[] {
  return AREA_GROUPS.find(g => g.includes(room)) ?? [room]
}
function sameArea(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && roomsInArea(a).includes(b))
}

async function handle(request: Request) {
  if (!supabaseConfigured()) return Response.json({ error: 'sync_not_configured' }, { status: 503 })

  const params = new URL(request.url).searchParams
  let room = params.get('room')
  if (!room) {
    try { room = (await request.json())?.room } catch { /* GET / empty body */ }
  }
  if (!room) return Response.json({ error: 'room required' }, { status: 400 })
  room = room.trim().toLowerCase()

  const email = nowTokenEmail(request)
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const nowIso = new Date().toISOString()
  const area = roomsInArea(room)

  // 1) Read the anchor (last area she was actually pinged for) BEFORE we touch
  //    presence. PostgREST upsert only writes the columns we pass, so the
  //    presence write below leaves last_ping_room / last_ping_at untouched.
  const { data: prev } = await supabase
    .from(PRESENCE_TABLE)
    .select('last_ping_room, last_ping_at')
    .eq('user_email', email)
    .maybeSingle()
  const anchorRoom = (prev?.last_ping_room ?? null) as string | null
  const anchorAt = prev?.last_ping_at ? new Date(prev.last_ping_at).getTime() : 0
  const anchorActive = anchorRoom && Date.now() - anchorAt < ANCHOR_TTL_MIN * 60_000

  // 2) Keep presence current (same as /api/here) so the app + kiosk agree.
  await supabase.from(PRESENCE_TABLE).upsert(
    { user_email: email, room, source: 'espresense', updated_at: nowIso },
    { onConflict: 'user_email' }
  )

  // 3) Gather everything tied to this area (grouped rooms share a task list).
  const { data: spotRows } = await supabase
    .from(SPOT_TASKS_TABLE)
    .select('title, emoji')
    .eq('user_email', email)
    .in('room', area)
    .eq('done', false)
    .order('created_at', { ascending: true })
    .limit(10)
  const spotTitles = (spotRows ?? []).map(r => (r.emoji ? `${r.emoji} ` : '') + r.title)

  const { data: stateRow } = await supabase
    .from(STATE_TABLE)
    .select('state')
    .eq('user_email', email)
    .maybeSingle()
  const state = (stateRow?.state ?? {}) as {
    microTasks?: MicroTask[]
    rituals?: Ritual[]
    ritualLog?: Record<string, string[]>
    settings?: { wakeHour?: number; sleepHour?: number }
  }

  const taskTitles = (state.microTasks ?? [])
    .filter(t => t.context != null && area.includes(t.context) && t.status === 'pending')
    .slice(0, 5)
    .map(t => t.title)

  const now = new Date()
  const roomRituals = (state.rituals && state.rituals.length ? state.rituals : DEFAULT_RITUALS)
    .filter(r => r.context != null && area.includes(r.context))
  // Rank in HER timezone — see /api/now. On the server's UTC clock a room ritual
  // would look due in the middle of her night and undone in her afternoon.
  const dueRituals = rankRituals(roomRituals, state.ritualLog ?? {}, now, APP_TZ)
    .filter(s => s.due)
    .map(s => s.ritual.title)

  const items = [...spotTitles, ...taskTitles, ...dueRituals]
  // Nothing tied to this area → stay completely silent (don't even touch the
  // anchor; a taskless room is not "a ping somewhere else").
  if (items.length === 0) {
    return Response.json({ ok: true, room, nudged: false, reason: 'nothing_here' })
  }

  // 4) Quiet hours — never buzz before she's up or after she's down. Use HER
  // timezone, not the function's UTC clock (see src/lib/clock.ts).
  const hour = localHour()
  const wake = state.settings?.wakeHour ?? 8
  const sleep = state.settings?.sleepHour ?? 21
  if (hour < wake || hour >= sleep) {
    return Response.json({ ok: true, room, nudged: false, reason: 'quiet_hours' })
  }

  // 5) Anchor: she's still in (or has returned to) the same area she was last
  //    pinged for, with no nudge anywhere else since → stay quiet.
  if (anchorActive && sameArea(room, anchorRoom)) {
    return Response.json({ ok: true, room, nudged: false, reason: 'same_area' })
  }

  // 6) Floor: even after a ping elsewhere, don't re-ping THIS area within
  //    FLOOR_MIN — stops two task-rooms ping-ponging if she paces. Shares the
  //    arrival log; in-house room names never collide with the geofence rooms
  //    (home/gym/errands/school) /api/arrive uses.
  const { data: recent } = await supabase
    .from(ARRIVAL_LOG_TABLE)
    .select('notified_at')
    .eq('user_email', email)
    .in('room', area)
    .order('notified_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (recent?.notified_at) {
    const ageMin = (Date.now() - new Date(recent.notified_at).getTime()) / 60_000
    if (ageMin < FLOOR_MIN) return Response.json({ ok: true, room, nudged: false, reason: 'too_soon' })
  }

  // 7) One calm nudge, up to 3 things.
  const shown = items.slice(0, 3)
  const more = items.length - shown.length
  const body =
    `📍 While you're in the ${humanRoom(room)}:\n` +
    shown.map(t => `• ${t}`).join('\n') +
    (more > 0 ? `\n…and ${more} more` : '')

  const telegram = await sendTelegram(body)
  const webpush = await sendWebPush({ title: 'GaeDHD', body, url: '/' })

  // 8) Record the ping: move the anchor to this area, and stamp the per-room
  //    floor so it can't immediately re-fire.
  await supabase.from(PRESENCE_TABLE).update(
    { last_ping_room: room, last_ping_at: nowIso }
  ).eq('user_email', email)
  await supabase.from(ARRIVAL_LOG_TABLE).upsert(
    { user_email: email, room, notified_at: nowIso },
    { onConflict: 'user_email,room' }
  )

  return Response.json({ ok: true, room, nudged: true, count: items.length, telegram, webpush })
}

export async function GET(request: Request) { return handle(request) }
export async function POST(request: Request) { return handle(request) }
