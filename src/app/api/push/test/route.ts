import { auth } from '@/auth'
import { sendWebPush } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sends a test push to all of her devices. Session-gated so only she can fire it
// (the "send a test" button in Settings, right after enabling).
export async function POST() {
  const session = await auth()
  if (!session?.user?.email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const sent = await sendWebPush({
    title: 'GaeDHD',
    body: "Notifications are on. I've got your back from here. — John",
    url: '/',
  })
  return Response.json({ ok: true, sent })
}
