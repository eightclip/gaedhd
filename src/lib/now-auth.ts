// Shared auth for the device/bot token (GAEDHD_NOW_TOKEN). Used by the kiosk,
// the Telegram bot, the presence bridge, and Apple Shortcuts.
//
// Preferred transport is an `Authorization: Bearer <token>` header, which keeps
// the secret out of URLs (and therefore out of server access logs, browser
// history, and Referer headers). The legacy `?token=` query param is still
// accepted as a fallback so clients that can't easily set a header (some Apple
// Shortcuts setups, the kiosk page) keep working during the transition. New
// callers should send the header.

function configuredEmail(): string | null {
  return (
    process.env.GAEDHD_NOW_EMAIL ||
    (process.env.ALLOWED_EMAILS || '').split(',')[0] ||
    ''
  ).trim().toLowerCase() || null
}

// The single shared GaeDHD account that every signed-in allowlisted user reads and
// writes — so John (her "coworker") and the kiosk and her phone all see HER data.
// Same value the device/bot token resolves to (GAEDHD_NOW_EMAIL, else the first
// ALLOWED_EMAILS entry). Revert to per-session email here when we whitelabel.
export function accountEmail(): string | null {
  return configuredEmail()
}

// Pull the bearer token from the Authorization header, else the ?token= param.
function providedToken(request: Request): string | null {
  const header = request.headers.get('authorization') || ''
  const m = /^bearer\s+(.+)$/i.exec(header.trim())
  if (m) return m[1].trim()
  return new URL(request.url).searchParams.get('token')
}

// True when the request carries a valid device/bot token.
export function nowTokenValid(request: Request): boolean {
  const expected = process.env.GAEDHD_NOW_TOKEN
  if (!expected) return false
  const provided = providedToken(request)
  return Boolean(provided && provided === expected)
}

// The configured single-user email when the token is valid, else null. Routes
// that accept "token OR session" use this for the token branch.
export function nowTokenEmail(request: Request): string | null {
  return nowTokenValid(request) ? configuredEmail() : null
}
