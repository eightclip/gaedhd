# GaeDHD Go-Live Checklist

Everything that's yours to wire now that the app is built and deployed. Order matters:
bot first, then in-app settings, then the phone shortcuts, then hardware whenever.

---

## 1. Telegram bot on the QNAP

The bot is the capture + nudge + morning-prompt channel. Code is in `telegram-bot/`.

**Get the two pieces:**
- Bot token: from BotFather (you made `@gaedhd_bot`).
- Chat IDs: yours is `1948731399`. Get hers: have her message the bot once, then open
  `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy her `chat.id`.

**Fill `telegram-bot/.env`:**
```
TELEGRAM_BOT_TOKEN=<from BotFather>
GAEDHD_BASE_URL=https://gaedhd.jmj.fyi
GAEDHD_NOW_TOKEN=<same value that's in Vercel>
ANTHROPIC_API_KEY=<your key>
ALLOWED_CHAT_IDS=1948731399,<her chat id>

# gentle ritual nudges (water, wrap-up, etc.)
NUDGES_ENABLED=true
NUDGE_CHAT_ID=<her chat id>
QUIET_START=21
QUIET_END=8

# the daily "what are you trying to do today?" prompt (fires at the top of the hour)
MORNING_PROMPT_ENABLED=true
MORNING_HOUR=9
MORNING_CHAT_ID=<her chat id>
```

**Run it on the QNAP** (full details in `telegram-bot/README.md`):
- pm2: `cd telegram-bot && npm install && pm2 start index.js --name gaedhd-bot`
- or Docker: build the included `Dockerfile` in Container Station.

**Verify:** text the bot `hi` (it should reply "Added to your list"), then `/next` and `/today`.

---

## 2. In the app (Settings)

- **Daily anchors:** set the real school drop-off / pick-up times and days. Everything
  movable reflows around them.
- **Important dates:** add the family (Dad, Mom, the mothers- and sisters-in-law, the
  nieces, the nephew, the brothers-in-law, Alfred, Clarissa) with birthdays. Toggle
  "queue a gift task 5 days before" on the ones she shops for. (Hers, your anniversary,
  and the two kids are already seeded.)
- **Calendars:** confirm her iCal + Google feeds are connected.
- **Your setup:** the free-text about her gear and spaces, so the AI steps fit her.

---

## 3. Auto presence (Apple Shortcuts on her iPhone) — no hardware

Shortcuts app → Automation → New Automation. Each set to run immediately (no confirm).

Two endpoints, on purpose:
- `/api/here` just updates presence, silently. Use it for leaving.
- `/api/arrive` updates presence AND sends a wrist nudge (Telegram + push) with her
  one thing for that place. Use it for arrivals. It has a 45-min cooldown and respects
  her wake/sleep quiet hours, so it never spams.

- **Leave home** → action "Open URL" →
  `https://gaedhd.jmj.fyi/api/here?room=errands&token=<NOW_TOKEN>`
- **Arrive home** → `https://gaedhd.jmj.fyi/api/arrive?room=home&token=<NOW_TOKEN>`
- **Arrive at the gym address** → `https://gaedhd.jmj.fyi/api/arrive?room=gym&token=<NOW_TOKEN>`
- **Arrive at Target / Trader Joe's** → `https://gaedhd.jmj.fyi/api/arrive?room=errands&token=<NOW_TOKEN>`
- **Arrive at the school (after dropoff)** → `https://gaedhd.jmj.fyi/api/arrive?room=school&token=<NOW_TOKEN>`

That makes "Out" and "at the gym" automatic, feeds the "while you're here" surfacing,
and buzzes her wrist with the right nudge the moment she gets there.

---

## 4. Verify Vercel env (Production)

Vercel → the `gaedhd` project → Settings → Environment Variables. Confirm these exist:
- `ALLOWED_EMAILS` = her email + yours, comma-separated (this is the access gate). In
  production a blank or missing value fails **CLOSED** — it denies *everyone* (see
  `src/auth.ts:19`), so this MUST be set or no one can sign in. (Allow-all only ever
  applies in local dev.)
- `ANTHROPIC_API_KEY`, `GAEDHD_NOW_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

**Sign-in (NextAuth v5 + Google) — required, and easy to miss.** next-auth reads these
three from the environment *internally*; they never appear in a `process.env` grep, so
a rebuilder won't discover them from the code. All three are required for login to work:
- `AUTH_SECRET` = a random secret (`openssl rand -base64 32` or `npx auth secret`).
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` = the OAuth client credentials from Google Cloud.

To get the Google credentials: **Google Cloud Console → APIs & Services → Credentials →
Create Credentials → OAuth client ID → Web application.** Add the authorized redirect URI:
```
https://gaedhd.jmj.fyi/api/auth/callback/google
```
(For local dev also add `http://localhost:3000/api/auth/callback/google`.) Copy the client
ID → `AUTH_GOOGLE_ID` and client secret → `AUTH_GOOGLE_SECRET`. Configure the OAuth consent
screen if prompted; only the emails in `ALLOWED_EMAILS` can actually get in regardless.

**Other server env the app reads (all optional but each has a real effect):**
- `GAEDHD_NOW_EMAIL` = the single shared account email that the device/bot token and every
  signed-in user read/write (`src/lib/now-auth.ts:13`). If unset, it falls back to the
  first entry in `ALLOWED_EMAILS`. Set it explicitly if that first entry isn't the account
  that owns the data.
- `CRON_SECRET` = secret for the daily presence reset cron (`src/app/api/presence/reset/route.ts:16`).
  Vercel injects `Authorization: Bearer <CRON_SECRET>` into scheduled cron calls; set it so
  the reset endpoint (see `vercel.json`) authorizes. The device token also works by hand.
- `GAEDHD_TZ` = her timezone for all server-side "her local hour/date" logic
  (`src/lib/clock.ts:6`). Defaults to `America/Los_Angeles`; set only if she moves.
- `JOHN_CHAT_ID` = John's Telegram chat ID, so `/api/focus` can ping him to body-double
  (`src/lib/notify.ts:33`). Optional; body-doubling pings just no-op without it.

For the wrist nudges on arrival (`/api/arrive` sends to both channels):
- `TELEGRAM_BOT_TOKEN` = same value as the bot's `.env` (BotFather token).
- `TELEGRAM_CHAT_ID` = her chat id (same as the bot's `NUDGE_CHAT_ID`).

For web push (the "Notifications on this device" toggle in Settings). These are
build-time for the public key, so set them, then redeploy:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (generate with
  `npx web-push generate-vapid-keys`).
- `VAPID_SUBJECT` = `mailto:eightclip@gmail.com` (optional, has a default).

One-time DB step: run the **whole** `supabase-migrations.sql` file in the GaeDHD Supabase
SQL editor. It creates every table the app needs (`gaedhd_state` first, then presence,
inbox, arrival log, push subs, spot tasks) and is idempotent, so it's safe to re-run.

---

## 5. The office TV kiosk

Fire TV Stick (or the Pi 3B+) → Fully Kiosk Browser → point it at:
`https://gaedhd.jmj.fyi/kiosk?token=<NOW_TOKEN>`
TV power on/off on a schedule via Home Assistant (Samsung integration / SmartThings / WoL).

---

## 6. Ambient hardware (the weekend-after project)

Full step-by-step in `AMBIENT-SETUP.md`: ESP32 + ESPresense room sensors → Mosquitto on
the QNAP → Home Assistant → `/api/here`, plus the Govee studio lamp as a calm nudge light
and the Feasycom beacon she carries.
