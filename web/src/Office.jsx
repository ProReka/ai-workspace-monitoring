import { useEffect, useRef, useState } from 'react';
import { statusOf } from './fmt.js';
import { WALL_H, hash, layout, legMs, look, plan, sky, tzClock, wrapName } from './office.js';

const R = (x, y, w, h, fill, { key, ...rest } = {}) => <rect key={key} x={x} y={y} width={w} height={h} fill={fill} {...rest} />;
const pointKey = (p) => Math.round(p.x) + ',' + Math.round(p.y);
const routeKey = (r) => r.map(pointKey).join(' ');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MIN_K = 0.4;
const MAX_K = 8;

function Person({ lk, pose, activity, dim }) {
  const { skin, hair, shirt, pants } = lk;
  const rest = activity !== 'work';
  const sit = pose === 'sit' || pose === 'cup';
  const shade = 'rgba(0,0,0,.3)';
  if (pose === 'desk') {
    return (
      <g transform="scale(.82)" opacity={dim ? 0.72 : 1}>
        {R(-7, -1, 14, 2, 'rgba(0,0,0,.32)')}
        {R(-6, -11, 12, 5, pants)}{R(-6, -11, 12, 1, 'rgba(255,255,255,.12)')}
        <g className="torso">
          {R(-7, -21, 14, 14, shade)}{R(-6, -20, 12, 12, shirt)}
          {R(-5, -19, 10, 1, 'rgba(255,255,255,.28)')}{R(0, -18, 1, 9, shade)}
          <g className={rest ? undefined : 'arm a1'}>{R(-9, -27, 4, 10, shirt)}{R(-9, -29, 4, 3, skin)}{R(-9, -27, 4, 1, shade)}</g>
          <g className={rest ? undefined : 'arm a2'}>{R(5, -27, 4, 10, shirt)}{R(5, -29, 4, 3, skin)}{R(5, -27, 4, 1, shade)}</g>
          {R(-2, -21, 4, 3, skin)}
          {R(-6, -31, 12, 12, shade)}{R(-5, -31, 10, 11, hair)}
          {R(-4, -30, 8, 7, 'rgba(255,255,255,.1)')}{R(-3, -29, 3, 1, 'rgba(255,255,255,.22)')}
          {R(-6, -27, 1, 3, skin)}{R(5, -27, 1, 3, skin)}
          {lk.deco === 1 && R(-3, -23, 6, 2, '#e2b04a')}
        </g>
      </g>
    );
  }
  const head = (<g>
    {R(-6, -30, 12, 12, shade)}{R(-4, -28, 1, 3, hair)}{R(4, -28, 1, 3, hair)}
    {R(-5, -29, 10, 10, skin)}{R(-5, -30, 10, 4, hair)}{R(-6, -29, 2, 6, hair)}{R(4, -29, 2, 4, hair)}
    {R(-3, -24, 2, 2, '#20232b')}{R(1, -24, 2, 2, '#20232b')}{R(-1, -20, 2, 1, 'rgba(0,0,0,.5)')}
    {lk.deco === 0 && <>{R(-5, -26, 10, 1, '#2b2f38')}{R(-5, -26, 2, 1, '#2b2f38')}{R(3, -26, 2, 1, '#2b2f38')}</>}
    {lk.deco === 1 && R(5, -28, 2, 3, '#e2b04a')}
  </g>);
  const legs = sit ? (<g>
    {R(-6, -11, 12, 5, pants)}{R(-6, -11, 12, 1, 'rgba(255,255,255,.14)')}
    {R(-5, -7, 3, 6, pants)}{R(2, -7, 3, 6, pants)}
    {R(-6, -2, 4, 2, '#1b1b1f')}{R(2, -2, 4, 2, '#1b1b1f')}
  </g>) : (<g className="legs">
    <g className="leg l1">{R(-4, -11, 3, 10, pants)}{R(-5, -2, 4, 2, '#1b1b1f')}</g>
    <g className="leg l2">{R(1, -11, 3, 10, pants)}{R(1, -2, 4, 2, '#1b1b1f')}</g>
  </g>);
  return (
    <g transform="scale(.82)" opacity={dim ? 0.72 : 1}>
      {R(-7, -1, 14, 2, 'rgba(0,0,0,.3)')}
      {legs}
      <g className="torso">
        {R(-7, -21, 14, 13, shade)}{R(-6, -20, 12, 11, shirt)}
        {R(-5, -20, 10, 1, 'rgba(255,255,255,.28)')}{R(-2, -20, 4, 2, 'rgba(255,255,255,.32)')}
        {R(0, -18, 1, 7, shade)}
        <g>{R(-8, -18, 3, 8, shirt)}{R(-8, -11, 3, 4, skin)}{R(-8, -11, 3, 1, shade)}</g>
        {pose === 'cup' ? (<g>
          {R(5, -18, 3, 5, shirt)}{R(6, -15, 4, 4, shirt)}{R(7, -13, 3, 3, skin)}
          {R(6, -16, 4, 4, '#f4f1e8')}{R(6, -16, 4, 1, '#6b3e1f')}{R(10, -15, 1, 2, '#f4f1e8')}
        </g>) : (<g>{R(5, -18, 3, 8, shirt)}{R(5, -11, 3, 4, skin)}{R(5, -11, 3, 1, shade)}</g>)}
        {lk.deco === 2 && R(-4, -17, 3, 4, '#e7e2d3')}
        {head}
      </g>
    </g>
  );
}


function Actor({ a, b, route, onAgent }) {
  const [pos, setPos] = useState(route[0] || b.spot);
  const [leg, setLeg] = useState(null);
  const posRef = useRef(pos);
  const last = useRef('');
  const key = routeKey(route);
  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => {
    if (key === last.current) return;
    last.current = key;
    if (route.length < 2) { setLeg(null); return; }
    const pts = [posRef.current, ...route.slice(1)];
    setLeg({ pts, i: 0, to: pts[1], ms: legMs(pts[0], pts[1]) });
  }, [key]);
  useEffect(() => {
    if (!leg) return undefined;
    const t = setTimeout(() => {
      setPos(leg.to);
      if (leg.i + 2 < leg.pts.length) {
        const i = leg.i + 1;
        setLeg({ pts: leg.pts, i, to: leg.pts[i + 1], ms: legMs(leg.pts[i], leg.pts[i + 1]) });
      } else setLeg(null);
    }, leg.ms);
    return () => clearTimeout(t);
  }, [leg]);
  const st = statusOf(a);
  const walking = !!leg;
  return (
    <g className={`actor${walking ? ' walking' : ''}${b.activity === 'work' && !walking ? ' typing' : ''}`}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, transitionDuration: `${leg ? leg.ms : 0}ms` }}
      onClick={() => onAgent(a.agent_id)} aria-hidden="true">
      <title>{`${a.agent_name} — ${st.label}`}</title>
      <Person lk={look(a.agent_id)} pose={walking ? 'walk' : b.spot.pose} activity={b.activity} dim={!a.runtime_online} />
      <text className="olabel" y={-30} textAnchor="middle">{a.agent_name}</text>
      {b.activity === 'work' && a.running > 1 && Array.from({ length: Math.min(2, a.running - 1) }, (_, i) =>
        <g key={i} className="taskwin" transform={`translate(${i ? 15 : -19} ${-40 - i * 4})`}>
          {R(0, 0, 14, 9, '#1d2b38')}{R(1, 1, 3, 1, '#4ade80')}{R(5, 1, 8, 1, '#a7f3d0')}{R(2, 4, 10, 1, '#86efac')}
        </g>)}
      {b.overload && <g className="overload" transform="translate(11 -34)">
        {R(0, 0, 8, 8, '#c53030')}{R(3, 1, 2, 4, '#fff')}{R(3, 6, 2, 1, '#fff')}
      </g>}
    </g>
  );
}

function screenOf(a, b) {
  if (!a.runtime_online) return 'off';
  if (b.activity === 'work') return 'work';
  if (b.activity === 'queue') return 'queue';
  if (String(a.last_status || '').toLowerCase() === 'failed') return 'err';
  return 'idle';
}
const SCREEN = { off: '#0c0e12', idle: '#1d3b5c', work: '#2f8f5b', queue: '#a77a1c', err: '#a3302c' };

function Screen({ a, b, d }) {
  const scr = screenOf(a, b);
  const x = d.x + 15, y = d.y + 2;
  const fun = b.activity === 'leisure' ? b.leisure : '';
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
      {fun === 'video' && <g className="fun">{R(x + 2, y + 2, 14, 7, '#2b3f7a')}{R(x + 7, y + 4, 4, 3, '#ffd166')}{R(x + 3, y + 8, 5, 1, '#8ab4f8')}</g>}
      {fun === 'book' && <g className="fun">{R(x + 2, y + 3, 6, 6, '#f6e7c1')}{R(x + 9, y + 3, 6, 6, '#f6e7c1')}{R(x + 8, y + 3, 1, 6, '#b08968')}</g>}
      {fun === 'game' && <g className="fun">{R(x + 3, y + 3, 12, 6, '#3b3f4a')}{R(x + 5, y + 5, 2, 2, '#4ade80')}{R(x + 11, y + 4, 1, 1, '#f87171')}{R(x + 9, y + 6, 1, 1, '#facc15')}</g>}
      {fun === 'music' && <g className="fun">{R(x + 2, y + 3, 10, 5, '#3b3f4a')}{R(x + 6, y + 4, 2, 3, '#ffd166')}{R(x + 3, y + 7, 4, 1, '#8ab4f8')}{R(x + 9, y + 6, 1, 1, '#f87171')}</g>}
      {scr === 'idle' && !fun && <g className="saver">{R(x + 3, y + 3, 3, 3, '#6fb3ff')}</g>}
      {scr === 'off' && R(x + 1, y + 1, 4, 1, '#1d2129')}
    </g>
  );
}

function Chair({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {R(11, 39, 4, 9, '#3f4550')}{R(33, 39, 4, 9, '#3f4550')}
      {R(12, 39, 3, 2, '#646d7a')}{R(33, 39, 3, 2, '#646d7a')}
      {R(13, 39, 22, 7, '#3f4550')}{R(14, 40, 20, 5, '#535c69')}{R(14, 40, 20, 1, '#707a88')}
      {R(14, 46, 20, 7, '#3f4550')}{R(15, 47, 18, 5, '#535c69')}{R(15, 47, 18, 1, '#707a88')}
      {R(22, 53, 4, 3, '#2f343d')}{R(17, 55, 14, 2, '#2f343d')}
      {R(17, 56, 2, 2, '#1d2129')}{R(29, 56, 2, 2, '#1d2129')}
    </g>
  );
}

function Desk({ a, b, d, onAgent }) {
  const scr = screenOf(a, b);
  const lk = look(a.agent_id);
  const st = statusOf(a);
  const label = `${a.agent_name}, ${st.label}${a.current?.kind_label ? ', ' + a.current.kind_label : ''}. Activate for details.`;
  const open = () => onAgent(a.agent_id);
  return (
    <g className="desk" role="button" tabIndex={0} aria-label={label} onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      transform={`translate(${d.x} ${d.y})`}>
      <title>{label.replace('. Activate for details.', '')}</title>
      <Chair x={0} y={0} />
      {R(2, 0, 44, 57, 'transparent', { className: 'hit' })}
      {R(4, 12, 40, 16, '#a8794a')}{R(4, 12, 40, 1, '#c4935e')}{R(4, 27, 40, 1, '#c4935e')}{R(4, 28, 40, 3, '#7a5432')}
      {R(6, 31, 2, 5, '#5e3f24')}{R(40, 31, 2, 5, '#5e3f24')}
      {R(14, 0, 20, 14, '#22262e')}{R(15, 1, 18, 12, '#303743')}{R(16, 2, 16, 10, SCREEN[scr])}
      {R(22, 14, 4, 2, '#4b525e')}{R(18, 16, 12, 1, '#4b525e')}
      {R(33, 12, 1, 1, scr === 'off' ? '#3a1d1d' : '#4ae37d')}
      {R(15, 20, 18, 5, '#d9dce3')}{R(15, 20, 18, 1, '#f4f6f8')}
      {[0, 1, 2, 3, 4, 5].map((k) => R(17 + k * 3, 21, 2, 1, '#8b929d', { key: k }))}
      {R(35, 20, 4, 3, '#e8eaee')}{R(36, 21, 2, 1, '#9aa0ab')}
      {lk.deco === 0 && <>{R(7, 15, 5, 5, '#3f8a3a')}{R(8, 19, 3, 3, '#a0522d')}{R(8, 14, 2, 1, '#5fb352')}</>}
      {lk.deco === 1 && <>{R(7, 15, 6, 4, '#f4f1de')}{R(8, 16, 4, 1, '#c9c3a8')}{R(13, 14, 2, 5, '#e8e3d2')}</>}
      {lk.deco === 2 && <>{R(38, 14, 4, 4, '#e07a5f')}{R(39, 15, 2, 1, '#fff')}{R(38, 18, 4, 1, '#b6533c')}</>}
      {lk.deco === 3 && <>{R(37, 13, 3, 7, '#1e1e1e')}{R(36, 12, 5, 2, '#f2c14e')}{R(37, 14, 2, 1, '#5c6068')}</>}
      <text className="plate" x={24} y={34} textAnchor="middle">
        {wrapName(a.agent_name, 12).map((l, i) => <tspan key={i} x={24} dy={i ? 4.6 : 0}>{l}</tspan>)}
      </text>
    </g>
  );
}

function Plaque({ cx, y, name, logo }) {
  const [bad, setBad] = useState(false);
  const show = logo && !bad;
  const w = 142;
  const x = cx - w / 2;
  return (
    <g className="plaque">
      {R(x, y, w, 28, '#3a2a1c')}{R(x + 2, y + 2, w - 4, 24, '#20160f')}
      {R(x + 2, y + 2, w - 4, 1, '#d4a84f')}{R(x + 2, y + 25, w - 4, 1, '#d4a84f')}
      {show && <image href={logo} x={x + 6} y={y + 4} width={20} height={20} preserveAspectRatio="xMidYMid meet"
        onError={() => setBad(true)} style={{ imageRendering: 'auto' }} />}
      <text className="wsname" x={show ? x + 31 + (w - 38) / 2 : cx} y={y + 19} textAnchor="middle"
        textLength={name.length > 8 ? (show ? w - 44 : w - 12) : undefined} lengthAdjust="spacingAndGlyphs">{name}</text>
    </g>
  );
}

function WallClock({ x, y, c }) {
  const hand = (deg, len, col, wd) => (
    <line x1={x} y1={y} x2={x + Math.sin(deg * Math.PI / 180) * len} y2={y - Math.cos(deg * Math.PI / 180) * len}
      stroke={col} strokeWidth={wd} strokeLinecap="square" shapeRendering="auto" />);
  return (
    <g className="wclock">
      <circle cx={x} cy={y} r={13} fill="#2b2f38" /><circle cx={x} cy={y} r={11} fill="#f4f1e8" />
      {[0, 3, 6, 9].map((k) => R(x - 1 + Math.sin(k * Math.PI / 6) * 9, y - 1 - Math.cos(k * Math.PI / 6) * 9, 2, 2, '#2b2f38', { key: k }))}
      {hand(((c.h % 12) + c.m / 60) * 30, 6, '#2b2f38', 2)}
      {hand((c.m + c.s / 60) * 6, 9, '#2b2f38', 1.4)}
      {hand(c.s * 6, 10, '#d9483b', 0.7)}
      <circle cx={x} cy={y} r={1.4} fill="#d9483b" />
    </g>
  );
}

function Tree({ x, y, s }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {R(-11, 3, 22, 4, 'rgba(0,0,0,.32)')}{R(-3, -3, 6, 10, '#59432c')}{R(-2, -2, 2, 8, '#7a5b3a')}
      {R(-5, -4, 3, 2, '#59432c')}{R(2, -6, 3, 2, '#59432c')}
      {R(-11, -13, 22, 13, '#223e2c')}{R(-9, -15, 18, 13, '#2d5438')}{R(-7, -19, 14, 6, '#386445')}
      {R(-4, -17, 8, 5, '#487b51')}{R(-2, -19, 4, 3, '#5a9360')}{R(-8, -11, 4, 2, '#487b51')}{R(4, -9, 4, 2, '#3b6b47')}
    </g>
  );
}

function Yard({ L, k }) {
  const night = k.night;
  const trees = [];
  const cols = Math.ceil(L.VW / 74), rows = Math.ceil(L.VH / 68);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = hash(`tree:${r}:${c}`);
      const x = c * 74 + (h % 25), y = r * 68 + ((h >>> 4) % 23);
      const inside = x > L.BX - 16 && x < L.BX + L.W + 16 && y > L.BY - 16 && y < L.BY + L.H + 16;
      if (inside || h % 4 === 0) continue;
      trees.push([x, y, 0.7 + ((h >>> 8) % 10) / 10]);
    }
  }
  const path = [];
  for (let y = L.BY + L.H + 2; y < L.BY + L.H + 74; y += 8) path.push(R(L.BX + L.doorX - 7 + ((y / 8) % 2) * 2, y, 12, 6, '#c9c2a8', { key: 'p' + y }));
  const flora = [];
  for (let i = 0; i < 44; i++) {
    const h = hash('flora:' + i);
    const x = (h % L.VW), y = L.BY + L.H + 6 + ((h >>> 9) % (L.VH - L.BY - L.H - 12));
    if (Math.abs(x - (L.BX + L.doorX)) < 16 && y < L.BY + L.H + 80) continue;
    flora.push([x, y, ['#8c7b62', '#a08a67', '#b9ae9a', '#786f8c', '#9a7458'][(h >>> 20) % 5], i % 4 ? 1 : 0]);
  }
  const lamps = [];
  for (let x = L.BX + 40; x < L.BX + L.W; x += 110) lamps.push(x);
  return (
    <g>
      {R(0, 0, L.VW, L.VH, 'url(#oGround)')}
      {path}
      {flora.map(([x, y, c, t], i) => (t
        ? <g key={'f' + i}>{R(x, y, 3, 3, c)}{R(x + 1, y + 1, 1, 1, '#ffe27a')}{R(x + 1, y + 3, 1, 2, '#3f7a35')}</g>
        : <g key={'b' + i}>{R(x - 6, y - 2, 12, 7, '#2f6b2f')}{R(x - 4, y - 4, 8, 3, '#3f8a3a')}{R(x - 2, y - 2, 3, 2, '#5fb352')}</g>))}
      {R(L.BX + 16, L.BY + L.H + 30, 22, 3, '#7a5432')}{R(L.BX + 17, L.BY + L.H + 33, 2, 4, '#4a3320')}{R(L.BX + 35, L.BY + L.H + 33, 2, 4, '#4a3320')}
      {R(L.BX + L.W - 38, L.BY + L.H + 30, 22, 3, '#7a5432')}{R(L.BX + L.W - 37, L.BY + L.H + 33, 2, 4, '#4a3320')}{R(L.BX + L.W - 19, L.BY + L.H + 33, 2, 4, '#4a3320')}
      {trees.map(([x, y, s], i) => <Tree key={i} x={x} y={y} s={s} />)}
      {lamps.map((x, i) => <g key={i}>
        {R(x - 2, L.BY + L.H + 2, 4, 16, '#4a4f5c')}
        {night > 0.3 && <circle cx={x} cy={L.BY + L.H + 4} r={30} fill="url(#oGlow)" pointerEvents="none" />}
      </g>)}
      <path d={`M0 0H${L.VW}V${L.VH}H0Z M${L.BX} ${L.BY}h${L.W}v${L.H}h-${L.W}Z`} fill="#0a1030" fillRule="evenodd" opacity={night * 0.6} pointerEvents="none" />
    </g>
  );
}

function RoomDoor({ x, y, label, vertical }) {
  if (vertical) {
    return (<g>
      {R(x - 2, y - 14, 4, 28, '#c9a227')}{R(x - 1, y - 12, 2, 24, '#7a5432')}
      <text className="doortag" x={x - 7} y={y + 2} textAnchor="end" transform={`rotate(-90 ${x - 7} ${y + 2})`}>{label}</text>
    </g>);
  }
  return (<g>
    {R(x - 14, y - 2, 28, 4, '#c9a227')}{R(x - 12, y - 1, 24, 2, '#7a5432')}
    <text className="doortag" x={x} y={y - 7} textAnchor="middle">{label}</text>
    </g>);
}

function fixtures(L) {
  const out = [];
  for (let c = 0; c < L.cols; c += 2) {
    const x = L.desks[c].x + (c + 1 < L.cols ? 48 : 24);
    for (let r = 0; r < L.rows; r++) out.push([x, L.top + r * 70 + 30]);
  }
  out.push([L.roomX + 50, L.pantryY + 30], [L.roomX + 55, L.loungeY + 40],
    [40, L.corridorY + 24], [L.W - 40, L.corridorY + 24], [L.doorX, L.H - 26]);
  return out;
}

function Lighting({ L, k }) {
  const lit = k.night > 0.3;
  const dark = Math.min(1, k.night) * 0.62;
  return (
    <g transform={`translate(${L.BX} ${L.BY})`} pointerEvents="none">
      {dark > 0.02 && R(0, WALL_H, L.W, L.H - WALL_H, '#1a2350', { className: 'lmul', opacity: dark })}
      {lit && <g className="lovl">
        {fixtures(L).map(([x, y], i) => <g key={i}>
          <ellipse cx={x} cy={y + 10} rx={58} ry={50} fill="url(#oLight)" />
          <ellipse cx={x} cy={y + 8} rx={24} ry={20} fill="url(#oLight)" />
        </g>)}
      </g>}
      {lit && <g className="lscr">{fixtures(L).map(([x, y], i) => <circle key={i} cx={x} cy={y + 8} r={22} fill="url(#oGlow)" />)}</g>}
    </g>
  );
}

function OfficeRoom({ L, c, k, name, logo, children }) {
  const half = Math.floor((L.openRight - 30) / 2);
  const plaqueCx = Math.max(70, half);
  const wins = [];
  for (let x = 10; x + 30 <= plaqueCx - 76; x += 50) wins.push(x);
  for (let x = plaqueCx + 76; x + 30 <= L.openRight - 10; x += 50) wins.push(x);
  wins.push(L.roomX + 22);
  const shift = (k.sunX - 0.5) * -50;
  const lit = k.night > 0.3;
  const fx = fixtures(L);
  const x0 = L.roomX, P = L.pantryY, Y = L.loungeY, C = L.corridorY, ob = L.openBottom;
  const plant = (x, y, big) => (<g>
    {R(x - 4, y - 6, 8, 6, '#8f4a2c')}{R(x - 4, y - 6, 8, 1, '#b5653f')}
    {R(x - (big ? 7 : 5), y - (big ? 18 : 13), big ? 14 : 10, big ? 12 : 8, '#2f6b2f')}
    {R(x - (big ? 5 : 3), y - (big ? 22 : 16), big ? 10 : 6, 5, '#3f8a3a')}{R(x - 2, y - (big ? 20 : 15), 3, 2, '#5fb352')}
  </g>);
  const sofa = (x, y, w, c1, c2, c3) => (<g>
    {R(x, y, w, 9, c1)}{R(x, y + 9, w, 13, c2)}{R(x - 4, y + 2, 5, 20, c1)}{R(x + w - 1, y + 2, 5, 20, c1)}
    {Array.from({ length: Math.max(1, Math.round(w / 30)) }, (_, i) => {
      const cw = (w - 4) / Math.max(1, Math.round(w / 30));
      return <g key={i}>{R(x + 2 + i * cw, y + 10, cw - 2, 10, c3)}{R(x + 2 + i * cw, y + 10, cw - 2, 1, 'rgba(255,255,255,.25)')}</g>;
    })}
    {R(x - 4, y + 22, w + 8, 2, 'rgba(0,0,0,.25)')}
  </g>);
  const pods = [];
  for (let c = 0; c < L.cols && c < L.desks.length; c += 2) {
    const w = c + 1 < L.cols && c + 1 < L.desks.length ? 96 : 48;
    pods.push(R(L.desks[c].x - 3, L.top - 3, w + 6, L.rows * 70 - 6, '#4f6472', { key: 'pod' + c }));
    pods.push(R(L.desks[c].x - 3, L.top - 3, w + 6, 1, '#6a808e', { key: 'pl' + c }));
  }
  return (
    <g transform={`translate(${L.BX} ${L.BY})`}>
      {R(0, 0, L.W, L.H, 'url(#oOpen)')}
      {R(0, L.corridorY, L.W, L.H - L.corridorY, 'url(#oCorridor)')}
      {R(L.doorX - 70, L.corridorY, 140, L.H - L.corridorY, 'url(#oLobby)')}
      {R(L.roomX, WALL_H, L.W - L.roomX, L.corridorY - WALL_H, 'url(#oTileP)')}
      {pods}
      {R(L.roomX, L.loungeY, L.W - L.roomX, L.corridorY - L.loungeY, 'url(#oWood)')}
      {R(L.roomX, L.pantryY + L.pantryH, L.W - L.roomX, L.loungeY - L.pantryY - L.pantryH, '#a8896a')}
      {R(L.roomX - 2, L.corridorY - 3, L.W - L.roomX + 2, 3, '#a8896a')}
      {R(0, 0, L.W, WALL_H, '#cfc3b0')}
      {R(0, WALL_H - 4, L.W, 4, '#7a5a46')}
      {R(0, 0, L.W, 4, '#e6dfd1')}
      {R(0, WALL_H, 4, L.H - WALL_H, '#a8896a')}
      {R(L.W - 4, WALL_H, 4, L.H - WALL_H, '#a8896a')}
      {R(0, L.H - 4, L.doorX - 16, 4, '#a8896a')}
      {R(L.doorX + 16, L.H - 4, L.W - L.doorX - 16, 4, '#a8896a')}
      {R(L.roomX - 2, WALL_H, 2, L.pantryDoorY - 13 - WALL_H, '#a8896a')}
      {R(L.roomX - 2, L.pantryDoorY + 13, 2, L.loungeDoorY - L.pantryDoorY - 26, '#a8896a')}
      {R(L.roomX - 2, L.loungeDoorY + 13, 2, L.corridorY - L.loungeDoorY - 13, '#a8896a')}
      {R(0, 6, L.W, 30, 'url(#oSky)')}
      {Array.from({ length: 12 }, (_, i) => R((i * 61) % L.W, 9 + ((i * 7) % 20), 1, 1, '#fff', { key: i, opacity: (1 - k.day) * 0.9 }))}
      {k.alt > -0.1 && R(k.sunX * L.W - 4, 30 - Math.max(0, k.alt) * 20, 8, 8, '#ffd34d')}
      {k.alt < 0.1 && R(k.moonX * L.W - 3, 30 - Math.max(0, -k.alt) * 20, 6, 6, '#eef0ff')}
      <g className="clouds" opacity={0.25 + k.day * 0.6}>
        {R(16, 14, 18, 4, '#fff')}{R(20, 11, 10, 3, '#fff')}{R(L.W * 0.62, 20, 22, 4, '#fff')}
      </g>
      <path d={`M0 0H${L.W}V${WALL_H}H0Z ${wins.map((x) => `M${x} 8h30v26h-30Z`).join(' ')}`} fill="#cfc3b0" fillRule="evenodd" />
      <g clipPath="url(#oRoomClip)">
        {wins.map((x) => k.day > 0.3 && <polygon key={'s' + x} points={`${x},${WALL_H} ${x + 30},${WALL_H} ${x + 30 + shift},${WALL_H + 42} ${x + shift},${WALL_H + 42}`} fill="#fff1b8" opacity={0.42} />)}
      </g>
      {wins.map((x) => <g key={x}>
        <rect x={x} y={8} width={30} height={26} fill="none" stroke="#f3eee4" strokeWidth={2} />
        {R(x + 14, 8, 2, 26, '#f3eee4')}{R(x - 2, 34, 34, 2, '#e6dfd1')}
        {R(x + 1, 9, 4, 24, '#c9b48f', { opacity: 0.7 })}{R(x + 25, 9, 4, 24, '#c9b48f', { opacity: 0.7 })}
        {R(x + 5, 9, 1, 24, '#e6dfd1', { opacity: 0.7 })}{R(x + 24, 9, 1, 24, '#e6dfd1', { opacity: 0.7 })}
      </g>)}
      <Plaque key={logo} cx={plaqueCx} y={8} name={name} logo={logo} />
      <WallClock x={L.roomX + 84} y={21} c={c} />

      {R(L.roomDoorX - 2, WALL_H, 4, L.corridorY - WALL_H, '#8d7258')}
      {R(L.roomDoorX - 3, L.pantryDoorY - 13, 6, 26, '#cfc3b0')}
      {R(L.roomDoorX - 3, L.loungeDoorY - 13, 6, 26, '#cfc3b0')}
      <RoomDoor x={L.roomDoorX} y={L.pantryDoorY} label="PANTRY" vertical />
      <RoomDoor x={L.roomDoorX} y={L.loungeDoorY} label="LOUNGE" vertical />
      <text className="roomtag" x={L.roomX + 54} y={L.pantryY + 12} textAnchor="middle">PANTRY</text>
      <text className="roomtag" x={L.roomX + 54} y={L.loungeY + 12} textAnchor="middle">LOUNGE</text>
      <text className="roomtag" x={L.openRight / 2} y={L.top - 4} textAnchor="middle">OPEN SPACE</text>
      <text className="roomtag" x={L.openRight / 2} y={L.corridorY + 10} textAnchor="middle">CORRIDOR</text>
      <text className="roomtag" x={L.doorX} y={L.H - 10} textAnchor="middle">LOBBY</text>

      {R(x0 + 2, WALL_H, 82, 14, '#6b4526')}{R(x0 + 2, WALL_H, 82, 9, '#ece7dc')}{R(x0 + 2, WALL_H + 9, 82, 1, '#c9c2b4')}
      {[0, 1, 2, 3, 4, 5].map((i) => R(x0 + 8 + i * 13, WALL_H + 11, 4, 1, '#c4935e', { key: 'h' + i }))}
      {R(x0 + 6, WALL_H - 3, 10, 10, '#2e2e33')}{R(x0 + 8, WALL_H, 6, 3, '#4a5560')}{R(x0 + 9, WALL_H + 4, 3, 2, '#f4f1e8')}{R(x0 + 14, WALL_H - 2, 1, 1, '#4ade80')}
      {R(x0 + 28, WALL_H + 1, 16, 6, '#9aa3ad')}{R(x0 + 29, WALL_H + 2, 14, 4, '#cdd3d9')}{R(x0 + 35, WALL_H - 2, 2, 4, '#6b7280')}
      {R(x0 + 56, WALL_H - 2, 18, 9, '#dce1e5')}{R(x0 + 57, WALL_H - 1, 12, 7, '#2e2e33')}{R(x0 + 70, WALL_H, 3, 1, '#4ade80')}
      {R(x0 + 88, WALL_H - 8, 18, 32, '#aab3bd')}{R(x0 + 89, WALL_H - 7, 16, 30, '#e4e8eb')}{R(x0 + 88, WALL_H + 4, 18, 1, '#aab3bd')}
      {R(x0 + 102, WALL_H - 4, 1, 6, '#8a939d')}{R(x0 + 102, WALL_H + 7, 1, 10, '#8a939d')}
      {R(x0 + 36, P + 36, 10, 7, '#5c4a39')}{R(x0 + 54, P + 36, 10, 7, '#5c4a39')}
      {R(x0 + 28, P + 44, 44, 13, '#a8794a')}{R(x0 + 28, P + 44, 44, 1, '#c4935e')}{R(x0 + 28, P + 57, 44, 3, '#7a5432')}
      {R(x0 + 36, P + 48, 6, 4, '#f4f1e8')}{R(x0 + 58, P + 48, 6, 4, '#f4f1e8')}{R(x0 + 46, P + 47, 8, 5, '#e07a5f')}{R(x0 + 47, P + 46, 2, 2, '#5fb352')}
      {R(x0 + 34, P + 62, 12, 6, '#5c4a39')}{R(x0 + 50, P + 62, 12, 6, '#5c4a39')}
      {plant(x0 + 100, P + 86, true)}{R(x0 + 4, P + 76, 7, 9, '#4a5560')}{R(x0 + 4, P + 76, 7, 1, '#6b7280')}

      {R(x0 + 16, Y + 28, 78, C - Y - 40, '#5d3a66')}{R(x0 + 18, Y + 30, 74, C - Y - 44, 'url(#oRug)')}
      {sofa(x0 + 12, Y + 12, 86, '#2c5a78', '#356381', '#4a85ab')}
      {R(x0 + 34, Y + 44, 40, 10, '#7a5432')}{R(x0 + 34, Y + 44, 40, 1, '#a8794a')}{R(x0 + 36, Y + 54, 2, 3, '#5e3f24')}{R(x0 + 70, Y + 54, 2, 3, '#5e3f24')}
      {R(x0 + 38, Y + 46, 10, 3, '#e8e2d3')}{R(x0 + 52, Y + 46, 4, 4, '#f4f1e8')}{R(x0 + 62, Y + 45, 6, 4, '#4b8a3a')}
      {R(x0 + 42, Y + 56, 12, 6, '#e0b84f')}{R(x0 + 42, Y + 56, 12, 1, '#f2d27a')}
      {R(x0 + 96, Y + 40, 12, 30, '#5c3f26')}{[0, 1, 2, 3].map((i) => <g key={'bk' + i}>
        {R(x0 + 97, Y + 42 + i * 7, 10, 6, '#3a2818')}{R(x0 + 98, Y + 43 + i * 7, 2, 5, ['#e07a5f', '#6fb3ff', '#e0b84f', '#5fb352'][i])}
        {R(x0 + 101, Y + 44 + i * 7, 2, 4, '#f4f1e8')}{R(x0 + 104, Y + 43 + i * 7, 2, 5, ['#8f62a0', '#e07a5f', '#4a85ab', '#d17a49'][i])}</g>)}
      {R(x0 + 89, Y + 50, 2, 20, '#3a3f4a')}{R(x0 + 85, Y + 46, 10, 5, '#f2c14e')}{R(x0 + 86, Y + 70, 8, 2, '#3a3f4a')}
      {plant(x0 + 8, C - 4, false)}

      {sofa(14, C + 14, 30, '#356381', '#4a85ab', '#5596bd')}
      {sofa(L.W - 52, C + 14, 30, '#6e4678', '#7c4f86', '#8f62a0')}
      {R(52, C + 18, 10, 16, '#dce1e5')}{R(53, C + 14, 8, 5, '#8ab4f8', { opacity: 0.85 })}{R(55, C + 24, 4, 2, '#4a85ab')}
      {plant(L.W - 64, C + 40, true)}
      {R(L.doorX + 22, C + 22, 36, 12, '#3a2a1c')}{R(L.doorX + 22, C + 22, 36, 2, '#d4a84f')}{R(L.doorX + 24, C + 24, 32, 8, '#20160f')}
      {R(L.doorX + 44, C + 16, 10, 7, '#22262e')}{R(L.doorX + 45, C + 17, 8, 5, '#1d3b5c')}{R(L.doorX + 28, C + 19, 4, 3, '#e07a5f')}

      {pods.length > 0 && <>
        {R(18, ob - 6, 40, 12, '#6b4a2b')}{R(18, ob - 6, 40, 1, '#8b5a33')}{R(24, ob - 12, 18, 7, '#dce1e5')}{R(26, ob - 10, 14, 2, '#4a5560')}{R(46, ob - 10, 8, 4, '#f4f1e8')}
        {plant(8, ob + 6, true)}{plant(L.deskRight - 10, ob + 6, true)}
      </>}
      {R(L.doorX - 16, L.H - 3, 32, 3, '#c9a227')}
      <RoomDoor x={L.doorX} y={L.H - 2} label="EXIT" />
      {fx.map(([x, y], i) => <g key={'fx' + i} pointerEvents="none">
        {R(x - 4, y - 1, 8, 2, '#3a3f4a')}{R(x - 3, y + 1, 6, 1, lit ? '#fff1b8' : '#cfd3da')}
      </g>)}
      {children}
    </g>
  );
}

export default function Office({ snap, now, onAgent, tz }) {
  const agents = [...(snap.multica.agents || [])].sort((x, y) =>
    String(x.agent_name).localeCompare(String(y.agent_name)) || String(x.agent_id).localeCompare(String(x.agent_id)));
  const L = layout(agents.length);
  const c = tzClock(now, tz);
  const k = sky(c.hours);
  const nowS = Math.floor(now / 1000);
  const [beh, setBeh] = useState({});
  const prev = useRef(null);
  const sig = agents.map((a) => `${a.agent_id}:${a.running}:${a.pending_total}:${a.runtime_online}`).join('|');
  useEffect(() => {
    const next = plan(agents, L, prev.current, nowS);
    prev.current = next;
    setBeh(next);
  }, [sig, nowS]);
  const counts = { working: 0, queued: 0, idle: 0, offline: 0 };
  agents.forEach((a) => { counts[statusOf(a).group] += 1; });
  const name = snap.meta?.workspace && snap.meta.workspace !== '?' ? snap.meta.workspace : (snap.meta?.company || 'Office');
  const svgRef = useRef(null);
  const stageRef = useRef(null);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [fitted, setFitted] = useState(false);
  const [stageSz, setStageSz] = useState(null);
  const [full, setFull] = useState(false);
  const drag = useRef(null);
  const moved = useRef(false);
  const cx = L.VW / 2, cy = L.VH / 2;
  const panLimit = (v) => ({
    x: Math.max(120, L.VW * (v.k - 1) / 2 + 120),
    y: Math.max(120, L.VH * (v.k - 1) / 2 + 120),
  });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setStageSz({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  useEffect(() => {
    if (!stageSz || fitted) return;
    const s0 = Math.min(stageSz.w / L.VW, stageSz.h / L.VH);
    const nk = clamp(Math.min(stageSz.w / (L.W * s0), stageSz.h / (L.H * s0)), MIN_K, MAX_K);
    setView({ k: nk, tx: 0, ty: 0 });
    setFitted(true);
  }, [stageSz, L, fitted]);

  const zoomAt = (factor, p) => setView((v) => {
    const nk = clamp(v.k * factor, MIN_K, MAX_K);
    const q = p || { x: cx, y: cy };
    const lim = panLimit(v);
    return { k: nk,
      tx: clamp(v.tx + (v.k - nk) * (q.x - cx), -lim.x, lim.x),
      ty: clamp(v.ty + (v.k - nk) * (q.y - cy), -lim.y, lim.y) };
  });
  const svgPoint = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: cx, y: cy };
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : { x: cx, y: cy };
  };
  const onWheel = (e) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, svgPoint(e)); };
  const onDown = (e) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, s: svgRef.current?.getScreenCTM()?.a || 1 };
    moved.current = false;
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 4) moved.current = true;
    setView((v) => {
      const lim = panLimit(v);
      return { ...v, tx: clamp(d.tx + dx / d.s, -lim.x, lim.x), ty: clamp(d.ty + dy / d.s, -lim.y, lim.y) };
    });
  };
  const onUp = () => { drag.current = null; };
  const toggleFull = () => {
    const el = stageRef.current;
    if (document.fullscreenElement === el) document.exitFullscreen?.();
    else el?.requestFullscreen?.();
    setFitted(false);
  };
  const order = [...agents].sort((p, q) => (beh[p.agent_id]?.spot.y || 0) - (beh[q.agent_id]?.spot.y || 0));
  const scene = `translate(${cx - view.k * cx + view.tx} ${cy - view.k * cy + view.ty}) scale(${view.k})`;

  return (
    <div className="office">
      <h2><i className="ph ph-buildings"></i> <span className="small">
        {agents.length} agents · {counts.working} working · {counts.queued} queued · {counts.idle} idle · {counts.offline} offline</span>
        <span className="oclock mono" title={`Office time (${tz || 'Asia/Jakarta'})`}>
          {String(c.h).padStart(2, '0')}:{String(c.m).padStart(2, '0')}:{String(c.s).padStart(2, '0')} {c.zone} · {c.date}</span>
      </h2>
      <div className="ostage" ref={stageRef}>
        <svg ref={svgRef} viewBox={`0 0 ${L.VW} ${L.VH}`} role="group"
          aria-label={`2D office of ${name}: ${agents.length} desks`}
          onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
          onClickCapture={(e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false; } }}>
          <defs>
            <linearGradient id="oSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={k.top} /><stop offset="1" stopColor={k.bottom} />
            </linearGradient>
            <pattern id="oGround" width="16" height="16" patternUnits="userSpaceOnUse">
              {R(0, 0, 16, 16, '#171c24')}
            </pattern>
            <pattern id="oOpen" width="16" height="16" patternUnits="userSpaceOnUse">
              {R(0, 0, 16, 16, '#5d7280')}{R(1, 1, 1, 1, '#657c8a')}{R(9, 1, 1, 1, '#657c8a')}{R(5, 9, 1, 1, '#536976')}{R(13, 9, 1, 1, '#536976')}
            </pattern>
            <pattern id="oCorridor" width="24" height="8" patternUnits="userSpaceOnUse">
              {R(0, 0, 24, 8, '#c9c6bd')}{R(0, 7, 24, 1, '#b6b2a8')}{R(0, 0, 1, 8, '#b6b2a8')}{R(12, 1, 1, 6, '#c1bdb3')}
            </pattern>
            <pattern id="oLobby" width="20" height="10" patternUnits="userSpaceOnUse">
              {R(0, 0, 20, 10, '#d8c8a8')}{R(0, 9, 20, 1, '#bdae8c')}{R(10, 0, 1, 10, '#cfbe9c')}{R(1, 2, 8, 1, '#e0d2b5')}
            </pattern>
            <clipPath id="oRoomClip"><rect x={0} y={WALL_H} width={L.W} height={L.H - WALL_H} /></clipPath>
            <radialGradient id="oLight"><stop offset="0" stopColor="#ffd27a" stopOpacity={1} /><stop offset=".55" stopColor="#ffb648" stopOpacity={0.55} /><stop offset="1" stopColor="#ffb648" stopOpacity={0} /></radialGradient>
            <pattern id="oWood" width="24" height="6" patternUnits="userSpaceOnUse">
              {R(0, 0, 24, 6, '#9a6c43')}{R(0, 5, 24, 1, '#7f5634')}{R(8, 0, 1, 5, '#8a5f3a')}{R(2, 2, 6, 1, '#a8794a')}
            </pattern>
            <radialGradient id="oGlow"><stop offset="0" stopColor="#ffe9a8" stopOpacity={0.35} /><stop offset="1" stopColor="#ffe9a8" stopOpacity={0} /></radialGradient>
            <pattern id="oTileP" width="12" height="12" patternUnits="userSpaceOnUse">
              {R(0, 0, 12, 12, '#e9dcb8')}{R(0, 0, 6, 6, '#dccb9c')}{R(6, 6, 6, 6, '#dccb9c')}
            </pattern>
            <pattern id="oRug" width="6" height="6" patternUnits="userSpaceOnUse">
              {R(0, 0, 6, 6, '#7c4f86')}{R(0, 0, 3, 3, '#8a5c94')}
            </pattern>
          </defs>
          <g transform={scene}>
            <Yard L={L} k={k} />
            <OfficeRoom L={L} c={c} k={k} name={name} logo={snap.meta?.office_logo || ''}>
              {agents.map((a, i) => <Desk key={a.agent_id} a={a} b={beh[a.agent_id] || {}} d={L.desks[i]} onAgent={onAgent} />)}
            </OfficeRoom>
            <g pointerEvents="none">
              {agents.map((a, i) => <Screen key={a.agent_id} a={a} b={beh[a.agent_id] || {}} d={{ x: L.BX + L.desks[i].x, y: L.BY + L.desks[i].y }} />)}
            </g>
            {order.map((a) => {
              const b = beh[a.agent_id];
              return b ? <Actor key={a.agent_id} a={a} b={b} route={b.route} onAgent={onAgent} /> : null;
            })}
            <Lighting L={L} k={k} />
          </g>
        </svg>
        <div className="otools">
          <button title="Zoom in" aria-label="Zoom in" onClick={() => zoomAt(1.25)}><i className="ph ph-plus"></i></button>
          <button title="Zoom out" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.25)}><i className="ph ph-minus"></i></button>
          <button title="Fit office" aria-label="Fit office" onClick={() => { setFitted(false); setView({ k: 1, tx: 0, ty: 0 }); }}>
            <i className="ph ph-corners-out"></i></button>
          <button title={full ? 'Exit fullscreen' : 'Fullscreen'} aria-label={full ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={toggleFull}><i className={full ? 'ph ph-fullscreen-exit' : 'ph ph-fullscreen'}></i></button>
          <span className="oz" title="Zoom level">{Math.round(view.k * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
