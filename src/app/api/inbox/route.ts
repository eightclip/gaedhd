import { auth } from '@/auth'
import { getSupabaseAdmin, supabaseConfigured, INBOX_TABLE } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The capture inbox. Append-only, so external writers never clobber her state blob.
//  - POST  (token: Telegram bot / email / John adding to her list) or (session: app)
//           body { raw_text?, image_url?, source? } -> queues a capture
//  - GET   (session) -> her pending captures, for review in the app
//  - DELETE (session) ?id=... -> mark a capture processed once she's added it

function tokenEmail(request: Request): string | null {
  const token = process.env.GAEDHD_NOW_TOKEN
  const provided = new URL(request.url).searchParams.get('token')
  if (token && provided === token) {
    return (
      process.env.GAEDHD_NOW_EMAIL ||
      (process.env.ALLOWED_EMAILS || '').split(',')[0] ||
      ''
    ).trim().toLowerCase() || null
  }
  return null
}

export async function POST(request: Request) {
  if (!supabaseConfigured()) return Response.json({ error: 'sync_not_configured' }, { status: 503 })

  let body: { raw_text?: string; image_url?: string; source?: string } = {}
  try { body = await request.json() } catch { /* allow query-only */ }

  // Device/bot token, else the logged-in user.
  let email = tokenEmail(request)
  let source = body.source || 'api'
  if (!email) {
    const session = await auth()
    email = session?.user?.email?.toLowerCase() ?? null
    source = body.source || 'app'
  }
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const raw = (body.raw_text ?? new URL(request.url).searchParams.get('text') ?? '').trim()
  if (!raw && !body.image_url) {
    return Response.json({ error: 'raw_text or image_url required' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from(INBOX_TABLE).insert({
    user_email: email,
    source,
    raw_text: raw || null,
    image_url: body.image_url || null,
    processed: false,
  })
  if (error) return Response.json({ error: error.message, hint: 'run supabase-migrations.sql' }, { status: 500 })
  return Response.json({ ok: true })
}

export async function GET() {
  if (!supabaseConfigured()) return Response.json({ items: [] })
  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(INBOX_TABLE)
    .select('id, source, raw_text, image_url, created_at')
    .eq('user_email', email)
    .eq('processed', false)
    .order('created_at', { ascending: false })
    .limit(50)

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
    .from(INBOX_TABLE)
    .update({ processed: true })
    .eq('id', id)
    .eq('user_email', email)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
