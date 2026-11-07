// Line icons used across the app (replaces emoji). 24x24 grid, drawn with the current text colour.
const P = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  footprint: 'M8 3c1.7 0 3 1.8 3 4.2S9.9 12 8.6 12 6 10 6 7.4 6.6 3 8 3zM6.4 14.5h4.4l-.4 3.2a2.2 2.2 0 0 1-4.3-.3zM16 7c1.6 0 2.6 1.7 2.6 3.9S17.4 15 16.2 15s-2.4-1.6-2.4-4S14.6 7 16 7zM13.9 17.4h4.3l-.4 2.6a2.2 2.2 0 0 1-4.3-.2z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 21h7M9.5 17h5v4h-5z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.2a4 4 0 0 1 0 7.6M18 14a6 6 0 0 1 4 5.7V21',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM4 21a8 8 0 0 1 16 0',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  compare: 'M4 19V9M9 19V5M15 19v-6M20 19V8M2 19h20',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  building: 'M4 21V5l8-2v18M12 7l8 2v12M2 21h20M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2',
  factory: 'M2 21V11l6 3V9l6 3V5h4l1 16zM2 21h20M6 18h2M11 18h2',
  shield: 'M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1.5v2M12 20.5v2M4.6 4.6 6 6M18 18l1.4 1.4M1.5 12h2M20.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4',
  moon: 'M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z',
  plus: 'M12 5v14M5 12h14',
  sidebar: 'M4 4h16v16H4zM9 4v16',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  chevronRight: 'M9 6l6 6-6 6',
  check: 'M4.5 12.5 9.5 17.5 19.5 7',
  x: 'M6 6l12 12M18 6 6 18',
  refresh: 'M20 11a8 8 0 0 0-14.6-4.5L4 8M4 3v5h5M4 13a8 8 0 0 0 14.6 4.5L20 16M20 21v-5h-5',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  car: 'M5 17h14M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M3 17v-5l2.5-5h13L21 12v5M3 12h18',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  leaf: 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15zM5 19l8-8',
  sprout: 'M12 21v-9M12 12c0-4-3-7-8-7 0 4 3 7 8 7zM12 14c0-3.5 2.5-6.5 8-6.5 0 3.5-2.5 6.5-8 6.5z',
  droplet: 'M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z',
  salad: 'M3 12h18a9 9 0 0 1-18 0zM8 12c0-3 2-5 4-6M12 12c0-2.5 1.5-4.5 4-5.5M7 21h10',
  apple: 'M12 7c-1-2-3-3-5-2.5C4 5 3 8 3.5 11c.6 4.5 3.5 9 6 9 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c2.5 0 5.4-4.5 6-9 .5-3-.5-6-3.5-6.5-2-.5-4 .5-5 2.5zM12 7c0-2 1-3.5 3-4',
  book: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  flame: 'M12 22a7 7 0 0 0 7-7c0-4-3-6.5-4-10-2 2-2.5 4-2.5 5.5C11 9 10 7.5 10 6c-3 2.5-5 5.5-5 9a7 7 0 0 0 7 7z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  gem: 'M6 3h12l4 6-10 12L2 9zM2 9h20M9 3l3 18M15 3l-3 18',
  bag: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
  bike: 'M5.5 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM18.5 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5.5 14.5 9 7h5l4.5 7.5M12 14.5 9 7M14 7l-1-2h-2',
  plug: 'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7',
  basket: 'M3 10h18l-2 10H5zM7 10l4-6M17 10l-4-6M9 14v3M15 14v3',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  recycle: 'M7 19H4.5a1.5 1.5 0 0 1-1.3-2.3L5 13.5M11 19h8.5a1.5 1.5 0 0 0 1.3-2.3L19 13.5M9.5 6.5l1.2-2.1a1.5 1.5 0 0 1 2.6 0l2.2 3.8M8 16l3 3-3 3M3.8 10.3 5 13.5l3.3-1M18.7 7.4l-3.2 1-1-3.3',
  tree: 'M12 22v-6M12 2 5 12h4l-3 4h12l-3-4h4z',
  bus: 'M5 4h14a1 1 0 0 1 1 1v12H4V5a1 1 0 0 1 1-1zM4 11h16M7 21v-4M17 21v-4M8 14h.01M16 14h.01',
  pin: 'M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
  message: 'M4 4h16v12H8l-4 4z',
  heart: 'M12 20.5s-8-4.7-8-11a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8c0 6.3-8 11-8 11z',
  pinned: 'M9 3h6l-1 6 4 3v2H6v-2l4-3zM12 14v7',
  megaphone: 'M3 10v4h4l7 5V5L7 10zM17 9a4 4 0 0 1 0 6M7 14l1 6h3l-1-5',
  file: 'M6 2h8l5 5v15H6zM14 2v5h5M9 13h6M9 17h6',
  calendar: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  medal: 'M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8 3l2.5 6.3M16 3l-2.5 6.3M12 12.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  alert: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  home: 'M3 11 12 4l9 7M5 10v10h14V10',
  graduation: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6',
  city: 'M3 21V9h6v12M9 21V4h8v17M17 21v-8h4v8M2 21h20M12 8h2M12 12h2M12 16h2',
};

export default function Icon({ name, size = 18, className = '', title, strokeWidth = 1.8 }) {
  const d = P[name] || P.leaf;
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  );
}

// Brand mark: a leaf in a rounded square
export function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <path d="M9 23c0-8 5-13 14-13 0 8.5-5 13-14 13zm0 0 7-7" fill="none" stroke="var(--on-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const hasIcon = (name) => Boolean(P[name]);
