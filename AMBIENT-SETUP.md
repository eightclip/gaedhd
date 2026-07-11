# GaeDHD Ambient Layer — Setup Guide

This guide turns GaeDHD from a web app into a calm, ambient presence in the house. It senses which room she is in, shows her single next task on the office TV, and nudges her with a smart lamp instead of an alarm.

Guiding principle: **CALM**. Slow color breaths, gentle fades, never strobing, never a klaxon. Never make her feel like a bear is chasing her.

---

## Table of Contents

1. [Overview + Architecture](#1-overview--architecture)
2. [Room Presence with ESP32 + ESPresense](#2-room-presence-with-esp32--espresense)
3. [MQTT Broker on the QNAP](#3-mqtt-broker-on-the-qnap)
4. [Home Assistant: nearest room → /api/here](#4-home-assistant-nearest-room--apihere)
5. [Samsung TV Office Kiosk](#5-samsung-tv-office-kiosk)
6. [Govee Studio Lamp as a Calm Nudge Light](#6-govee-studio-lamp-as-a-calm-nudge-light)
7. [Out-of-House Location (Errands)](#7-out-of-house-location-errands)
8. [Optional NFC Taps](#8-optional-nfc-taps)
9. [Checklist + Cost Summary](#9-checklist--cost-summary)

---

## The Two GaeDHD Endpoints

Everything in this guide talks to the app through two token-protected HTTP endpoints. The shared secret is the env var `GAEDHD_NOW_TOKEN`, already set in the app's Vercel project.

**Read — what is her one thing right now (for the TV and ambient devices):**

```
GET https://gaedhd.jmj.fyi/api/now?token=<GAEDHD_NOW_TOKEN>
```

Returns JSON like:

```json
{
  "task": {
    "title": "Email the gallery back",
    "durationMin": 10,
    "phase": "do",
    "goal": "Spring show prep",
    "emoji": "🎨"
  },
  "pendingCount": 4,
  "streak": 6
}
```

`task` is `null` when nothing is pending. (Verified against `src/app/api/now/route.ts`.)

**Write — tell the app which room she is in:**

```
POST https://gaedhd.jmj.fyi/api/here?token=<GAEDHD_NOW_TOKEN>&room=<room>
```

Send the room as a query param (e.g. `room=studio`). Use lowercase room slugs consistently everywhere: `studio`, `office`, `kitchen`, `bedroom`, `living_room`.

> Keep the token in Home Assistant `secrets.yaml`, never inline in dashboards or automations you might screen-share.

---

## 1. Overview + Architecture

The body tracker is a fixed-UUID BLE beacon she carries. ESP32 nodes in each room run ESPresense and constantly measure how close that beacon is. They publish to MQTT on the QNAP. Home Assistant reads the "nearest room," and when it changes, POSTs to `/api/here`. HA also drives the Govee nudge lamp, the TV power schedule, and the Fire TV Stick shows the kiosk.

```
                         She carries:
                    ┌──────────────────────┐
                    │  Feasycom BLE iBeacon │  (fixed UUID, always on)
                    └───────────┬──────────┘
                                │  BLE advertisements
         ┌──────────────┬───────┴───────┬──────────────┐
         ▼              ▼               ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ ESP32    │   │ ESP32    │   │ ESP32    │   │ ESP32 ... │   ESPresense firmware
   │ "studio" │   │ "office" │   │ "kitchen"│   │ per room  │   measures distance
   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
        └──────────────┴───── MQTT ───┴──────────────┘
                                │  (WiFi → Mosquitto :1883)
                                ▼
                    ┌────────────────────────┐
                    │  QNAP NAS               │
                    │   • Mosquitto (MQTT)    │
                    │   • Home Assistant      │
                    └───────────┬────────────┘
                                │
        ┌───────────────┬───────┼───────────────┬─────────────────┐
        ▼               ▼       ▼               ▼                 ▼
  POST /api/here   Govee lamp  Samsung TV   GET /api/now      (Fire TV Stick)
  (room changed)   (nudges)    power on/off  polled by kiosk   shows /kiosk
        │                                                          ▲
        └────────────────────► GaeDHD (Vercel) ───────────────────┘
                               gaedhd.jmj.fyi
```

Two data directions:

- **Inbound presence:** beacon → ESP32 → MQTT → HA → `POST /api/here`.
- **Outbound glance + nudge:** the Fire TV kiosk page polls `GET /api/now`; HA separately reads `/api/now` to decide lamp nudges.

**Why a dedicated beacon and not the Apple Watch?** iPhones and Apple Watches randomize their BLE MAC/identity every ~15 minutes for privacy. ESPresense can only track a moving Apple device reliably if it knows the device's IRK (identity resolving key), and extracting an Apple Watch's IRK is impractical. A dedicated iBeacon broadcasts one fixed UUID forever, so every ESP32 node sees the same identity. The watch stays in the system purely for wrist notifications mirrored from her iPhone.

---

## 2. Room Presence with ESP32 + ESPresense

ESPresense is firmware for ESP32 boards that listens for BLE beacons, estimates distance to each, and publishes to MQTT. With one node per room, the node reporting the shortest distance is "where she is."

### 2.1 Flash the ESP32-WROOM-32 boards (no Arduino IDE)

You flash directly from the browser using Web Serial. No toolchain, no Arduino IDE.

1. Use **Chrome or Edge on a laptop** (Web Serial is required; Safari and Firefox will not work). A Mac is fine for flashing even though the Mac mini lives in the closet — flashing is a one-time bench task.
2. Plug one ESP32-WROOM-32 into the laptop with a **data-capable USB cable** (many cheap cables are charge-only — if the board does not appear, swap the cable first).
3. Go to **https://espresense.com/firmware/** and click the embedded web installer / "Connect" button. (The old `/getting_started` URL 404s.)
4. In the serial-port dialog, pick the board. If nothing shows up:
   - Install the **CP2102** or **CH340** USB-serial driver (depends on which USB chip your 6-pack uses — most WROOM-32 dev boards are CP2102).
   - On the board, hold **BOOT**, tap **EN/RST**, release BOOT, then retry.
5. Choose the **ESPresense** firmware for `esp32` (the plain WROOM-32 target, not S3/C3) and flash. Takes ~1 minute.
6. Repeat for all six boards. Flash them all now while you have the bench set up; configure them in their rooms next.

### 2.2 First-boot config (per node)

On first boot (and any time it can't reach saved WiFi) ESPresense starts its own WiFi access point.

1. On your phone, join the WiFi network named **`ESPresense-xxxx`**.
2. A captive portal opens (if not, browse to `http://192.168.4.1`). Enter:
   - **WiFi SSID + password** for the house network.
3. The node reboots onto your WiFi. Find its IP (check your router's client list or your QNAP's DHCP table) and open `http://<node-ip>/` for the full settings page. Set:
   - **MQTT host:** the QNAP's LAN IP (e.g. `192.168.1.10`)
   - **MQTT port:** `1883`
   - **MQTT username / password:** the broker credentials from [Section 3](#3-mqtt-broker-on-the-qnap)
   - **Node name / "room":** a unique slug per node — `studio`, `office`, `kitchen`, `bedroom`, `living_room`. This exact string becomes the MQTT topic and the room you pass to `/api/here`, so keep it consistent.
4. Save and reboot. The node should connect to MQTT within seconds.

> Tip: label each board with a sticker (`studio`, `office`, …) before you mount it, so a later reflash doesn't mix them up.

### 2.3 Placement

ESPresense distance is just signal strength (RSSI), which metal and bodies block. Good placement matters more than calibration.

- **One node per room she cares about:** studio, office, kitchen, bedroom, living room.
- **Chest height or higher.** Floor-level outlets get blocked by furniture and legs. A high shelf or a USB charger on a bookshelf is ideal.
- **Central and open-air.** Aim for line-of-sight to most of the room. Avoid tucking it behind the TV, inside a cabinet, behind a metal appliance, or inside a media console.
- **Power:** any 5V USB phone charger + micro-USB cable. No special supply.
- **Overlap is good.** It's fine (helpful, even) for the office node to faintly hear the beacon while she's in the hall. Whichever node reports the closest distance wins, so denser coverage = cleaner room transitions.
- Keep nodes a few feet away from the WiFi router and from each other where possible, to reduce RF self-interference.

### 2.4 Track the Feasycom beacon by its iBeacon UUID

The Feasycom is an iBeacon: it broadcasts a **UUID + major + minor**. ESPresense identifies it by that UUID, which never changes — that's the whole point.

**Find / set the UUID:**

1. Install Feasycom's configuration app (**FeasyBeacon** / **FSCBP**, depending on model) on a phone, or use a generic BLE scanner like **nRF Connect**.
2. Connect to the beacon. Read its current **iBeacon UUID** (a value like `426c7565-4368-6172-6d42-6561636f6e74`). You can leave the factory UUID or set your own — just record whatever it is.
3. While you're in there: set a strong advertising interval (~**500 ms–1 s** is a good battery/responsiveness balance) and reasonable TX power.

**Add it to ESPresense:**

ESPresense auto-discovers iBeacons. Each node publishes per-beacon distance to topics like:

```
espresense/devices/iBeacon:<uuid>-<major>-<minor>/<room>
```

To give it a friendly name and confirm it's tracked, open any node's web UI → **Devices**, find the iBeacon entry, and give it an alias like `her_beacon`. (**Note:** the shipped `presence-bridge/` follows `gaes_beacon` by default — its `DEVICE_ID`. Either alias the beacon `gaes_beacon` here, or set `DEVICE_ID=her_beacon` in the bridge's `.env`. They must match.) From then on the topic becomes:

```
espresense/devices/her_beacon/<room>     # e.g. .../her_beacon/studio
espresense/rooms/<room>                   # node-level summary
```

Each message payload includes `distance` (meters) and `id`. Home Assistant's ESPresense integration will roll these up into a single "nearest room" for the beacon — see [Section 4](#4-home-assistant-nearest-room--apihere).

### 2.5 Calibration (per node)

Calibration tunes each node's RSSI-to-distance math so "closest distance" is honest across rooms.

1. In a node's web UI, find **`Absorption`** and the **`RSSI @ 1m`** (a.k.a. `ref_rssi` / "measured power") settings.
2. Stand exactly **1 meter** from the node holding the beacon. Watch the reported distance for that beacon in the node's web UI (or in MQTT).
3. Adjust **`RSSI @ 1m`** until the node reports ~1.0 m at 1 meter.
4. Walk to **5 m** and check. If the reported distance is too short/long at range, nudge **`Absorption`** up (more absorption = distances grow faster with range) or down. Typical indoor absorption is ~3.0–4.0.
5. Repeat per node — every room's walls and furniture absorb differently. Spend the most effort on the **studio** and **office**, the two rooms that matter most for nudges.

You don't need perfection. You need the right node to win when she's actually in that room.

---

## 3. MQTT Broker on the QNAP

ESPresense and Home Assistant talk through **Mosquitto** (an MQTT broker) running on the QNAP. How you install it depends on how Home Assistant runs on your QNAP. Cover the path that matches your setup.

### Path A — Home Assistant OS inside Virtualization Station

If HA runs as a full **Home Assistant OS** VM (you see the **Settings → Add-ons** store inside HA), Mosquitto is one click.

1. In HA: **Settings → Add-ons → Add-on Store**.
2. Search **Mosquitto broker** → **Install** → **Start**. Enable **Start on boot** and **Watchdog**.
3. Create a broker login. The clean way: **Settings → People → Users → Add user** (e.g. username `mqtt`, a strong password) — the Mosquitto add-on authenticates against HA users automatically. (**Note:** the shipped `presence-bridge/` defaults its broker user to `gaedhd` — its `MQTT_USER`. Either name this user `gaedhd`, or set `MQTT_USER=mqtt` in the bridge's `.env` to match whatever you create here.)
4. HA usually auto-discovers the broker. If prompted, accept the **MQTT integration** (**Settings → Devices & Services → MQTT**) using `core-mosquitto` as host, port `1883`, and that user/password.
5. The broker is reachable from the ESP32 nodes at **the QNAP/VM's LAN IP, port 1883**. Use that IP (not `core-mosquitto`, which only resolves inside HA) in each ESPresense node's MQTT settings.

### Path B — Home Assistant "Container" Docker image

If HA runs as the **`ghcr.io/home-assistant/home-assistant` Container** image (via QNAP's **Container Station**), there is **no add-on store**. Run Mosquitto as its own Docker container.

1. On the QNAP, create a folder for Mosquitto config, e.g. `/share/Container/mosquitto/{config,data,log}`.
2. Create `/share/Container/mosquitto/config/mosquitto.conf`:

   ```conf
   listener 1883
   persistence true
   persistence_location /mosquitto/data/
   log_dest file /mosquitto/log/mosquitto.log
   password_file /mosquitto/config/passwords
   allow_anonymous false
   ```

3. Run the broker. SSH into the QNAP (or use Container Station's "create from docker run") and run:

   ```bash
   docker run -d --name mosquitto --restart unless-stopped \
     -p 1883:1883 \
     -v /share/Container/mosquitto/config:/mosquitto/config \
     -v /share/Container/mosquitto/data:/mosquitto/data \
     -v /share/Container/mosquitto/log:/mosquitto/log \
     eclipse-mosquitto:2
   ```

4. Create the broker user (this writes the `passwords` file referenced above):

   ```bash
   docker exec -it mosquitto \
     mosquitto_passwd -c /mosquitto/config/passwords mqtt
   # enter a strong password when prompted
   docker restart mosquitto
   ```

5. Point the HA **Container** at the broker. In HA: **Settings → Devices & Services → Add Integration → MQTT**, then:
   - **Broker:** the QNAP's LAN IP (e.g. `192.168.1.10`) — both HA and the broker are containers, so use the host IP, not `localhost`.
   - **Port:** `1883`
   - **Username / Password:** `mqtt` and the password you set.
6. The ESP32 nodes use the same QNAP LAN IP + port 1883 + `mqtt` credentials.

### Sanity check (either path)

From any machine on the LAN with mosquitto clients installed:

```bash
mosquitto_sub -h <QNAP_LAN_IP> -p 1883 -u mqtt -P '<password>' -t 'espresense/#' -v
```

Walk around with the beacon. You should see a stream of `espresense/devices/her_beacon/<room>` messages with changing distances. If you see them, presence is working end-to-end up to MQTT.

---

## 4. Home Assistant: nearest room → /api/here

> **What actually ships is the `presence-bridge/` container, not this Home Assistant path.**
> The repo includes a small Node service (`presence-bridge/`, deployed to the QNAP via
> `presence-bridge/deploy.sh`) that subscribes to the beacon's MQTT topics directly, picks
> the nearest room itself, and POSTs to **`/api/enter`** (which also fires the room nudge) —
> not `/api/here`. It needs **no Home Assistant at all**. If you're running the bridge, skip
> this section; see `presence-bridge/README.md`. Two differences to know about:
> - The bridge POSTs `/api/enter` (presence **plus** a cooldowned room nudge). `/api/here`
>   below only sets presence, silently. Both endpoints exist and both work.
> - The bridge's defaults differ from this guide's example names — see the naming note below.
>   Reconcile them in one direction or the other; don't mix.
>
> This Home Assistant route is kept as a documented alternative (e.g. if you'd rather HA own
> the presence logic). Use one or the other, not both pointing at the same room signal.

Two pieces: (1) HA derives the beacon's **nearest room** from the ESPresense data, and (2) an automation POSTs that room to `/api/here` whenever it changes.

> **Naming — the shipped bridge vs. this guide's examples.** This guide aliases the beacon
> `her_beacon` and creates an MQTT user `mqtt`. The shipped `presence-bridge/` instead
> defaults to beacon `gaes_beacon` (`DEVICE_ID`) and MQTT user `gaedhd` (`MQTT_USER`). Pick
> one convention and make it consistent everywhere: either alias the beacon / name the MQTT
> user to match this guide and override `DEVICE_ID` / `MQTT_USER` in the bridge's `.env`, or
> keep the bridge defaults and use `gaes_beacon` / `gaedhd` in ESPresense and Mosquitto.

### 4.1 Get the nearest room into HA

Easiest: install the **ESPresense** integration (HACS, or check core). After adding the device for `her_beacon`, HA exposes a **device tracker / sensor** whose state is the nearest room name, e.g. `sensor.her_beacon_room` with state `studio`.

If you prefer not to use the integration, you can subscribe to the per-room MQTT topics directly with MQTT sensors, but the integration handles the "pick the closest node" logic for you and is the recommended route.

### 4.2 Secrets

In `secrets.yaml`:

```yaml
gaedhd_now_token: "PUT_THE_REAL_TOKEN_HERE"
```

### 4.3 REST command to call /api/here

In `configuration.yaml`:

```yaml
rest_command:
  gaedhd_here:
    url: "https://gaedhd.jmj.fyi/api/here?token={{ token }}&room={{ room }}"
    method: POST
    content_type: "application/json"
    payload: "{}"
```

### 4.4 Automation: fire on room change

```yaml
automation:
  - alias: "GaeDHD - report room change"
    description: "POST her current room to GaeDHD when ESPresense reports a new nearest room"
    mode: single
    trigger:
      - platform: state
        entity_id: sensor.her_beacon_room
    condition:
      # Ignore unknown/away/empty transitions so we don't spam null rooms
      - condition: template
        value_template: >
          {{ trigger.to_state.state not in ['unknown', 'unavailable', 'not_home', 'none', ''] }}
    action:
      - service: rest_command.gaedhd_here
        data:
          token: "{{ states('input_text.dummy') if false else 0 }}"  # placeholder, replaced below
          room: "{{ trigger.to_state.state | lower }}"
```

Cleaner version that pulls the token from `secrets.yaml` (HA templates can't read secrets directly, so inject it via the rest_command default instead). Replace the `rest_command` block with:

```yaml
rest_command:
  gaedhd_here:
    url: >-
      https://gaedhd.jmj.fyi/api/here?token=!secret gaedhd_now_token&room={{ room }}
    method: POST
    content_type: "application/json"
    payload: "{}"
```

> Note: `!secret` only works as a standalone YAML value, not mid-string. The reliable pattern is to put the **whole URL** in `secrets.yaml`:
>
> ```yaml
> # secrets.yaml
> gaedhd_here_base: "https://gaedhd.jmj.fyi/api/here?token=PUT_THE_REAL_TOKEN_HERE"
> ```
>
> ```yaml
> # configuration.yaml
> rest_command:
>   gaedhd_here:
>     url: "!secret gaedhd_here_base&room={{ room }}"
>     method: POST
>     content_type: "application/json"
>     payload: "{}"
> ```

Then the automation simplifies to:

```yaml
automation:
  - alias: "GaeDHD - report room change"
    mode: single
    trigger:
      - platform: state
        entity_id: sensor.her_beacon_room
    condition:
      - condition: template
        value_template: >
          {{ trigger.to_state.state not in ['unknown', 'unavailable', 'not_home', 'none', ''] }}
    action:
      - service: rest_command.gaedhd_here
        data:
          room: "{{ trigger.to_state.state | lower }}"
```

Reload automations (**Developer Tools → YAML → Reload Automations**) and walk between rooms. Each room change should produce one POST. Watch the GaeDHD app / Vercel logs to confirm `/api/here` is receiving them.

---

## 5. Samsung TV Office Kiosk

The office TV shows `https://gaedhd.jmj.fyi/kiosk?token=<GAEDHD_NOW_TOKEN>` full-screen, all day. **The `?token=` is required** — the kiosk page hard-requires it (`src/app/kiosk/page.tsx`); without it (or with a token the server rejects) she just sees a "not set up" screen. **Tizen (Samsung's built-in OS) cannot reliably run a 24/7 fullscreen kiosk web page** — its browser sleeps, drops the app, and has no real auto-start. So we drive the screen with an external device and use HA only for power scheduling.

### 5.1 Recommended: Fire TV Stick + Fully Kiosk Browser

1. Plug a **Fire TV Stick** into the office TV's HDMI. Set the TV's input to that HDMI port.
2. On the Fire TV, install **Fully Kiosk Browser** (search the Amazon Appstore; "Fully Kiosk Browser & Lockdown" has a Fire TV build).
3. In Fully Kiosk settings:
   - **Start URL:** `https://gaedhd.jmj.fyi/kiosk?token=<GAEDHD_NOW_TOKEN>` (the token is required)
   - **Launch on Boot:** ON
   - **Restart on Crash / Watchdog:** ON
   - **Screen Always On while in app:** ON
   - **Fullscreen / hide system bars:** ON
4. (Optional but tidy) Set Fully Kiosk as the **default launcher** behavior so a power-on lands straight on the dashboard.
5. The kiosk page polls `GET /api/now` itself to stay current, using the `token` from its own URL — so the `?token=<GAEDHD_NOW_TOKEN>` in the Start URL is what authenticates it. Get that one URL right and there's nothing else to wire per device.

> Why Fire TV over the Pi here: the Stick is cheap, silent, HDMI-CEC aware, and Fully Kiosk on Fire OS is purpose-built for exactly this.

### 5.2 Alternative: Raspberry Pi 3B+ in Chromium kiosk

You have a 3B+ as a backup kiosk option (the Mac mini can't be used — it lives in the server closet, not by the TV).

Install Chromium and autostart it fullscreen:

```bash
sudo apt update
sudo apt install -y chromium-browser unclutter
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/gaedhd-kiosk.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=GaeDHD Kiosk
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito --check-for-update-interval=31536000 https://gaedhd.jmj.fyi/kiosk?token=<GAEDHD_NOW_TOKEN>
X-GNOME-Autostart-enabled=true
EOF
```

> The `?token=` is required (and `--incognito` means nothing persists between boots, so
> it can only live in the URL). This is how the studio Pi is actually configured.

`unclutter` hides the mouse pointer. Reboot to test.

### 5.3 TV power schedule via Home Assistant

The honest gotcha with Samsung: **turning the TV OFF is easy; turning it ON is the hard part**, because most Samsungs ignore the network when fully powered off unless you explicitly leave the network awake.

**Turn OFF — built-in Samsung Smart TV integration:**

1. HA: **Settings → Devices & Services → Add Integration → Samsung Smart TV**. Enter the TV's IP; accept the on-TV authorization prompt.
2. This gives you `media_player.office_tv` with a working **turn_off**.

**Turn ON — two options (pick based on model year):**

- **Option 1 — SmartThings integration (most reliable for 2018+ sets).** Add the **SmartThings** integration in HA, link your Samsung account, and use the SmartThings `media_player`/switch for the TV — its **turn_on** works through Samsung's cloud regardless of network-standby quirks.
- **Option 2 — Wake-on-LAN.** On the TV: **Settings → General → Network → Expert Settings → Power On with Mobile / Network Standby (a.k.a. "IP Remote" / "Wake on LAN/WLAN")** → **ON**. The exact menu name varies by model year. Then in HA send a magic packet to the TV's MAC.

WoL config in `configuration.yaml`:

```yaml
wake_on_lan:

switch:
  - platform: wake_on_lan
    name: "Office TV WOL"
    mac: "AA:BB:CC:DD:EE:FF"   # the TV's MAC
    host: "192.168.1.50"        # the TV's IP, for status checks
```

**Schedule automations** — on at her wake hour, off at night:

```yaml
automation:
  - alias: "Office TV - morning on"
    trigger:
      - platform: time
        at: "07:00:00"
    action:
      # Option 1 (SmartThings):
      - service: media_player.turn_on
        target:
          entity_id: media_player.office_tv
      # Option 2 (WoL) instead of the above:
      # - service: switch.turn_on
      #   target: { entity_id: switch.office_tv_wol }

  - alias: "Office TV - night off"
    trigger:
      - platform: time
        at: "21:30:00"
    action:
      - service: media_player.turn_off
        target:
          entity_id: media_player.office_tv
```

> Test the morning-on automation manually (**run actions** from the automation page) before trusting it. If the TV won't wake, the network-standby setting is off or this model needs SmartThings.

If you want HA to also control the Fire TV screen state, add the **Fire TV / Android Debug Bridge (ADB)** integration and toggle the Stick's screen with the TV — but the simplest reliable setup is: TV power on/off scheduled, Fire TV always running the kiosk underneath.

---

## 6. Govee Studio Lamp as a Calm Nudge Light

Put one of the Govee color bulbs she already owns into a studio lamp. HA breathes a slow color into it to nudge her, then returns it to her normal warm working white. **Slow fades and single breaths only — never strobing, never a hard flash.**

### 6.1 Two HA paths to the Govee bulb

**Path A — LOCAL (recommended): "Govee Light Local" integration.**

1. In the **Govee Home app**: open the bulb → its settings → enable **LAN Control / "LAN Control"** toggle. (Not all Govee models support LAN control — most recent color bulbs do.)
2. In HA: **Settings → Devices & Services → Add Integration → Govee Light Local**. It discovers LAN-control bulbs on the network automatically.
3. You get a `light.studio_lamp` entity with sub-second response and no cloud dependency. Best for nudges.

**Path B — CLOUD: Govee API key.**

1. In the **Govee Home app**: **Profile / Me → About Us → Apply for API Key**. The key arrives by email.
2. In HA: add the **Govee** (cloud) integration and paste the API key.
3. Cloud has ~1–2 s latency. That's totally fine here because every nudge is a **slow** color breath, not a fast blink. Use this only if LAN control isn't available for the bulb.

### 6.2 Nudge color language

Keep it small and legible. Each nudge is a slow breath, then back to warm working white.

| Nudge state | Meaning | Color + motion |
|---|---|---|
| `hydrate` | drink water | **soft blue breath** — one slow fade up and down |
| `outside` | step outside / move | **gentle green** — slow fade in, hold, fade out |
| `wrap_up` | wrap up the meeting | **amber pulse** — two slow breaths, calm not urgent |
| `free_time` | free time, go make art | **warm gold glow** — slow rise to a warm gold, hold longer |
| (default) | working | **warm white** ~2700K, steady |

### 6.3 Scripts: the calm primitives

Define a "normal" return state and a reusable slow-breath script.

```yaml
script:
  studio_lamp_normal:
    alias: "Studio lamp - normal warm working white"
    sequence:
      - service: light.turn_on
        target: { entity_id: light.studio_lamp }
        data:
          color_temp_kelvin: 2700
          brightness_pct: 70
          transition: 4

  studio_lamp_breath:
    alias: "Studio lamp - one slow color breath"
    # Variables: rgb (list), peak_brightness, breaths
    fields:
      rgb: { description: "RGB color, e.g. [80,140,255]" }
      peak: { description: "peak brightness pct" }
      breaths: { description: "how many breaths" }
    variables:
      breaths: "{{ breaths | default(1) | int }}"
    sequence:
      - repeat:
          count: "{{ breaths }}"
          sequence:
            - service: light.turn_on
              target: { entity_id: light.studio_lamp }
              data:
                rgb_color: "{{ rgb }}"
                brightness_pct: "{{ peak | default(60) }}"
                transition: 6          # 6s fade UP — slow
            - delay: "00:00:06"
            - service: light.turn_on
              target: { entity_id: light.studio_lamp }
              data:
                rgb_color: "{{ rgb }}"
                brightness_pct: 5
                transition: 6          # 6s fade DOWN — slow
            - delay: "00:00:06"
      - service: script.studio_lamp_normal   # always return to working white
```

### 6.4 Map an app nudge-state to the bulb

How HA learns the nudge-state is up to how the app surfaces it. Two clean options:

- **Poll `/api/now`** with a REST sensor and react to a field the app adds (e.g. a `nudge` value), or
- Have HA decide nudges itself from app data (e.g. fire `hydrate` every 90 min during work hours).

Example REST sensor + automations (assuming the app exposes a `nudge` string on `/api/now`; if it doesn't yet, drive these from HA timers instead):

```yaml
sensor:
  - platform: rest
    name: "GaeDHD now"
    resource: "https://gaedhd.jmj.fyi/api/now?token=!secret gaedhd_now_token"
    method: GET
    scan_interval: 60
    value_template: "{{ value_json.nudge | default('none') }}"
    json_attributes:
      - task
      - streak

automation:
  - alias: "Nudge - hydrate (soft blue breath)"
    trigger: { platform: state, entity_id: sensor.gaedhd_now, to: "hydrate" }
    action:
      - service: script.studio_lamp_breath
        data: { rgb: [80, 140, 255], peak: 55, breaths: 1 }

  - alias: "Nudge - outside (gentle green)"
    trigger: { platform: state, entity_id: sensor.gaedhd_now, to: "outside" }
    action:
      - service: script.studio_lamp_breath
        data: { rgb: [90, 200, 120], peak: 55, breaths: 1 }

  - alias: "Nudge - wrap up (amber pulse)"
    trigger: { platform: state, entity_id: sensor.gaedhd_now, to: "wrap_up" }
    action:
      - service: script.studio_lamp_breath
        data: { rgb: [255, 170, 60], peak: 60, breaths: 2 }

  - alias: "Nudge - free time (warm gold glow)"
    trigger: { platform: state, entity_id: sensor.gaedhd_now, to: "free_time" }
    action:
      - service: light.turn_on
        target: { entity_id: light.studio_lamp }
        data: { rgb_color: [255, 200, 110], brightness_pct: 65, transition: 10 }
```

> Same `!secret` caveat as Section 4: put the full `/api/now?token=...` URL in `secrets.yaml` and reference it, rather than splicing the token into a template.

Design rules baked into the above: 6-second fades, single breaths by default, max 2 for "wrap up," and always return to warm working white. No effect over ~70% brightness in her workspace. If anything ever feels jumpy, lengthen `transition` and the `delay` — slower is always more correct here.

---

## 7. Out-of-House Location (Errands)

For "remind her when she's at the store," no extra hardware — phone geofencing is enough. Geofences are coarse (~100 m radius), which is perfect for store-level reminders and bad for anything finer.

**Option A — Apple Shortcuts personal automations (on her iPhone):**

1. Shortcuts app → **Automation** tab → **+** → **Arrive** (or **Leave**).
2. Set the location (e.g. **Target**, **Trader Joe's**, or **Home**).
3. Action: **Get Contents of URL** →
   - `POST https://gaedhd.jmj.fyi/api/here?token=<GAEDHD_NOW_TOKEN>&room=errand_target`
   - or hit a future errand endpoint / open the app to her errands list.
4. Set **Run Immediately** (no confirmation tap) so it's truly ambient.

**Option B — Home Assistant Companion app zones:**

1. Install the **Home Assistant Companion** app on her iPhone, sign into HA.
2. Define **Zones** in HA for Target, Trader Joe's, Home.
3. Automate on zone enter/leave to call `rest_command.gaedhd_here` with `room=errand_<store>`, or to push an errand reminder.

Option A keeps location entirely on her phone (nothing leaves the device except the one POST). Option B centralizes logic in HA alongside everything else. Either is fine; pick by preference.

---

## 8. Optional NFC Taps (intentional check-in)

NFC is a deliberate ~2 cm tap, not passive sensing. Good for "I'm officially starting work now" or "heading out." Note the **Apple Watch cannot read NFC tags** — this is an iPhone tap.

1. Buy cheap **NTAG215** NFC stickers. Stick them on the **office door**, **back door**, **front door**.
2. On her iPhone: Shortcuts → **Automation** → **+** → **NFC** → **Scan** the sticker → name it (e.g. "Office door").
3. Action: **Get Contents of URL** →
   - `POST https://gaedhd.jmj.fyi/api/here?token=<GAEDHD_NOW_TOKEN>&room=office`
4. **Run Immediately** = ON.

Use NFC as a high-confidence override of the passive ESP32 presence (a tap means she's definitely there/leaving), or for doors that aren't worth an ESP32 node.

---

## 9. Checklist + Cost Summary

### Setup checklist

- [ ] Flash all 6 ESP32-WROOM-32 boards with ESPresense (web installer)
- [ ] Configure each node: WiFi, QNAP MQTT, unique room name
- [ ] Mount nodes chest-height, central, open-air: studio, office, kitchen, bedroom, living room
- [ ] Read/record the Feasycom beacon's iBeacon UUID; set advertising interval ~500ms–1s
- [ ] Alias the beacon as `her_beacon` in ESPresense; confirm `espresense/#` MQTT traffic
- [ ] Calibrate each node (1 m + 5 m), focus on studio + office
- [ ] Mosquitto running on QNAP (Path A add-on **or** Path B Docker container)
- [ ] HA MQTT integration connected to the broker
- [ ] HA ESPresense integration → `sensor.her_beacon_room` shows the right room
- [ ] `rest_command.gaedhd_here` + room-change automation POSTing to `/api/here`
- [ ] Token stored in `secrets.yaml`, not inline
- [ ] Fire TV Stick on office TV running Fully Kiosk → `…/kiosk`, launch-on-boot
- [ ] Samsung integration for TV **off**; SmartThings or WoL for TV **on**; morning/night schedule tested
- [ ] Govee bulb in studio lamp; LAN Control enabled; Govee Light Local integration (or cloud key)
- [ ] Nudge scripts + color-language automations loaded; verified slow + calm
- [ ] iPhone errand geofences (Shortcuts or HA Companion) for Target / Trader Joe's / Home
- [ ] (Optional) NFC stickers on office/back/front doors with iPhone Shortcuts

### Rough cost (to buy)

| Item | Cost |
|---|---|
| ESP32-WROOM-32 (6-pack) | ~$33 |
| Fire TV Stick | ~$30 |
| Feasycom BLE iBeacon | ~$10 |
| NFC stickers (NTAG215, optional) | ~$8 / 10-pack |
| **Total new spend** | **~$73–81** |

Already owned (no cost): QNAP NAS + Home Assistant, Samsung Tizen TV, Govee color bulbs, Apple Watch + iPhone, Raspberry Pi 3B+ (backup kiosk), Mac mini (closet — not usable for the TV).

### Honest gotchas recap

- **BLE MAC randomization** is why she carries a fixed-UUID iBeacon instead of relying on the Apple Watch/iPhone for presence.
- **Tizen can't self-kiosk** reliably — the Fire TV Stick (or Pi) drives the dashboard; the TV just powers on/off.
- **Samsung wake-on** needs SmartThings or Wake-on-LAN with "network standby" enabled; off is easy, on is the finicky part, and the menu name varies by model year.
- **HA-on-QNAP flavor matters for MQTT:** HA OS gives you the one-click Mosquitto add-on; the HA Container image needs Mosquitto run as a separate Docker container.
- **`!secret` can't be spliced mid-string** in HA — store the full token-bearing URL in `secrets.yaml`.
- **Govee LAN Control** isn't on every model; cloud API is the fallback and its 1–2 s lag is fine for slow breaths.
