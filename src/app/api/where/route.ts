import { auth } from '@/auth'
import { getSupabaseAdmin, supabaseConfigured, PRESENCE_TABLE } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Where is she right now (for the in-app "while you're here" surfacing).
// Session-authed. Degrades to room=null if presence isn't set up yet.
export async function GET() {
  if (!supabaseConfigured()) return Response.json({ room: null })

  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(PRESENCE_TABLE)
    .select('room, source, updated_at')
    .eq('user_email', email)
    .maybeSingle()

  if (error) return Response.json({ room: null }) // table may not exist yet

  // `room` powers the "while you're here" surfacing: treat stale presence (>3h)
  // as unknown so an old ping doesn't mislead her.
  let room: string | null = data?.room ?? null
  if (room && data?.updated_at) {
    const ageMs = Date.now() - new Date(data.updated_at).getTime()
    if (ageMs > 3 * 3_600_000) room = null
  }

  // `lastRoom`/`source`/`updatedAt` are the raw values (never nulled by staleness),
  // for the Presence status panel in Settings. Note: presence only updates when she
  // changes rooms, so a frozen updatedAt means "same room" OR "bridge offline".
  return Response.json({
    room,
    lastRoom: data?.room ?? null,
    source: data?.source ?? null,
    updatedAt: data?.updated_at ?? null,
  })
}
