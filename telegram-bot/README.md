# GaeDHD Telegram Bot

Telegram capture + query + nudge channel for [GaeDHD](https://gaedhd.jmj.fyi). Runs on John's QNAP via long-polling — no public URL needed.

---

## What it does

| Input | What happens |
|---|---|
| Any text message | Queued in GaeDHD inbox for review |
| Photo of a list | Vision reads it, each item queued in inbox |
| `/next` | Your current task + any rituals due |
| `/today` | Full snapshot: task, rituals, streak, progress, next meeting |
| `/start` or `/help` | Usage info |

Nudges (optional): every 30 min, if rituals are due and it's not quiet hours, sends a single calm DM naming the top ritual.

---

## Setup

### 1. Create the bot in BotFather

1. Open Telegram, search `@BotFather`, start a chat.
2. Send `/newbot`, follow the prompts (name + username).
3. Copy the **HTTP API token** — that's your `TELEGRAM_BOT_TOKEN`.
4. Optional: send `/setcommands` to BotFather and paste:
   ```
   next - What to focus on right now
   today - Full daily snapshot
   help - How to use this bot
   ```

### 2. Find your Telegram chat IDs

Option A — message `@userinfobot` and it replies with your chat ID.

Option B — start the bot, send it a message, then call:
```
https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
```
Your chat ID is in `result[0].message.chat.id`.

Put both her chat ID and John's chat ID in `ALLOWED_CHAT_IDS`.

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
nano .env   # or vi .env
```

Key fields:

| Variable | Required | Notes |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes | From BotFather |
| `GAEDHD_NOW_TOKEN` | yes | Secret token for the GaeDHD API |
| `ANTHROPIC_API_KEY` | yes (for photos) | From console.anthropic.com |
| `ALLOWED_CHAT_IDS` | yes | Comma-separated chat IDs |
| `NUDGES_ENABLED` | no | Set `true` to enable nudges |
| `NUDGE_CHAT_ID` | if nudges | Her chat ID for DMs |
| `QUIET_START` | no | Hour (0-23) quiet begins. Default: 21 |
| `QUIET_END` | no | Hour (0-23) quiet ends. Default: 8 |
| `GAEDHD_BASE_URL` | no | Default: https://gaedhd.jmj.fyi |

---

## Running on QNAP

### Option A: plain Node + pm2

SSH into the QNAP and run once to set up:

```bash
# Install Node 20 if not present (use QNAP App Center or nvm)
# Install pm2 globally
npm install -g pm2

# Clone or copy the telegram-bot/ directory onto the QNAP, e.g.:
# /share/homes/admin/bots/gaedhd-telegram-bot/

cd /share/homes/admin/bots/gaedhd-telegram-bot
npm install
cp .env.example .env
nano .env   # fill in your values

# Start with pm2
pm2 start index.js --name gaedhd-bot

# Persist across reboots
pm2 save
pm2 startup   # follow the printed command
```

Useful pm2 commands:
```bash
pm2 logs gaedhd-bot       # tail logs
pm2 restart gaedhd-bot    # restart
pm2 stop gaedhd-bot       # stop
pm2 status                # see all bots
```

---

### Option B: Docker / Container Station

QNAP's Container Station runs Docker. Build and run the bot as a container.

**Build the image** (on your Mac or directly on the QNAP):

```bash
cd telegram-bot/
docker build -t gaedhd-telegram-bot .
```

**Run it** (pass env file at runtime — never bake secrets into the image):

```bash
docker run -d \
  --name gaedhd-bot \
  --restart unless-stopped \
  --env-file .env \
  gaedhd-telegram-bot
```

**On QNAP Container Station via UI:**

1. Upload the image via "Import" (export it first: `docker save gaedhd-telegram-bot | gzip > gaedhd-bot.tar.gz`)
   — or pull from a private registry if you push it there.
2. Create a container from the image.
3. Under "Advanced Settings → Environment", add each key/value from your `.env`.
4. Set restart policy to "Always" or "Unless Stopped".
5. Click Create.

**View logs in Container Station:** select the container → Logs tab.

---

## Updating

```bash
# pm2 approach
cd /share/homes/admin/bots/gaedhd-telegram-bot
# copy updated index.js here
pm2 restart gaedhd-bot

# Docker approach
docker build -t gaedhd-telegram-bot .
docker stop gaedhd-bot && docker rm gaedhd-bot
docker run -d --name gaedhd-bot --restart unless-stopped --env-file .env gaedhd-telegram-bot
```
