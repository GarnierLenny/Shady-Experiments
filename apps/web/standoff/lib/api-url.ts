/**
 * Base URL of the NestJS API for server-side REST calls (result permalinks).
 * The realtime gateway and the REST API share an origin, so we reuse the socket
 * URL unless an explicit `API_URL` is set.
 */
export function apiUrl(): string {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    'http://localhost:3002'
  );
}
