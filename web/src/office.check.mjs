// Self-check for 2D Office helpers: `node src/office.check.mjs`
import assert from 'node:assert/strict';
import { layout, loungeSpots, plan, sky, tzClock, wrapName } from './office.js';

const t = Date.UTC(2026, 10, 18, 5, 0, 0);
assert.equal(tzClock(t, 'Asia/Jakarta').h, 12);
assert.equal(tzClock(t, 'Not/AZone').h, 12);
assert.equal(sky(12).day, 1);
assert.equal(sky(0).day, 0);

const agents = Array.from({ length: 10 }, (_, i) => ({
  agent_id: 'a' + i, runtime_online: i < 6, running: i < 2 ? 1 : 0, pending_total: i === 2 ? 1 : 0,
}));
const L = layout(agents.length);
assert.equal(L.desks.length, 10);
const spots = loungeSpots(L.lx, L.H);
for (const now of [0, 75, 1e6]) {
  const p = plan(agents, L.desks, spots, now);
  for (const i of [0, 1, 2]) assert.equal(p['a' + i].pose, 'desk');
  for (const i of [3, 6, 9]) assert.notEqual(p['a' + i].pose, 'desk');
  const lounge = Object.values(p).filter((x) => x.pose !== 'desk' && x.x >= L.lx);
  assert.equal(new Set(lounge.map((x) => x.x + ',' + x.y)).size, lounge.length);
  assert.deepEqual(plan(agents, L.desks, spots, now), p);
}
assert.deepEqual(wrapName('Technical Lead - Tanto'), ['Technical Lead', 'Tanto']);
assert.deepEqual(wrapName('Nova'), ['Nova']);
assert.deepEqual(wrapName('Supercalifragilisticexpialidocious'), ['Supercalifragilis…']);
for (const n of ['Backend Developer Senior Lead - Andromeda', 'A B C D E F G H I J K L M N O P']) {
  const w = wrapName(n);
  assert.ok(w.length <= 2 && w.every((l) => l.length <= 18), n);
}
console.log('office.check ok');
