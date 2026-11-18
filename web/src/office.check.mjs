// Self-check for 2D Office helpers: `node src/office.check.mjs`
import assert from 'node:assert/strict';
import { CELL_H, CELL_W, M, deskSpot, indoorSpots, layout, outdoorSpots, plan, routeFor, sky, tzClock, wrapName } from './office.js';

const t = Date.UTC(2026, 10, 18, 5, 0, 0);
assert.equal(tzClock(t, 'Asia/Jakarta').h, 12);
assert.equal(tzClock(t, 'Not/AZone').h, 12);
assert.equal(sky(12).day, 1);
assert.equal(sky(0).day, 0);

const L = layout(8);
assert.equal(L.desks.length, 8);
assert.ok(L.VW / L.VH > 1.7, 'contain aspect');

const agents = Array.from({ length: 8 }, (_, i) => ({
  agent_id: 'a' + i, runtime_online: true, running: i < 2 ? 1 : 0, pending_total: i === 2 ? 3 : 0,
}));
const indoors = indoorSpots(L), outdoors = outdoorSpots(L);
assert.equal(new Set([...indoors, ...outdoors].map((s) => s.key)).size, indoors.length + outdoors.length);
const seats = agents.map((a, i) => deskSpot(a, i, L));
const starts = [...seats, ...indoors, ...outdoors];
for (const from of starts) {
  for (const to of starts) {
    if (from === to) continue;
    const r = routeFor(from, to, L);
    assert.ok(r.length >= 2, `${from.key} -> ${to.key}`);
    assert.deepEqual([r[0].x, r[0].y], [from.x, from.y]);
    assert.deepEqual([r[r.length - 1].x, r[r.length - 1].y], [to.x, to.y]);
    const crosses = r.some((p) => p.x > M + L.W + 4 && from.zone !== 'outside' && to.zone !== 'outside');
    assert.ok(!crosses, `inside-only route crossed wall: ${from.key} -> ${to.key}`);
    if (from.zone === 'outside' || to.zone === 'outside') {
      const door = { x: M + L.W, y: M + L.doorY };
      assert.ok(r.some((p) => Math.abs(p.x - door.x) < 12 && Math.abs(p.y - door.y) < 2), 'route passes door');
    }
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1], b = r[i];
      if (a.y !== b.y) continue;
      const y = a.y, x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
      const deskRows = L.desks.filter((d) => {
        const y0 = M + d.y, y1 = y0 + 57;
        return y > y0 + 4 && y < y1;
      });
      for (const d of deskRows) {
        const x0 = M + d.x + 2, x1d = M + d.x + CELL_W;
        const own = from.zone === 'desk' && from.i === L.desks.indexOf(d);
        assert.ok(own || x2 <= x0 || x1 >= x1d, `route crossed a foreign desk: ${from.key} -> ${to.key}`);
      }
    }
  }
}

let b = plan(agents, L, null, 1000);
assert.equal(b.a0.activity, 'work');
assert.equal(b.a2.activity, 'queue');
const working = b.a0.wasWorking;
assert.ok(working);
const stopped = agents.map((a, i) => (i === 0 ? { ...a, running: 0 } : a));
b = plan(stopped, L, b, 1005);
assert.equal(b.a0.activity, 'relax', 'stay at desk after work');
assert.ok(b.a0.holdUntil > 1005);
b = plan(stopped, L, b, 1070);
assert.notEqual(b.a0.activity, 'relax', 'relax ends after hold expires');
assert.ok(b.a0.holdUntil < 1070);
const away = Object.values(b).filter((x) => x.spot.zone !== 'desk');
assert.ok(away.length > 0, 'some idle agents roam after hold');
const offline = agents.map((a, i) => (i === 3 ? { ...a, runtime_online: false } : a));
b = plan(offline, L, null, 2000);
assert.equal(b.a3.activity, 'away');

assert.deepEqual(wrapName('Technical Lead - Tanto'), ['Technical Lead', 'Tanto']);
assert.deepEqual(wrapName('Nova'), ['Nova']);
assert.deepEqual(wrapName('Supercalifragilisticexpialidocious'), ['Supercalifragili…']);
for (const n of ['Backend Developer Senior Lead - Andromeda', 'A B C D E F G H I J K L M N O P']) {
  const w = wrapName(n);
  assert.ok(w.length <= 2 && w.every((l) => l.length <= 17), n);
}
console.log('office.check ok');
