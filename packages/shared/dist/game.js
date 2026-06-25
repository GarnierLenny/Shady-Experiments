"use strict";
/**
 * Core game domain shared between the NestJS server and the Next.js client.
 * The server is the single source of truth for status transitions and timing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_BRAG_REACTION_MS = exports.MAX_PLAYERS_PER_LOBBY = exports.DUEL_TIMINGS = void 0;
exports.isBragWorthyReaction = isBragWorthyReaction;
exports.randomDelayMs = randomDelayMs;
/**
 * Timings (ms) for the cinematic sequence and the draw window.
 * The random portion of the wait is decided server-side per duel.
 */
exports.DUEL_TIMINGS = {
    /** Phase 1 - push in on the eyes. */
    ZOOM_MS: 3500,
    /** Phase 2 - pull back to full frame, silence. */
    DEZOOM_MS: 2500,
    /** Phase 3 - random wait before the signal, lower bound (after dezoom). */
    DRAW_MIN_MS: 3000,
    /** Phase 3 - random wait before the signal, upper bound. */
    DRAW_MAX_MS: 8000,
    /** Phase 4 - how long detection stays armed before a timeout. */
    DRAW_WINDOW_MS: 6000,
};
exports.MAX_PLAYERS_PER_LOBBY = 2;
/**
 * Above this, a "reaction" is almost certainly a missed/slow webcam detection
 * (or a genuinely sluggish round you still won) rather than a real fast draw.
 * We keep storing it, but hide the chrono in the UI instead of bragging an
 * absurd time.
 */
exports.MAX_BRAG_REACTION_MS = 1500;
/** True when a reaction is fast enough to show off (not a detection miss). */
function isBragWorthyReaction(ms) {
    return typeof ms === 'number' && ms >= 0 && ms <= exports.MAX_BRAG_REACTION_MS;
}
/** Inclusive random integer in [min, max]. */
function randomDelayMs(min = exports.DUEL_TIMINGS.DRAW_MIN_MS, max = exports.DUEL_TIMINGS.DRAW_MAX_MS) {
    return Math.floor(min + Math.random() * (max - min));
}
