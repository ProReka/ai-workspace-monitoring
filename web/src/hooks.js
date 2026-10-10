import { useEffect, useRef, useState } from 'react';

// Poll an async fn every ms; returns {data, error}. Immediate first fetch.
export function usePoll(fn, ms) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let dead = false;
    let timer = 0;
    async function run() {
      try {
        const d = await ref.current();
        if (!dead) { setData(d); setError(null); }
      } catch (e) {
        if (!dead) setError(e);
      }
      if (!dead) timer = setTimeout(run, ms);
    }
    run();
    return () => { dead = true; clearTimeout(timer); };
  }, [ms]);
  return { data, error };
}

// Ticks every second; components derive clock/elapsed/ago from it.
export function useNow(active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

// localStorage-backed state.
export function useStored(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s === null ? initial : JSON.parse(s);
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }, [key, v]);
  return [v, setV];
}
