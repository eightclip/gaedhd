import { nowTokenValid } from '@/lib/now-auth'
import { getSupabaseAdmin, supabaseConfigured, PRESENCE_TABLE } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Daily presence reset. Wipes her current-room row so yesterday's last room (or a
// stale ping) doesn't linger into the morning — she starts each day with a clean
// slate and her first real room-change re-establishes presence. Fired by a Vercel
// cron (see vercel.json) and callable by hand with the device token.
//
// Auth: the device/bot token (Authorization: Bearer GAEDHD_NOW_TOKEN) OR the
// Vercel cron secret (Vercel injects Authorization: Bearer CRON_SECRET when set).
function authorized(request: Request): boolean {
  if (nowTokenValid(request)) return true
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') || ''
  return Boolean(secret && header === `Bearer ${secret}`)
}

async function handler(request: Request) {
  if (!supabaseConfigured()) {
    return Response.json({ error: 'sync_not_configured' }, { status: 503 })
  }
  if (!authorized(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const email = (
    process.env.GAEDHD_NOW_EMAIL ||
    (process.env.ALLOWED_EMAILS || '').split(',')[0] ||
    ''
  ).trim().toLowerCase()
  if (!email) {
    return Response.json({ error: 'no_user_configured' }, { status: 500 })
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from(PRESENCE_TABLE).delete().eq('user_email', email)
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, reset: true })
}

export const GET = handler
export const POST = handler
