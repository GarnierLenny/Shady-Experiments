// The subject number is generated client-side (no DB) and persisted in
// localStorage so the same visitor keeps the same id across "/" and
// "/eyetoeye". Range 10000–99999.
const KEY = "se.subject";

export function readSubjectId(): number {
  const fresh = () => Math.floor(10000 + Math.random() * 90000);

  if (typeof window === "undefined") return fresh();

  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored) {
      const n = Number.parseInt(stored, 10);
      if (n >= 10000 && n <= 99999) return n;
    }
    const id = fresh();
    window.localStorage.setItem(KEY, String(id));
    return id;
  } catch {
    // Private mode / storage blocked — still hand back a number.
    return fresh();
  }
}
