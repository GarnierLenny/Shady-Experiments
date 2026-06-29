/**
 * Human-friendly room codes for Whispering Hacker, like `CIPHER-07` — easy to
 * read aloud and share. Same shape as Standoff's lobby codes, so the generic
 * normalize/validate helpers are reused verbatim from `lobby-id.ts`.
 */
export { normalizeLobbyId as normalizeRoomId, isValidLobbyId as isValidRoomId } from './lobby-id';

const WORDS = [
  'NODE',
  'CIPHER',
  'PROXY',
  'DAEMON',
  'KERNEL',
  'PACKET',
  'VECTOR',
  'SOCKET',
  'ENTROPY',
  'ROOTKIT',
  'FIREWALL',
  'BUFFER',
  'SANDBOX',
  'PAYLOAD',
  'BEACON',
  'RELAY',
] as const;

export function generateRoomId(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = Math.floor(10 + Math.random() * 90); // 2 digits
  return `${word}-${num}`;
}
