import { auth } from '@/auth'
import { getSupabaseAdmin, supabaseConfigured, PUSH_SUBS_TABLE } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Stores a web push subscription for the logged-in user. Called from the
// "Notifications on this device" toggle in Settings after she grants permission.
export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return Response.json({ error: 'sync_not_configured' }, { status: 503 })
  }

  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  let sub: { endpoint?: string } | undefined
  try { sub = (await request.json())?.subscription } catch { /* bad body */ }
  if (!sub?.endpoint) return Response.json({ error: 'subscription required' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from(PUSH_SUBS_TABLE).upsert(
    { endpoint: sub.endpoint, user_email: email, subscription: sub, created_at: new Date().toISOString() },
    { onConflict: 'endpoint' }
  )
  if (error) {
    return Response.json({ error: error.message, hint: 'run supabase-migrations.sql' }, { status: 500 })
  }
  return Response.json({ ok: true })
}

// Removes this device's subscription (toggle off).
export async function DELETE(request: Request) {
  if (!supabaseConfigured()) {
    return Response.json({ error: 'sync_not_configured' }, { status: 503 })
  }
  const session = await auth()
  if (!session?.user?.email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  let endpoint: string | undefined
  try { endpoint = (await request.json())?.endpoint } catch { /* bad body */ }
  if (!endpoint) return Response.json({ error: 'endpoint required' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  await supabase.from(PUSH_SUBS_TABLE).delete().eq('endpoint', endpoint)
  return Response.json({ ok: true })
}
