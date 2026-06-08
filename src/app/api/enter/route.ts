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
import { rankRituals, DEFAULT_RITUALS, type Ritual } from '@/lib/rituals'
import type { MicroTask } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// In-house room entry, reported by the ESPresense presence bridge:
//   GET /api/enter?room=living_room&token=XXX
//
// Sets her current room (same as /api/here) AND, if something is tied to that
// room — a spot task, a room-tagged task, or a due room ritual — fires ONE calm
// nudge, with a per-room cooldown and quiet hours so it never nags. This is the
// noisy sibling of /api/here, which stays silent (the in-app room picker uses it).

const COOLDOWN_MIN = 30

const humanRoom = (room: string) => room.replace(/_/g, ' ')

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

  // 1) Keep presence current (same as /api/here) so the app + kiosk agree.
  await supabase.from(PRESENCE_TABLE).upsert(
    { user_email: email, room, source: 'espresense', updated_at: nowIso },
    { onConflict: 'user_email' }
  )

  // 2) Gather everything tied to this room.
  const { data: spotRows } = await supabase
    .from(SPOT_TASKS_TABLE)
    .select('title, emoji')
    .eq('user_email', email)
    .eq('room', room)
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
    .filter(t => t.context === room && t.status === 'pending')
    .slice(0, 5)
    .map(t => t.title)

  const now = new Date()
  const roomRituals = (state.rituals && state.rituals.length ? state.rituals : DEFAULT_RITUALS)
    .filter(r => r.context === room)
  const dueRituals = rankRituals(roomRituals, state.ritualLog ?? {}, now)
    .filter(s => s.due)
    .map(s => s.ritual.title)

  const items = [...spotTitles, ...taskTitles, ...dueRituals]
  if (items.length === 0) {
    return Response.json({ ok: true, room, nudged: false, reason: 'nothing_here' })
  }

  // 3) Quiet hours — never buzz before she's up or after she's down.
  const hour = now.getHours() + now.getMinutes() / 60
  const wake = state.settings?.wakeHour ?? 8
  const sleep = state.settings?.sleepHour ?? 21
  if (hour < wake || hour >= sleep) {
    return Response.json({ ok: true, room, nudged: false, reason: 'quiet_hours' })
  }

  // 4) Per-room cooldown. Shares the arrival log; in-house room names
  //    (office/kitchen/bedroom/living_room/yard) never collide with the geofence
  //    rooms (home/gym/errands/school) /api/arrive uses.
  const { data: last } = await supabase
    .from(ARRIVAL_LOG_TABLE)
    .select('notified_at')
    .eq('user_email', email)
    .eq('room', room)
    .maybeSingle()
  if (last?.notified_at) {
    const ageMin = (Date.now() - new Date(last.notified_at).getTime()) / 60_000
    if (ageMin < COOLDOWN_MIN) return Response.json({ ok: true, room, nudged: false, reason: 'cooldown' })
  }

  // 5) One calm nudge, up to 3 things.
  const shown = items.slice(0, 3)
  const more = items.length - shown.length
  const body =
    `📍 While you're in the ${humanRoom(room)}:\n` +
    shown.map(t => `• ${t}`).join('\n') +
    (more > 0 ? `\n…and ${more} more` : '')

  const telegram = await sendTelegram(body)
  const webpush = await sendWebPush({ title: 'GaeDHD', body, url: '/' })

  await supabase.from(ARRIVAL_LOG_TABLE).upsert(
    { user_email: email, room, notified_at: nowIso },
    { onConflict: 'user_email,room' }
  )

  return Response.json({ ok: true, room, nudged: true, count: items.length, telegram, webpush })
}

export async function GET(request: Request) { return handle(request) }
export async function POST(request: Request) { return handle(request) }
