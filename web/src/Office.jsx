import { useEffect, useState } from 'react';
import { statusOf } from './fmt.js';
import { LOUNGE_W, WALL_H, layout, look, loungeSpots, plan, sky, tzClock } from './office.js';

const R = (x, y, w, h, fill, { key, ...rest } = {}) => <rect key={key} x={x} y={y} width={w} height={h} fill={fill} {...rest} />;

function screenOf(a) {
  if (!a.runtime_online) return 'off';
  if (a.running > 0) return 'work';
  if ((a.pending_total || 0) > 0) return 'queue';
  if (String(a.last_status || '').toLowerCase() === 'failed') return 'err';
  return 'idle';
}
const SCREEN = { off: '#0c0e12', idle: '#1d3b5c', work: '#2f8f5b', queue: '#a77a1c', err: '#a3302c' };

function Person({ lk, pose }) {
  const { skin, hair, shirt, pants } = lk;
  const shadow = R(-5, -1, 10, 2, 'rgba(0,0,0,.28)');
  if (pose === 'desk') {
    return (<>
      {shadow}
      {R(-5, -15, 10, 9, shirt)}
      <g className="arm a1">{R(-7, -17, 2, 6, shirt)}{R(-7, -19, 2, 2, skin)}</g>
      <g className="arm a2">{R(5, -17, 2, 6, shirt)}{R(5, -19, 2, 2, skin)}</g>
      {R(-4, -23, 8, 8, hair)}{R(-5, -20, 1, 2, skin)}{R(4, -20, 1, 2, skin)}
      {R(-6, -8, 12, 5, '#33363f')}{R(-6, -8, 12, 1, '#4a4f5c')}
    </>);
  }
  const sit = pose === 'sit';
  return (<>
    {shadow}
    {sit ? (<>{R(-4, -7, 8, 3, pants)}{R(-4, -4, 3, 3, pants)}{R(1, -4, 3, 3, pants)}{R(-4, -1, 3, 1, '#1b1b1f')}{R(1, -1, 3, 1, '#1b1b1f')}</>)
      : (<>
        <g className="leg l1">{R(-4, -7, 3, 6, pants)}{R(-4, -1, 3, 1, '#1b1b1f')}</g>
        <g className="leg l2">{R(1, -7, 3, 6, pants)}{R(1, -1, 3, 1, '#1b1b1f')}</g>
      </>)}
    <g className="torso">
      {R(-5, -15, 10, 9, shirt)}{R(-7, -14, 2, 7, shirt)}{R(5, -14, 2, 7, shirt)}
      {R(-7, -8, 2, 2, skin)}{R(5, -8, 2, 2, skin)}
      {pose === 'cup' && <>{R(6, -11, 3, 3, '#f1f1f1')}{R(9, -10, 1, 2, '#f1f1f1')}{R(6, -11, 3, 1, '#6b3e1f')}</>}
      {R(-4, -23, 8, 8, skin)}{R(-4, -24, 8, 3, hair)}{R(-5, -23, 1, 4, hair)}{R(4, -23, 1, 4, hair)}
      {R(-2, -19, 1, 2, '#1b1b1f')}{R(1, -19, 1, 2, '#1b1b1f')}
    </g>
  </>);
}

// Walks in a straight line to its target; transition length scales with distance.
function Actor({ a, p, onAgent }) {
  const [cur, setCur] = useState({ x: p.x, y: p.y, ms: 0, walking: false });
  if (cur.x !== p.x || cur.y !== p.y) {
    const ms = Math.min(7000, Math.max(900, Math.hypot(p.x - cur.x, p.y - cur.y) * 45));
    setCur({ x: p.x, y: p.y, ms, walking: true });
  }
  useEffect(() => {
    if (!cur.walking) return undefined;
    const t = setTimeout(() => setCur((c) => ({ ...c, walking: false })), cur.ms);
    return () => clearTimeout(t);
  }, [cur]);
  const pose = cur.walking ? 'walk' : p.pose;
  const st = statusOf(a);
  const working = pose === 'desk' && a.running > 0;
  return (
    <g className={`actor${cur.walking ? ' walking' : ''}${working ? ' typing' : ''}`}
      style={{ transform: `translate(${cur.x}px, ${cur.y}px)`, transitionDuration: `${cur.ms}ms` }}
      onClick={() => onAgent(a.agent_id)} aria-hidden="true">
      <title>{`${a.agent_name} — ${st.label}`}</title>
      <Person lk={look(a.agent_id)} pose={pose} />
      {pose !== 'desk' && (
        <text className="olabel" y={-28} textAnchor="middle">{a.agent_name.slice(0, 10)}</text>)}
    </g>
  );
}

function Desk({ a, d, onAgent }) {
  const scr = screenOf(a);
  const lk = look(a.agent_id);
  const st = statusOf(a);
  const label = `${a.agent_name}, ${st.label}${a.current?.kind_label ? ', ' + a.current.kind_label : ''}. Activate for details.`;
  const open = () => onAgent(a.agent_id);
  return (
    <g className="desk" role="button" tabIndex={0} aria-label={label} onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      transform={`translate(${d.x} ${d.y})`}>
      <title>{label.replace('. Activate for details.', '')}</title>
      {R(2, 0, 44, 52, 'transparent', { className: 'hit' })}
      {R(4, 12, 40, 16, '#a8794a')}{R(4, 12, 40, 1, '#c4935e')}{R(4, 28, 40, 3, '#7a5432')}
      {R(6, 31, 2, 4, '#5e3f24')}{R(40, 31, 2, 4, '#5e3f24')}
      {R(14, 1, 20, 13, '#2b2f38')}{R(22, 14, 4, 2, '#2b2f38')}{R(19, 15, 10, 1, '#2b2f38')}
      {R(33, 12, 1, 1, scr === 'off' ? '#3a1d1d' : '#4ae37d')}
      {R(17, 20, 14, 4, '#d9dce3')}{R(17, 23, 14, 1, '#9aa0ab')}
      {R(33, 21, 3, 3, '#e6e6e6')}
      {lk.deco === 0 && <>{R(7, 14, 5, 5, '#3f8a3a')}{R(8, 18, 3, 3, '#a0522d')}</>}
      {lk.deco === 1 && <>{R(7, 15, 6, 4, '#f4f1de')}{R(8, 16, 4, 1, '#c9c3a8')}</>}
      {lk.deco === 2 && <>{R(38, 14, 4, 4, '#e07a5f')}{R(39, 15, 2, 1, '#fff')}</>}
      {lk.deco === 3 && <>{R(37, 14, 2, 6, '#1e1e1e')}{R(36, 13, 4, 2, '#f2c14e')}</>}
      {R(17, 33, 14, 9, '#3b3f4a')}{R(17, 33, 14, 1, '#555b69')}{R(23, 42, 2, 3, '#2a2c33')}
      <text className="plate" x={24} y={53} textAnchor="middle">{a.agent_name.slice(0, 9)}</text>
    </g>
  );
}

function Screen({ a, d }) {
  const scr = screenOf(a);
  const x = d.x + 15, y = d.y + 2;
  return (
    <g className={`scr s-${scr}`}>
      {scr !== 'off' && R(d.x + 8, d.y + 12, 32, 10, SCREEN[scr], { opacity: 0.22 })}
      {R(x, y, 18, 11, SCREEN[scr])}
      {scr === 'work' && <g className="code">
        {R(x + 2, y + 2, 9, 1, '#b8ffd1')}{R(x + 4, y + 4, 11, 1, '#e3fff0')}
        {R(x + 4, y + 6, 6, 1, '#b8ffd1')}{R(x + 2, y + 8, 12, 1, '#e3fff0')}
      </g>}
      {scr === 'queue' && <g className="blink">{R(x + 7, y + 2, 4, 1, '#ffe7a8')}{R(x + 8, y + 3, 2, 5, '#ffe7a8')}{R(x + 7, y + 8, 4, 1, '#ffe7a8')}</g>}
      {scr === 'err' && <g className="blink">{R(x + 8, y + 2, 2, 5, '#ffd5d0')}{R(x + 8, y + 8, 2, 1, '#ffd5d0')}</g>}
      {scr === 'idle' && <g className="saver">{R(x + 3, y + 3, 3, 3, '#6fb3ff')}</g>}
      {scr === 'off' && R(x + 1, y + 1, 4, 1, '#1d2129')}
    </g>
  );
}

function Plaque({ cx, name, logo }) {
  const [bad, setBad] = useState(false);
  const showLogo = logo && !bad;
  const w = 124;
  const x = cx - w / 2;
  const long = name.length > (showLogo ? 7 : 10);
  return (
    <g className="plaque">
      {R(x, 6, w, 30, '#3a2a1c')}{R(x + 2, 8, w - 4, 26, '#20160f')}
      {R(x + 2, 8, w - 4, 1, '#d4a84f')}{R(x + 2, 33, w - 4, 1, '#d4a84f')}
      {showLogo && <image href={logo} x={x + 6} y={10} width={22} height={22} preserveAspectRatio="xMidYMid meet"
        onError={() => setBad(true)} style={{ imageRendering: 'auto' }} />}
      <text className="wsname" x={showLogo ? x + 32 + (w - 38) / 2 : cx} y={27} textAnchor="middle"
        textLength={long ? (showLogo ? w - 40 : w - 12) : undefined} lengthAdjust="spacingAndGlyphs">{name}</text>
    </g>
  );
}

function WallClock({ x, c }) {
  const hr = ((c.h % 12) + c.m / 60) * 30, mn = (c.m + c.s / 60) * 6, sc = c.s * 6;
  const hand = (deg, len, col, wd) => (
    <line x1={x} y1={22} x2={x + Math.sin(deg * Math.PI / 180) * len} y2={22 - Math.cos(deg * Math.PI / 180) * len}
      stroke={col} strokeWidth={wd} strokeLinecap="square" shapeRendering="auto" />);
  return (
    <g className="wclock">
      <circle cx={x} cy={22} r={14} fill="#2b2f38" /><circle cx={x} cy={22} r={12} fill="#f4f1e8" />
      {[0, 3, 6, 9].map((k) => R(x - 1 + Math.sin(k * Math.PI / 6) * 10, 21 - Math.cos(k * Math.PI / 6) * 10, 2, 2, '#2b2f38', { key: k }))}
      {hand(hr, 6, '#2b2f38', 2)}{hand(mn, 9, '#2b2f38', 1.4)}{hand(sc, 10, '#d9483b', 0.7)}
      <circle cx={x} cy={22} r={1.4} fill="#d9483b" />
    </g>
  );
}

function Plant({ x, y, big }) {
  const s = big ? 1.4 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {R(-4, -4, 8, 6, '#b5653a')}{R(-4, -4, 8, 1, '#d17a49')}
      {R(-5, -12, 4, 8, '#2f7d3b')}{R(1, -13, 4, 9, '#3d9a49')}{R(-2, -16, 4, 12, '#4fb35a')}
    </g>
  );
}

const M = 30;

function Tree({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {R(-6, 5, 12, 3, 'rgba(0,0,0,.22)')}{R(-1, 2, 3, 5, '#6b4a2b')}
      {R(-7, -6, 14, 9, '#2f6b2f')}{R(-5, -9, 10, 3, '#3a7f38')}{R(-4, -6, 6, 4, '#4f9a44')}{R(-2, -8, 3, 2, '#5fb352')}
    </g>
  );
}

function Lamp({ x, y }) {
  return <g>{R(x - 1, y - 9, 2, 9, '#3b3f4a')}{R(x - 2, y - 12, 4, 3, '#2b2f38')}{R(x - 1, y - 11, 2, 2, '#ffe08a')}{R(x - 2, y, 4, 1, '#2b2f38')}</g>;
}

// Outdoor garden around the building, bounded by a perimeter wall with a gate at the bottom.
function Yard({ OW, OH, W, H, k }) {
  const gx = M + W / 2;
  const trees = [];
  for (let x = 16; x < OW - 10; x += 34) trees.push([x, 16], [x + 17, OH - 15]);
  for (let y = 54; y < OH - 40; y += 40) trees.push([15, y], [OW - 15, y + 20]);
  const kept = trees.filter(([x, y]) => !(y > OH - 30 && Math.abs(x - gx) < 22));
  const lamps = [[gx - 12, OH - 10], [gx + 12, OH - 10], [M - 6, M - 6], [M + W + 6, M - 6], [M - 6, M + H + 6], [M + W + 6, M + H + 6]];
  const night = 1 - k.day;
  return (
    <>
      {R(0, 0, OW, OH, 'url(#oGrass)')}
      {R(gx - 7, M + H, 14, OH - M - H, '#c9b48f')}
      {Array.from({ length: Math.ceil((OH - M - H) / 6) }, (_, i) => R(gx - 5 + (i % 2) * 2, M + H + 2 + i * 6, 8, 3, '#b39b72', { key: i }))}
      {kept.map(([x, y], i) => <Tree key={i} x={x} y={y} />)}
      {[[M - 12, M + 40, '#f2c14e'], [M + W + 12, M + 80, '#e07a5f'], [gx - 24, OH - 20, '#d17ad1'], [gx + 26, OH - 22, '#f4f1de']].map(([x, y, col], i) =>
        <g key={i}>{R(x - 3, y - 2, 6, 5, '#3a7f38')}{R(x - 1, y - 1, 2, 2, col)}{R(x + 1, y + 1, 2, 2, col)}</g>)}
      <path d={`M0 0H${OW}V${OH}H0Z M6 6H${OW - 6}V${OH - 6}H6Z`} fill="#9c5a3c" fillRule="evenodd" />
      {R(0, 0, OW, 2, '#b8714f')}{R(gx - 9, OH - 6, 18, 6, 'url(#oGrass)')}{R(gx - 7, OH - 6, 14, 6, '#c9b48f')}
      {R(gx - 11, OH - 8, 2, 8, '#6a3a24')}{R(gx + 9, OH - 8, 2, 8, '#6a3a24')}
      <path d={`M0 0H${OW}V${OH}H0Z M${M} ${M}h${W}v${H}h-${W}Z`} fill="#0a1030" fillRule="evenodd" opacity={night * 0.55} pointerEvents="none" />
      {lamps.map(([x, y], i) => <Lamp key={i} x={x} y={y} />)}
      {night > 0.3 && lamps.map(([x, y], i) =>
        <circle key={'g' + i} cx={x} cy={y - 8} r={16} fill="#ffd98a" opacity={night * 0.28} shapeRendering="auto" pointerEvents="none" />)}
    </>
  );
}

export default function Office({ snap, now, onAgent, tz }) {
  const agents = [...(snap.multica.agents || [])].sort((x, y) =>
    String(x.agent_name).localeCompare(String(y.agent_name)) || String(x.agent_id).localeCompare(String(y.agent_id)));
  const L = layout(agents.length);
  const { W, H, lx, desks } = L;
  const t = WALL_H;
  const spots = loungeSpots(lx, H);
  const pos = plan(agents, desks, spots, Math.floor(now / 1000));
  const c = tzClock(now, tz);
  const k = sky(c.hours);
  const name = snap.meta?.workspace && snap.meta.workspace !== '?' ? snap.meta.workspace : (snap.meta?.company || 'Office');
  const deskW = lx - 16;
  const plaqueCx = Math.max(64, deskW / 2);
  const wins = [];
  for (let x = 8; x + 30 <= deskW; x += 52) {
    if (x + 30 > plaqueCx - 66 && x < plaqueCx + 66) continue;
    wins.push(x);
  }
  wins.push(lx + 4, lx + LOUNGE_W - 34);
  const wallPath = `M0 0H${W}V${t}H0Z` + wins.map((x) => `M${x} 8h30v26h-30Z`).join('');
  const shift = (k.sunX - 0.5) * -70;
  const counts = { working: 0, queued: 0, idle: 0, offline: 0 };
  agents.forEach((a) => { counts[statusOf(a).group] += 1; });
  const order = [...agents].sort((p, q) => (pos[p.agent_id]?.y || 0) - (pos[q.agent_id]?.y || 0));

  return (
    <div className="office">
      <h2><i className="ph ph-buildings"></i> <span className="small">
        {agents.length} agents · {counts.working} working · {counts.queued} queued · {counts.idle} idle · {counts.offline} offline</span>
        <span className="oclock mono" title={`Office time (${tz || 'Asia/Jakarta'})`}>
          {String(c.h).padStart(2, '0')}:{String(c.m).padStart(2, '0')}:{String(c.s).padStart(2, '0')} {c.zone} · {c.date}</span>
      </h2>
      <svg viewBox={`0 0 ${W + 2 * M} ${H + 2 * M}`} shapeRendering="crispEdges" role="group"
        aria-label={`2D office of ${name}: ${agents.length} desks`}>
        <defs>
          <linearGradient id="oSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={k.top} /><stop offset="1" stopColor={k.bottom} />
          </linearGradient>
          <pattern id="oWood" width="16" height="8" patternUnits="userSpaceOnUse">
            {R(0, 0, 16, 8, '#8a6a4c')}{R(0, 0, 16, 1, '#7d5f43')}{R(9, 0, 1, 8, '#7d5f43')}{R(0, 4, 16, 1, '#93724f')}
          </pattern>
          <pattern id="oTile" width="12" height="12" patternUnits="userSpaceOnUse">
            {R(0, 0, 12, 12, '#d9dde2')}{R(0, 0, 6, 6, '#c8cdd4')}{R(6, 6, 6, 6, '#c8cdd4')}
          </pattern>
          <pattern id="oGrass" width="10" height="10" patternUnits="userSpaceOnUse">
            {R(0, 0, 10, 10, '#5a9c45')}{R(2, 3, 1, 2, '#6fb655')}{R(7, 7, 1, 2, '#4b8a3a')}{R(5, 1, 1, 1, '#79c25e')}
          </pattern>
          <pattern id="oRug" width="6" height="6" patternUnits="userSpaceOnUse">
            {R(0, 0, 6, 6, '#7c4f86')}{R(0, 0, 3, 3, '#8a5c94')}
          </pattern>
        </defs>

        <Yard OW={W + 2 * M} OH={H + 2 * M} W={W} H={H} k={k} />
        {R(M - 3, M - 3, W + 6, H + 6, '#5c4a39')}
        <g transform={`translate(${M} ${M})`}>
        {R(0, 0, W, H, 'url(#oWood)')}
        {R(lx - 6, t, LOUNGE_W + 12, 74, 'url(#oTile)')}
        {R(lx - 6, t + 150, LOUNGE_W + 12, H - t - 150, 'url(#oGrass)')}

        {R(0, 6, W, 30, 'url(#oSky)')}
        {Array.from({ length: 14 }, (_, i) => R((i * 53) % W, 9 + ((i * 7) % 20), 1, 1, '#fff', { key: i, opacity: (1 - k.day) * 0.9 }))}
        {k.alt > -0.1 && R(k.sunX * W - 4, 30 - Math.max(0, k.alt) * 20, 8, 8, '#ffd34d')}
        {k.alt < 0.1 && R(k.moonX * W - 3, 30 - Math.max(0, -k.alt) * 20, 6, 6, '#eef0ff')}
        <g className="clouds" opacity={0.25 + k.day * 0.6}>
          {R(20, 14, 18, 4, '#fff')}{R(24, 11, 10, 3, '#fff')}{R(W * 0.55, 20, 22, 4, '#fff')}{R(W * 0.55 + 5, 17, 11, 3, '#fff')}
        </g>
        <path d={wallPath} fill="#cfc3b0" fillRule="evenodd" />
        {R(0, 0, W, 4, '#b6a993')}{R(0, t - 4, W, 4, '#6a5a48')}
        {wins.map((x) => (<g key={x}>
          <rect x={x} y={8} width={30} height={26} fill="none" stroke="#f3eee4" strokeWidth={2} />
          {R(x + 14, 8, 2, 26, '#f3eee4')}{R(x - 2, 34, 34, 2, '#e6dfd1')}
        </g>))}
        <Plaque key={snap.meta?.office_logo || ''} cx={plaqueCx} name={name} logo={snap.meta?.office_logo || ''} />
        <WallClock x={lx + 64} c={c} />

        <g opacity={k.day * 0.22}>
          {wins.map((x) => <polygon key={x} points={`${x},${t} ${x + 30},${t} ${x + 30 + shift},${t + 44} ${x + shift},${t + 44}`} fill="#fff1b8" />)}
        </g>

        {R(lx - 8, t, 3, H - t, '#5c4a39')}
        <Plant x={lx - 7} y={t + 66} />
        <Plant x={lx - 7} y={t + 146} />
        <Plant x={10} y={H - 6} big />

        {R(lx + 4, t + 2, 76, 16, '#e9e4da')}{R(lx + 4, t + 18, 76, 4, '#9c8b74')}
        {R(lx + 8, t + 3, 10, 10, '#2e2e33')}{R(lx + 10, t + 5, 6, 2, '#d0463a')}
        {R(lx + 26, t + 5, 12, 6, '#bfc6cf')}{R(lx + 50, t + 4, 5, 6, '#f2f2f2')}{R(lx + 58, t + 4, 5, 6, '#e07a5f')}
        {R(lx + 86, t, 18, 30, '#e1e5ea')}{R(lx + 86, t + 12, 18, 1, '#a9b0ba')}{R(lx + 101, t + 4, 1, 6, '#8a929e')}
        {R(lx + 112, t + 4, 10, 24, '#d6e3f0')}{R(lx + 113, t + 5, 8, 8, '#7fb6e6')}
        <text className="zone" x={lx + 64} y={t + 70} textAnchor="middle">PANTRY</text>

        {R(lx + 12, t + 78, 84, 46, 'url(#oRug)')}
        {R(lx + 18, t + 82, 70, 8, '#3c6e8f')}{R(lx + 18, t + 90, 70, 14, '#4a85ab')}
        {R(lx + 14, t + 84, 6, 22, '#356381')}{R(lx + 86, t + 84, 6, 22, '#356381')}
        {R(lx + 34, t + 110, 38, 10, '#7a5432')}{R(lx + 34, t + 110, 38, 1, '#a8794a')}{R(lx + 48, t + 112, 6, 4, '#f2f2f2')}
        {R(lx + 100, t + 106, 18, 18, '#b0603c')}{R(lx + 100, t + 106, 18, 5, '#8f4a2c')}
        <Plant x={lx + 118} y={t + 92} />
        <text className="zone" x={lx + 64} y={t + 142} textAnchor="middle">LOUNGE</text>

        {R(lx + 8, t + 156, 22, 22, '#2f6b2f')}{R(lx + 4, t + 162, 30, 12, '#3a7f38')}{R(lx + 12, t + 152, 14, 6, '#4f9a44')}
        {R(lx + 17, t + 178, 4, 8, '#6b4a2b')}
        {R(lx + 50, t + 162, 32, 3, '#8b5a33')}{R(lx + 50, t + 166, 32, 6, '#a86d3e')}{R(lx + 52, t + 172, 2, 4, '#5e3f24')}{R(lx + 78, t + 172, 2, 4, '#5e3f24')}
        {R(lx + 92, t + 182, 26, 14, '#4f8fc0')}{R(lx + 94, t + 184, 22, 10, '#6aaee0')}
        {[[lx + 40, t + 190, '#f2c14e'], [lx + 110, t + 160, '#e07a5f'], [lx + 30, H - 8, '#f4f1de'], [lx + 118, H - 10, '#d17ad1']].map(([x, y, col], i) =>
          <g key={i}>{R(x, y, 2, 2, col)}{R(x - 2, y, 2, 2, col)}{R(x, y - 2, 2, 2, col)}{R(x - 1, y + 2, 1, 2, '#2f6b2f')}</g>)}
        <text className="zone" x={lx + 64} y={t + 216} textAnchor="middle">GARDEN</text>

        {agents.map((a, i) => <Desk key={a.agent_id} a={a} d={desks[i]} onAgent={onAgent} />)}
        {order.map((a) => <Actor key={a.agent_id} a={a} p={pos[a.agent_id]} onAgent={onAgent} />)}

        <g pointerEvents="none">
          {agents.map((a, i) => <Screen key={a.agent_id} a={a} d={desks[i]} />)}
        </g>
        </g>
      </svg>
    </div>
  );
}
