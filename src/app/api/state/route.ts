import { auth } from '@/auth'
import { getSupabaseAdmin, supabaseConfigured, STATE_TABLE } from '@/lib/supabase-server'

export async function GET() {
  if (!supabaseConfigured()) {
    return Response.json({ error: 'sync_not_configured' }, { status: 503 })
  }

  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  if (!email) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select('state, updated_at')
    .eq('user_email', email)
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ state: data?.state ?? null, updatedAt: data?.updated_at ?? null })
}

export async function PUT(request: Request) {
  if (!supabaseConfigured()) {
    return Response.json({ error: 'sync_not_configured' }, { status: 503 })
  }

  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  if (!email) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let state: unknown
  try {
    const body = await request.json()
    state = body.state
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (state == null || typeof state !== 'object') {
    return Response.json({ error: 'invalid_state' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from(STATE_TABLE)
    .upsert(
      { user_email: email, state, updated_at: new Date().toISOString() },
      { onConflict: 'user_email' }
    )

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
