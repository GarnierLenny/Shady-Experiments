import { io, Socket } from 'socket.io-client';
import type {
  WhisperClientToServerEvents,
  WhisperServerToClientEvents,
} from '@shadyexperiments/shared';
import { socketUrl } from '@/lib/socket';

export type WhisperSocket = Socket<
  WhisperServerToClientEvents,
  WhisperClientToServerEvents
>;

/**
 * Connect to the central API's `/whisper` socket.io namespace - same host/port
 * as Standoff (resolved by `socketUrl`), just an isolated namespace so the two
 * experiments never share room or game state.
 */
export function createWhisperSocket(): WhisperSocket {
  return io(`${socketUrl()}/whisper`, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
  });
}
