export function fmtDur(sec) {
  sec = Math.round(sec || 0);
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'm';
  return (sec / 3600).toFixed(1) + 'h';
}

export function agoParts(ts) {
  if (!ts) return null;
  const s = Math.max(0, Date.now() / 1000 - new Date(ts).getTime() / 1000);
  if (s < 60) return [Math.floor(s) + 's', 'ago'];
  if (s < 3600) return [Math.floor(s / 60) + 'm', 'ago'];
  if (s < 86400) return [Math.floor(s / 3600) + 'h', 'ago'];
  return [Math.floor(s / 86400) + 'd', 'ago'];
}

export function ago(ts) {
  const p = agoParts(ts);
  return p ? p[0] + ' ' + p[1] : '—';
}

export function agoShort(ts) {
  const p = agoParts(ts);
  return p ? p[0] : '—';
}

export function timeHM(ts) {
  return new Date(ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function fullDT(ts) {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleString('en-GB');
}

export function big(n) {
  n = Number(n || 0);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
}

export function short(s, n) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function kindIcon(kind) {
  return {
    autopilot: 'ph-robot', direct: 'ph-chat-teardrop-text', issue: 'ph-ticket',
    chat: 'ph-chats', mention: 'ph-at', comment: 'ph-comment-text',
  }[(kind || '').toLowerCase()] || 'ph-briefcase';
}

export function statusOf(a) {
  const pending = a.pending_total || 0;
  if (!a.runtime_online) return { cls: 'muted', label: 'OFFLINE', group: 'offline', icon: 'ph-plug-charging' };
  if (a.running > 0) return { cls: 'working', label: 'WORKING', group: 'working', icon: 'ph-gear-six' };
  if (pending > 0) return { cls: 'warn', label: `QUEUED ${pending}`, group: 'queued', icon: 'ph-hourglass-medium' };
  return { cls: 'ok', label: 'IDLE', group: 'idle', icon: 'ph-moon-stars' };
}
