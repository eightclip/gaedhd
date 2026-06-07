# GaeDHD Presence Bridge

Turns the ESPresense room nodes into live presence in the GaeDHD app.

It subscribes to the beacon's per-room MQTT topics on the QNAP broker, picks the
**nearest room** (smallest fresh distance), debounces it, and POSTs that room to
`/api/enter` whenever it changes. The app then:

1. sets her current room (so the app's "while you're here" panel + kiosk update), and
2. fires **one calm nudge** (Telegram + web push) if anything is tied to that room
   — a **spot task** ("water the plants in the yard"), a room-tagged task, or a due
   room ritual — with a per-room cooldown and quiet hours so it never nags.

```
ESPresense nodes → MQTT (gaes_beacon/<room>) → [this bridge] → POST /api/enter → GaeDHD
```

All the "what to nudge / cooldown / quiet hours" logic lives in `/api/enter`.
This bridge is intentionally dumb: nearest-room in, one POST out.

## Run it (QNAP)

Same pattern as the Telegram bot:

1. Set `.env` on the QNAP at
   `/share/CACHEDEV1_DATA/Container/gaedhd-presence-bridge/.env` (copy `.env.example`,
   fill `MQTT_PASS` and `GAEDHD_NOW_TOKEN`). The `.env` is gitignored and never
   pushed over by deploy.
2. From your Mac: `./presence-bridge/deploy.sh` (rsync + `docker compose build && up -d`).

Runs as the `gaedhd-presence-bridge` Container Station container, `restart: unless-stopped`.

## Tuning

- `DWELL_MS` (default 8s) — how long a new room must stay nearest before we switch.
  Higher = fewer false flips when she passes through a room; lower = snappier.
- `FRESH_MS` (default 30s) — a room reading older than this is ignored (she left it).
- `MAX_DISTANCE_M` (default 8m) — readings farther than this don't count as "in the room".
- `DEVICE_ID` (default `gaes_beacon`) — the aliased beacon to follow.

## Verify

`docker compose logs -f` shows `[hb]` heartbeats (current room + live distances) and
`[enter]` lines each time it reports a room change (with `(nudged)` / `(cooldown)` /
`(nothing_here)` / `(quiet_hours)` from the app).
