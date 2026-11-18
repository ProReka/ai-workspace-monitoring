// Pure helpers for the 2D Office view (layout, routing, schedule, daylight).
export const TZ_DEFAULT = 'Asia/Jakarta';
export const M = 26;
export const CELL_W = 48;
export const CELL_H = 72;
export const WALL_H = 44;
export const LOUNGE_W = 120;
const POD_GAP = 10;
const BUCKET_LEISURE = 45;
const BUCKET_AWAY = 180;
const HOLD_S = 60;

export function hash(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const g = (L, x, y) => ({ x: M + x, y: M + y });

function mix(a, b, t) {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

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
    night: 1 - day,
  };
}

export function layout(n) {
  const count = Math.max(1, n);
  const cols = clamp(Math.ceil(Math.sqrt(count * 1.6)), 2, 5);
  const rows = Math.max(1, Math.ceil(count / cols));
  const deskX = (c) => 10 + c * CELL_W + Math.floor(c / 2) * POD_GAP;
  const deskRight = deskX(cols - 1) + CELL_W;
  const top = WALL_H + 12;
  const lx = deskRight + 20;
  const W = lx + LOUNGE_W + 8;
  const H = top + Math.max(rows * CELL_H + 80, 260);
  const gardenW = Math.max(300, W * 0.9);
  return {
    cols, rows, W, H, top, lx, gardenW, deskRight,
    VW: W + gardenW + 2 * M,
    VH: H + 2 * M,
    aisleX: deskRight + 8,
    bottomY: H - 14,
    doorX: W - 10,
    doorY: H - 30,
    desks: Array.from({ length: count }, (_, i) => ({ x: deskX(i % cols), y: top + Math.floor(i / cols) * CELL_H })),
  };
}

export function deskSpot(a, i, L) {
  const d = L.desks[i];
  return { key: 'desk:' + a.agent_id, zone: 'desk', i, id: a.agent_id, pose: 'desk',
    x: M + d.x + 24, y: M + d.y + 44 };
}

export function indoorSpots(L) {
  return [
    { key: 'pantry', zone: 'inside', pose: 'cup', x: M + L.lx + 18, y: M + L.top + 34, laneX: L.lx + 6 },
    { key: 'pantry2', zone: 'inside', pose: 'cup', x: M + L.lx + 76, y: M + L.top + 34, laneX: L.lx + 108 },
    { key: 'sofa', zone: 'inside', pose: 'sit', x: M + L.lx + 34, y: M + L.top + 106, laneX: L.lx + 6 },
    { key: 'sofa2', zone: 'inside', pose: 'sit', x: M + L.lx + 88, y: M + L.top + 106, laneX: L.lx + 108 },
  ];
}

export function outdoorSpots(L) {
  const x0 = M + L.W + 26;
  const yDoor = M + L.doorY;
  const w = L.gardenW - 52;
  return [
    { key: 'pool1', zone: 'outside', pose: 'sit', x: x0 + 40, y: yDoor + 12, laneX: x0 + 14 },
    { key: 'pool2', zone: 'outside', pose: 'stand', x: x0 + w * 0.5, y: yDoor + 12, laneX: x0 + w * 0.5 },
    { key: 'pool3', zone: 'outside', pose: 'sit', x: x0 + w - 18, y: yDoor + 12, laneX: x0 + w - 14 },
    { key: 'tree', zone: 'outside', pose: 'sit', x: x0 + 24, y: M + 34, laneX: x0 + 14 },
    { key: 'lawn', zone: 'outside', pose: 'stand', x: x0 + w * 0.55, y: M + 34, laneX: x0 + w * 0.5 },
    { key: 'deck', zone: 'outside', pose: 'sit', x: x0 + w - 16, y: M + 34, laneX: x0 + w - 14 },
  ];
}

function insideLeg(p, L) {
  const hub = g(L, L.aisleX, L.bottomY);
  const doorIn = g(L, L.doorX, L.bottomY);
  const door = g(L, L.doorX, L.doorY);
  if (p.zone === 'desk') {
    const d = L.desks[p.i];
    const rowY = d.y + CELL_H - 8;
    return [p, g(L, d.x + 24, rowY), g(L, L.aisleX, rowY), hub, doorIn, door];
  }
  if (p.zone === 'inside') {
    return [p, g(L, p.laneX, p.y - M), g(L, p.laneX, L.bottomY), hub, doorIn, door];
  }
  const yDoor = M + L.doorY;
  return [p, { x: p.laneX, y: p.y }, { x: p.laneX, y: yDoor }, { x: M + L.W + 10, y: yDoor }];
}

export function routeFor(from, to, L) {
  if (!from || !to) return [];
  const A = insideLeg(from, L);
  const B = insideLeg(to, L);
  return A.concat(B.reverse().slice(1));
}

export function chooseAway(id, prev, L, nowS) {
  if (prev && prev.zone !== 'desk' && Math.floor(nowS / BUCKET_AWAY) === prev.bucket) return prev;
  const inSpots = indoorSpots(L), outSpots = outdoorSpots(L);
  const useOutside = prev ? prev.zone === 'outside' : hash(id + 'out') % 2 === 0;
  const pool = useOutside ? outSpots : inSpots;
  const h = hash(id + ':' + Math.floor(nowS / BUCKET_AWAY));
  return { ...pool[h % pool.length], bucket: Math.floor(nowS / BUCKET_AWAY) };
}

export function plan(agents, L, prevBeh, nowS) {
  const next = {};
  agents.forEach((a, i) => {
    const id = a.agent_id;
    const desk = deskSpot(a, i, L);
    const old = prevBeh && prevBeh[id];
    const work = a.running > 0;
    const pending = (a.pending_total || 0) > 0;
    let spot = desk, activity = 'idle';
    let holdUntil = old && old.wasWorking && !work && !old.holdUntil ? nowS + HOLD_S : (old ? old.holdUntil || 0 : 0);
    if (work) {
      activity = 'work'; holdUntil = 0;
    } else if (nowS < holdUntil) {
      activity = 'relax';
    } else if (pending) {
      activity = 'queue';
    } else if (!a.runtime_online) {
      spot = chooseAway(id, old && old.spot, L, nowS); activity = 'away';
    } else {
      const bucket = Math.floor(nowS / BUCKET_LEISURE);
      const stay = hash(id + ':stay:' + bucket) % 100 < 58;
      if (stay) activity = 'leisure';
      else { spot = chooseAway(id, old && old.spot, L, nowS); activity = 'away'; }
    }
    if (activity === 'queue' && (hash(id + ':q') % 100) < 45) activity = 'leisure';
    const leisure = activity === 'leisure' ? ['video', 'book', 'game'][hash(id + ':l') % 3] : '';
    const overload = work && pending;
    const route = routeFor(old && old.spot ? old.spot : desk, spot, L);
    next[id] = { spot, activity, leisure, overload, holdUntil, wasWorking: work || activity === 'relax', route,
      from: old && old.spot ? old.spot : desk };
  });
  return next;
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

export function wrapName(name, max = 17, lines = 2) {
  const out = [];
  let cur = '';
  for (const w of String(name || '').trim().split(/\s+/)) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length <= max || !cur) cur = next;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  const clean = (l) => l.replace(/\s*[-–—|·:]+$/, '');
  const res = out.slice(0, lines).map(clean).map((l) => (l.length > max ? l.slice(0, max - 1) + '…' : l));
  if (out.length > lines) res[lines - 1] = res[lines - 1].slice(0, max - 1).replace(/\s+$/, '') + '…';
  return res.filter(Boolean);
}
