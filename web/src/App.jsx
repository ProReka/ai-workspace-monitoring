import { useEffect, useState } from 'react';
import { fetchHistory, fetchLive, fetchSnapshot } from './api.js';
import { useNow, usePoll, useStored } from './hooks.js';
import {
  ComboList, HeatSeg, Heatmap, InfraList, Modal, Notifications, QuotaList,
  RuntimeList, Section, StaleList, StreamPanel, Tiles, Workspace,
} from './components.jsx';
import { Logo } from './parts.jsx';
import { big, fmtDur } from './fmt.js';

function LiveDock({ live, routerUrl }) {
  const [shut, setShut] = useStored('ov-dock', false);
  const [height, setHeight] = useStored('ov-dock-h', 0);
  const t = (live && live.totals) || {};
  useEffect(() => {
    const head = document.getElementById('dockHead');
    if (!head) return;
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); head.click(); }
    };
    head.addEventListener('keydown', onKey);
    return () => head.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const grip = document.getElementById('dockGrip');
    if (!grip) return;
    const onDown = (e) => {
      e.preventDefault();
      setShut(false);
      const dock = grip.closest('.dock');
      const y0 = e.clientY, h0 = dock.getBoundingClientRect().height;
      const move = (ev) => {
        const h = Math.min(window.innerHeight * 0.7, Math.max(90, h0 + (y0 - ev.clientY)));
        dock.style.height = h + 'px';
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        setHeight(Math.round(dock.getBoundingClientRect().height));
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    };
    grip.addEventListener('mousedown', onDown);
    return () => grip.removeEventListener('mousedown', onDown);
  }, [setHeight, setShut]);
  const tiles = [
    ['ph-lightning', big(t.totalRequests), 'requests'],
    ['ph-arrow-line-down', big(t.totalPromptTokens), 'input tokens'],
    ['ph-arrow-line-up', big(t.totalCompletionTokens), 'output tokens'],
    ['ph-currency-dollar', '$' + Number(t.totalCost || 0).toFixed(2), 'cost'],
  ];
  return (
    <section className={`dock${shut ? ' collapsed' : ''}`} style={height > 0 && !shut ? { height } : undefined} aria-label="Live traffic">
      <div className="dockgrip" id="dockGrip" title="Drag to resize"><i></i></div>
      <div className="dockhead" role="button" tabIndex={0} id="dockHead" aria-expanded={String(!shut)}
        onClick={() => setShut(!shut)}>
        <i className="ph ph-pulse"></i> <b>Live LLM traffic</b>
        <span className="small">{live && live.ok ? `live · ${Math.round(live.age_s || 0)}s old` : 'unavailable'}</span>
        <span className="small mono">{live && live.ok ? `${big(t.totalRequests)} req · $${Number(t.totalCost || 0).toFixed(2)}` : ''}</span>
        <i className={`ph ${shut ? 'ph-caret-up' : 'ph-caret-down'}`}></i>
      </div>
      <div className="dockbody">
        <div className="tiles" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 8 }}>
          {tiles.map(([i, v, x]) => (
            <div className="tile" key={x}>
              <div className="tv">{String(v)}</div>
              <div className="tl"><i className={`ph ${i}`}></i> {x}</div>
            </div>))}
        </div>
        <ul className="rows" style={{ marginBottom: 8 }}>
          {(live?.providers || []).map((p) => (
            <li className="row" key={p.provider}>
              <span className="ell"><Logo provider={p.provider} size={16} routerUrl={routerUrl} /> <b>{p.provider}</b></span>
              <span className="bar" style={{ flex: 1 }}><i style={{ width: `${p.share}%` }}></i></span>
              <span className="mono">{p.share}% · {big(p.requests)} req{p.cost ? ` · $${p.cost}` : ''}</span>
            </li>))}
        </ul>
        <ul className="rows">
          {(live?.models || []).map((m, i) => (
            <li className="row" key={m.label || i}>
              <span className="ell"><Logo provider={m.provider} size={16} routerUrl={routerUrl} />{' '}
                <b className="mono">{m.model}</b> <span className="small">{m.provider}</span></span>
              <span className="mono" title="requests per minute">{m.req_min != null ? m.req_min + '/m' : '—'}</span>
              <span className="small mono">
                {m.tok_min != null ? <><i className="ph ph-arrow-line-down" title={`${big(m.tok_min)} input tokens/min`}></i> </> : null}
                <i className="ph ph-clock" title={`last used ${m.last_used || 'unknown'}`}></i>
              </span>
              {m.req_min > 0 ? <span className="pulsebar" title="active right now"></span> : null}
            </li>))}
        </ul>
      </div>
    </section>
  );
}

export default function App() {
  const snap = usePoll(fetchSnapshot, 20000);
  const live = usePoll(fetchLive, 10000);
  const [range, setRange] = useState('week');
  const [hist, setHist] = useState(null);
  const [theme, setTheme] = useStored('ov-theme', 'dark');
  const [hideL, setHideL] = useStored('ov-hideL', window.matchMedia('(max-width: 1200px)').matches);
  const [hideR, setHideR] = useStored('ov-hideR', window.matchMedia('(max-width: 1200px)').matches);
  const [modal, setModal] = useState(null);
  const now = useNow(true);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    document.body.classList.toggle('hideL', hideL);
    document.body.classList.toggle('hideR', hideR);
  }, [hideL, hideR]);
  useEffect(() => {
    let dead = false;
    fetchHistory(range).then((h) => { if (!dead) setHist(h); }).catch(() => {});
    const t = setInterval(() => {
      fetchHistory(range).then((h) => { if (!dead) setHist(h); }).catch(() => {});
    }, 60000);
    return () => { dead = true; clearInterval(t); };
  }, [range]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setModal(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const s = snap.data;
  const openAgent = (id) => setModal({ kind: 'agent', id });
  const routerUrl = s?.meta?.router_url || '';

  return (
    <>
      <header>
        <span className={`livedot${s?.refreshing ? ' busy' : ''}`} title="collector alive"></span>
        <h1><i className="ph ph-buildings"></i> Command Center</h1>
        <span className="pill ok">ws: {(s?.meta?.workspace) || '…'}</span>
        <button id="themeBtn" title="Toggle light / dark mode"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <i className={`ph ${theme === 'dark' ? 'ph-moon' : 'ph-sun'}`}></i>
        </button>
        <button id="sysBtn" title="System info & debug" onClick={() => setModal({ kind: 'sys' })}>
          <i className="ph ph-info"></i>
        </button>
        <span className="modes">
          {s ? `multica:${s.modes.multica} · router:${s.modes.router} · ecs:${s.modes.ecs}`
            : snap.error ? `collector unreachable (${snap.error.message}) — retrying` : '…'}
        </span>
        <span className="right">
          <span id="clock">{new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>{' '}
          <span id="clockAge" className="small">
            {s?.cache_age_s != null ? `data ${Math.round(s.cache_age_s)}s old${s.refreshing ? ' (refreshing…)' : ''}` : ''}
          </span>{' '}· <a href="/api/snapshot" style={{ color: 'inherit' }}>JSON</a>
        </span>
      </header>
      <main className="layout">
        <aside className="col side left" aria-label="Left panel">
          <div className="sidetool">
            <button title="Hide left panel" onClick={() => setHideL(true)}><i className="ph ph-caret-left"></i></button>
          </div>
          {s ? (<>
            <section><Tiles snap={s} /></section>
            <Section id="quota" icon="ph-battery-charging" title="LLM quota" resizable>
              <QuotaList snap={s} routerUrl={routerUrl} onConn={(c) => setModal({ kind: 'conn', id: (s.router.connections || []).indexOf(c) })} />
            </Section>
            <Section id="combos" icon="ph-git-fork" title="combos" resizable>
              <ComboList snap={s} onCombo={(c) => setModal({ kind: 'combo', id: (s.router.combos || []).indexOf(c) })} />
            </Section>
            <Section id="runtimes" icon="ph-desktop-tower" title="Runtimes" resizable>
              <RuntimeList snap={s} onRuntime={(r) => setModal({ kind: 'runtime', id: r.id || r.daemon_id })} />
              <details><summary className="small">Non-standard ({(s.multica.runtimes_stale || []).length})</summary>
                <StaleList snap={s} />
              </details>
            </Section>
            {s.modes.ecs === 'live' && (
              <section>
                <h2><i className="ph ph-cloud"></i> Infra</h2>
                <InfraList snap={s} onEcs={(v) => setModal({ kind: 'ecs', id: (s.ecs.services || []).indexOf(v) })} />
              </section>)}
          </>) : <section><div className="small">Loading snapshot…</div></section>}
        </aside>
        <section className="col center" aria-label="Workspace">
          <div className="floor">
            {s ? <Workspace snap={s} onAgent={openAgent} now={now} /> : <div className="small">Loading agents…</div>}
          </div>
        </section>
        <aside className="col side right" aria-label="Right panel">
          <div className="sidetool">
            <button title="Hide right panel" onClick={() => setHideR(true)}><i className="ph ph-caret-right"></i></button>
          </div>
          {s ? (<>
            <Section id="notifs" icon="ph-bell"
              title={`Notifications (${(s.alerts || []).length + (s.notices || []).length})`} resizable>
              <Notifications snap={s} />
            </Section>
            <Section id="stream" icon="ph-waves" title="Stream" resizable>
              <StreamPanel live={live.data} now={now} />
            </Section>
            <Section id="activity" icon="ph-chart-bar" title="Activity"
              head={<HeatSeg range={range} onRange={setRange} />}>
              <Heatmap hist={hist} />
            </Section>
          </>) : <section><div className="small">Loading…</div></section>}
        </aside>
        <LiveDock live={live.data} routerUrl={routerUrl} />
      </main>
      <button id="edgeL" className={`edge${hideL ? '' : ' hidden'}`} title="Show left panel" onClick={() => setHideL(false)}>
        <i className="ph ph-caret-right"></i>
      </button>
      <button id="edgeR" className={`edge${hideR ? '' : ' hidden'}`} title="Show right panel" onClick={() => setHideR(false)}>
        <i className="ph ph-caret-left"></i>
      </button>
      {modal && s && <Modal snap={snap.data} hist={hist} modal={modal} onAgent={openAgent} onClose={() => setModal(null)} />}
    </>
  );
}
