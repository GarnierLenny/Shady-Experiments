import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@standoffduel/shared';

export type DuelSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Where the gateway lives. Explicit env wins (deploys / tunnels); otherwise
 * default to the same host the page was served from on :3002 - so opening the
 * app from another machine on the LAN "just works" without any config.
 */
function socketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3002`;
  }
  return 'http://localhost:3002';
}

/** Create a fresh, typed socket connection (one per lobby session). */
export function createSocket(): DuelSocket {
  return io(socketUrl(), {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
  });
}
