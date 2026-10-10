let SNAP = null, HEAT_RANGE = "week";
const THEME_KEY = "ov-theme";
function syncThemeBtn() {
  document.getElementById("themeBtn").innerHTML =
    document.documentElement.dataset.theme === "dark" ? '<i class="ph ph-moon"></i>' : '<i class="ph ph-sun"></i>';
}
function initTheme() {
  const t = localStorage.getItem(THEME_KEY) || "dark";
  document.documentElement.dataset.theme = t;
  syncThemeBtn();
}
document.getElementById("themeBtn").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  syncThemeBtn();
});
initTheme();
function syncPanels() {
  const L = document.body.classList.contains("hideL"), R = document.body.classList.contains("hideR");
  document.getElementById("edgeL").classList.toggle("hidden", !L);
  document.getElementById("edgeR").classList.toggle("hidden", !R);
  try { localStorage.setItem("ov-panels", (L ? "L" : "") + (R ? "R" : "")); } catch (e) {}
}
function initPanels() {
  let saved = "";
  try { saved = localStorage.getItem("ov-panels") || ""; } catch (e) {}
  if (saved.includes("L") || (!saved && window.matchMedia("(max-width: 1200px)").matches)) document.body.classList.add("hideL");
  if (saved.includes("R") || (!saved && window.matchMedia("(max-width: 1200px)").matches)) document.body.classList.add("hideR");
  syncPanels();
}
document.getElementById("hideL").addEventListener("click", () => { document.body.classList.add("hideL"); syncPanels(); });
document.getElementById("hideR").addEventListener("click", () => { document.body.classList.add("hideR"); syncPanels(); });
document.getElementById("edgeL").addEventListener("click", () => { document.body.classList.remove("hideL"); syncPanels(); });
document.getElementById("edgeR").addEventListener("click", () => { document.body.classList.remove("hideR"); syncPanels(); });
initPanels();
function tickClock() {
  document.getElementById("clock").textContent =
    new Date().toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit", second: "2-digit"});
}
tickClock(); setInterval(tickClock, 1000);
function initDock() {
  let shut = false;
  try { shut = localStorage.getItem("ov-dock") === "shut"; } catch (e) {}
  const dock = document.querySelector(".dock");
  const apply = () => {
    dock.classList.toggle("collapsed", shut);
    document.getElementById("dockHead").setAttribute("aria-expanded", String(!shut));
  };
  document.getElementById("dockHead").addEventListener("click", () => {
    shut = !shut;
    try { localStorage.setItem("ov-dock", shut ? "shut" : "open"); } catch (e) {}
    apply();
  });
  document.getElementById("dockHead").addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.getElementById("dockHead").click(); }
  });
  apply();
  // drag-to-resize dock height
  const grip = document.getElementById("dockGrip");
  let savedH = 0;
  try { savedH = parseInt(localStorage.getItem("ov-dock-h") || "0", 10) || 0; } catch (e) {}
  if (savedH > 0) dock.style.height = Math.min(window.innerHeight * 0.7, Math.max(90, savedH)) + "px";
  grip.addEventListener("mousedown", e => {
    e.preventDefault();
    dock.classList.remove("collapsed");
    const y0 = e.clientY, h0 = dock.getBoundingClientRect().height;
    const move = ev => {
      const h = Math.min(window.innerHeight * 0.7, Math.max(90, h0 + (y0 - ev.clientY)));
      dock.style.height = h + "px";
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      try { localStorage.setItem("ov-dock-h", String(Math.round(dock.getBoundingClientRect().height))); } catch (err) {}
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  });
}
initDock();
document.querySelectorAll("#rangeSeg button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll("#rangeSeg button").forEach(x => x.classList.remove("on"));
  b.classList.add("on"); HEAT_RANGE = b.dataset.r; heat();
}));
document.getElementById("modalX").addEventListener("click", closeModal);
document.getElementById("modalWrap").addEventListener("click", e => { if (e.target.id === "modalWrap") closeModal(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeModal(); return; }
  if ((e.key === "Enter" || e.key === " ") && e.target instanceof HTMLElement) {
    const t = e.target.closest("[data-agent],[data-conn],[data-combo],[data-ecs]");
    if (t) { e.preventDefault(); t.click(); }
  }
});
document.addEventListener("click", e => {
  const m = e.target instanceof HTMLElement && e.target.closest(".mention[data-agent]");
  if (m) { e.preventDefault(); openAgent(m.dataset.agent); }
});
let lastFocus = null;
function openModal(html) {
  lastFocus = document.activeElement;
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("modalWrap").classList.remove("hidden");
  document.getElementById("modalX").focus();
}
function closeModal() {
  document.getElementById("modalWrap").classList.add("hidden");
  if (lastFocus instanceof HTMLElement) lastFocus.focus();
}

async function tick() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 90000);
    const r = await fetch("/api/snapshot", {cache: "no-store", signal: ctl.signal});
    clearTimeout(timer);
    if (!r.ok) throw new Error("HTTP " + r.status);
    SNAP = await r.json();
    render(SNAP);
  } catch (e) {
    document.getElementById("modes").textContent =
      "collector unreachable (" + (e.name === "AbortError" ? "timeout" : e.message) + ") — retrying in 5s";
    setTimeout(tick, 5000);
  }
}
async function heat() {
  try {
    const r = await fetch("/api/history?range=" + HEAT_RANGE, {cache: "no-store"});
    if (r.ok) renderHeat(await r.json());
  } catch (e) {}
}
async function live() {
  try {
    const r = await fetch("/api/live", {cache: "no-store"});
    if (r.ok) { const l = await r.json(); renderLive(l); renderStream(l); }
  } catch (e) {}
}
function ago(ts) {
  if (!ts) return "—";
  const s = Math.max(0, Date.now() / 1000 - new Date(ts).getTime() / 1000);
  if (s < 60) return Math.floor(s) + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}
function agoShort(ts) {
  const a = ago(ts);
  return a === "—" ? a : a.replace(/ ago$/, "");
}
function big(n) {
  n = Number(n || 0);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(Math.round(n));
}
function renderLive(l) {
  const t = l.totals || {};
  document.getElementById("liveAge").textContent = `live · ${l.age_s != null ? Math.round(l.age_s) + "s old" : ""}`;
  const tiles = [
    ["ph-lightning", big(t.totalRequests), "requests"],
    ["ph-arrow-line-down", big(t.totalPromptTokens), "input tokens"],
    ["ph-arrow-line-up", big(t.totalCompletionTokens), "output tokens"],
    ["ph-currency-dollar", "$" + Number(t.totalCost || 0).toFixed(2), "cost"],
  ];
  document.getElementById("livetotals").innerHTML = tiles.map(([i, v, x]) =>
    `<div class="tile"><div class="tv">${esc(String(v))}</div><div class="tl"><i class="ph ${i}"></i> ${x}</div></div>`).join("");
  document.getElementById("livemodels").innerHTML = !l.ok
    ? `<li class="row"><span class="small">stream unavailable</span></li>`
    : (l.models || []).map(m =>
      `<li class="row"><span class="ell">${logo(m.provider, 16)} <b class="mono">${esc(m.model)}</b> <span class="small">${esc(m.provider)}</span></span>
       <span class="mono" title="requests per minute">${m.req_min != null ? m.req_min + "/m" : "—"}</span>
       <span class="small mono">${m.tok_min != null ? `<i class="ph ph-arrow-line-down" title="${big(m.tok_min)} input tokens/min"></i>` : ""} <i class="ph ph-clock" title="last used ${esc(m.last_used || "unknown")}"></i> ${agoShort(m.last_used)}</span>
       ${m.req_min > 0 ? `<span class="pulsebar" title="active right now"></span>` : ""}</li>`).join("");
  const tot = l.totals || {};
  document.getElementById("dockSum").textContent =
    l.ok ? `${big(tot.totalRequests)} req · $${Number(tot.totalCost || 0).toFixed(2)}` : "stream unavailable";
  document.getElementById("liveprov").innerHTML = !l.ok ? "" : (l.providers || []).map(p =>
    `<li class="row"><span class="ell">${logo(p.provider, 16)} <b>${esc(p.provider)}</b></span>
     <span class="bar" style="flex:1"><i style="width:${p.share}%"></i></span>
     <span class="mono">${p.share}% · ${big(p.requests)} req${p.cost ? " · $" + p.cost : ""}</span></li>`).join("");
}
function renderStream(l) {
  const age = l.age_s != null ? Math.round(l.age_s) + "s old" : "";
  document.getElementById("streamAge").textContent = l.ok ? `live · ${age}` : "unavailable";
  const act = l.active || [];
  document.getElementById("streamActive").innerHTML = !l.ok ? "" : act.length
    ? `<div class="taskline"><span class="pulsebar" title="in flight right now"></span> <b>${act.length} in flight</b>
       <span class="small">${act.map(a => `${esc(a.model)} → ${esc(a.provider)}${a.account ? " · " + esc(a.account) : ""}${a.count > 1 ? " ×" + a.count : ""}`).join(" · ")}</span></div>`
    : `<div class="small">No in-flight requests.</div>`;
  document.getElementById("streamRecent").innerHTML = !l.ok ? "" : (l.recent || []).map(q =>
    `<li class="row"><i class="ph ${q.status === "ok" ? "ph-check-circle ok" : "ph-x-circle crit"}"></i>
     <span class="ell"><b class="mono">${esc(q.model)}</b> <span class="small">→ ${esc(q.provider)}</span></span>
     <span class="small mono" title="${big(q.in_tok)} in / ${big(q.out_tok)} out tokens">↓${big(q.in_tok)} ↑${big(q.out_tok)}</span>
     <span class="small" title="${esc(q.ts || "")}"><i class="ph ph-clock"></i> ${agoShort(q.ts)}</span></li>`).join("");
  const keys = l.by_key || [];
  const kMax = Math.max(1, ...keys.map(k => k.requests));
  document.getElementById("streamKeys").innerHTML = !l.ok ? "" : keys.map(k =>
    `<li class="row"><span class="ell"><i class="ph ph-key"></i> <b>${esc(k.key)}</b></span>
     <span class="bar" style="flex:1"><i style="width:${Math.round(k.requests / kMax * 100)}%"></i></span>
     <span class="mono" title="${big(k.in_tok)} in / ${big(k.out_tok)} out tokens">${big(k.requests)} req</span></li>`).join("");
  const per = l.per_min || [];
  const pMax = Math.max(1, ...per);
  document.getElementById("streamSpark").innerHTML = !l.ok || !per.length ? "" :
    `<div class="spark" title="requests per minute, last 10 minutes">` +
    per.map(v => `<i style="height:${Math.max(8, Math.round(v / pMax * 100))}%"></i>`).join("") + `</div>`;
}
setInterval(elapsedTick, 5000);
function elapsedTick() {
  if (!SNAP) return;
  const now = Date.now() / 1000, base = SNAP.ts;
  document.querySelectorAll("[data-elapsed]").forEach(el => {
    el.textContent = fmtDur(parseFloat(el.dataset.elapsed) + (now - base));
  });
}

function routerUrl() { return (SNAP && SNAP.meta && SNAP.meta.router_url) || ""; }
function logo(provider, size) {
  const p = String(provider || "").toLowerCase().trim();
  const init = esc((p || "?")[0].toUpperCase());
  const box = `width:${size}px;height:${size}px;`;
  if (!p || !routerUrl()) return `<span class="logobox noimg" style="${box}"><span class="logoinit">${init}</span></span>`;
  return `<span class="logobox" style="${box}" title="${esc(p)}"><img width="${size - 2}" height="${size - 2}" loading="lazy" alt=""
    src="${routerUrl()}/providers/${encodeURIComponent(p)}.png"
    onerror="this.parentNode.classList.add('noimg');this.remove()"><span class="logoinit">${init}</span></span>`;
}
function statusOf(a) {
  const pending = a.pending_total || 0;
  if (!a.runtime_online) return ["muted", "OFFLINE", "offline", "ph-plug-charging"];
  if (a.running > 0) return ["working", "WORKING", "working", "ph-gear-six"];
  if (pending > 0) return ["warn", `QUEUED ${pending}`, "queued", "ph-hourglass-medium"];
  return ["ok", "IDLE", "idle", "ph-moon-stars"];
}
function kindIcon(kind) {
  return {autopilot: "ph-robot", direct: "ph-chat-teardrop-text", issue: "ph-ticket",
    chat: "ph-chats", mention: "ph-at", comment: "ph-comment-text"}[(kind || "").toLowerCase()] || "ph-briefcase";
}

function render(s) {
  const age = s.cache_age_s != null ? `data ${Math.round(s.cache_age_s)}s old${s.refreshing ? " (refreshing…)" : ""}` : "";
  document.getElementById("clockAge").textContent = age;
  tickClock();
  document.getElementById("modes").textContent =
    `multica:${s.modes.multica} · router:${s.modes.router} · ecs:${s.modes.ecs}`;
  document.getElementById("wspill").textContent = "ws: " + ((s.meta || {}).workspace || "?");
  document.getElementById("livedot").className = "livedot" + (s.refreshing ? " busy" : "");
  renderTiles(s); renderNotifs(s); renderWorkspace(s);
  renderQuotas(s); renderCombos(s); renderRuntimes(s); renderMon(s);
  elapsedTick();
}

function renderTiles(s) {
  const agents = s.multica.agents || [];
  const online = agents.filter(a => a.runtime_online).length;
  const running = agents.reduce((n, a) => n + (a.running || 0), 0);
  const queued = agents.reduce((n, a) => n + (a.pending_total || 0), 0);
  let worst = null;
  for (const c of (s.router.connections || [])) {
    if (!c.isActive || c.worst_remaining == null) continue;
    if (!worst || c.worst_remaining < worst.v) worst = {v: c.worst_remaining, p: c.provider};
  }
  const combos = s.router.combos || [];
  const nAlert = (s.alerts || []).length;
  const tiles = [
    ["ph-robot", `${online}/${agents.length}`, "agents online"],
    ["ph-gear-six", running, "tasks running"],
    ["ph-hourglass-medium", queued, "tasks queued"],
    ["ph-battery-medium", worst ? `${worst.v.toFixed(0)}% ${worst.p}` : "—", "lowest quota"],
    ["ph-git-fork", `${combos.filter(c => c.verdict === "ok").length} ok · ${combos.filter(c => c.verdict === "degraded").length} degraded`, "combos"],
    ["ph-bell", nAlert, "notifications"],
  ];
  document.getElementById("tiles").innerHTML = tiles.map(([i, v, l]) =>
    `<div class="tile"><div class="tv">${esc(String(v))}</div><div class="tl"><i class="ph ${i}"></i> ${l}</div></div>`).join("");
}

function renderNotifs(s) {
  const items = [...(s.alerts || []), ...(s.notices || []).map(n => ({...n, ts: n.ts || s.ts}))];
  document.getElementById("notifCount").textContent = items.length;
  const icon = {crit: "ph-octagon", warn: "ph-warning", info: "ph-info"};
  document.getElementById("notifs").innerHTML = items.length
    ? items.map(a => `<div class="alert ${a.level}"><i class="ph ${icon[a.level] || "ph-dot"}"></i>
        <span>${esc(a.msg)}</span><span class="ts" title="${esc(a.source)} · ${new Date((a.ts || s.ts) * 1000).toLocaleString("en-GB")}"><i class="ph ph-clock"></i> ${timeHM(a.ts || s.ts)}</span></div>`).join("")
    : `<div class="small"><i class="ph ph-check-circle"></i> All clear.</div>`;
}

function avatar(a, px) {
  const v = a || "";
  const fs = Math.round(px * 0.62);
  if (v.startsWith("emoji:")) return `<span style="font-size:${fs}px;line-height:1">${esc(v.slice(6))}</span>`;
  if (/^https?:/.test(v)) return `<img src="${esc(v)}" alt="">`;
  return `<span style="font-size:${fs}px;font-weight:700;color:var(--muted)">?</span>`;
}
function fmtMention(text) {
  // [@Label](mention://type/uuid) -> pill; agent type deep-links to our agent modal.
  return esc(text).replace(/\[@(.+?)\]\(mention:\/\/(member|agent|squad|issue|all)\/([0-9a-fA-F-]+|all)\)/g,
    (m, label, type, id) => type === "agent"
      ? `<a class="mention" data-agent="${id}" href="#" title="Open agent ${esc(label)}">@${esc(label)}</a>`
      : `<span class="mention" title="${type} mention">@${esc(label)}</span>`);
}
function taskLine(cur) {
  if (!cur) return "";
  const el = cur.elapsed_s != null ? ` · <span data-elapsed="${cur.elapsed_s}">${fmtDur(cur.elapsed_s)}</span>` : "";
  return `<div class="taskline"><i class="ph ${kindIcon(cur.kind)}"></i> <b>${esc(cur.kind_label || cur.summary)}</b>
    <div class="small clamp1">${fmtMention(cur.summary)}${cur.issue ? ` · <i class="ph ph-ticket"></i> ${esc(short(cur.issue, 12))}` : ""}${el}</div></div>`;
}
function card(a) {
  const [cls, label, group, stIcon] = statusOf(a);
  const off = group === "offline";
  const working = group === "working";
  const border = off ? "st-off" : working ? "st-working" : cls === "ok" ? "st-ok" : "st-warn";
  const badges = [
    a.pending_total > 0 ? `<span class="bdg warn" title="${a.pending_total} pending tasks"><i class="ph ph-tray"></i>${a.pending_total}</span>` : "",
    a.last_error ? `<span class="bdg crit" title="has error — click for details"><i class="ph ph-warning"></i></span>` : "",
    a.stale_runtime ? `<span class="bdg" title="non-standard runtime">stale</span>` : "",
  ].join("");
  return `<div class="agent ${border}" data-agent="${a.agent_id}" role="button" tabindex="0"
    aria-label="${esc(a.agent_name)}, ${label}. Activate for details." title="${esc(a.agent_name)} — click for details">
    <div class="ahead"><span class="ava">${avatar(a.avatar)}</span>
      <div class="amin"><div class="aname">${esc(a.agent_name)}</div></div>
      <span class="dot ${cls.split(" ")[0]}"><i class="ph ${stIcon}"></i></span></div>
    <div class="amiddle"><span class="rt ${a.runtime_online ? "on" : ""}" title="${esc(a.runtime_name || a.daemon_id)} — runtime ${a.runtime_online ? "ON" : "OFF"}">
      <i class="ph ${a.runtime_online ? "ph-desktop-tower" : "ph-plug-charging"}"></i></span>
      <span class="lbl">${label}</span><span class="bdgs">${badges}</span></div>
    ${taskLine(a.current)}</div>`;
}
function renderWorkspace(s) {
  const agents = [...(s.multica.agents || [])].sort((a, b) => {
    const rank = x => !x.runtime_online ? 3 : x.running > 0 ? 0 : (x.pending_total || 0) > 0 ? 1 : 2;
    return rank(a) - rank(b);
  });
  document.getElementById("workspace").innerHTML = agents.map(card).join("");
  document.querySelectorAll("#workspace .agent").forEach(el =>
    el.addEventListener("click", () => openAgent(el.dataset.agent)));
  const w = agents.filter(a => a.running > 0).length, q = agents.filter(a => (a.pending_total || 0) > 0 && a.running === 0).length;
  document.getElementById("wsSub").textContent = `${agents.length} agents · ${w} working · ${q} queued`;
}

function renderQuotas(s) {
  const conns = [...(s.router.connections || [])].sort((x, y) => (y.isActive - x.isActive));
  document.getElementById("quotas").innerHTML = conns.map((c, i) => {
    if (!c.isActive) return `<li class="row stale" data-conn="${i}"><span class="ell">${logo(c.provider, 18)} <b>${esc(c.provider)}</b>
      <span class="small">${esc(c.account)}</span></span><span class="pill">OFF</span></li>`;
    const min = c.worst_remaining;
    const cls = min == null ? "" : min <= 10 ? "hot" : min <= 30 ? "mid" : "";
    return `<li class="row stack" data-conn="${i}" role="button" tabindex="0" aria-label="${esc(c.provider)} ${esc(c.account)} quota. Activate for details.">
      <span class="ell" style="display:flex;gap:6px;align-items:center">${logo(c.provider, 16)} <b>${esc(c.provider)}</b>
      <span class="small">${esc(c.account)}</span>
      <span class="mono" style="margin-left:auto">${min == null ? "—" : min.toFixed(0) + "%"}</span>
      ${(c.last_error || "") !== "" ? `<i class="ph ph-warning warn" title="has error — click for details"></i>` : `<i class="ph ph-check-circle ok"></i>`}<i class="ph ph-caret-right go"></i></span>
      <span class="bar ${cls}"><i style="width:${min == null ? 0 : min}%"></i></span></li>`;
  }).join("");
  document.querySelectorAll("#quotas .row").forEach(el =>
    el.addEventListener("click", () => openConn(conns[+el.dataset.conn])));
}

function healthGraph(chain) {
  const ic = {ok: "ph-check-circle ok", low: "ph-warning warn", exhausted: "ph-x-circle crit",
    error: "ph-x-circle crit", inactive: "ph-minus-circle crit", unknown: "ph-question"};
  return (chain || []).map((l, i) =>
    `${i ? '<i class="ph ph-arrow-right small"></i>' : ""}<i class="ph ${ic[l.status] || "ph-question"}" title="${esc(l.link)}: ${l.status} — ${esc(l.detail || "")}"></i>`
  ).join("");
}
function renderCombos(s) {
  const vp = {ok: "ok", degraded: "warn", down: "crit", unknown: ""};
  const combos = s.router.combos || [];
  document.getElementById("combos").innerHTML = combos.map((c, i) => {
    const v = c.verdict || "unknown";
    const dot = {ok: ["ok", "ph-check"], degraded: ["warn", "ph-minus"], down: ["crit", "ph-x"], unknown: ["mut", "ph-question"]}[v] || ["mut", "ph-question"];
    return `<li class="row" data-combo="${i}" role="button" tabindex="0" aria-label="Combo ${esc(c.name)}, ${v}. Activate for details.">
      <span class="cdot ${dot[0]}" title="verdict: ${v} — click for chain"><i class="ph ${dot[1]}"></i></span>
      <span class="mono ell"><b>${esc(c.name)}</b></span>
      <span class="graph">${healthGraph(c.chain)}</span>
      <i class="ph ph-caret-right go"></i></li>`;
  }).join("");
  document.querySelectorAll("#combos .row").forEach(el =>
    el.addEventListener("click", () => openCombo(combos[+el.dataset.combo])));
}

function renderRuntimes(s) {
  const known = s.multica.runtimes_known || [];
  const agents = s.multica.agents || [];
  document.getElementById("runtimes").innerHTML = known.map((r, i) => {
    const n = agents.filter(a => a.runtime_id === r.id).length;
    return `<li class="row" data-rt="${i}" role="button" tabindex="0" aria-label="Runtime ${esc(r.name || r.daemon_id)}. Activate for details.">
      <span class="dot ${r.online ? "ok" : "muted"}"><i class="ph ${r.online ? "ph-desktop-tower" : "ph-plug-charging"}"></i></span>
      <span class="ell"><b>${esc(r.name || r.daemon_id)}</b> <span class="small">${esc(r.daemon_id)} · ${n} agent${n === 1 ? "" : "s"}</span></span>
      <span class="pill ${r.online ? "ok" : ""}">${r.online ? "ON" : "OFF"}</span>
      <i class="ph ph-caret-right go"></i></li>`;
  }).join("");
  document.querySelectorAll("#runtimes .row").forEach(el =>
    el.addEventListener("click", () => openRuntime(known[+el.dataset.rt])));
}
function renderMon(s) {
  document.getElementById("ecs").innerHTML = (s.ecs.services || []).map((v, i) =>
    `<li class="row" data-ecs="${i}" role="button" tabindex="0" aria-label="ECS service ${esc(v.service)}. Activate for details."><span class="mono">${esc(short(v.service, 26))}</span>
     <span class="mono">des ${v.desired} · run ${v.running}</span>
     ${(v.pending || 0) > 0 ? `<span class="bdg warn">${v.pending}</span>` : `<i class="ph ph-check-circle ok"></i>`}<i class="ph ph-caret-right go"></i></li>`
  ).join("");
  document.querySelectorAll("#ecs .row").forEach(el =>
    el.addEventListener("click", () => openEcs((s.ecs.services || [])[+el.dataset.ecs], s.modes.ecs)));
  const stale = (s.multica.runtimes_stale || []);
  document.getElementById("staleCount").textContent = stale.length;
  document.getElementById("stale").innerHTML = stale.map(r =>
    `<li class="row stale mini"><span class="mono ell">${esc(r.daemon_id)}</span><span class="small" style="margin-left:auto">${r.online ? "online" : "offline"} · ${esc(r.last_seen || "—")}</span></li>`).join("");
  const m = s.meta || {};
  const rows = [["Workspace", `${m.workspace} (${m.workspace_id})`], ["9Router", `${m.router_url} · v${m.router_version}`],
    ["Multica CLI", "v" + (m.multica_cli || "?")], ["ECS", `${m.ecs_cluster} · ${m.aws_region}`],
    ["Refresh", `every ${m.refresh_s}s + cache`]];
  document.getElementById("sysinfo").innerHTML = rows.map(([k, v]) =>
    `<li class="row"><span class="small">${k}</span><span class="mono">${esc(v)}</span></li>`).join("");
  document.getElementById("eps").innerHTML = Object.entries(s.router.endpoint_status || {}).map(([k, v]) =>
    `<li class="row"><span class="mono small">${esc(k)}</span><span class="mono">${v === 200 ? '<span class="ok">200</span>' : `<span class="crit">${esc(String(v))}</span>`}</span></li>`).join("");
  document.getElementById("raw").textContent =
    `insights: ${JSON.stringify(s.insights || [], null, 1)}\nnote router: ${s.router.note || "-"}\nnote ecs: ${s.ecs.note || "-"}`;
}

function renderHeat(h) {
  const buckets = h.buckets || [], bs = h.bucket_s || 86400;
  const fmt = ts => bs >= 86400
    ? new Date(ts * 1000).toLocaleDateString("en-GB", {day: "numeric", month: "short"})
    : new Date(ts * 1000).toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit"});
  const max = Math.max(1, ...[].concat(...(h.agents || []).map(g => g.scores)));
  const cols = bs >= 86400 && buckets.length > 7
    ? Math.ceil(buckets.length / 7) : buckets.length;
  const cell = (ts, v) => {
    const lv = v <= 0 ? 0 : Math.min(4, Math.ceil(4 * v / max));
    const lbl = bs >= 86400
      ? new Date(ts * 1000).toLocaleDateString("en-GB", {weekday: "short", day: "numeric", month: "short"})
      : new Date(ts * 1000).toLocaleString("en-GB");
    return `<i class="cell lv${lv}" title="${lbl} · activity ${v}"></i>`;
  };
  let grid;
  if (bs >= 86400 && buckets.length > 7) {
    // GitHub layout: columns = weeks; each day cell = team total activity
    const weeks = [];
    for (let w = 0; w < cols; w++) weeks.push(buckets.slice(w * 7, w * 7 + 7));
    grid = `<div class="cal">` + weeks.map(wk =>
      `<div class="wcol">` + wk.map(ts => {
        const gi = buckets.indexOf(ts);
        const tot = (h.agents || []).reduce((n, g) => n + (g.scores[gi] || 0), 0);
        return cell(ts, tot);
      }).join("") + `</div>`).join("") + `</div>`;
  } else {
    grid = (h.agents || []).map(g =>
      `<div class="hrow"><span class="hname">${esc(g.name)}</span><span class="hcells">` +
      g.scores.map((v, i) => cell(buckets[i], v)).join("") + `</span></div>`).join("");
  }
  document.getElementById("heatmap").innerHTML =
    (grid || "") + `<div class="small">${buckets.length ? fmt(buckets[0]) + " → " + fmt(buckets[buckets.length - 1]) : "no history yet"}</div>`;
}

// --- modals ---
function kv(k, v) { return `<div class="mrow"><span>${k}</span><span>${v}</span></div>`; }
function openAgent(id) {
  const a = (SNAP.multica.agents || []).find(x => x.agent_id === id);
  if (!a) return;
  const [cls, label] = statusOf(a);
  const recent = (a.recent || []).map(t =>
    `<li class="row"><i class="ph ${t.status === "failed" ? "ph-x-circle crit" : t.status === "completed" ? "ph-check-circle ok" : "ph-circle warn"}"></i>
     <span><b>${esc(t.kind_label || t.kind)}</b> <span class="small">${fmtMention(t.summary)}${t.issue ? " · " + esc(short(t.issue, 14)) : ""}</span>
     ${t.error ? `<div class="mono crit small">${esc(t.error)}</div>` : ""}</span>
     <span class="small mono">${esc(t.status)}${t.elapsed_s != null ? " · " + fmtDur(t.elapsed_s) : ""}</span></li>`).join("");
  openModal(`<h3><span class="ava">${avatar(a.avatar)}</span> ${esc(a.agent_name)}</h3>
    <div style="margin-bottom:8px"><span class="pill ${cls}">${label}</span>
    ${a.stale_runtime ? ' <span class="pill">non-standard runtime</span>' : ""}
    <a class="extlink" href="https://multica.ai" target="_blank" rel="noopener" title="Open Multica web">Open in Multica <i class="ph ph-arrow-square-out"></i></a></div>
    ${kv("Runtime", `<i class="ph ${a.runtime_online ? "ph-desktop-tower" : "ph-plug-charging"}"></i> ${esc(a.runtime_name || a.daemon_id)} <span class="small mono">${esc(a.daemon_id)} · ${a.runtime_online ? "ON" : "OFF"}</span>`)}
    ${kv("Provider", `${logo(a.runtime_provider, 14)} ${esc(a.runtime_provider || "—")}`)}
    ${kv("Model", `<span class="mono">${esc(a.model || "default")}</span>`)}
    ${kv("Load", `<span class="mono">q${a.queued} · d${a.dispatched} · r${a.running} · concurrency ${a.concurrency ?? "?"}</span>`)}
    ${kv("Last run", `<span class="mono">${esc(a.last_status)}</span>`)}
    ${a.last_error ? `<div class="mono crit" style="margin:6px 0">${esc(a.last_error)}</div>` : ""}
    ${a.current ? `<h4>Current task</h4><div class="taskline"><i class="ph ${kindIcon(a.current.kind)}"></i>
      <b>${esc(a.current.kind_label || a.current.summary)}</b><div class="small">${fmtMention(a.current.summary)}</div></div>` : ""}
    <h4>Recent tasks</h4><ul class="rows">${recent || '<li class="row"><span class="small">none</span></li>'}</ul>`);
}
function openRuntime(r) {
  if (!r || !SNAP) return;
  const bound = (SNAP.multica.agents || []).filter(a => a.runtime_id === r.id);
  openModal(`<h3><i class="ph ${r.online ? "ph-desktop-tower" : "ph-plug-charging"}"></i> ${esc(r.name || r.daemon_id)}</h3>
    <div style="margin-bottom:8px"><span class="pill ${r.online ? "ok" : ""}">${r.online ? "ONLINE" : "OFFLINE"}</span></div>
    ${kv("Daemon", `<span class="mono">${esc(r.daemon_id)}</span>`)}
    ${kv("Provider", `${logo(r.provider, 14)} ${esc(r.provider || "—")}`)}
    ${kv("Last seen", `<span class="mono">${esc(r.last_seen || "—")}</span>`)}
    <h4>Bound agents (${bound.length})</h4>
    <ul class="rows">${bound.map(a => `<li class="row" data-agent="${a.agent_id}" role="button" tabindex="0">
      <span class="ell"><b>${esc(a.agent_name)}</b></span>
      <span class="small mono">q${a.queued}·d${a.dispatched}·r${a.running} · ${esc(a.last_status)}</span>
      <i class="ph ph-caret-right go"></i></li>`).join("") || '<li class="row"><span class="small">none</span></li>'}</ul>`);
  document.querySelectorAll("#modalBody [data-agent]").forEach(el =>
    el.addEventListener("click", () => openAgent(el.dataset.agent)));
}
function openConn(c) {
  if (!c) return;
  const wins = (c.windows || []).map(w => {
    const pct = parseFloat(w.remaining_pct);
    return `<div class="win"><div class="small"><b>${esc(w.label)}</b></div>
      <div class="bar ${isNaN(pct) ? "" : pct <= 10 ? "hot" : pct <= 30 ? "mid" : ""}"><i style="width:${isNaN(pct) ? 0 : pct}%"></i></div>
      <div class="small mono">${isNaN(pct) ? "—" : pct + "% left · used " + w.used + "/" + w.total} · <i class="ph ph-clock" title="resets ${esc(w.reset_in)}"></i> ${esc(w.reset_in)}</div></div>`;
  }).join("");
  openModal(`<h3>${logo(c.provider, 22)} ${esc(c.provider)} <span class="small">${esc(c.account)}</span></h3>
    ${kv("Plan", esc(c.plan || "—"))}${kv("Active", c.isActive ? "yes" : "no")}
    ${kv("Health check", esc(c.testStatus || "?"))}
    ${c.last_error ? `<div class="mono crit" style="margin:6px 0">${esc(c.last_error)}</div>` : ""}
    <h4>Quota windows</h4>${wins || '<span class="small">unreadable</span>'}`);
}
function openCombo(c) {
  if (!c) return;
  const chain = (c.chain || []).map((l, i) =>
    `${i ? '<div class="chain-arrow"><i class="ph ph-arrow-down"></i> fallback</div>' : ""}
     <li class="row"><span class="mono"><b>${esc(l.link)}</b></span>
     <span class="small">${esc(l.detail || "")}</span><span class="pill">${l.status}</span></li>`).join("");
  openModal(`<h3><i class="ph ph-git-fork"></i> ${esc(c.name)} <span class="pill">${(c.verdict || "").toUpperCase()}</span></h3>
    <ul class="rows">${chain}</ul>`);
}
function openEcs(v, mode) {
  if (!v) return;
  openModal(`<h3><i class="ph ph-cloud"></i> <span class="mono">${esc(v.service)}</span></h3>
    ${kv("Source", "ECS " + mode)}${kv("Desired", v.desired)}${kv("Running", v.running)}${kv("Pending", v.pending ?? 0)}`);
}

function short(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function fmtDur(sec) { sec = Math.round(sec); if (sec < 60) return sec + "s";
  if (sec < 3600) return Math.floor(sec / 60) + "m"; return (sec / 3600).toFixed(1) + "h"; }
function timeHM(ts) { return new Date(ts * 1000).toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit"}); }
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c])); }
tick(); setInterval(tick, 20000);
heat(); setInterval(heat, 60000);
live(); setInterval(live, 10000);
