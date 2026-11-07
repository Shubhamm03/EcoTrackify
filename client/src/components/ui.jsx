import { Component, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useUnread } from '../context/UnreadContext';
import { ThemeToggle } from '../context/ThemeContext';

export function PageHeader({ title, subtitle, eyebrow, children }) {
  const { unread } = useUnread();
  return (
    <div className="topbar">
      <div>
        {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="row">
        {children}
        {/* Theme switch and notifications sit together in the header */}
        <span className="header-tools">
          <ThemeToggle />
          <Link to="/notifications" className="bell" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Icon name="bell" />{unread > 0 && <span className="badge-dot">{unread > 99 ? '99+' : unread}</span>}
          </Link>
        </span>
      </div>
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" aria-label="Loading" />;
}

export function ErrorMsg({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert alert-error row spread">
      <span>{message}</span>
      {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Retry</button>}
    </div>
  );
}

// Empty state. `icon` is an Icon name.
export function Empty({ icon = 'inbox', title, children }) {
  return (
    <div className="empty">
      <div className="big"><Icon name={icon} size={20} /></div>
      <h3>{title}</h3>
      {children && <div>{children}</div>}
    </div>
  );
}

export function Progress({ value, marker, tone }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={`progress ${tone || ''}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
      {marker != null && <i className="marker" style={{ left: `${Math.min(100, marker)}%` }} title="Time elapsed" />}
    </div>
  );
}

// `icon` (optional) shows a small tile next to the label; without it the tile looks as before
export function Stat({ label, value, unit, sub, red = false, icon, tone = '' }) {
  if (icon) {
    return (
      <div className="card stat stat-tile">
        <div className="stat-top">
          <span className="stat-label">{label}</span>
          <span className={`icon-tile sm ${tone}`}><Icon name={icon} size={16} /></span>
        </div>
        <span className={`stat-value ${red ? 'co2' : ''}`}>{value}{unit && <small>{unit}</small>}</span>
        {sub}
      </div>
    );
  }
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${red ? 'co2' : ''}`}>{value}{unit && <small>{unit}</small>}</span>
      {sub}
    </div>
  );
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Counts up to `value` when it first appears or changes. Display only: the number shown at the
// end is exactly `format(value)`, and nothing is fetched or stored.
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString(), duration = 900 }) {
  const target = Number(value) || 0;
  const reduce = prefersReducedMotion();
  const [shown, setShown] = useState(reduce ? target : 0);
  const cur = useRef(reduce ? target : 0); // the number on screen right now
  useEffect(() => {
    const a = cur.current;
    if (reduce || a === target) { cur.current = target; setShown(target); return undefined; }
    const start = performance.now();
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - start) / duration);
      const v = k === 1 ? target : a + (target - a) * (1 - (1 - k) ** 3);
      cur.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);
  return <span className="tnum">{format(shown)}</span>;
}

// Circular progress. `value` 0–100 fills the ring (values above 100 show a full ring).
export function ProgressRing({ value, size = 120, stroke = 10, label, caption, tone = '', className = '' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  // Start empty, then fill, so the ring animates in on first show
  const [drawn, setDrawn] = useState(prefersReducedMotion() ? pct : 0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <div className={`ring ${tone} ${className}`} style={{ width: size, height: size }} role="img" aria-label={caption ? `${label}: ${caption}` : String(label)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="ring-value" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - drawn / 100)} />
      </svg>
      <div className="ring-label"><div><strong>{label}</strong>{caption && <><br /><span>{caption}</span></>}</div></div>
    </div>
  );
}

// Placeholder shown while data loads, in the shape of the content
export function Skeleton({ width = '100%', height = 14, radius, style }) {
  return <span className="skeleton" aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />;
}

// Keeps a rendering error on one page from crashing the whole app.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="card">
          <Empty icon="alert" title="Something went wrong on this page">
            <button className="btn" onClick={() => this.setState({ error: null })}>Try again</button>
          </Empty>
        </div>
      );
    }
    return this.props.children;
  }
}

// Profile photo, or initials when there is none
export function Avatar({ user, size = '' }) {
  const name = user?.displayName || user?.name || '?';
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const src = user?.avatarUrl ? `${import.meta.env.VITE_API_URL || ''}${user.avatarUrl}` : '';
  return (
    <span className={`avatar ${size}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}

// A CO2 amount, always shown in red
export function Co2({ value, digits = 1, suffix = '' }) {
  const n = Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
  return <span className="co2">{n} kg{suffix}</span>;
}

// Square with a community's initials (communities no longer use emoji icons)
export function Monogram({ name = '', size = '' }) {
  const letters = String(name).split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'C';
  return <span className={`monogram ${size}`} aria-hidden="true">{letters}</span>;
}

// Gold, silver and bronze positions
export function Medal({ place }) {
  return <span className={`medal m${place}`} aria-label={`Rank ${place}`}>{place}</span>;
}

// Text from the server (tips, headlines) with every CO2 amount such as "2.9 kg" shown in red
const KG_RX = /(\d[\d,]*(?:\.\d+)?\s?(?:kg|t)\b(?:\s?CO₂)?)/g;
export function RedKg({ text }) {
  if (!text) return null;
  return String(text).split(KG_RX).map((part, i) => (i % 2 === 1 ? <span key={i} className="co2">{part}</span> : part));
}

// Dialog over the page. Escape or the backdrop closes it; the page behind does not scroll.
export function Modal({ title, onClose, children, footer, wide = false, id }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} id={id}>
        <div className="modal-top">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={17} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
