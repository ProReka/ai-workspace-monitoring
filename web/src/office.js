// Pure helpers for the 2D Office view (layout, routing, schedule, daylight).
export const TZ_DEFAULT = 'Asia/Jakarta';
export const CELL_W = 48;
export const CELL_H = 70;
export const WALL_H = 42;
export const ROOM_W = 126;
const POD_GAP = 8;
const OUT_X = 170;
const OUT_Y = 48;
const HOLD_S = 300;
const AWAY_AFTER_S = 600;

export const legMs = (a, b) => Math.min(9000, Math.max(700, Math.hypot(b.x - a.x, b.y - a.y) * 55));

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
  const openRight = deskRight + 18;
  const top = WALL_H + 12;
  const openBottom = top + rows * CELL_H + 10;
  const corridorY = openBottom + 22;
  const W = openRight + ROOM_W + 10;
  const H = corridorY + 64;
  return {
    cols, rows, W, H, top, openRight, deskRight,
    VW: W + 2 * OUT_X, VH: H + 2 * OUT_Y,
    BX: OUT_X, BY: OUT_Y,
    aisleX: deskRight + 8,
    openBottom, corridorY,
    roomX: openRight + 8, roomRight: W - 8,
    pantryY: top, pantryH: 88,
    loungeY: top + 96,
    doorX: Math.round(W / 2),
    pantryDoorY: top + 42,
    loungeDoorY: top + 132,
    roomDoorX: openRight + 4,
    desks: Array.from({ length: count }, (_, i) => ({ x: deskX(i % cols), y: top + Math.floor(i / cols) * CELL_H })),
  };
}

export function deskSpot(a, i, L) {
  const d = L.desks[i];
  return { key: 'desk:' + a.agent_id, zone: 'desk', i, id: a.agent_id, pose: 'desk',
    x: L.BX + d.x + 24, y: L.BY + d.y + 44 };
}

export function indoorSpots(L) {
  const rx = L.BX + L.roomX;
  return [
    { key: 'coffee', zone: 'pantry', pose: 'cup', x: rx + 40, y: L.BY + L.pantryY + 68, door: 'pantry' },
    { key: 'cook', zone: 'pantry', pose: 'stand', x: rx + 100, y: L.BY + L.pantryY + 44, door: 'pantry' },
    { key: 'eat', zone: 'pantry', pose: 'sit', x: rx + 56, y: L.BY + L.pantryY + 68, door: 'pantry' },
    { key: 'sofa1', zone: 'lounge', pose: 'sit', x: rx + 24, y: L.BY + L.loungeY + 38, door: 'lounge' },
    { key: 'sofa2', zone: 'lounge', pose: 'sit', x: rx + 80, y: L.BY + L.loungeY + 38, door: 'lounge' },
    { key: 'read', zone: 'lounge', pose: 'sit', x: rx + 48, y: L.BY + L.loungeY + 60, door: 'lounge' },
    { key: 'corr1', zone: 'corridor', pose: 'sit', x: L.BX + 28, y: L.BY + L.corridorY + 36 },
    { key: 'corr2', zone: 'corridor', pose: 'sit', x: L.BX + L.openRight - 30, y: L.BY + L.corridorY + 36 },
  ];
}

export function outdoorSpots(L) {
  const y = L.BY + L.H + 54;
  return [
    { key: 'lawn1', zone: 'outside', pose: 'stand', x: L.BX - 84, y: y + 18 },
    { key: 'lawn2', zone: 'outside', pose: 'sit', x: L.BX + 34, y },
    { key: 'lawn3', zone: 'outside', pose: 'stand', x: L.BX + L.W / 2 - 46, y: y + 26 },
    { key: 'lawn4', zone: 'outside', pose: 'stand', x: L.BX + L.W / 2 + 46, y: y + 26 },
    { key: 'lawn5', zone: 'outside', pose: 'sit', x: L.BX + L.W - 34, y },
    { key: 'lawn6', zone: 'outside', pose: 'stand', x: L.BX + L.W + 84, y: y + 18 },
  ];
}

const hub = (L) => ({ x: L.BX + L.aisleX, y: L.BY + L.corridorY });

function insideLeg(p, L) {
  if (p.zone === 'desk') {
    const d = L.desks[p.i];
    const rowY = L.BY + d.y + CELL_H - 8;
    const seatX = L.BX + d.x + 24;
    return [p, { x: seatX, y: rowY }, { x: L.BX + L.aisleX, y: rowY }, hub(L)];
  }
  if (p.zone === 'corridor') {
    return [p, { x: p.x, y: L.BY + L.corridorY }, hub(L)];
  }
  if (p.zone === 'pantry' || p.zone === 'lounge') {
    const doorY = L.BY + (p.door === 'pantry' ? L.pantryDoorY : L.loungeDoorY);
    const inX = L.BX + L.roomX + 4, outX = L.BX + L.roomDoorX - 8;
    return [p, { x: inX, y: p.y }, { x: inX, y: doorY }, { x: outX, y: doorY },
      { x: outX, y: L.BY + L.corridorY }, hub(L)];
  }
  const doorOutX = L.BX + L.doorX, doorOutY = L.BY + L.H + 12;
  return [p, { x: p.x, y: doorOutY }, { x: doorOutX, y: doorOutY }];
}

function mainDoorLeg(L) {
  const x = L.BX + L.doorX;
  return [{ x: L.BX + L.aisleX, y: L.BY + L.corridorY },
    { x, y: L.BY + L.corridorY }, { x, y: L.BY + L.H }, { x, y: L.BY + L.H + 12 }];
}

export function routeFor(from, to, L) {
  if (!from || !to || from.key === to.key) return [];
  const a = insideLeg(from, L);
  const b = insideLeg(to, L).reverse();
  const fromOut = from.zone === 'outside';
  const toOut = to.zone === 'outside';
  const door = mainDoorLeg(L);
  if (fromOut && !toOut) return a.concat(door.slice(0, -1).reverse(), b.slice(1));
  if (!fromOut && toOut) return a.concat(door.slice(1, -1), b.slice(1));
  return a.concat(b.slice(1));
}

export function chooseAway(id, prev, L, nowS) {
  const pool = indoorSpots(L);
  const first = hash(id + ':away:' + nowS) % pool.length;
  for (let k = 0; k < pool.length; k++) {
    const spot = pool[(first + k) % pool.length];
    if (!prev || spot.key !== prev.key) return { ...spot };
  }
  return { ...pool[first] };
}

function homeSpot(id, L) {
  if (hash(id + ':home') % 100 < 35) return null;
  const pool = indoorSpots(L);
  return { ...pool[hash(id + ':place') % pool.length] };
}

const nextDelay = (id, nowS) => 90 + hash(id + ':when:' + nowS) % 150;

export function plan(agents, L, prevBeh, nowS) {
  const next = {};
  agents.forEach((a, i) => {
    const id = a.agent_id;
    const desk = deskSpot(a, i, L);
    const old = prevBeh && prevBeh[id];
    const work = a.running > 0;
    const pending = (a.pending_total || 0) > 0;
    let spot = desk;
    let activity = 'idle';
    let leisure = '';
    let idleSince = old ? (old.idleSince ?? nowS) : nowS;
    let holdUntil = old ? old.holdUntil || 0 : 0;
    let nextAt = old ? old.nextAt || 0 : nowS + 20 + hash(id + ':phase') % 150;

    if (!old) {
      const home = homeSpot(id, L);
      if (home) { spot = home; activity = 'away'; }
    } else {
      spot = old.spot;
      activity = old.activity;
      leisure = old.leisure || '';
    }

    if (!a.runtime_online) {
      activity = 'offline'; spot = desk; leisure = '';
      holdUntil = 0; idleSince = nowS; nextAt = 0;
    } else if (work) {
      activity = 'work'; spot = desk; leisure = '';
      holdUntil = 0; idleSince = nowS; nextAt = 0;
    } else if (old && old.activity === 'work' && !work) {
      if (!holdUntil) holdUntil = nowS + HOLD_S;
      activity = 'relax'; spot = desk; leisure = '';
    } else if (nowS < holdUntil) {
      activity = 'relax'; spot = desk; leisure = '';
    } else if (pending) {
      activity = hash(id + ':q') % 100 < 45 ? 'leisure' : 'queue';
      spot = desk;
      leisure = activity === 'leisure' ? ['video', 'book', 'game'][hash(id + ':l') % 3] : '';
    } else if (nowS >= nextAt) {
      idleSince = old ? (old.idleSince ?? nowS) : nowS - AWAY_AFTER_S;
      const roll = hash(id + ':stay:' + nowS) % 100;
      const mayLeave = nowS - idleSince >= AWAY_AFTER_S;
      if (roll < 35) activity = 'leisure';
      else if (!mayLeave || roll < 55) activity = 'idle';
      else { spot = chooseAway(id, old && old.spot, L, nowS); activity = 'away'; }
      leisure = activity === 'leisure' ? ['video', 'book', 'game'][hash(id + ':l:' + nowS) % 3] : '';
      nextAt = nowS + nextDelay(id, nowS);
      if (spot.zone === 'desk' && old && old.spot.zone !== 'desk') idleSince = nowS;
    }

    const overload = work && pending;
    const route = old ? routeFor(old.spot, spot, L) : [];
    next[id] = { spot, activity, leisure, overload, holdUntil, idleSince, nextAt, route };
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

export function wrapName(name, max = 12, lines = 2) {
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
