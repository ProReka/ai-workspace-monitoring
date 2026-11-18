// Self-check for 2D Office helpers: `node src/office.check.mjs`
import assert from 'node:assert/strict';
import { layout, loungeSpots, plan, sky, tzClock } from './office.js';

const t = Date.UTC(2026, 10, 18, 5, 0, 0);
assert.equal(tzClock(t, 'Asia/Jakarta').h, 12);
assert.equal(tzClock(t, 'Not/AZone').h, 12);
assert.ok(sky(12).day === 1 && !sky(12).lamps);
assert.ok(sky(0).day === 0 && sky(0).lamps);

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
console.log('office.check ok');
