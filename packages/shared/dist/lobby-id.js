"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLobbyId = generateLobbyId;
exports.normalizeLobbyId = normalizeLobbyId;
exports.isValidLobbyId = isValidLobbyId;
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
];
function generateLobbyId() {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const num = Math.floor(10 + Math.random() * 90); // 2 digits
    return `${word}-${num}`;
}
/** Normalize user input (trim, uppercase) so `outlaw-42` matches `OUTLAW-42`. */
function normalizeLobbyId(raw) {
    return raw.trim().toUpperCase();
}
function isValidLobbyId(raw) {
    return /^[A-Z]+-\d{1,3}$/.test(normalizeLobbyId(raw));
}
