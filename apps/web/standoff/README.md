# StandoffDuel

Real-time 1v1 **western duel over webcam**. Two players join a lobby, the camera
zooms onto their eyes Sergio-Leone style, a random countdown ticks, and the first
to *draw* (a fast downward hand flick) wins. Built to be shared on X / TikTok / LinkedIn.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 |
| Vision   | MediaPipe Tasks Vision (Hand + Face landmarks) |
| Realtime | WebRTC (`simple-peer`) peer-to-peer video · Socket.io |
| Audio    | Howler.js (+ WebAudio synth fallback) |
| Backend  | NestJS 11 · Socket.io gateway · in-memory lobby store |

## Monorepo layout

```
standoffduel/
├── packages/shared   # socket contract: event names, payload types, timings
└── apps/
    ├── api           # NestJS - lobby gateway + server-authoritative game clock
    └── web           # Next.js - landing, lobby, cinematic duel stage
```

## Getting started

```bash
npm install          # installs all workspaces
npm run dev          # builds shared, then runs api (:3002) + web (:3000)
```

Open two browser tabs (or two devices) at <http://localhost:3000>, create a lobby
in one, join the same code in the other.

> MediaPipe + WebRTC require **HTTPS** in production (Vercel handles this).
> `localhost` is treated as a secure context, so local dev works over plain http.

### Environment

`apps/web/.env.local`

```
NEXT_PUBLIC_SOCKET_URL=http://localhost:3002
```

`apps/api/.env`

```
PORT=3002
WEB_ORIGIN=http://localhost:3000
```

### Audio assets (optional)

The duel works out of the box using a WebAudio synth for the gunshot/tension cues.
To use real sound, drop files in `apps/web/public/audio/`:
`tension.mp3`, `gunshot.mp3`, `victory.mp3`. Howler will prefer them automatically.

## How a duel flows

1. **Lobby** - both players `Ready`.
2. **Zoom** (~3.5s) - Face Mesh finds the eyes, canvas pushes in, letterbox bars, tension music.
3. **Dezoom + silence** (~2.5s) - pull back to full frame, total silence.
4. **Draw** - after a *server-decided* random 3–8s, a white flash + gunshot. Detection arms.
5. **Result** - first valid draw wins; reaction time stamped **server-side** for fairness.
   Drawing before the signal = false start, opponent wins.

The **server owns the clock** - clients never decide when the signal fires, only report
when they drew. Reaction time = `serverReceive(draw) − serverEmit(signal)`.
