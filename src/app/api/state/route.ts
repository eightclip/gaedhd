import { auth } from '@/auth'
import { accountEmail } from '@/lib/now-auth'
import { getSupabaseAdmin, supabaseConfigured, STATE_TABLE } from '@/lib/supabase-server'

export async function GET() {
  if (!supabaseConfigured()) {
    return Response.json({ error: 'sync_not_configured' }, { status: 503 })
  }

  const session = await auth()
  if (!session?.user?.email) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  // Shared account: every signed-in allowed user reads/writes the same primary row.
  const email = accountEmail()
  if (!email) {
    return Response.json({ error: 'no_user_configured' }, { status: 500 })
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
  if (!session?.user?.email) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  // Shared account: every signed-in allowed user reads/writes the same primary row.
  const email = accountEmail()
  if (!email) {
    return Response.json({ error: 'no_user_configured' }, { status: 500 })
  }

  let state: unknown
  let baseUpdatedAt: string | null = null
  try {
    const body = await request.json()
    state = body.state
    // The updated_at the client last reconciled with. Used as a compare-and-swap
    // token so a device with a stale blob can't silently clobber a newer write from
    // another device (which would revert her completions in front of her).
    baseUpdatedAt = typeof body.baseUpdatedAt === 'string' ? body.baseUpdatedAt : null
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (state == null || typeof state !== 'object') {
    return Response.json({ error: 'invalid_state' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const newUpdatedAt = new Date().toISOString()

  // Read the other device's current version and hand it back so the client can
  // merge additively and retry — never losing a completion.
  const conflict = async () => {
    const { data } = await supabase
      .from(STATE_TABLE)
      .select('state, updated_at')
      .eq('user_email', email)
      .maybeSingle()
    return Response.json(
      { error: 'conflict', state: data?.state ?? null, updatedAt: data?.updated_at ?? null },
      { status: 409 },
    )
  }

  if (baseUpdatedAt == null) {
    // First write for this account: there should be no row yet. Insert it. If a row
    // already exists (another device raced us to the first write), the primary-key
    // unique violation (23505) becomes a 409 so the client merges instead of blindly
    // overwriting.
    const { data, error } = await supabase
      .from(STATE_TABLE)
      .insert({ user_email: email, state, updated_at: newUpdatedAt })
      .select('updated_at')
      .maybeSingle()

    if (error) {
      if (error.code === '23505') return conflict()
      return Response.json({ error: error.message }, { status: 500 })
    }
    // Echo what the DB actually stored — see the note on the update path below.
    return Response.json({ ok: true, updatedAt: data?.updated_at ?? newUpdatedAt })
  }

  // Compare-and-swap: only overwrite if the row STILL carries the version we based
  // this write on. The `.eq('updated_at', baseUpdatedAt)` makes the check atomic in
  // the DB (no read-then-write race); zero rows returned means another device wrote
  // in the meantime, so we bounce it back as a 409 for the client to merge.
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .update({ state, updated_at: newUpdatedAt })
    .eq('user_email', email)
    .eq('updated_at', baseUpdatedAt)
    .select('updated_at')

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return conflict()
  }

  // Echo the value the DATABASE stored, never the one we computed. gaedhd_state
  // was created by hand, so we cannot be sure a BEFORE UPDATE trigger isn't
  // rewriting updated_at to now(). If one is, our own `newUpdatedAt` is a lie:
  // the client would send it back as `baseUpdatedAt`, the compare-and-swap would
  // miss, and every single save from then on would 409 → merge → retry. It would
  // still converge (no data lost) but it would double every write forever.
  // Reading the stored value back makes the whole question moot.
  return Response.json({ ok: true, updatedAt: data[0].updated_at ?? newUpdatedAt })
}
