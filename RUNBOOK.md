# Standoff — Launch Runbook

Survival guide for the launch-day traffic spike (X / LinkedIn / Reddit / YouTube
Shorts / TikTok / Instagram — mostly **mobile/4G**).

## Topology

- **Web (Next.js)** → Vercel. Scales itself, not the worry.
- **API (NestJS + socket.io)** → Railway, **single service, 1 replica**.
- **Redis** → Railway plugin. Backs the shareable `/r/<id>` result permalinks.
- **Game video** → P2P WebRTC between players. **Never touches the server.** The
  API only does lobby + signaling + draw timestamps (tiny messages).

> Why 1 replica: lobby state lives in process memory (`apps/api/src/lobby/lobby.service.ts`
> — a `Map` plus the duel timers/clock). Two replicas = two players of the same
> lobby could land on different instances and never see each other. **Do not raise
> replicas** until that state is moved to Redis (post-launch project).

## Environment variables

### API (Railway service)

| Var | Value | Why |
| --- | --- | --- |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (reference the Redis plugin) | Durable share permalinks. Without it, results live in memory and **die on every redeploy** → dead links in everyone's posts. |
| `WEB_ORIGIN` | exact web prod origin(s), comma-separated, e.g. `https://standoffduel.com` | Locks CORS for both the HTTP API and the socket gateway. Unset = any origin allowed. |
| `PORT` | injected by Railway | Read by `main.ts`. |
| `MAX_SOCKETS_PER_IP` | unset (defaults to 100) | Per-IP socket cap. `0` disables it. Raise/disable if legit CGNAT users get refused (see "If it falls over"). |

### Web (Vercel, Production)

| Var | Value | Why |
| --- | --- | --- |
| `NEXT_PUBLIC_SOCKET_URL` | **public Railway API URL, no `:3002`**, e.g. `https://standoff-api.up.railway.app` | Where the browser opens the socket. **Most breakage-prone var** — verify first. |
| `NEXT_PUBLIC_TURN_URLS` | metered.ca URLs, comma-separated (e.g. `turn:...:80,turn:...:443,turns:...:443?transport=tcp`) | TURN relay. Without it, mobile/CGNAT players can't establish the P2P video and hang on a failed-connection screen. |
| `NEXT_PUBLIC_TURN_USERNAME` | metered username | TURN auth (client-visible by design). |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | metered credential | TURN auth. |

> `lib/ice.ts` ships STUN-only and appends TURN automatically when these are set —
> no code change needed.

## Railway service settings (you're on Pro)

- **Replicas = 1** — do not raise (see Topology).
- **App Sleeping = OFF** — no cold-start of the socket server mid-launch.
- **Healthcheck Path = `/`** — `app.controller.ts` returns `{ok:true}`.
- **Restart Policy = On Failure** — auto-recover on crash.
- **Resource Limits** — leave generous (Pro cap is high; workload is light).
- **Region** — closest to the bulk of the audience.
- **Public domain** generated; WSS works natively (no special toggle).

## Monitoring

- External uptime monitor (UptimeRobot / BetterStack, free) on `GET https://<api>/`
  every 1 min, alert to email/SMS. The single instance is the assumed SPOF —
  you want to know within a minute if it dies.

## Launch-day checklist (run before the first post)

1. `curl https://<api>/` → `{"ok":true,...}`.
2. Open the prod site on **two devices** (ideally one on cellular), join the same
   lobby code → both see each other update, video connects. This is the whole
   product working end to end.
3. In the connecting browser, check `chrome://webrtc-internals` shows a `relay`
   ICE candidate → TURN is live.
4. Finish a duel → open the shared `/r/<id>` link → it loads. (Optional: redeploy
   the API, reload the link, confirm it survives → `REDIS_URL` is wired.)
5. Uptime monitor is green.

## If it falls over

- **"Waiting for opponent" / no video, especially on phones** → TURN missing or
  misconfigured. Check the 3 `NEXT_PUBLIC_TURN_*` vars on Vercel and that a
  `relay` candidate appears. The client already shows a Reconnect button after
  15s (`useWebRTC.ts`), so it's a connect-rate problem, not a hang.
- **No connection at all, console socket errors** → `NEXT_PUBLIC_SOCKET_URL` wrong
  (typo, `:3002` left on, or CORS). Check it matches the Railway public URL and
  that `WEB_ORIGIN` includes the web origin.
- **Legit users refused / socket cap warnings in logs** (`ip ... over socket cap`)
  → CGNAT false positive. Set `MAX_SOCKETS_PER_IP` higher or `0` on Railway and
  redeploy. Safe to disable; the per-socket rate limit still protects the relay.
- **Shared links 404 after a deploy** → `REDIS_URL` not set; results fell back to
  memory. Add the Railway Redis plugin and reference the var.
- **API down (monitor red)** → Railway should auto-restart (On Failure). Check the
  service logs; redeploy if needed. A restart drops in-flight duels (players just
  rejoin), but the box recovers on its own.

## Post-launch (not for tomorrow)

If Standoff sticks, the real scaling step is moving lobby state out of memory into
Redis so the API can run multiple replicas behind Railway. Until then, vertical
(single big instance) is the ceiling.
