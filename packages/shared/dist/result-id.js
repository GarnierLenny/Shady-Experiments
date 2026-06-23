"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateResultId = generateResultId;
/**
 * Short, URL-safe id for a shareable duel result permalink (`/r/<id>`).
 * Time-prefixed so ids sort roughly by creation, plus random entropy so they
 * can't be trivially guessed or enumerated.
 */
function generateResultId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
