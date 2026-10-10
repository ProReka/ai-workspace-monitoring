import { short } from './fmt.js';

export function Logo({ provider, size = 16, routerUrl }) {
  const p = String(provider || '').toLowerCase().trim();
  const init = (p || '?')[0].toUpperCase();
  const box = { width: size, height: size };
  if (!p || !routerUrl) {
    return <span className="logobox noimg" style={box}><span className="logoinit">{init}</span></span>;
  }
  return (
    <span className="logobox" style={box} title={p}>
      <img
        width={size - 2} height={size - 2} loading="lazy" alt=""
        src={`${routerUrl}/providers/${encodeURIComponent(p)}.png`}
        onError={(e) => { e.currentTarget.parentNode.classList.add('noimg'); e.currentTarget.remove(); }}
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
