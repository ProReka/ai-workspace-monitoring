// Self-check for 2D Office helpers: `node src/office.check.mjs`
import assert from 'node:assert/strict';
import { CELL_W, WALL_H, deskSpot, indoorSpots, layout, legMs, outdoorSpots, plan, routeFor, sky, tzClock, wrapName } from './office.js';

const t = Date.UTC(2026, 10, 18, 5, 0, 0);
assert.equal(tzClock(t, 'Asia/Jakarta').h, 12);
assert.equal(tzClock(t, 'Not/AZone').h, 12);
assert.equal(sky(12).day, 1);
assert.equal(sky(0).day, 0);

const L = layout(8);
assert.equal(L.desks.length, 8);
assert.ok(L.VW > L.W + 200 && L.VH > L.H, 'dark ground around a centered building');
const agents = Array.from({ length: 8 }, (_, i) => ({
  agent_id: 'a' + i, runtime_online: true, running: i < 2 ? 1 : 0, pending_total: i === 2 ? 3 : 0,
}));
const indoors = indoorSpots(L), outdoors = outdoorSpots(L);
assert.equal(new Set([...indoors, ...outdoors].map((s) => s.key)).size, indoors.length + outdoors.length);
const seats = agents.map((a, i) => deskSpot(a, i, L));
const starts = [...seats, ...indoors, ...outdoors];
const crossesX = (a, b, x) => Math.min(a.x, b.x) <= x && Math.max(a.x, b.x) >= x;
const crossesY = (a, b, y) => Math.min(a.y, b.y) <= y && Math.max(a.y, b.y) >= y;
const roomGap = (y) => [L.pantryDoorY, L.loungeDoorY].some((d) => Math.abs(y - (L.BY + d)) <= 13);
const cross = (r, x, y) => r.some((p, i) => {
  if (!i) return false;
  const a = r[i - 1], b = p;
  const horiz = Math.abs(a.y - y) < 0.1 && Math.abs(b.y - y) < 0.1
    && Math.min(a.x, b.x) - 1 <= x && Math.max(a.x, b.x) + 1 >= x;
  const vert = Math.abs(a.x - x) < 0.1 && Math.abs(b.x - x) < 0.1
    && Math.min(a.y, b.y) - 1 <= y && Math.max(a.y, b.y) + 1 >= y;
  return horiz || vert;
});
assert.deepEqual(routeFor(seats[0], deskSpot(agents[0], 0, L), L), [], 'no desk round trip');
assert.ok(legMs({ x: 0, y: 0 }, { x: 100, y: 0 }) >= 5000, 'walking speed is natural');
const idleOnly = agents.filter((a) => !a.running && !a.pending_total);
const spawn = plan(idleOnly, L, null, 5000);
assert.ok(Object.values(spawn).some((s) => s.spot.zone !== 'desk'), 'fresh load spreads agents across rooms');
assert.ok(Object.values(spawn).some((s) => s.spot.zone === 'desk'), 'fresh load keeps some agents at desk');
const still = plan(idleOnly, L, spawn, 5001);
assert.ok(Object.keys(spawn).every((id) => spawn[id].spot.key === still[id].spot.key), 'agents keep position between ticks');
assert.ok(Object.values({ ...spawn, ...still }).every((s) => s.spot.zone !== 'outside'), 'agents stay indoors');
const fridge = { x0: L.BX + L.roomX + 6, x1: L.BX + L.roomX + 24, y0: L.BY + L.pantryY + 8, y1: L.BY + L.pantryY + 32 };
for (const spot of indoors.filter((s) => s.zone === 'pantry')) {
  assert.ok(!(spot.x >= fridge.x0 && spot.x <= fridge.x1 && spot.y >= fridge.y0 && spot.y <= fridge.y1), `pantry spot on fridge: ${spot.key}`);
}
for (const from of starts) {
  for (const to of starts) {
    if (from === to) continue;
    const r = routeFor(from, to, L);
    assert.ok(r.length >= 2, `${from.key} -> ${to.key}`);
    assert.deepEqual([r[0].x, r[0].y], [from.x, from.y]);
    assert.deepEqual([r[r.length - 1].x, r[r.length - 1].y], [to.x, to.y]);
    if ((from.zone === 'outside') !== (to.zone === 'outside')) {
      assert.ok(cross(r, L.BX + L.doorX, L.BY + L.H), `main door missing: ${from.key} -> ${to.key}`);
    }
    for (const zone of ['pantry', 'lounge']) {
      if (from.zone === zone || to.zone === zone) {
        const other = from.zone === zone ? to : from;
        if (other.zone !== zone) {
          const y = L.BY + (zone === 'pantry' ? L.pantryDoorY : L.loungeDoorY);
          assert.ok(cross(r, L.BX + L.roomDoorX, y), `${zone} door missing: ${from.key} -> ${to.key}`);
        }
      }
    }
    const wallX = L.BX + L.roomX - 1;
    const bottomY = L.BY + L.H - 2;
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1], b = r[i];
      if (a.y === b.y && crossesX(a, b, wallX) && a.y > L.BY + WALL_H && a.y < L.BY + L.corridorY) {
        assert.ok(roomGap(a.y), `room wall breached: ${from.key} -> ${to.key}`);
      }
      if (a.x === b.x && crossesY(a, b, bottomY)) {
        assert.ok(Math.abs(a.x - (L.BX + L.doorX)) <= 15, `bottom wall breached: ${from.key} -> ${to.key}`);
      }
      if (a.y !== b.y) continue;
      const y = a.y, x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
      const rows = L.desks.filter((d) => {
        const y0 = L.BY + d.y;
        return y > y0 + 4 && y < y0 + 57;
      });
      for (const d of rows) {
        const x0 = L.BX + d.x + 2, x1d = L.BX + d.x + CELL_W;
        const own = from.zone === 'desk' && from.i === L.desks.indexOf(d);
        assert.ok(own || x2 <= x0 || x1 >= x1d, `route crossed a desk: ${from.key} -> ${to.key}`);
      }
    }
  }
}

let b = plan(agents, L, null, 1000);
assert.equal(b.a0.activity, 'work');
assert.equal(b.a2.activity, 'queue');
const stopped = agents.map((a, i) => (i === 0 ? { ...a, running: 0 } : a));
b = plan(stopped, L, b, 1005);
assert.equal(b.a0.activity, 'relax');
assert.ok(b.a0.holdUntil > 1005);
assert.ok(b.a0.holdUntil - 1005 >= 300, 'long post-work hold');
for (let t = 1010; t < 1005 + 300; t += 10) {
  b = plan(stopped, L, b, t);
  assert.equal(b.a0.spot.zone, 'desk', 'stays at desk during hold');
}
b = plan(stopped, L, b, 1400);
assert.notEqual(b.a0.activity, 'relax');
assert.equal(b.a0.spot.zone, 'desk', 'still no leaving soon after hold');
let left = false;
for (let t = 1400; t < 1400 + 3600 && !left; t += 120) {
  b = plan(stopped, L, b, t);
  if (b.a0.spot.zone !== 'desk') left = true;
}
assert.ok(left, 'idle agent leaves eventually');
const offline = agents.map((a, i) => (i === 3 ? { ...a, runtime_online: false } : a));
for (const seed of [null, b]) {
  const o = plan(offline, L, seed, 2000);
  assert.equal(o.a3.activity, 'offline');
  assert.equal(o.a3.spot.zone, 'desk', 'offline runtime stays at desk');
}
b = plan(offline, L, null, 2000);
b = plan(agents, L, b, 2010);
assert.notEqual(b.a3.activity, 'offline', 'back on when runtime returns');
const busy = plan(agents, L, null, 3000);
assert.equal(busy.a0.overload, false);
const ov = agents.map((a, i) => (i === 0 ? { ...a, pending_total: 2 } : a));
assert.equal(plan(ov, L, null, 3000).a0.overload, true, 'pending while working = overload');

assert.deepEqual(wrapName('Technical Lead - Tanto'), ['Technical', 'Lead - Tanto']);
assert.deepEqual(wrapName('Nova'), ['Nova']);
for (const n of ['Backend Developer Senior Lead - Andromeda', 'A B C D E F G H I J K L M N O P']) {
  const w = wrapName(n);
  assert.ok(w.length <= 2 && w.every((l) => l.length <= 12), n);
}
console.log('office.check ok');
