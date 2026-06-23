/**
 * Short, URL-safe id for a shareable duel result permalink (`/r/<id>`).
 * Time-prefixed so ids sort roughly by creation, plus random entropy so they
 * can't be trivially guessed or enumerated.
 */
export declare function generateResultId(): string;
