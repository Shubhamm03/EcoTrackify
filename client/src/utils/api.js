const BASE = (import.meta.env.VITE_API_URL || '') + '/api';
const TOKEN_KEY = 'ecotrackify_token';

// Each browser tab keeps its own login (sessionStorage), so two accounts can be used side by side
// and refreshing a tab keeps that tab's account. localStorage only remembers the most recent login,
// which a newly opened tab starts with. After logging out, a tab stays logged out ('' marker).
const ss = {
  get: () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (v) => { try { sessionStorage.setItem(TOKEN_KEY, v); } catch { /* storage unavailable */ } },
};
const ls = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(TOKEN_KEY, v); } catch { /* storage unavailable */ } },
  remove: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } },
};

export const tokenStore = {
  get: () => {
    const mine = ss.get();
    if (mine !== null) return mine || null; // this tab already has a login (or logged out)
    const latest = ls.get();                // new tab: start with the most recent login
    if (latest) ss.set(latest);
    return latest;
  },
  set: (t) => {
    ss.set(t);
    ls.set(t);
  },
  clear: () => {
    const mine = ss.get();
    ss.set('');
    // Forget the shared login only if it is this tab's, so other tabs and new tabs are not affected
    if (mine && ls.get() === mine) ls.remove();
  },
};

export class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// ---------- Live updates ----------
// After any change (POST/PUT/DELETE) the other open tabs of this browser are told at once, so
// pages there refresh their data without a reload. Pages also refresh quietly every few seconds,
// which picks up changes made by other people or on other devices.
const SYNC = 'ecotrackify-sync';
let channel = null;
try { channel = new BroadcastChannel(SYNC); } catch { /* not supported: storage event below */ }
export function announceChange() {
  try { channel?.postMessage(Date.now()); } catch { /* ignore */ }
  try { localStorage.setItem(SYNC, String(Date.now())); } catch { /* storage unavailable */ }
}
export function onDataChange(cb) {
  const onMsg = () => cb();
  const onStorage = (e) => { if (e.key === SYNC) cb(); };
  channel?.addEventListener('message', onMsg);
  window.addEventListener('storage', onStorage);
  return () => { channel?.removeEventListener('message', onMsg); window.removeEventListener('storage', onStorage); };
}

// Small fetch wrapper: JSON in/out, auth header, friendly errors, abort support.
export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:logout'));
    }
    throw new ApiError(data?.message || `Request failed (${res.status})`, res.status, data?.details || null);
  }
  if (method !== 'GET') announceChange();
  return data;
}

// Multipart upload (e.g. profile photo). Lets the browser set the boundary header.
api.upload = async (path, formData) => {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(BASE + path, { method: 'POST', headers, body: formData });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new ApiError(data?.message || `Upload failed (${res.status})`, res.status);
  announceChange();
  return data;
};

api.get = (p, opts) => api(p, { ...opts, method: 'GET' });
api.post = (p, body, opts) => api(p, { ...opts, method: 'POST', body });
api.put = (p, body, opts) => api(p, { ...opts, method: 'PUT', body });
api.del = (p, opts) => api(p, { ...opts, method: 'DELETE' });
