import { short } from './fmt.js';

const LOGO_ALIAS = {
  'opencode-go': 'opencode', 'codebuddy-intl': 'codebuddy',
  ag: 'antigravity', oc: 'opencode', ocg: 'opencode', cx: 'codex', cc: 'claude',
  ollama: 'ollama', openrouter: 'openrouter', nvidia: 'nvidia', mmf: 'mmf',
  commandcode: 'commandcode', anthropic: 'anthropic', codex: 'codex',
};

function hueOf(s) {
  let h = 0;
  for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function Logo({ provider, size = 16, routerUrl }) {
  const raw = String(provider || '').toLowerCase().trim();
  const p = LOGO_ALIAS[raw] || raw;
  const init = (p || '?')[0].toUpperCase();
  const box = { width: size, height: size };
  const tint = { '--h': hueOf(p || '?') };
  const local = `providers/${encodeURIComponent(p)}.png`;
  const remote = routerUrl ? `${routerUrl}/providers/${encodeURIComponent(p)}.png` : '';
  if (!p) {
    return <span className="logobox noimg" style={{ ...box, ...tint }}><span className="logoinit">{init}</span></span>;
  }
  return (
    <span className="logobox" style={{ ...box, ...tint }} title={p}>
      <img
        width={size - 2} height={size - 2} loading="lazy" alt=""
        src={local}
        onError={(e) => {
          const img = e.currentTarget;
          if (remote && !img.dataset.remote) { img.dataset.remote = '1'; img.src = remote; return; }
          img.parentNode.classList.add('noimg'); img.remove();
        }}
      />
      <span className="logoinit">{init}</span>
    </span>
  );
}

export function Avatar({ value }) {
  const v = value || '';
  if (v.startsWith('emoji:')) return <span style={{ fontSize: 19, lineHeight: 1 }}>{v.slice(6)}</span>;
  if (/^https?:/.test(v)) return <img src={v} alt="" />;
  return <span style={{ fontWeight: 700, color: 'var(--muted)' }}>?</span>;
}

// [@Label](mention://type/uuid) -> bold; agent mentions open the agent modal.
const MENTION_RE = /\[@(.+?)\]\(mention:\/\/(member|agent|squad|issue|all)\/([0-9a-fA-F-]+|all)\)/g;

export function Mentions({ text, onAgent }) {
  const out = [];
  let last = 0, m, i = 0;
  MENTION_RE.lastIndex = 0;
  const s = String(text ?? '');
  while ((m = MENTION_RE.exec(s)) !== null) {
    if (m.index > last) out.push(<span key={i++}>{s.slice(last, m.index)}</span>);
    const [, label, type, id] = m;
    if (type === 'agent') {
      out.push(
        <a key={i++} className="mention" href="#" title={`Open agent ${label}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAgent && onAgent(id); }}>@{label}</a>
      );
    } else {
      out.push(<span key={i++} className="mention" title={`${type} mention`}>@{label}</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(<span key={i++}>{s.slice(last)}</span>);
  return <>{out}</>;
}

export function IssueRef({ value }) {
  if (!value) return null;
  return <span><i className="ph ph-ticket"></i> {short(value, 12)}</span>;
}
