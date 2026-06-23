export declare function generateLobbyId(): string;
/** Normalize user input (trim, uppercase) so `outlaw-42` matches `OUTLAW-42`. */
export declare function normalizeLobbyId(raw: string): string;
export declare function isValidLobbyId(raw: string): boolean;
