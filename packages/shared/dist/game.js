"use strict";
/**
 * Core game domain shared between the NestJS server and the Next.js client.
 * The server is the single source of truth for status transitions and timing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_PLAYERS_PER_LOBBY = exports.DUEL_TIMINGS = void 0;
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
/** Inclusive random integer in [min, max]. */
function randomDelayMs(min = exports.DUEL_TIMINGS.DRAW_MIN_MS, max = exports.DUEL_TIMINGS.DRAW_MAX_MS) {
    return Math.floor(min + Math.random() * (max - min));
}
