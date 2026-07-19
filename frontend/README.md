# SOS Connect — Frontend

Next.js 14 (App Router) + TypeScript + Tailwind CSS frontend for SOS Connect.
Any logged-in user can act as **both victim and volunteer** — raise an SOS
and go on duty to help others, from the same account.

## Setup

```bash
npm install
cp .env.local.example .env.local   # already done — edit if your services run elsewhere
npm run dev
```

Runs on `http://localhost:3000`. Requires all backend services + Docker infra
running from the previous tasks:

| Service | Port |
|---|---|
| user-service | 4000 |
| sos-service | 4001 |
| notification-service (Socket.io) | 4003 |

## What's automatic

- Socket connects to `notification-service` the moment you're logged in — no
  manual "connect" step, and it auto-reconnects on drops.
- `register-volunteer` / `join-sos-room` re-fire automatically on every
  reconnect.
- Availability, active-SOS status, and incoming SOS cards all update live via
  sockets — no manual refresh anywhere.
- The connection dot in the navbar shows live socket health (green = live,
  amber = reconnecting, gray = offline).

## Design

- Palette: warm paper background, vivid red/orange for SOS-danger actions,
  fresh green for safe/on-duty states, amber for medium severity, deep teal
  as the trust/info accent.
- Type: Space Grotesk (display), Inter (body), JetBrains Mono (coordinates,
  data).
- Signature motif: concentric "pulse rings" around the SOS button and live
  indicators — a broadcast/radar cue reused throughout the app.
