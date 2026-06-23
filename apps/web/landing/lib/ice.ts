/**
 * ICE servers for the WebRTC peer connection.
 *
 * Public STUN gets most consumer home routers to discover their public address
 * and connect directly. But a meaningful slice of players sit behind symmetric
 * NAT - mobile carriers, CGNAT, locked-down corporate Wi-Fi - where a direct
 * path can never form. Those duels need a TURN *relay* to hand the media
 * through. Without one they silently hang on "waiting for opponent" forever.
 *
 * TURN is env-driven so the public build ships with STUN-only and a deploy can
 * plug in credentials (metered.ca, Twilio NTS, self-hosted coturn, ...).
 */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const PUBLIC_STUN: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

/** STUN always; append the configured TURN relay when env credentials exist. */
export function iceServers(): IceServer[] {
  const urls = process.env.NEXT_PUBLIC_TURN_URLS?.split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  if (!urls || urls.length === 0) return PUBLIC_STUN;

  return [
    ...PUBLIC_STUN,
    {
      urls,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    },
  ];
}

/** True when a TURN relay is configured - used to soften failure messaging. */
export function hasTurn(): boolean {
  return !!process.env.NEXT_PUBLIC_TURN_URLS?.trim();
}
