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

Shortcuts app → Automation → New Automation. Each set to run immediately (no confirm):

- **Leave home** → action "Open URL" →
  `https://gaedhd.jmj.fyi/api/here?room=errands&token=<NOW_TOKEN>`
- **Arrive home** → same URL, `room=home`
- **Arrive at the gym address** → `room=gym`
- **Arrive at Target / Trader Joe's** → `room=errands`

That makes "Out" and "at the gym" automatic, feeding the "while you're here" surfacing.

---

## 4. Verify Vercel env (Production)

Vercel → the `gaedhd` project → Settings → Environment Variables. Confirm these exist:
- `ALLOWED_EMAILS` = her email + yours (this is the access gate; if blank, the app is open).
- `ANTHROPIC_API_KEY`, `GAEDHD_NOW_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

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
