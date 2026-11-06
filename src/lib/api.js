// Small fetch wrapper: always returns { ok, status, data } and never throws
// on HTTP errors, so callers can map status codes to translated messages.
export async function api(path, { method = 'GET', body, signal } = {}) {
  const init = { method, signal };
  if (body !== undefined) { init.headers = { 'Content-Type': 'application/json' }; init.body = JSON.stringify(body); }
  const response = await fetch(path, init);
  let data = null;
  try { data = await response.json(); } catch { /* e.g. HTML error page from a proxy */ }
  return { ok: response.ok, status: response.status, data };
}

// Maps an HTTP status to an i18n key for a friendly, translated error.
export function errorKeyFor(status, fallback = 'err.analyze') {
  if (status === 429) return 'err.busy';
  if (status === 503) return 'err.notConfigured';
  if (status === 413) return 'err.tooLarge';
  return fallback;
}
