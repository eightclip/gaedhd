# GaeDHD Design System

The look and feel, locked from real references. Read this before touching any UI.
Source of truth for the phone, the web dashboard, and the office TV kiosk.

## The one rule

**Color where she's glancing. Calm where she's working.**

- Home, kiosk, and meeting surfaces get color: soft color-blocked tiles, a color-of-the-day
  tint, her hand-drawn art.
- Task and ritual lists go quiet: one soft field, serif headline, monospace timestamps,
  status dots. Calming and direct, never busy.

This is for an ADHD brain. One thing at a time, no guilt on a miss, gentle momentum.
Pull and glanceable over push and alarm. Never make her feel like a bear is chasing her.

## Palette

Warm cream base, earthy muted accents. These already exist in globals.css; we lean into them.

- Background (paper): `#FBF7F0`
- Foreground (ink): `#1A1A1A`
- Muted ink: `#9B9590`

Soft tints (color-blocked cards, color-of-the-day). Each has a deep ink variant for text on it:

| Name      | Tint (card fill) | Ink (text/accents) |
| --------- | ---------------- | ------------------ |
| terracotta| `#F5E6E0`        | `#C85D3E`          |
| sage      | `#E8F0E4`        | `#7B9E6B`          |
| lavender  | `#ECE5F3`        | `#9B7EC8`          |
| rose      | `#F5E4EC`        | `#C87E9E`          |
| sky       | `#E2EEF2`        | `#6BA3BE`          |
| gold      | `#F5ECD9`        | `#A89060`          |

Dark mode: ink/paper invert (already wired). Tints darken, ink stays the accent.

## Color of the day

The whole app picks up one soft tint per day, rotating through the palette. Makes the
day feel distinct and alive without her doing anything. Computed from the date so phone,
web, and TV all agree. Task lists use the *tint* as a faint field; headlines and the
"now" marker use the *ink*.

## Type, three roles

1. **Fraunces** (serif, already loaded) - headlines. Warm and personal. "Today's Schedule".
   Use the italic for the second word of a two-word headline, like the refs.
2. **Grotesk** (bold sans) - the giant date and all big numbers. Oversized, tight tracking.
   Use the existing Nunito at 800 weight if a new face is not worth the load; otherwise a
   neutral grotesk.
3. **Monospace** - the timestamps on lists (`8:00am`, `12:04`). System mono is fine.

## Components

### Time-rail list (the main day list)
A vertical rail. Each row: mono time pill on the left, task text, a status dot on the right.
The list is **alive**:
- Past rows dim and check off.
- The current row is highlighted (ink underline or filled dot).
- A "now" marker sits between rows and moves down through the day.
- A missed row pops/detonates and the list reflows around the new now. No shame, just reflow.

### Color-blocked card (meetings, big moments)
Full-bleed soft tint fills the whole card (not white-with-accent). Big title in ink,
a duration pill, optional avatars. Rounded ~24px. Used for "You have a meeting" and the like.

### Bento tile (dashboard + kiosk)
Rounded tile, one big number or one idea per tile. Generous whitespace, calm. Grid of these
for the web dashboard and the TV.

### Her art
Hand-drawn doodles slot into empty states, ritual icons, and the kiosk corner. Warmth layer.

## Surfaces

- **Phone:** the time-rail day list, color-blocked meeting cards, big serif date. Quiet.
- **Web dashboard:** bento grid. The day list plus glanceable tiles (rituals, wins, next up).
- **TV kiosk (`/kiosk`):** 10-foot view, calm ambient lead. Big clock and the day's shape,
  her one thing now and the next ritual woven in, her art. Not a loud stat board. Muted
  palette only, since it is on all day.

## Motion

Gentle and physical (framer-motion is already in use). Reflow, not flash. Spring, not snap.
The list reflow and the missed-item pop are the signature interactions.
