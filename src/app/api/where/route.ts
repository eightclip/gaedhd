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
    .select('room, updated_at')
    .eq('user_email', email)
    .maybeSingle()

  if (error) return Response.json({ room: null }) // table may not exist yet

  // Treat stale presence (>3h) as unknown, so an old ping doesn't mislead her.
  let room: string | null = data?.room ?? null
  if (room && data?.updated_at) {
    const ageMs = Date.now() - new Date(data.updated_at).getTime()
    if (ageMs > 3 * 3_600_000) room = null
  }

  return Response.json({ room, updatedAt: data?.updated_at ?? null })
}
