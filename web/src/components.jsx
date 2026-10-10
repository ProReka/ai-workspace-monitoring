import { useEffect, useRef } from 'react';
import { agoShort, big, fmtDur, kindIcon, short, statusOf, timeHM, fullDT } from './fmt.js';
import { Avatar, IssueRef, Logo, Mentions } from './parts.jsx';

// Panel section with optional drag-to-resize body (persisted; dbl-click resets to auto).
export function Section({ id, icon, title, head, resizable, children }) {
  const key = 'ov-sec-' + id;
  const bodyRef = useRef(null);
  useEffect(() => {
    let h = 0;
    try { h = parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch {}
    if (h > 0 && bodyRef.current) {
      bodyRef.current.style.height = Math.min(window.innerHeight * 0.8, Math.max(80, h)) + 'px';
      bodyRef.current.style.overflowY = 'auto';
    }
  }, [key]);
  const onDown = (e) => {
    e.preventDefault();
    const body = bodyRef.current;
    const y0 = e.clientY, h0 = body.getBoundingClientRect().height;
    body.style.overflowY = 'auto';
    const move = (ev) => {
      body.style.height = Math.min(window.innerHeight * 0.8, Math.max(80, h0 + (ev.clientY - y0))) + 'px';
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      try { localStorage.setItem(key, String(Math.round(body.getBoundingClientRect().height))); } catch {}
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const onDbl = () => {
    if (bodyRef.current) { bodyRef.current.style.height = ''; bodyRef.current.style.overflowY = ''; }
    try { localStorage.removeItem(key); } catch {}
  };
  return (
    <section>
      <h2><i className={`ph ${icon}`}></i> {title}{head}</h2>
      <div ref={bodyRef}>{children}</div>
      {resizable && <div className="secgrip" title="Drag to resize (double-click resets)" onMouseDown={onDown} onDoubleClick={onDbl}><i></i></div>}
    </section>
  );
}

function rel(ts, now) {
  if (!ts) return '—';
  const s = Math.max(0, now / 1000 - new Date(ts).getTime() / 1000);
  if (s < 60) return Math.floor(s) + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}

export function Tiles({ snap }) {
  const agents = snap.multica.agents || [];
  const online = agents.filter((a) => a.runtime_online).length;
  const running = agents.reduce((n, a) => n + (a.running || 0), 0);
  const queued = agents.reduce((n, a) => n + (a.pending_total || 0), 0);
  let worst = null;
  for (const c of snap.router.connections || []) {
    if (!c.isActive || c.worst_remaining == null) continue;
    if (!worst || c.worst_remaining < worst.v) worst = { v: c.worst_remaining, p: c.provider };
  }
  const combos = snap.router.combos || [];
  const tiles = [
    ['ph-robot', `${online}/${agents.length}`, 'agents online'],
    ['ph-gear-six', running, 'tasks running'],
    ['ph-hourglass-medium', queued, 'tasks queued'],
    ['ph-battery-medium', worst ? `${worst.v.toFixed(0)}% ${worst.p}` : '—', 'lowest quota'],
    ['ph-git-fork', `${combos.filter((c) => c.verdict === 'ok').length} ok · ${combos.filter((c) => c.verdict === 'degraded').length} degraded`, 'combos'],
    ['ph-bell', (snap.alerts || []).length, 'notifications'],
  ];
  return (
    <div className="tiles">
      {tiles.map(([i, v, l]) => (
        <div className="tile" key={l}>
          <div className="tv">{String(v)}</div>
          <div className="tl"><i className={`ph ${i}`}></i> {l}</div>
        </div>
      ))}
    </div>
  );
}

const NOTIF_ICON = { crit: 'ph-octagon', warn: 'ph-warning', info: 'ph-info' };

export function Notifications({ snap }) {
  const items = [...(snap.alerts || []), ...(snap.notices || []).map((n) => ({ ...n, ts: n.ts || snap.ts }))];
  return (
    <div className="alerts" data-count={items.length}>
        {items.length ? items.map((a, i) => (
          <div className={`alert ${a.level}`} key={i}>
            <i className={`ph ${NOTIF_ICON[a.level] || 'ph-dot'}`}></i>
            <span>{a.msg}</span>
            <span className="ts" title={`${a.source} · ${fullDT(a.ts || snap.ts)}`}>
              <i className="ph ph-clock"></i> {timeHM(a.ts || snap.ts)}
            </span>
          </div>
        )) : <div className="small"><i className="ph ph-check-circle"></i> All clear.</div>}
    </div>
  );
}

function TaskLine({ cur, snapTs, now, onAgent }) {
  if (!cur) return null;
  const el = cur.elapsed_s != null ? <> · <span>{fmtDur(cur.elapsed_s + (now / 1000 - snapTs))}</span></> : null;
  return (
    <div className="taskline">
      <i className={`ph ${kindIcon(cur.kind)}`}></i> <b>{cur.kind_label || cur.summary}</b>
      <div className="small clamp1">
        <Mentions text={cur.summary} onAgent={onAgent} />
        {cur.issue ? <> · <IssueRef value={cur.issue} /></> : null}{el}
      </div>
    </div>
  );
}

function LastIcon({ status }) {
  const s = String(status || '').toLowerCase();
  const ic = s === 'completed' ? 'ph-check-circle ok'
    : s === 'failed' ? 'ph-x-circle crit'
    : s === 'cancelled' ? 'ph-minus-circle'
    : s === 'running' ? 'ph-circle-dashed warn' : 'ph-question';
  return <span className="ld" title={`last run: ${status}`}><i className={`ph ${ic}`}></i></span>;
}

export function MiniSpark({ spark, ts }) {
  const cells = Array.isArray(spark) ? spark : [];
  if (!cells.length) return null;
  const W = 120, H = 20;
  const vals = cells.map((c) => c[0] || 0);
  const toks = cells.map((c) => c[1] || 0);
  const mx = Math.max(1, ...vals);
  const step = W / Math.max(1, vals.length - 1);
  const pts = vals.map((v, i) => `${(i * step).toFixed(1)},${(H - 2 - (v / mx) * (H - 5)).toFixed(1)}`).join(' ');
  const tot = vals.reduce((n, v) => n + v, 0);
  const tok = toks.reduce((n, v) => n + v, 0);
  const t0 = ts ? new Date((ts - 3600) * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  const t1 = ts ? new Date(ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div className="heartbeat" title={`tasks per 5-min block · last 60 min (${t0} → ${t1}): ${tot} task${tot === 1 ? '' : 's'} · ${big(tok)} tokens`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke="var(--ok)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function AgentCard({ a, onAgent, now, snapTs }) {
  const st = statusOf(a);
  const off = st.group === 'offline';
  const border = off ? 'st-off' : st.group === 'working' ? 'st-working' : st.cls === 'ok' ? 'st-ok' : 'st-warn';
  return (
    <div
      className={`agent ${border}`} role="button" tabIndex={0}
      aria-label={`${a.agent_name}, ${st.label}. Activate for details.`}
      title={`${a.agent_name} — click for details`}
      onClick={() => onAgent(a.agent_id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAgent(a.agent_id); } }}
    >
      <div className="ahead">
        <span className="ava"><Avatar value={a.avatar} /></span>
        <div className="amin">
          <div className="aname">{a.agent_name}</div>
          <div className={`sline ${st.cls}`}><i className={`ph ${st.icon}`}></i>{st.label}</div>
        </div>
        <span className={`dot ${st.cls}`}><i className={`ph ${st.icon}`}></i></span>
      </div>
      <div className="amiddle">
        <span className={`rt ${a.runtime_online ? 'on' : ''}`}
          title={`${a.runtime_name || a.daemon_id} — runtime ${a.runtime_online ? 'ON' : 'OFF'}`}>
          <i className={`ph ${a.runtime_online ? 'ph-desktop-tower' : 'ph-plug-charging'}`}></i>
        </span>
        <span className="ld" title={`${a.running} running`}>
          <i className="ph ph-gear-six"></i>{a.running}</span>
        <span className="ld" title={`${a.pending_total} queued`}>
          <i className="ph ph-tray"></i>{a.queued + a.dispatched}</span>
        {a.oldest_pending_s != null && (a.queued + a.dispatched) > 0 && (
          <span className="ld warn" title={`waiting ${fmtDur(a.oldest_pending_s)}`}>
            <i className="ph ph-hourglass-medium"></i>{fmtDur(a.oldest_pending_s)}</span>)}
        <LastIcon status={a.last_status} />
        <span className="bdgs">
          {a.last_error && (
            <span className="bdg crit" title={`last run ${a.last_status} — click for details`}><i className="ph ph-warning"></i></span>)}
          {a.stale_runtime && <span className="bdg" title="non-standard runtime">stale</span>}
        </span>
      </div>
      <MiniSpark spark={a.spark} ts={a.spark_ts} />
      <TaskLine cur={a.current} snapTs={snapTs} now={now} onAgent={onAgent} />
    </div>
  );
}

const RANK = (x) => (!x.runtime_online ? 3 : x.running > 0 ? 0 : (x.pending_total || 0) > 0 ? 1 : 2);

export function Workspace({ snap, onAgent, now }) {
  const agents = [...(snap.multica.agents || [])].sort((a, b) => RANK(a) - RANK(b));
  const w = agents.filter((a) => a.running > 0).length;
  const q = agents.filter((a) => (a.pending_total || 0) > 0 && a.running === 0).length;
  return (
    <>
      <h2><i className="ph ph-grid-four"></i> <span className="small">
        {agents.length} agents · {w} working · {q} queued</span></h2>
      <div className="wgrid">
        {agents.map((a) => (
          <AgentCard key={a.agent_id} a={a} onAgent={onAgent} now={now} snapTs={snap.ts} />
        ))}
      </div>
    </>
  );
}

export function hotProviders(live) {
  const s = new Set();
  for (const m of (live?.models || [])) {
    if ((m.req_min || 0) > 0 && m.provider) s.add(String(m.provider).toLowerCase());
  }
  for (const a of (live?.active || [])) {
    if (a.provider) s.add(String(a.provider).toLowerCase());
  }
  return s;
}

const LINK_PROV = { cc: 'claude', oc: 'opencode' };

export function comboHot(combo, combos, hot) {
  if (!hot.size) return false;
  const seen = new Set();
  const walk = (name, depth) => {
    if (depth > 2 || seen.has(name)) return false;
    seen.add(name);
    const c = (combos || []).find((x) => x.name === name);
    const chain = c ? c.chain || [] : [{ link: name }];
    return chain.some((l) => {
      const link = String(l.link || l);
      if (!link.includes('/')) {
        return (combos || []).some((x) => x.name === link) ? walk(link, depth + 1) : false;
      }
      const head = link.split('/')[0].toLowerCase();
      return hot.has(LINK_PROV[head] || head);
    });
  };
  return walk(combo.name, 0);
}

export function QuotaList({ snap, routerUrl, live, onConn }) {
  const hot = hotProviders(live);
  const conns = [...(snap.router.connections || [])].sort((x, y) => y.isActive - x.isActive);
  return (
    <ul className="rows">
      {conns.map((c, i) => {
        if (!c.isActive) {
          return (
            <li className="row stale" key={c.id || i}>
              <span className="ell"><Logo provider={c.provider} size={16} routerUrl={routerUrl} /> <b>{c.provider}</b>
              <span className="small"> {c.account}</span></span><span className="pill">OFF</span>
            </li>);
        }
        const wins = c.windows || [];
        const prim = wins.find((w) => w.label === c.primary) || wins[0];
        const pv = prim ? parseFloat(prim.remaining_pct) : NaN;
        const cls = isNaN(pv) ? '' : pv <= 10 ? 'hot' : pv <= 30 ? 'mid' : '';
        const isHot = c.isActive && hot.has(String(c.provider || '').toLowerCase());
        return (
          <li className={`row stack${isHot ? ' liveact' : ''}`} key={c.id || i} role="button" tabIndex={0}
            aria-label={`${c.provider} ${c.account} quota. Activate for details.`}
            onClick={() => onConn(c)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onConn(c); } }}>
            <span className="ell" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Logo provider={c.provider} size={16} routerUrl={routerUrl} /> <b>{c.provider}</b>
              <span className="small">{c.account}{prim ? ` · ${prim.label}` : ''}</span>
              <span className="mono" style={{ marginLeft: 'auto' }}>{isNaN(pv) ? '—' : pv.toFixed(0) + '%'}</span>
              {(c.last_error || '') !== ''
                ? <i className="ph ph-warning warn" title="has error — click for details"></i>
                : <i className="ph ph-check-circle ok"></i>}
              <i className="ph ph-caret-right go"></i>
            </span>
            <span className={`bar ${cls}`}><i style={{ width: `${isNaN(pv) ? 0 : pv}%` }}></i></span>
            {wins.filter((w) => w.label !== c.primary).map((w) => (
              <span className="small mono" key={w.label}>
                {w.label}: {w.remaining_pct == null ? '—' : `${w.remaining_pct}% left · resets ${w.reset_in}`}
              </span>))}
          </li>);
      })}
    </ul>
  );
}

const LINK_ICON = {
  ok: 'ph-check-circle ok', low: 'ph-warning warn', exhausted: 'ph-x-circle crit',
  error: 'ph-x-circle crit', inactive: 'ph-minus-circle crit', unknown: 'ph-question',
};

export function ComboList({ snap, live, onCombo }) {
  const combos = snap.router.combos || [];
  const hot = hotProviders(live);
  const dot = { ok: ['ok', 'ph-check'], degraded: ['warn', 'ph-minus'], down: ['crit', 'ph-x'], unknown: ['mut', 'ph-question'] };
  return (
    <ul className="rows">
      {combos.map((c) => {
        const v = c.verdict || 'unknown';
        const [dc, di] = dot[v] || dot.unknown;
        const isHot = comboHot(c, combos, hot);
        return (
          <li className={`row${isHot ? ' liveact' : ''}`} key={c.name} role="button" tabIndex={0}
            aria-label={`Combo ${c.name}, ${v}. Activate for details.`}
            onClick={() => onCombo(c)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCombo(c); } }}>
            <span className={`cdot ${dc}`} title={`verdict: ${v} — click for chain`}><i className={`ph ${di}`}></i></span>
            <span className="mono ell"><b>{c.name}</b></span>
            <span className="graph">
              {(c.chain || []).map((l, j) => (
                <span key={j}>
                  {j ? <i className="ph ph-arrow-right small"></i> : null}
                  <i className={`ph ${LINK_ICON[l.status] || 'ph-question'}`}
                    title={`${l.link}: ${l.status} — ${l.detail || ''}`}></i>
                </span>))}
            </span>
            <i className="ph ph-caret-right go"></i>
          </li>);
      })}
    </ul>
  );
}

export function RuntimeList({ snap, onRuntime }) {
  const known = snap.multica.runtimes_known || [];
  const agents = snap.multica.agents || [];
  return (
    <ul className="rows">
      {known.map((r) => {
        const n = agents.filter((a) => a.runtime_id === r.id).length;
        return (
          <li className="row" key={r.id || r.daemon_id} role="button" tabIndex={0}
            aria-label={`Runtime ${r.name || r.daemon_id}. Activate for details.`}
            onClick={() => onRuntime(r)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRuntime(r); } }}>
            <span className={`dot ${r.online ? 'ok' : 'muted'}`}>
              <i className={`ph ${r.online ? 'ph-desktop-tower' : 'ph-plug-charging'}`}></i>
            </span>
            <span className="ell"><b>{r.name || r.daemon_id}</b>
              <span className="small"> {n} agent{n === 1 ? '' : 's'}</span></span>
            <i className="ph ph-caret-right go"></i>
          </li>);
      })}
    </ul>
  );
}

export function StaleList({ snap }) {
  const stale = snap.multica.runtimes_stale || [];
  return (
    <ul className="rows">
      {stale.map((r, i) => (
        <li className="row stale mini" key={r.id || i}>
          <span className="mono ell">{r.daemon_id}</span>
          <span className="small" style={{ marginLeft: 'auto' }}>{r.online ? 'online' : 'offline'} · {r.last_seen || '—'}</span>
        </li>))}
    </ul>
  );
}

export function InfraList({ snap, onEcs }) {
  return (
    <ul className="rows">
      {(snap.ecs.services || []).map((v, i) => (
        <li className="row" key={v.service} role="button" tabIndex={0}
          aria-label={`ECS service ${v.service}. Activate for details.`}
          onClick={() => onEcs(v)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEcs(v); } }}>
          <span className="mono ell">{short(v.service, 26)}</span>
          <span className="mono">des {v.desired} · run {v.running}</span>
          {(v.pending || 0) > 0
            ? <span className="bdg warn">{v.pending}</span>
            : <i className="ph ph-check-circle ok"></i>}
          <i className="ph ph-caret-right go"></i>
        </li>))}
    </ul>
  );
}

export function HeatSeg({ range, onRange }) {
  const opts = [{ v: 'week', l: '7 Days' }, { v: 'month', l: '90 Days' }];
  return (
    <span className="seg">
      {opts.map((o) => (
        <button key={o.v} className={range === o.v ? 'on' : ''}
          onClick={() => onRange(o.v)}>{o.l}</button>))}
    </span>
  );
}
export function Heatmap({ hist }) {
  const buckets = hist?.buckets || [];
  const bs = hist?.bucket_s || 86400;
  const kind = hist?.kind || 'week';
  const hour = (ts) => new Date(ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const day = (ts) => new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const tot = (gi) => (hist.agents || []).reduce((n, g) => n + (g.scores[gi] || 0), 0);
  const max = Math.max(1, ...buckets.map((_, gi) => tot(gi)));
  const cell = (key, ts, v, lbl) => {
    const lv = v <= 0 ? 0 : Math.min(4, Math.ceil((4 * v) / max));
    return <i key={key} className={`cell lv${lv}`} title={`${lbl} · activity ${v}`}></i>;
  };
  let grid = <span className="small">No history yet.</span>;
  if (buckets.length && kind === 'week') {
    // Team total: 7 day-rows x 24 hour-blocks (1 block = 1 hour).
    const days = [];
    for (let d = 0; d < 7; d++) days.push(buckets.slice(d * 24, d * 24 + 24));
    grid = (
      <div className="cal7">
        {days.map((hrs, d) => (
          <div className="hrow7" key={d}>
            <span className="hday">{hrs.length ? day(hrs[0]) : ''}</span>
            <span className="hcells">{hrs.map((ts) => cell(ts, ts, tot(buckets.indexOf(ts)), `${day(ts)} ${hour(ts)}`))}</span>
          </div>))}
      </div>
    );
  } else if (buckets.length && kind === 'month') {
    const cols = Math.ceil(buckets.length / 7);
    const weeks = [];
    for (let w = 0; w < cols; w++) weeks.push(buckets.slice(w * 7, w * 7 + 7));
    grid = (
      <div className="cal">
        {weeks.map((wk, w) => (
          <div className="wcol" key={w}>
            {wk.map((ts) => {
              const gi = buckets.indexOf(ts);
              return cell(ts + ':' + w, ts, tot(gi), new Date(ts * 1000).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }));
            })}
          </div>))}
      </div>
    );
  } else if (buckets.length) {
    grid = (hist.agents || []).map((g) => (
      <div className="hrow" key={g.id}>
        <span className="hname">{g.name}</span>
        <span className="hcells">{g.scores.map((v, i) => cell(buckets[i] + ':' + g.id, buckets[i], v, hour(buckets[i])))}</span>
      </div>));
  }
  return (
    <>
      <div>{grid}</div>
      <div className="legend small">Less
        {[0, 1, 2, 3, 4].map((l) => <i key={l} className={`cell lv${l}`}></i>)} More</div>
      {buckets.length > 0 && (
        <div className="small">
          {kind === 'day' ? `${hour(buckets[0])} → ${hour(buckets[buckets.length - 1])}, hourly` : kind === 'week' ? 'last 7 days · 1 block = 1 hour' : `${day(buckets[0])} → ${day(buckets[buckets.length - 1])}, 1 block = 1 day`}
        </div>)}
    </>
  );
}

export function StreamPanel({ live, now }) {
  const seen = useRef(new Set());
  if (!live) return <div className="small">Waiting for stream…</div>;
  const mark = (k) => {
    const fresh = !seen.current.has(k);
    seen.current.add(k);
    if (seen.current.size > 400) {
      const it = seen.current.values();
      for (let i = 0; i < 100; i++) seen.current.delete(it.next().value);
    }
    return fresh ? ' fresh' : '';
  };
  const act = live.active || [];
  const N_RECENT = 8;
  const recent = (live.recent || []).slice(0, N_RECENT);
  return (
    <>
      <div className="activehold">
        {!live.ok ? null : act.length ? (
          <ul className="rows">
            {act.map((a, i) => (
              <li className={`row frow liveact${mark('a:' + a.model + '|' + a.provider + '|' + a.account)}`} key={i}>
                <span className="pulse-ic"><i className="ph ph-gear-six"></i></span>
                <span className="ell"><b className="mono">{a.model}</b>
                  <span className="small"> → {a.provider}{a.account ? ' · ' + a.account : ''}</span></span>
                <span className="small mono">in flight{a.count > 1 ? ' ×' + a.count : ''}</span>
              </li>))}
          </ul>
        ) : null}
      </div>
      <ul className="rows" style={{ marginTop: 6 }}>
        {recent.map((q, i) => (
          <li className={`row frow${mark('r:' + q.ts + '|' + q.model + '|' + q.in_tok)}`} key={i}>
            <i className={`ph ${q.status === 'ok' ? 'ph-check-circle ok' : 'ph-x-circle crit'}`}></i>
            <span className="ell"><b className="mono">{q.model}</b>
              <span className="small"> → {q.provider}</span></span>
            <span className="small mono" title={`${big(q.in_tok)} in / ${big(q.out_tok)} out tokens`}>
              ↓{big(q.in_tok)} ↑{big(q.out_tok)}</span>
            <span className="small" title={q.ts || ''}>
              <i className="ph ph-clock"></i> {rel(q.ts, now)}
            </span>
          </li>))}
      </ul>
      <ul className="rows" style={{ marginTop: 6 }}>
        {(live.by_key || []).map((k) => {
          const mx = Math.max(1, ...(live.by_key || []).map((x) => x.requests));
          return (
            <li className="row" key={k.key}>
              <span className="ell"><i className="ph ph-key"></i> <b>{k.key}</b></span>
              <span className="bar" style={{ flex: 1 }}>
                <i style={{ width: `${Math.round((k.requests / mx) * 100)}%` }}></i></span>
              <span className="mono" title={`${big(k.in_tok)} in / ${big(k.out_tok)} out tokens`}>{big(k.requests)} req</span>
            </li>);
        })}
      </ul>
      {(live.per_min || []).length > 0 && (
        <div className="spark" title="requests per minute, last 10 minutes">
          {live.per_min.map((v, i) => {
            const mx = Math.max(1, ...live.per_min);
            return <i key={i} style={{ height: `${Math.max(8, Math.round((v / mx) * 100))}%` }}></i>;
          })}
        </div>)}
    </>
  );
}

function Kv({ k, v }) {
  return <div className="mrow"><span>{k}</span><span>{v}</span></div>;
}

function AgentProfile({ a }) {
  const p = a.profile || {};
  const skills = p.skills || [];
  return (<>
    <h4>Profile</h4>
    {p.description && <div style={{ marginBottom: 6 }}>{p.description}</div>}
    <Kv k="Model" v={<span className="mono">{p.model || a.model || 'default'}</span>} />
    <Kv k="Thinking" v={<span className="mono">{p.thinking_level || '—'}</span>} />
    <Kv k="Access" v={<span className="mono">{p.permission_mode || '—'}</span>} />
    {p.service_tier && <Kv k="Tier" v={<span className="mono">{p.service_tier}</span>} />}
    <Kv k="MCP" v={p.has_mcp ? 'configured (values redacted)' : 'none'} />
    {(p.custom_args || []).length > 0 &&
      <Kv k="Args" v={<span className="mono">{p.custom_args.join(' ')}</span>} />}
    <Kv k="Skills" v={skills.length ? `${skills.filter((s) => s.enabled).length}/${skills.length} enabled` : 'none'} />
    {skills.length > 0 && (
      <ul className="rows">{skills.map((s, i) => (
        <li className="row" key={i}>
          <i className={`ph ph-puzzle-piece ${s.enabled ? 'ok' : ''}`}></i>
          <span><b>{s.name}</b></span>
        </li>))}</ul>)}
    {p.instructions && (
      <details><summary className="small"><b>Instructions</b> ({p.instructions.length} chars)</summary>
        <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{p.instructions}</div></details>)}
  </>);
}

// Error text, tidied: [CODE] + headline + wrapped detail (never raw JSON dump).
export function ErrBlock({ text }) {
  const s = String(text || '');
  if (!s) return null;
  const code = (s.match(/\[(\d{3})\]/) || [])[1] || '';
  let msg = '';
  const jm = s.match(/\{[\s\S]*\}/);
  if (jm) {
    try {
      const j = JSON.parse(jm[0].replace(/\n/g, ''));
      const e = j.error || j;
      msg = String(e.message || e.text || '');
    } catch { msg = ''; }
  }
  const head = s.split('\n')[0].replace(/\{[\s\S]*$/, '').trim();
  return (
    <div className="errbox">
      <div className="errhead">
        <i className="ph ph-warning"></i>
        {code && <span className="pill crit">{code}</span>}
        <b>{short(msg || head, 110)}</b>
      </div>
      {msg && head && msg !== head && <div className="small mono">{short(head, 160)}</div>}
      <details><summary className="small">full error</summary>
        <div className="mono small">{s.slice(0, 800)}</div></details>
    </div>
  );
}

export function QuotaSpark({ hist, provider, account, window }) {
  const q = (hist?.quotas || []).find((x) =>
    x.label === `${provider} · ${account} · ${window}`);
  const pts = q?.points || [];
  if (pts.length < 2) return null;
  const w = 120, h = 26;
  const vals = pts.map((p) => p[1]);
  const max = Math.max(...vals, 1);
  const step = w / Math.max(1, vals.length - 1);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`).join(' ');
  const first = vals[0], last = vals[vals.length - 1];
  const trend = last < first ? 'down' : last > first ? 'up' : 'flat';
  return (
    <span className="sparkline" title={`quota trend 24h: ${first}% → ${last}%`}>
      <svg width={w} height={h}><path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" /></svg>
      <span className="small">{trend === 'down' ? <i className="ph ph-trend-down crit"></i> : trend === 'up' ? <i className="ph ph-trend-up ok"></i> : <i className="ph ph-minus small"></i>}</span>
    </span>
  );
}

export function Modal({ snap, hist, modal, onAgent, onClose }) {
  const closeRef = useRef(null);
  const opener = useRef(document.activeElement);
  useEffect(() => {
    closeRef.current && closeRef.current.focus();
    return () => { if (opener.current instanceof HTMLElement) opener.current.focus(); };
  }, []);
  if (!modal) return null;
  const { kind, id } = modal;
  let body = null;
  if (kind === 'agent') {
    const a = (snap.multica.agents || []).find((x) => x.agent_id === id);
    if (!a) return null;
    const st = statusOf(a);
    body = (<>
      <h3><span className="ava"><Avatar value={a.avatar} /></span> {a.agent_name}</h3>
      <div style={{ marginBottom: 8 }}>
        <span className={`pill ${st.cls}`}>{st.label}</span>
        {a.stale_runtime && ' '}
        {a.stale_runtime && <span className="pill">non-standard runtime</span>}
        <a className="extlink" href="https://multica.ai" target="_blank" rel="noopener" title="Open Multica web">
          Open in Multica <i className="ph ph-arrow-square-out"></i></a>
      </div>
      <Kv k="Runtime" v={<><i className={`ph ${a.runtime_online ? 'ph-desktop-tower' : 'ph-plug-charging'}`}></i> {a.runtime_name || a.daemon_id} <span className="small mono">{a.daemon_id} · {a.runtime_online ? 'ON' : 'OFF'}</span></>} />
      <Kv k="Provider" v={<>{a.runtime_provider || '—'}</>} />
      <Kv k="Model" v={<span className="mono">{a.model || 'default'}</span>} />
      <Kv k="Load" v={<span className="mono">q{a.queued} · d{a.dispatched} · r{a.running}</span>} />
      {a.concurrency ? (
        <div className="slots" title={`${a.running || 0}/${a.concurrency} concurrency slots used`}>
          <span className="bar" style={{ flex: 1 }}>
            <i style={{ width: `${Math.min(100, Math.round(((a.running || 0) / a.concurrency) * 100))}%` }}></i>
          </span>
          <span className="small mono">{a.running || 0}/{a.concurrency} slots</span>
        </div>) : null}
      <Kv k="Last run" v={<span className="mono">{a.last_status}</span>} />
      {a.last_error && <ErrBlock text={a.last_error} />}
      <AgentProfile a={a} />
      {a.current && (<><h4>Current task</h4>
        <div className="taskline"><i className={`ph ${kindIcon(a.current.kind)}`}></i>
          <b>{a.current.kind_label || a.current.summary}</b>
          <div className="small"><Mentions text={a.current.summary} onAgent={(x) => onAgent(x)} /></div></div></>)}
      <h4>Recent tasks</h4>
      <div className="timeline">{(a.recent || []).map((t, i) => (
        <div className={`tl-item st-${t.status === 'failed' ? 'bad' : t.status === 'completed' ? 'ok' : 'run'}`} key={i}>
          <span className="tl-dot"></span>
          <div className="tl-body">
            <div className="tl-head"><b>{t.kind_label || t.kind}</b>
              <span className="small mono">{t.started_at ? fullDT(t.started_at) : ''}{t.ended_at && t.status !== 'running' ? ' → ' + fullDT(t.ended_at) : ''}</span></div>
            <div><Mentions text={t.summary} onAgent={(x) => onAgent(x)} />{t.issue ? ' · ' + short(t.issue, 14) : ''}</div>
            <div className="small mono">{t.status}{t.elapsed_s != null ? ' · ' + fmtDur(t.elapsed_s) : ''}</div>
            {t.error && <ErrBlock text={t.error} />}
          </div>
        </div>))}</div>
    </>);
  } else if (kind === 'conn') {
    const c = (snap.router.connections || [])[id];
    if (!c) return null;
    body = (<>
      <h3>{c.provider} <span className="small">{c.account}</span></h3>
      <Kv k="Plan" v={c.plan || '—'} />
      <Kv k="Active" v={c.isActive ? 'yes' : 'no'} />
      <Kv k="Health check" v={c.testStatus || '?'} />
      {c.last_error && <ErrBlock text={c.last_error} />}
      <h4>Quota windows</h4>
      {(c.windows || []).map((w) => {
        const pct = parseFloat(w.remaining_pct);
        return (
          <div className="win" key={w.label}>
            <div className="small"><b>{w.label}</b> <QuotaSpark hist={hist} provider={c.provider} account={c.account} window={w.label} /></div>
            <div className={`bar ${isNaN(pct) ? '' : pct <= 10 ? 'hot' : pct <= 30 ? 'mid' : ''}`}>
              <i style={{ width: `${isNaN(pct) ? 0 : pct}%` }}></i></div>
            <div className="small mono">{isNaN(pct) ? '—' : `${pct}% left · used ${big(w.used)}/${big(w.total)}`} · resets {w.reset_in}</div>
          </div>);
      })}
    </>);
  } else if (kind === 'combo') {
    const c = (snap.router.combos || [])[id];
    if (!c) return null;
    body = (<>
      <h3><i className="ph ph-git-fork"></i> {c.name} <span className="pill">{(c.verdict || '').toUpperCase()}</span></h3>
      <ul className="rows">{(c.chain || []).map((l, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i ? <div className="chain-arrow"><i className="ph ph-arrow-down"></i> fallback</div> : null}
          <li className="row"><span className="mono"><b>{l.link}</b></span>
            <span className="small">{l.detail || ''}</span><span className="pill">{l.status}</span></li>
        </span>))}
      </ul>
    </>);
  } else if (kind === 'ecs') {
    const v = (snap.ecs.services || [])[id];
    if (!v) return null;
    body = (<>
      <h3><i className="ph ph-cloud"></i> <span className="mono">{v.service}</span></h3>
      <Kv k="Source" v={'ECS ' + snap.modes.ecs} />
      <Kv k="Desired" v={v.desired} />
      <Kv k="Running" v={v.running} />
      <Kv k="Pending" v={v.pending ?? 0} />
    </>);
  } else if (kind === 'runtime') {
    const r = [...(snap.multica.runtimes_known || []), ...(snap.multica.runtimes_stale || [])].find((x) => (x.id || x.daemon_id) === id);
    if (!r) return null;
    const bound = (snap.multica.agents || []).filter((a) => a.runtime_id === r.id);
    body = (<>
      <h3><i className={`ph ${r.online ? 'ph-desktop-tower' : 'ph-plug-charging'}`}></i> {r.name || r.daemon_id}</h3>
      <div style={{ marginBottom: 8 }}>
        <span className={`pill ${r.online ? 'ok' : ''}`}>{r.online ? 'ONLINE' : 'OFFLINE'}</span></div>
      <Kv k="Daemon" v={<span className="mono">{r.daemon_id}</span>} />
      <Kv k="Provider" v={r.provider || '—'} />
      <Kv k="Last seen" v={<span className="mono">{r.last_seen || '—'}</span>} />
      <h4>Bound agents ({bound.length})</h4>
      <ul className="rows">{bound.map((a) => (
        <li className="row" key={a.agent_id} role="button" tabIndex={0}
          onClick={() => onAgent(a.agent_id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAgent(a.agent_id); } }}>
          <span className="ell"><b>{a.agent_name}</b></span>
          <span className="small mono">q{a.queued}·d{a.dispatched}·r{a.running} · {a.last_status}</span>
          <i className="ph ph-caret-right go"></i></li>))}</ul>
    </>);
  } else if (kind === 'sys') {
    const m = snap.meta || {};
    const rows = [['Workspace', `${m.workspace} (${m.workspace_id})`], ['9Router', `${m.router_url} · v${m.router_version}`],
      ['Multica CLI', 'v' + (m.multica_cli || '?')], ['ECS', `${m.ecs_cluster} · ${m.aws_region} (${snap.modes.ecs})`],
      ['Refresh', `snapshot every ${m.refresh_s}s + cache · live 10s`],
      ['Modes', `multica:${snap.modes.multica} · router:${snap.modes.router} · ecs:${snap.modes.ecs}`]];
    body = (<>
      <h3><i className="ph ph-info"></i> System info & debug</h3>
      <ul className="rows">{rows.map(([k, v]) => (
        <li className="row" key={k}><span className="small">{k}</span><span className="mono">{v}</span></li>))}</ul>
      <h4>9Router endpoints</h4>
      <ul className="rows">{Object.entries(snap.router.endpoint_status || {}).map(([k, v]) => (
        <li className="row" key={k}><span className="mono small">{k}</span>
          <span className="mono">{v === 200 ? <span className="ok">200</span> : <span className="crit">{String(v)}</span>}</span></li>))}</ul>
      <h4>Raw</h4>
      <pre className="mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}>
        insights: {JSON.stringify(snap.insights || [])}
        note router: {snap.router.note || '-'}{snap.ecs.note ? '\nnote ecs: ' + snap.ecs.note : ''}</pre>
    </>);
  }
  return (
    <div id="modalWrap" onClick={(e) => { if (e.target.id === 'modalWrap') onClose(); }}>
      <div id="modal" role="dialog" aria-modal="true">
        <button id="modalX" title="Close" ref={closeRef} onClick={onClose}><i className="ph ph-x"></i></button>
        <div id="modalBody">{body}</div>
      </div>
    </div>
  );
}
