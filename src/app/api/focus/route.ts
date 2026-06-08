import { sendJohn } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Body doubling: doing focused work in the low-interaction presence of another
// person lowers the activation energy to start and sustain it (see RESEARCH.md
// #11). John is the built-in body double — this pings him to co-work. No-ops
// gracefully if JOHN_CHAT_ID isn't configured (the in-app timer still works).
export async function POST(request: Request) {
  let minutes = 20
  try {
    const body = await request.json()
    if (typeof body?.minutes === 'number' && body.minutes > 0) {
      minutes = Math.min(120, Math.round(body.minutes))
    }
  } catch {
    // no/invalid body — fall back to the 20-minute default
  }

  const pinged = await sendJohn(
    `💛 She's starting a ${minutes}-minute focus session. Want to body-double? Hop on and work alongside her — reply 👍 and she'll see you're in.`
  )

  return Response.json({ ok: true, pinged })
}
