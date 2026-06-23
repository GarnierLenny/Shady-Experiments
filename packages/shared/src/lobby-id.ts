/**
 * Human-friendly lobby codes like `OUTLAW-42` - easy to read aloud and share.
 */
const WORDS = [
  'OUTLAW',
  'SHERIFF',
  'BANDIT',
  'CACTUS',
  'CANYON',
  'REVOLVER',
  'SALOON',
  'COYOTE',
  'MUSTANG',
  'RANGER',
  'GUNSLINGER',
  'TUMBLEWEED',
  'DESPERADO',
  'VARMINT',
  'WRANGLER',
  'BUZZARD',
] as const;

export function generateLobbyId(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = Math.floor(10 + Math.random() * 90); // 2 digits
  return `${word}-${num}`;
}

/** Normalize user input (trim, uppercase) so `outlaw-42` matches `OUTLAW-42`. */
export function normalizeLobbyId(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidLobbyId(raw: string): boolean {
  return /^[A-Z]+-\d{1,3}$/.test(normalizeLobbyId(raw));
}
