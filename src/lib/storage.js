// localStorage can be missing (private mode), full, or hold data written by an
// older version of the app. These helpers never throw and always return the
// shape the caller expects.
export function readLocalArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* storage full or blocked: history is a convenience, so skip saving */ }
}

export function readLocalString(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}
