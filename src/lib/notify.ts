import webpush from 'web-push'
import { getSupabaseAdmin, supabaseConfigured, PUSH_SUBS_TABLE } from './supabase-server'

// Two outbound channels for a nudge. Both no-op gracefully when their env isn't
// set, so the app and the arrival endpoint never error just because one channel
// isn't wired yet.

// Send to a specific Telegram chat. No-ops gracefully if the bot token or the
// chat id isn't set, so callers never error just because a channel isn't wired.
export async function sendTelegramTo(chatId: string | undefined, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Telegram lands on her phone and her Apple Watch with zero setup on her end.
// Reuses the bot token + chat id the nudge bot already uses.
export async function sendTelegram(text: string): Promise<boolean> {
  return sendTelegramTo(process.env.TELEGRAM_CHAT_ID || process.env.NUDGE_CHAT_ID, text)
}

// Ping John (the built-in body double). Needs JOHN_CHAT_ID set.
export async function sendJohn(text: string): Promise<boolean> {
  return sendTelegramTo(process.env.JOHN_CHAT_ID, text)
}

let vapidReady = false
function configureVapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  if (!vapidReady) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:eightclip@gmail.com', pub, priv)
    vapidReady = true
  }
  return true
}

type PushRow = { endpoint: string; subscription: webpush.PushSubscription }

// Web push reaches the installed PWA on her phone (and mirrors to the watch).
// Returns the number of devices successfully pushed. Prunes dead subscriptions.
export async function sendWebPush(payload: { title: string; body: string; url?: string }): Promise<number> {
  if (!configureVapid() || !supabaseConfigured()) return 0
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from(PUSH_SUBS_TABLE).select('endpoint, subscription')
  const rows = (data ?? []) as PushRow[]
  let sent = 0
  await Promise.all(
    rows.map(async row => {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify(payload))
        sent++
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode
        // 404/410 mean the subscription is gone — stop trying it.
        if (code === 404 || code === 410) {
          await supabase.from(PUSH_SUBS_TABLE).delete().eq('endpoint', row.endpoint)
        }
      }
    })
  )
  return sent
}
