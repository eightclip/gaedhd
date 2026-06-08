import { getSupabaseAdmin, supabaseConfigured, PRESENCE_TABLE, STATE_TABLE, ARRIVAL_LOG_TABLE } from '@/lib/supabase-server'
import { currentNextActions } from '@/lib/schedule'
import { sendTelegram, sendWebPush } from '@/lib/notify'
import { nowTokenEmail } from '@/lib/now-auth'
import type { Goal, MicroTask } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// A geofence arrival. Apple Shortcuts personal automations hit this when she
// arrives somewhere meaningful: GET /api/arrive?room=gym&token=XXX
//
// This is deliberately separate from /api/here. In-house BLE room flips
// (kitchen <-> office) go to /api/here and stay silent. Only these coarse
// geofence arrivals nudge her wrist, with a cooldown and quiet hours so it
// never turns into spam.

const COOLDOWN_MIN = 45

// Rooms an arrival should nudge, and the copy for each. The {task} is her
// current one thing; the fallback is what to say when her list is clear.
const ARRIVAL_COPY: Record<string, (task: string | null) => string> = {
  gym: t => t ? `💪 You made it to the gym. One thing while you're here: ${t}` : `💪 You made it to the gym. Just move — that already counts.`,
  errands: t => t ? `🛒 Out and about. Easy win when you get a sec: ${t}` : `🛒 Out and about. Nothing pending — enjoy it.`,
  store: t => t ? `🛒 Out and about. Easy win when you get a sec: ${t}` : `🛒 Out and about. Nothing pending — enjoy it.`,
  home: t => t ? `🏡 Welcome home. No rush at all. When you're ready: ${t}` : `🏡 Welcome home. Nothing on the list — rest, you earned it.`,
  school: t => t ? `🚗 School run done. You've got a clear stretch now: ${t}` : `🚗 School run done. Breathe first, then pick one thing.`,
}

async function handle(request: Request) {
  if (!supabaseConfigured()) {
    return Response.json({ error: 'sync_not_configured' }, { status: 503 })
  }

  const params = new URL(request.url).searchParams
  let room = params.get('room')
  if (!room) {
    try { room = (await request.json())?.room } catch { /* GET / empty body */ }
  }
  if (!room) return Response.json({ error: 'room required' }, { status: 400 })
  room = room.toLowerCase()

  const email = nowTokenEmail(request)
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const nowIso = new Date().toISOString()

  // 1) Keep presence accurate, same as /api/here, so the app and kiosk agree.
  await supabase.from(PRESENCE_TABLE).upsert(
    { user_email: email, room, source: 'geofence', updated_at: nowIso },
    { onConflict: 'user_email' }
  )

  const copy = ARRIVAL_COPY[room]
  if (!copy) return Response.json({ ok: true, room, nudged: false, reason: 'room_not_nudge_worthy' })

  // 2) Cooldown: don't re-nudge the same room within COOLDOWN_MIN (geofence flap).
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

  // 3) Load her state for quiet hours + her current one thing.
  const { data: row } = await supabase
    .from(STATE_TABLE)
    .select('state')
    .eq('user_email', email)
    .maybeSingle()
  const state = (row?.state ?? {}) as {
    goals?: Goal[]
    microTasks?: MicroTask[]
    settings?: { wakeHour?: number; sleepHour?: number }
  }

  // Quiet hours: never buzz before she's up or after she's down.
  const now = new Date()
  const hour = now.getHours() + now.getMinutes() / 60
  const wake = state.settings?.wakeHour ?? 8
  const sleep = state.settings?.sleepHour ?? 21
  if (hour < wake || hour >= sleep) {
    return Response.json({ ok: true, room, nudged: false, reason: 'quiet_hours' })
  }

  const next = currentNextActions(state.goals ?? [], state.microTasks ?? [])[0]
  const text = copy(next ? next.microTask.title : null)

  const telegram = await sendTelegram(text)
  const webpush = await sendWebPush({ title: 'GaeDHD', body: text, url: '/' })

  // 4) Record the nudge so the cooldown holds.
  await supabase.from(ARRIVAL_LOG_TABLE).upsert(
    { user_email: email, room, notified_at: nowIso },
    { onConflict: 'user_email,room' }
  )

  return Response.json({ ok: true, room, nudged: true, telegram, webpush })
}

export async function GET(request: Request) { return handle(request) }
export async function POST(request: Request) { return handle(request) }
