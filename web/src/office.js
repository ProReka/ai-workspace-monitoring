// Pure helpers for the 2D Office view (layout, schedule, daylight). No React here.

export const TZ_DEFAULT = 'Asia/Jakarta';
export const WALL_H = 46;
export const CELL_W = 48;
export const CELL_H = 56;
export const LOUNGE_W = 128;
const POD_GAP = 10;
const SLOT_S = 75;

export function hash(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function mix(a, b, t) {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// Wall-clock parts in the office timezone; invalid tz falls back to Jakarta.
export function tzClock(now, tz) {
  const fmt = (zone) => new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    weekday: 'short', day: '2-digit', month: 'short', timeZoneName: 'short',
  });
  let f;
  try { f = fmt(tz || TZ_DEFAULT); } catch { f = fmt(TZ_DEFAULT); }
  const p = Object.fromEntries(f.formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  const h = +p.hour, m = +p.minute, s = +p.second;
  return { h, m, s, hours: h + m / 60 + s / 3600, zone: p.timeZoneName, date: `${p.weekday} ${p.day} ${p.month}` };
}

// ponytail: fixed 06:00-18:00 sun arc (fits equatorial WIB); add a solar calc if offices move far from the equator.
export function sky(hours) {
  const alt = Math.sin((Math.PI * (hours - 6)) / 12);
  const day = clamp((alt + 0.1) / 0.35, 0, 1);
  const glow = Math.max(0, 1 - Math.abs(alt) / 0.3);
  return {
    alt, day, glow,
    top: mix('#0a0f2e', '#4c9fe0', day),
    bottom: mix(mix('#1c2452', '#a8dbf6', day), '#ff9a5c', glow * 0.8),
    sunX: (hours - 6) / 12,
    moonX: (((hours + 12) % 24) - 6) / 12,
  };
}

export function layout(n) {
  const cols = clamp(Math.ceil(Math.sqrt(Math.max(1, n) * 1.6)), 2, 5);
  const rows = Math.max(1, Math.ceil(n / cols));
  const deskX = (c) => 10 + c * CELL_W + Math.floor(c / 2) * POD_GAP;
  const top = WALL_H + 10;
  const lx = deskX(cols - 1) + CELL_W + 16;
  const W = lx + LOUNGE_W + 6;
  const H = top + Math.max(rows * CELL_H + 14, 236);
  const desks = Array.from({ length: n }, (_, i) => ({ x: deskX(i % cols), y: top + Math.floor(i / cols) * CELL_H }));
  return { cols, rows, W, H, top, lx, desks };
}

// Feet positions in the lounge; must match the furniture drawn in Office.jsx.
export function loungeSpots(lx, H) {
  const t = WALL_H;
  return [
    { x: lx + 20, y: t + 40, pose: 'cup' }, { x: lx + 42, y: t + 42, pose: 'cup' }, { x: lx + 64, y: t + 40, pose: 'cup' },
    { x: lx + 118, y: t + 58, pose: 'cup' },
    { x: lx + 32, y: t + 104, pose: 'sit' }, { x: lx + 52, y: t + 104, pose: 'sit' }, { x: lx + 72, y: t + 104, pose: 'sit' },
    { x: lx + 108, y: t + 124, pose: 'sit' },
    { x: lx + 58, y: t + 172, pose: 'sit' }, { x: lx + 74, y: t + 172, pose: 'sit' },
    { x: lx + 46, y: t + 200, pose: 'stand' }, { x: lx + 100, y: H - 26, pose: 'stand' }, { x: lx + 66, y: H - 14, pose: 'stand' },
  ];
}

export const atDesk = (a) => !!a.runtime_online && (a.running > 0 || (a.pending_total || 0) > 0);

// Busy agents sit at their desk; the rest roam to a free lounge spot that changes every ~75s.
export function plan(agents, desks, spots, nowS) {
  const out = {};
  const idle = [];
  agents.forEach((a, i) => {
    const d = desks[i];
    if (atDesk(a)) out[a.agent_id] = { x: d.x + 24, y: d.y + 40, pose: 'desk' };
    else idle.push([a, d]);
  });
  idle.sort((p, q) => String(p[0].agent_id).localeCompare(String(q[0].agent_id)));
  const taken = new Set();
  for (const [a, d] of idle) {
    const id = String(a.agent_id);
    const r = hash(id + ':' + Math.floor((nowS + (hash(id) % SLOT_S)) / SLOT_S));
    let pick = -1;
    for (let k = 0; r % 5 !== 0 && k < spots.length; k++) {
      const j = (r + k) % spots.length;
      if (!taken.has(j)) { pick = j; break; }
    }
    if (pick < 0) out[id] = { x: d.x + 42, y: d.y + 36, pose: 'stand' };
    else { taken.add(pick); out[id] = { ...spots[pick] }; }
  }
  return out;
}

const SKIN = ['#f3d0b0', '#e5b48a', '#c98d60', '#9a6440', '#6e4529'];
const HAIR = ['#2a1c14', '#4b2e1c', '#7a4a24', '#c99a52', '#1d1f2b', '#8c2f2f', '#d9d9de', '#3d5a8a'];
const PANTS = ['#2d3550', '#3b3b44', '#4a3a2a', '#24425a'];

export function look(id) {
  const h = hash(id);
  return {
    skin: SKIN[h % SKIN.length], hair: HAIR[(h >>> 3) % HAIR.length],
    shirt: `hsl(${(h >>> 6) % 360} 55% 52%)`, pants: PANTS[(h >>> 15) % PANTS.length], deco: (h >>> 18) % 4,
  };
}
