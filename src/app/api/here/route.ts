import { auth } from '@/auth'
import { getSupabaseAdmin, supabaseConfigured, PRESENCE_TABLE } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sets where she is right now. Two callers:
//  - Devices (Home Assistant, NFC Shortcuts): GET /api/here?room=studio&token=XXX
//  - The in-app room switcher: POST /api/here { room } with her session cookie
// One source of truth, fed by whatever exists. See AMBIENT-SETUP.md.

async function resolveEmail(request: Request): Promise<string | null> {
  const token = process.env.GAEDHD_NOW_TOKEN
  const provided = new URL(request.url).searchParams.get('token')
  if (token && provided === token) {
    return (
      process.env.GAEDHD_NOW_EMAIL ||
      (process.env.ALLOWED_EMAILS || '').split(',')[0] ||
      ''
    ).trim().toLowerCase() || null
  }
  const session = await auth()
  return session?.user?.email?.toLowerCase() ?? null
}

async function setRoom(request: Request) {
  if (!supabaseConfigured()) {
    return Response.json({ error: 'sync_not_configured' }, { status: 503 })
  }

  const params = new URL(request.url).searchParams
  let room = params.get('room')
  if (!room) {
    try { room = (await request.json())?.room } catch { /* GET / empty body */ }
  }
  if (!room) {
    return Response.json({ error: 'room required' }, { status: 400 })
  }

  const email = await resolveEmail(request)
  if (!email) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from(PRESENCE_TABLE)
    .upsert(
      { user_email: email, room, source: params.get('source') || 'api', updated_at: new Date().toISOString() },
      { onConflict: 'user_email' }
    )

  if (error) {
    // Likely the table doesn't exist yet — see supabase-migrations.sql.
    return Response.json({ error: error.message, hint: 'run supabase-migrations.sql' }, { status: 500 })
  }

  return Response.json({ ok: true, room })
}

export async function GET(request: Request) { return setRoom(request) }
export async function POST(request: Request) { return setRoom(request) }
