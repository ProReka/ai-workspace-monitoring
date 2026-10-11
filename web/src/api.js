async function get(path, timeoutMs = 90000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(path, { cache: 'no-store', signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

export const fetchSnapshot = () => get('/api/snapshot');
export const fetchLive = (period = 'all') => get('/api/live?period=' + period, 15000);
export const fetchHistory = (range) => get('/api/history?range=' + range, 20000);
