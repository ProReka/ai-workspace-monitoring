import { useEffect, useRef, useState } from 'react';
import { statusOf } from './fmt.js';
import { ROOM_W, WALL_H, hash, layout, legMs, look, plan, sky, tzClock, wrapName } from './office.js';

const R = (x, y, w, h, fill, { key, ...rest } = {}) => <rect key={key} x={x} y={y} width={w} height={h} fill={fill} {...rest} />;
const pointKey = (p) => Math.round(p.x) + ',' + Math.round(p.y);
const routeKey = (r) => r.map(pointKey).join(' ');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MIN_K = 0.4;
const MAX_K = 8;

function Person({ lk, pose, activity, dim }) {
  const { skin, hair, shirt, pants } = lk;
  const shadow = R(-5, -1, 10, 2, 'rgba(0,0,0,.28)');
  const rest = activity !== 'work';
  const sit = pose === 'sit';
  return (
    <g transform="scale(.74)" opacity={dim ? 0.72 : 1}>
      {shadow}
      {pose === 'desk' ? (
        <>
          {R(-5, -15, 10, 9, shirt)}
          <g className={rest ? 'arm rest' : 'arm a1'}>{R(-7, -17, 2, 6, shirt)}{R(-7, -19, 2, 2, skin)}</g>
          <g className={rest ? 'arm rest2' : 'arm a2'}>{R(5, -17, 2, 6, shirt)}{R(5, -19, 2, 2, skin)}</g>
          {R(-4, -23, 8, 8, hair)}{R(-5, -20, 1, 2, skin)}{R(4, -20, 1, 2, skin)}
          {R(-6, -8, 12, 5, '#33363f')}{R(-6, -8, 12, 1, '#4a4f5c')}
        </>
      ) : (
        <>
          {sit ? (
            <g className="legs">
              {R(-4, -7, 8, 3, pants)}{R(-4, -4, 3, 3, pants)}{R(1, -4, 3, 3, pants)}{R(-4, -1, 3, 1, '#1b1b1f')}{R(1, -1, 3, 1, '#1b1b1f')}
            </g>
          ) : (
            <g className="legs">
              <g className="leg l1">{R(-4, -7, 3, 6, pants)}{R(-4, -1, 3, 1, '#1b1b1f')}</g>
              <g className="leg l2">{R(1, -7, 3, 6, pants)}{R(1, -1, 3, 1, '#1b1b1f')}</g>
            </g>
          )}
          <g className="torso">
            {R(-5, -15, 10, 9, shirt)}{R(-7, -14, 2, 7, shirt)}{R(5, -14, 2, 7, shirt)}
            {R(-7, -8, 2, 2, skin)}{R(5, -8, 2, 2, skin)}
            {pose === 'cup' && <>{R(6, -11, 3, 3, '#f1f1f1')}{R(9, -10, 1, 2, '#f1f1f1')}{R(6, -11, 3, 1, '#6b3e1f')}</>}
            {R(-4, -23, 8, 8, skin)}{R(-4, -24, 8, 3, hair)}{R(-5, -23, 1, 4, hair)}{R(4, -23, 1, 4, hair)}
            {R(-2, -19, 1, 2, '#1b1b1f')}{R(1, -19, 1, 2, '#1b1b1f')}
          </g>
        </>
      )}
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
      {scr === 'idle' && !fun && <g className="saver">{R(x + 3, y + 3, 3, 3, '#6fb3ff')}</g>}
      {scr === 'off' && R(x + 1, y + 1, 4, 1, '#1d2129')}
    </g>
  );
}

function Chair({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {R(10, 50, 20, 7, '#5c4a39')}
      {R(12, 40, 16, 10, '#6b5b45')}
      {R(10, 52, 2, 2, '#4a4f5c')}{R(28, 52, 2, 2, '#4a4f5c')}
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
      <Chair x={10} y={0} />
      {R(2, 0, 44, 57, 'transparent', { className: 'hit' })}
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
      <text className="plate" x={24} y={51} textAnchor="middle">
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
      {R(-9, 3, 18, 4, 'rgba(0,0,0,.18)')}{R(-2, -2, 4, 8, '#6b4a2b')}
      {R(-10, -12, 20, 12, '#2f6b2f')}{R(-7, -17, 14, 5, '#3a7f38')}{R(-4, -13, 8, 6, '#4f9a44')}{R(-2, -15, 4, 3, '#5fb352')}
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
    flora.push([x, y, ['#e8618c', '#f2c14e', '#ffffff', '#b57edc', '#ff8c42'][(h >>> 20) % 5], i % 4 ? 1 : 0]);
  }
  const lamps = [];
  for (let x = L.BX + 40; x < L.BX + L.W; x += 110) lamps.push(x);
  return (
    <g>
      {R(0, 0, L.VW, L.VH, 'url(#oGrass)')}
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

function OfficeRoom({ L, c, k, name, logo, children }) {
  const half = Math.floor((L.openRight - 30) / 2);
  const plaqueCx = Math.max(70, half);
  const wins = [];
  for (let x = 10; x + 30 <= plaqueCx - 76; x += 50) wins.push(x);
  for (let x = plaqueCx + 76; x + 30 <= L.openRight - 10; x += 50) wins.push(x);
  const shift = (k.sunX - 0.5) * -50;
  const lit = k.night > 0.3;
  const fix = [];
  for (let x = 24; x < L.openRight - 10; x += 60) for (let y = L.top + 30; y < L.openBottom; y += 80) fix.push([x, y]);
  fix.push([L.roomX + 54, L.pantryY + 46], [L.roomX + 54, L.loungeY + 44], [L.openRight / 2, L.corridorY + 30], [L.doorX, L.H - 16]);
  const lamp = (<g pointerEvents="none">
    {fix.map(([x, y], i) => <g key={i}>
      {R(x - 3, y - 1, 6, 2, '#3a3f4a')}{R(x - 2, y + 1, 4, 1, lit ? '#fff1b8' : '#cfd3da')}
      {lit && <circle cx={x} cy={y + 6} r={46} fill="url(#oGlow)" />}
    </g>)}
    {lit && R(0, WALL_H, L.W, L.H - WALL_H, '#ffd98a', { opacity: 0.07 })}
  </g>);
  const orn = (<g>
    {R(L.openRight - 70, WALL_H + 8, 14, 12, '#6b4a2b')}{R(L.openRight - 69, WALL_H + 9, 12, 5, '#e0b84f')}{R(L.openRight - 69, WALL_H + 15, 12, 4, '#e07a5f')}
    {R(L.roomX + 2, L.pantryY + 70, 10, 14, '#6b4a2b')}{R(L.roomX + 4, L.pantryY + 72, 6, 3, '#e0b84f')}
    {R(L.roomX + 98, L.loungeY + 56, 6, 4, '#8f4a2c')}{R(L.roomX + 97, L.loungeY + 50, 8, 6, '#4b8a3a')}{R(L.roomX + 99, L.loungeY + 47, 4, 3, '#5fb352')}
    {R(L.roomX + 4, L.loungeY + 56, 6, 4, '#8f4a2c')}{R(L.roomX + 3, L.loungeY + 50, 8, 6, '#4b8a3a')}{R(L.roomX + 5, L.loungeY + 47, 4, 3, '#5fb352')}
    {R(L.roomX + 36, L.loungeY + 2, 22, 10, '#f4f1e8')}{R(L.roomX + 38, L.loungeY + 4, 18, 6, '#6fb3ff')}{R(L.roomX + 38, L.loungeY + 8, 18, 2, '#4b8a3a')}
    {R(L.roomX + 70, L.pantryY + 40, 12, 12, '#f4f1e8')}{R(L.roomX + 72, L.pantryY + 42, 8, 8, '#d17a49')}
    {R(8, L.corridorY + 2, 10, 10, '#4b8a3a')}{R(10, L.corridorY + 12, 6, 5, '#8f4a2c')}
    {R(L.openRight - 16, L.corridorY + 2, 10, 10, '#5fb352')}{R(L.openRight - 14, L.corridorY + 12, 6, 5, '#8f4a2c')}
    {R(L.doorX - 34, L.H - 14, 10, 8, '#4b8a3a')}{R(L.doorX - 32, L.H - 7, 6, 4, '#8f4a2c')}
    {R(L.doorX + 24, L.H - 14, 10, 8, '#4b8a3a')}{R(L.doorX + 26, L.H - 7, 6, 4, '#8f4a2c')}
    {R(L.doorX - 24, L.H - 6, 48, 3, '#7c4f86')}
  </g>);
  return (
    <g transform={`translate(${L.BX} ${L.BY})`}>
      {R(0, 0, L.W, L.H, 'url(#oOpen)')}
      {R(0, L.corridorY, L.openRight + 4, L.H - L.corridorY, 'url(#oCorridor)')}
      {R(L.doorX - 70, L.corridorY, 140, L.H - L.corridorY, 'url(#oLobby)')}
      {R(L.roomX, L.pantryY, ROOM_W - 16, L.pantryH, 'url(#oTileP)')}
      {R(L.roomX, L.loungeY, ROOM_W - 16, L.corridorY - L.loungeY - 8, 'url(#oRug)')}
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
      {wins.map((x) => <g key={x}>
        <rect x={x} y={8} width={30} height={26} fill="none" stroke="#f3eee4" strokeWidth={2} />
        {R(x + 14, 8, 2, 26, '#f3eee4')}{R(x - 2, 34, 34, 2, '#e6dfd1')}
        {k.day > 0.3 && <polygon key={'s'+x} points={`${x},${WALL_H} ${x + 30},${WALL_H} ${x + 30 + shift},${WALL_H + 36} ${x + shift},${WALL_H + 36}`} fill="#fff1b8" opacity={0.5} />}
      </g>)}
      <Plaque key={logo} cx={plaqueCx} y={8} name={name} logo={logo} />
      <WallClock x={L.openRight - 20} y={20} c={c} />

      {R(L.roomDoorX - 2, WALL_H, 4, L.corridorY - WALL_H, '#8d7258')}
      {R(L.roomX, L.pantryY - 4, ROOM_W - 16, 4, '#5c4a39')}
      {R(L.roomDoorX - 3, L.pantryDoorY - 13, 6, 26, '#cfc3b0')}
      {R(L.roomDoorX - 3, L.loungeDoorY - 13, 6, 26, '#cfc3b0')}
      <RoomDoor x={L.roomDoorX} y={L.pantryDoorY} label="PANTRY" vertical />
      <RoomDoor x={L.roomDoorX} y={L.loungeDoorY} label="LOUNGE" vertical />
      <text className="roomtag" x={L.roomX + 54} y={L.pantryY + 12} textAnchor="middle">PANTRY</text>
      <text className="roomtag" x={L.roomX + 54} y={L.loungeY + 12} textAnchor="middle">LOUNGE</text>
      <text className="roomtag" x={L.openRight / 2} y={L.top - 4} textAnchor="middle">OPEN SPACE</text>
      <text className="roomtag" x={L.openRight / 2} y={L.corridorY + 10} textAnchor="middle">CORRIDOR</text>
      <text className="roomtag" x={L.doorX} y={L.H - 10} textAnchor="middle">LOBBY</text>

      {R(L.roomX + 6, L.pantryY + 8, 18, 24, '#5c6b78')}{R(L.roomX + 8, L.pantryY + 10, 14, 8, '#2e2e33')}
      {R(L.roomX + 10, L.pantryY + 18, 3, 3, '#d9483b')}{R(L.roomX + 16, L.pantryY + 18, 3, 3, '#4ade80')}
      {R(L.roomX + 72, L.pantryY + 8, 22, 26, '#cdd3d9')}{R(L.roomX + 72, L.pantryY + 14, 22, 1, '#aab3bd')}
      {R(L.roomX + 78, L.pantryY + 23, 10, 2, '#6b7280')}
      {R(L.roomX + 14, L.pantryY + 54, 58, 4, '#8b5a33')}{R(L.roomX + 14, L.pantryY + 58, 58, 2, '#a8794a')}
      {R(L.roomX + 24, L.pantryY + 44, 8, 8, '#f4f1de')}{R(L.roomX + 56, L.pantryY + 44, 8, 8, '#e07a5f')}
      {R(L.roomX + 80, L.pantryY + 62, 16, 5, '#4b8a3a')}

      {R(L.roomX + 6, L.loungeY + 16, 52, 8, '#3c6e8f')}{R(L.roomX + 6, L.loungeY + 24, 52, 14, '#4a85ab')}
      {R(L.roomX + 4, L.loungeY + 18, 5, 22, '#356381')}{R(L.roomX + 58, L.loungeY + 18, 5, 22, '#356381')}
      {R(L.roomX + 66, L.loungeY + 16, 30, 8, '#8a5c94')}{R(L.roomX + 66, L.loungeY + 24, 30, 14, '#7c4f86')}
      {R(L.roomX + 64, L.loungeY + 18, 4, 22, '#5d3a66')}{R(L.roomX + 94, L.loungeY + 18, 4, 22, '#5d3a66')}
      {R(L.roomX + 32, L.loungeY + 52, 32, 8, '#7a5432')}{R(L.roomX + 32, L.loungeY + 52, 32, 1, '#a8794a')}
      {R(L.roomX + 74, L.loungeY + 36, 16, 18, '#6b4a2b')}
      {R(L.roomX + 76, L.loungeY + 38, 12, 3, '#e0b84f')}{R(L.roomX + 76, L.loungeY + 43, 12, 3, '#e07a5f')}
      {R(L.roomX + 94, L.loungeY + 14, 16, 22, '#3a3f4a')}{R(L.roomX + 96, L.loungeY + 18, 12, 16, '#2b2f38')}
      {R(L.roomX + 94, L.loungeY + 38, 16, 2, '#f2c14e')}

      {R(12, L.corridorY + 14, 24, 8, '#3c6e8f')}{R(12, L.corridorY + 22, 24, 14, '#4a85ab')}
      {R(L.openRight - 40, L.corridorY + 14, 24, 8, '#8a5c94')}{R(L.openRight - 40, L.corridorY + 22, 24, 14, '#7c4f86')}
      {R(54, L.corridorY + 48, 34, 5, '#7a5432')}{R(58, L.corridorY + 40, 6, 8, '#c9b48f')}
      {R(L.openRight - 32, L.corridorY + 48, 28, 4, '#7a5432')}
      {R(L.openRight - 18, WALL_H + 14, 4, 6, '#8f4a2c')}{R(L.openRight - 17, WALL_H + 16, 2, 3, '#d17a49')}
      {R(L.openRight - 20, L.corridorY - 24, 4, 6, '#4b8a3a')}{R(L.openRight - 21, L.corridorY - 28, 6, 4, '#5fb352')}
      {R(16, WALL_H + 10, 22, 12, '#f1f1f1')}{R(18, WALL_H + 12, 18, 2, '#8ab4f8')}{R(18, WALL_H + 16, 12, 2, '#cbd5e1')}
      {R(L.openRight - 34, L.corridorY - 28, 22, 14, '#2f3f4f')}
      {R(L.openRight - 32, L.corridorY - 26, 18, 2, '#e2e8f0')}{R(L.openRight - 32, L.corridorY - 22, 14, 2, '#94a3b8')}
      {R(L.openRight - 22, WALL_H + 10, 12, 10, '#ffd98a', { opacity: 0.85 })}
      {R(L.openRight - 24, WALL_H + 12, 8, 2, '#d97706')}
      {R(L.doorX - 16, L.H - 3, 32, 3, '#c9a227')}
      <RoomDoor x={L.doorX} y={L.H - 2} label="EXIT" />
      {orn}
      {lamp}
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
  const drag = useRef(null);
  const moved = useRef(false);
  const cx = L.VW / 2, cy = L.VH / 2;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setStageSz({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
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
    return { k: nk, tx: v.tx + (v.k - nk) * (q.x - cx), ty: v.ty + (v.k - nk) * (q.y - cy) };
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
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    if (Math.hypot(dx, dy) > 4) moved.current = true;
    setView((v) => ({ ...v, tx: drag.current.tx + dx / drag.current.s, ty: drag.current.ty + dy / drag.current.s }));
  };
  const onUp = () => { drag.current = null; };
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
        <svg ref={svgRef} viewBox={`0 0 ${L.VW} ${L.VH}`} shapeRendering="crispEdges" role="group"
          aria-label={`2D office of ${name}: ${agents.length} desks`}
          onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
          onClickCapture={(e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false; } }}>
          <defs>
            <linearGradient id="oSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={k.top} /><stop offset="1" stopColor={k.bottom} />
            </linearGradient>
            <pattern id="oGrass" width="12" height="12" patternUnits="userSpaceOnUse">
              {R(0, 0, 12, 12, '#616e5c')}{R(2, 3, 1, 2, '#6d7b66')}{R(7, 7, 1, 2, '#56634f')}{R(5, 1, 1, 1, '#77836d')}
            </pattern>
            <pattern id="oOpen" width="16" height="16" patternUnits="userSpaceOnUse">
              {R(0, 0, 16, 16, '#5d7280')}{R(0, 0, 16, 1, '#536976')}{R(0, 8, 16, 1, '#536976')}{R(8, 0, 1, 16, '#668091')}
            </pattern>
            <pattern id="oCorridor" width="12" height="12" patternUnits="userSpaceOnUse">
              {R(0, 0, 12, 12, '#c9c6bd')}{R(0, 0, 6, 6, '#bdb9af')}{R(6, 6, 6, 6, '#bdb9af')}
            </pattern>
            <pattern id="oLobby" width="14" height="14" patternUnits="userSpaceOnUse">
              {R(0, 0, 14, 14, '#d8c8a8')}{R(0, 0, 7, 7, '#cbb995')}{R(7, 7, 7, 7, '#cbb995')}
            </pattern>
            <radialGradient id="oGlow"><stop offset="0" stopColor="#ffe9a8" stopOpacity={0.55} /><stop offset="1" stopColor="#ffe9a8" stopOpacity={0} /></radialGradient>
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
          </g>
        </svg>
        <div className="otools">
          <button title="Zoom in" aria-label="Zoom in" onClick={() => zoomAt(1.25)}><i className="ph ph-plus"></i></button>
          <button title="Zoom out" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.25)}><i className="ph ph-minus"></i></button>
          <button title="Fit office" aria-label="Fit office" onClick={() => { setFitted(false); setView({ k: 1, tx: 0, ty: 0 }); }}>
            <i className="ph ph-corners-out"></i></button>
          <span className="oz" title="Zoom level">{Math.round(view.k * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
