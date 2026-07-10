# GaeDHD

An ADHD second-brain app built for one person: it holds every goal, task, ritual, streak,
and important date so she never has to carry the whole day in her head. It surfaces the one
thing to do next, nudges gently (never a klaxon), senses which room she's in, shows a calm
glanceable dashboard on a studio TV, and captures anything she throws at a Telegram bot.
Deployed at **[gaedhd.jmj.fyi](https://gaedhd.jmj.fyi)**.

This is a customized Next.js — read `AGENTS.md` before writing app code; APIs and conventions
differ from stock, and the relevant guides live in `node_modules/next/dist/docs/`.

---

## The three deployables

| Piece | Where it runs | What it is |
|---|---|---|
| **Next.js app** | Vercel (`gaedhd` project) → gaedhd.jmj.fyi | The web app + all `/api/*` routes. Data in Supabase. |
| **Telegram bot** | QNAP NAS, Docker (Container Station) | Capture + query + nudge + morning-prompt channel. `telegram-bot/`. Deploy: `telegram-bot/deploy.sh`. |
| **Presence bridge** | QNAP NAS, Docker (Container Station) | Reads ESPresense/MQTT, computes nearest room, POSTs `/api/enter`. `presence-bridge/`. Deploy: `presence-bridge/deploy.sh`. |

Both QNAP containers deploy from your Mac over the `what-server` ssh alias (see Disaster
Recovery). Each keeps its own `.env` **on the QNAP** — the deploy scripts never overwrite it.
Templates: `telegram-bot/.env.example`, `presence-bridge/.env.example`.

---

## Setup / rebuild guides

- **`SETUP-CHECKLIST.md`** — go-live: the Telegram bot, in-app settings, iPhone Shortcuts,
  the full Vercel env list (including the NextAuth/Google sign-in setup), the kiosk, and the
  one-time Supabase migration.
- **`AMBIENT-SETUP.md`** — the hardware layer: ESP32 + ESPresense room sensors, Mosquitto on
  the QNAP, the presence bridge vs. the Home Assistant path, the TV kiosk, and the Govee
  nudge lamp.
- **`supabase-migrations.sql`** — the whole database schema. Run the entire file once in the
  GaeDHD Supabase SQL editor (project `vqnkfbceuodzrynfccnf`). Idempotent; safe to re-run.

---

## Next.js app environment variables (Vercel)

Set in Vercel → `gaedhd` project → Settings → Environment Variables. See `SETUP-CHECKLIST.md`
§4 for the Google OAuth recipe and more detail.

| Variable | Required | What it does |
|---|---|---|
| `AUTH_SECRET` | yes | NextAuth session secret (`openssl rand -base64 32`). Read internally by next-auth. |
| `AUTH_GOOGLE_ID` | yes | Google OAuth client ID. Read internally by next-auth. |
| `AUTH_GOOGLE_SECRET` | yes | Google OAuth client secret. Read internally by next-auth. |
| `ALLOWED_EMAILS` | yes | Comma-separated sign-in allowlist. **Fails CLOSED in production** — blank denies everyone (`src/auth.ts:19`). |
| `SUPABASE_URL` | yes | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service-role key. Server-only; touches the RLS-locked tables. |
| `GAEDHD_NOW_TOKEN` | yes | Shared device/bot secret. Kiosk, Telegram bot, presence bridge, Shortcuts, cron all present it. |
| `ANTHROPIC_API_KEY` | yes | Claude, for capture / chat / decompose / goal-next routes. Without it, goals stop generating new steps once their current ones run out (`/api/goal-next` falls back to two generic nudges and then stalls), so this is effectively required for goals to keep working. She can also paste a key in Settings, which takes precedence. |
| `GAEDHD_NOW_EMAIL` | no | The single shared account email. Falls back to the first `ALLOWED_EMAILS` entry (`src/lib/now-auth.ts:13`). |
| `CRON_SECRET` | no | Authorizes the Vercel cron that hits `/api/presence/reset` (`src/app/api/presence/reset/route.ts:16`). |
| `GAEDHD_TZ` | no | Her timezone for server-side "her local hour/date". Default `America/Los_Angeles` (`src/lib/clock.ts:6`). |
| `TELEGRAM_BOT_TOKEN` | no | Same BotFather token as the bot; lets `/api/arrive` etc. send wrist nudges (`src/lib/notify.ts:11`). |
| `TELEGRAM_CHAT_ID` | no | Her chat ID for app-sent nudges. Falls back to `NUDGE_CHAT_ID` (`src/lib/notify.ts:28`). |
| `NUDGE_CHAT_ID` | no | Alternate name for the above; either works app-side. |
| `JOHN_CHAT_ID` | no | John's chat ID, so `/api/focus` can ping him to body-double (`src/lib/notify.ts:33`). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | no | Web-push public key (build-time; set then redeploy). |
| `VAPID_PRIVATE_KEY` | no | Web-push private key. |
| `VAPID_SUBJECT` | no | Web-push contact. Default `mailto:eightclip@gmail.com` (`src/lib/notify.ts:42`). |

The two QNAP containers have their own env; see `telegram-bot/.env.example` and
`presence-bridge/.env.example`.

---

## Local development

```bash
npm install
npm run dev   # http://localhost:3000
```

Sign-in fails closed only in production, so with an empty `ALLOWED_EMAILS` local dev lets you
in (`src/auth.ts:19`). For Google login locally, add
`http://localhost:3000/api/auth/callback/google` as an authorized redirect URI on the OAuth
client.

---

## Disaster recovery

The single hardest thing to rebuild from memory. Read this before you touch prod or rotate a
secret.

### `what-server` — the QNAP ssh alias

Both `deploy.sh` scripts (`telegram-bot/`, `presence-bridge/`) `ssh what-server`. It is **not**
in this repo — it's an alias in the author's `~/.ssh/config` on his Mac. To deploy from a new
machine, add a block like:

```sshconfig
Host what-server
    HostName <QNAP-hostname-or-LAN-IP>   # TODO: fill in the real QNAP host
    User <qnap-ssh-user>                 # TODO: the QNAP user that can run container-station's docker
    IdentityFile ~/.ssh/<your-key>       # TODO: the private key authorized on the QNAP
```

The QNAP must have SSH enabled and Container Station installed; the deploy scripts invoke
docker at `/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin/.libs/docker` and deploy into
`/share/CACHEDEV1_DATA/Container/gaedhd-telegrambot` and `.../gaedhd-presence-bridge`.

### Rotating `GAEDHD_NOW_TOKEN` — the fan-out

This one secret is shared by everything that talks to the API. Rotate it in **all six** places
or something silently breaks:

1. **Vercel** env (`GAEDHD_NOW_TOKEN`) — then redeploy.
2. **Telegram bot** `.env` on the QNAP → re-run `telegram-bot/deploy.sh`.
3. **Presence bridge** `.env` on the QNAP → re-run `presence-bridge/deploy.sh`.
4. **Home Assistant** `secrets.yaml` (`gaedhd_now_token` / the full `/api/here` URL) — if you
   run the HA presence path (see `AMBIENT-SETUP.md` §4).
5. **iPhone Shortcuts** — the `token=` in every `/api/here` and `/api/arrive` automation URL
   (see `SETUP-CHECKLIST.md` §3).
6. **Fully Kiosk** (or Chromium) Start URL on the office TV — the `?token=` in
   `…/kiosk?token=<GAEDHD_NOW_TOKEN>`.

### Rotating VAPID keys DESTROYS every push subscription

Web-push subscriptions are signed against the VAPID keypair. If you regenerate
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, **every existing subscription in
`gaedhd_push_subs` becomes invalid** — every device (her phone, the installed PWA, the watch
mirror) must re-enable "Notifications on this device" in Settings. The app auto-prunes the
dead rows on the next push (a 404/410 deletes the row — `src/lib/notify.ts:66-68`), so nothing
warns you; notifications just stop until each device re-subscribes. Rotate these only when you
truly must, and tell her to re-toggle afterward.

### Supabase has no backup procedure — set one up

There is currently **no export/backup** of the Supabase data — and `gaedhd_state` is the
entire app (every goal, task, ritual log, streak, setting, calendar URL) in one row. Recommend
either enabling **Point-in-Time Recovery (PITR)** on the project, or a **scheduled `pg_dump`**
to offsite storage. The project ref is recorded at `supabase-migrations.sql:2`
(`vqnkfbceuodzrynfccnf`). Schema is reproducible from `supabase-migrations.sql`; the *data* is
not reproducible from anything — back it up.

### The studio kiosk Pi (`gaedhd-studio`)

A Raspberry Pi drives the studio TV's power on a weekday schedule over HDMI-CEC. It's real,
shipped infrastructure (details in `TODOS.md`):

- Host: `gaedhd-studio` (a Raspberry Pi; user `johnjenkins` is in the `video` group for
  `/dev/cec0`).
- Scripts on the Pi: `~/tv-on.sh` (`cec-client`: `on 0` + set active-source) and `~/tv-off.sh`
  (`standby 0`).
- Crontab (Pi TZ `America/Los_Angeles`):
  ```
  30 8 * * 1-5  ~/tv-on.sh     # 8:30am ON, Mon–Fri
  30 18 * * 1-5 ~/tv-off.sh    # 6:30pm OFF, Mon–Fri
  ```
  No weekend power cycling. The times are a fixed fallback; the plan (still TODO) is to swap
  them for presence triggers (on when she arrives in the studio, off when she leaves after
  6pm) once the studio ESP32 node + HA→Pi link are wired.
