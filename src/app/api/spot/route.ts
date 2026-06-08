import { auth } from '@/auth'
import { getSupabaseAdmin, supabaseConfigured, SPOT_TASKS_TABLE } from '@/lib/supabase-server'
import { nowTokenEmail } from '@/lib/now-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Location-tagged one-line tasks ("water the plants in the yard"). Surfaced and
// nudged when she's physically in that room (see /api/enter + PresenceBar).
//  - POST   (token: Telegram bot) or (session: app)  body { title, room, emoji? } -> create
//  - GET    (session) ?room=  -> her open spot tasks (optionally just one room)
//  - DELETE (session) ?id=    -> mark done

export async function POST(request: Request) {
  if (!supabaseConfigured()) return Response.json({ error: 'sync_not_configured' }, { status: 503 })

  let body: { title?: string; room?: string; emoji?: string } = {}
  try { body = await request.json() } catch { /* allow query-only */ }
  const params = new URL(request.url).searchParams

  // Bot/device token, else the logged-in user.
  let email = nowTokenEmail(request)
  if (!email) {
    const session = await auth()
    email = session?.user?.email?.toLowerCase() ?? null
  }
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const title = (body.title ?? params.get('title') ?? '').trim()
  const room = (body.room ?? params.get('room') ?? '').trim().toLowerCase()
  const emoji = ((body.emoji ?? params.get('emoji') ?? '').trim()) || null
  if (!title || !room) return Response.json({ error: 'title and room required' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(SPOT_TASKS_TABLE)
    .insert({ user_email: email, title, room, emoji, done: false })
    .select('id')
    .maybeSingle()

  if (error) return Response.json({ error: error.message, hint: 'run supabase-migrations.sql' }, { status: 500 })
  return Response.json({ ok: true, id: data?.id, room })
}

export async function GET(request: Request) {
  if (!supabaseConfigured()) return Response.json({ items: [] })
  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const room = new URL(request.url).searchParams.get('room')?.trim().toLowerCase()
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from(SPOT_TASKS_TABLE)
    .select('id, title, room, emoji, created_at')
    .eq('user_email', email)
    .eq('done', false)
    .order('created_at', { ascending: false })
    .limit(50)
  if (room) query = query.eq('room', room)

  const { data, error } = await query
  if (error) return Response.json({ items: [] }) // table may not exist yet
  return Response.json({ items: data ?? [] })
}

export async function DELETE(request: Request) {
  if (!supabaseConfigured()) return Response.json({ error: 'sync_not_configured' }, { status: 503 })
  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from(SPOT_TASKS_TABLE)
    .update({ done: true, done_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_email', email)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
