# GaeDHD — TODOS

## Studio kiosk Pi (gaedhd-studio)

### Auto power the kiosk display (HDMI-CEC), weekdays only
**Priority:** P1 — requested 2026-06-06

The studio Pi should turn its connected TV/display on and off on its own, on weekdays:
- **ON:** when she first arrives in her office/studio in the morning (presence) **OR** at **8:30 AM**, whichever comes first.
- **OFF:** when she **leaves the office after 6:00 PM** (presence-based departure).
- **Never** powers on/off on **Saturday/Sunday**.

**Status (2026-06-06):**
- ✅ **CEC confirmed working** Pi → Samsung (bus scan sees `device #0: TV, Samsung`; an Apple TV is also on the bus). `cec-client` via `/dev/cec0`; johnjenkins in `video` group.
- ✅ **Time-based weekday schedule SHIPPED on the Pi.** Scripts `~/tv-on.sh` (`on 0` + `as` active-source) and `~/tv-off.sh` (`standby 0`); crontab: `30 8 * * 1-5 tv-on.sh`, `30 18 * * 1-5 tv-off.sh` (8:30am on / 6:30pm off, Mon-Fri, no weekends). TZ = America/Los_Angeles. cron active+enabled.
- ⬜ **Presence triggers (still TODO):** swap the fixed times for "on when she first arrives" / "off when she leaves after 6PM" once the **studio** ESP32 node is wired and Home Assistant can signal the Pi. Office node + MQTT broker already live; HA→Pi link not built yet.
- ⬜ Confirm/adjust the 6:30pm OFF time (fixed fallback; may cut off if she works late). Change = edit the cron hour on the Pi.
