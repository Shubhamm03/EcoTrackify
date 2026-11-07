import { useCallback, useEffect, useRef, useState } from 'react';
import { api, onDataChange } from '../utils/api';

// Every page refreshes its data quietly in the background (no spinner, no flicker):
//  - at once when another tab of this browser changes something,
//  - when you come back to the tab,
//  - and every LIVE_MS while the tab is visible (changes by other people or devices).
const LIVE_MS = 15000;

// GET a path and keep the result in state.
// Pass { refreshMs } to refresh more often than LIVE_MS. Polling pauses while the tab is hidden.
export default function useApi(path, deps = [], { refreshMs = 0 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(path));
  const ctrlRef = useRef(null);

  const load = useCallback(async () => {
    if (!path) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(path, { signal: ctrl.signal });
      if (!ctrl.signal.aborted) setData(res);
    } catch (err) {
      if (err.name !== 'AbortError' && !ctrl.signal.aborted) setError(err.message);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [path, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background refresh: keeps the old data on screen, ignores errors, and only updates
  // the page when something actually changed (so nothing re-renders or re-animates for no reason)
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    if (!path || document.hidden || busy.current) return;
    busy.current = true;
    try {
      const res = await api.get(path);
      setData((prev) => (JSON.stringify(prev) === JSON.stringify(res) ? prev : res));
      setError('');
    } catch {
      /* keep showing what we have */
    } finally {
      busy.current = false;
    }
  }, [path, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    return () => ctrlRef.current?.abort();
  }, [load]);

  useEffect(() => {
    if (!path) return undefined;
    const id = setInterval(refresh, refreshMs || LIVE_MS);
    let t;
    // Another tab changed something: refresh shortly after (lets its write finish first)
    const off = onDataChange(() => { clearTimeout(t); t = setTimeout(refresh, 250); });
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { clearInterval(id); clearTimeout(t); off(); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [refresh, refreshMs, path]);

  return { data, setData, error, loading, reload: load, refresh };
}
