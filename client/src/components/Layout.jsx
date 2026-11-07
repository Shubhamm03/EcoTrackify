import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../context/ThemeContext';
import { UnreadContext } from '../context/UnreadContext';
import { api, onDataChange } from '../utils/api';
import { displayName, homeFor } from '../utils/format';
import Icon, { Logo } from './Icon';
import { Avatar } from './ui';

// Each account type gets its own menu: [path, label, icon]
const NAV_USER = [
  ['Personal', [
    ['/dashboard', 'Dashboard', 'dashboard'],
    ['/tracker', 'My footprint', 'footprint'],
    ['/goals', 'Goals & tips', 'target'],
    ['/challenges', 'Challenges', 'bolt'],
    ['/leaderboard', 'Leaderboard', 'trophy'],
    ['/tips', 'Discover tips', 'bulb'],
  ]],
  ['Community', [
    ['/communities', 'Communities', 'users'],
    ['/compare', 'Compare', 'compare'],
  ]],
];

const NAV_BUSINESS = [
  ['Business', [
    ['/business', 'Overview', 'building'],
    ['/tracker', 'Company footprint', 'factory'],
    ['/goals', 'Goals & tips', 'target'],
  ]],
  ['Your people', [
    ['/communities', 'Communities', 'users'],
    ['/business/members', 'Members', 'user'],
    ['/business/challenges', 'Challenges', 'bolt'],
    ['/compare', 'Compare', 'compare'],
  ]],
];

const NAV_ADMIN = [
  ['Administration', [
    ['/admin', 'Overview', 'shield'],
    ['/admin/users?role=user', 'Individuals', 'user'],
    ['/admin/users?role=business', 'Businesses', 'building'],
    ['/admin/communities', 'Communities', 'users'],
    ['/admin/reports', 'Reports & tips', 'flag'],
  ]],
];

// Shorter names for the phone menu so every item fits on one line
const SHORT = { '/dashboard': 'Home', '/tracker': 'Footprint', '/goals': 'Goals', '/communities': 'Community', '/admin/reports': 'Reports', '/admin/users?role=business': 'Businesses' };

// The phone menu ends with "Profile", which opens the profile settings
const MOBILE_ADMIN = ['/admin', '/admin/users?role=user', '/admin/communities', '/admin/reports'];
const MOBILE_USER = ['/dashboard', '/tracker', '/goals', '/challenges', '/communities'];
const MOBILE_BUSINESS = ['/business', '/tracker', '/communities', '/business/members'];
const SIDEBAR_KEY = 'ecotrackify_sidebar';
const POLL_MS = 10000;

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  // The side bar can be collapsed to icons with the toggle; the choice is remembered
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(SIDEBAR_KEY) === 'collapsed'; } catch { return false; } });
  const biz = user?.role === 'business';
  const admin = user?.role === 'admin';
  const nav = admin ? NAV_ADMIN : biz ? NAV_BUSINESS : NAV_USER;
  const mobile = admin ? MOBILE_ADMIN : biz ? MOBILE_BUSINESS : MOBILE_USER;
  // NavLink ignores the query string, so the admin user tabs are matched by hand
  const isActive = (to, active) => (to.includes('?') ? location.pathname + location.search === to : active);

  const toggleSidebar = () => setCollapsed((c) => {
    try { localStorage.setItem(SIDEBAR_KEY, c ? 'open' : 'collapsed'); } catch { /* ignore */ }
    return !c;
  });

  // Unread count for the bell, refreshed every few seconds so new notifications appear without reloading
  const refreshUnread = useCallback(() => {
    if (document.hidden) return;
    api.get('/notifications/unread-count').then((r) => setUnread(r.unread)).catch(() => {});
  }, []);
  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, POLL_MS);
    // Live: a change in another tab (e.g. someone joined, a reply) updates the bell at once
    let t;
    const off = onDataChange(() => { clearTimeout(t); t = setTimeout(refreshUnread, 300); });
    return () => { clearInterval(id); clearTimeout(t); off(); };
  }, [refreshUnread, location.pathname]);
  const unreadValue = useMemo(() => ({ unread, setUnread, refreshUnread }), [unread, refreshUnread]);

  const items = nav.flatMap(([, list]) => list);
  const end = (to) => to === '/business' || to === '/admin';
  const subline = admin ? user.email : biz ? user.name : `@${user?.username} · ${user?.totalPoints ?? 0} pts`;

  return (
    <UnreadContext.Provider value={unreadValue}>
      <div className={`shell ${collapsed ? 'collapsed' : ''}`}>
        <aside className={`sidebar ${admin ? 'admin' : biz ? 'biz' : ''}`}>
          <div className="side-top">
            <Link to={homeFor(user)} className="logo" title="Ecotrackify"><Logo size={28} /><span className="side-label">Ecotrackify</span></Link>
            <button type="button" id="sidebar-toggle" className="icon-btn side-toggle" onClick={toggleSidebar} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand side bar' : 'Collapse side bar'} title={collapsed ? 'Expand side bar' : 'Collapse side bar'}>
              <Icon name={collapsed ? 'chevronRight' : 'sidebar'} size={18} />
            </button>
          </div>
          <span className="acct-badge side-label">{admin ? 'Administrator' : biz ? 'Business account' : 'Individual'}</span>
          {nav.map(([title, list]) => (
            <div key={title}>
              <div className="side-h">{title}</div>
              {list.map(([to, label, icon]) => (
                <NavLink key={to} to={to} end={end(to)} title={collapsed ? label : undefined} className={({ isActive: a }) => `nav-link ${isActive(to, a) ? 'active' : ''}`}>
                  <span className="nav-icon"><Icon name={icon} /></span>
                  <span className="side-label">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
          <div className="sidebar-foot">
            {/* Clicking your name opens the profile settings (log out and delete account are there) */}
            <NavLink to="/settings" id="sidebar-profile" className={({ isActive: a }) => `sidebar-user ${a ? 'active' : ''}`} title="Profile settings">
              <Avatar user={user} />
              <div className="side-label" style={{ minWidth: 0 }}>
                <strong>{admin ? user.name : displayName(user)}</strong>
                <span>{subline}</span>
              </div>
            </NavLink>
          </div>
        </aside>

        <div style={{ minWidth: 0 }}>
          <header className="mobile-top">
            <Link to={homeFor(user)} className="logo" style={{ padding: 0 }}><Logo size={26} />Ecotrackify</Link>
            <div className="header-tools">
              <ThemeToggle />
              <Link to="/notifications" className="bell" aria-label="Notifications"><Icon name="bell" />{unread > 0 && <span className="badge-dot">{unread > 99 ? '99+' : unread}</span>}</Link>
            </div>
          </header>
          <main className="main">
            <Outlet />
            <footer className="app-footer">
              <span>© {new Date().getFullYear()} Ecotrackify · Hyderabad, India</span>
              <nav aria-label="Footer">
                <Link to="/terms" state={{ from: location.pathname + location.search }}>Terms of Service</Link>
                <Link to="/privacy" state={{ from: location.pathname + location.search }}>Privacy Policy</Link>
                <span style={{ userSelect: 'all' }}>support@ecotrackify.app</span>
              </nav>
            </footer>
          </main>
        </div>

        {/* Phones: a floating button to log an activity (individual and business accounts) */}
        {!admin && location.pathname !== '/tracker' && (
          <Link to="/tracker" className="fab" aria-label="Log an activity" title="Log an activity"><Icon name="plus" size={24} /></Link>
        )}

        <nav className="mobile-nav" aria-label="Main">
          {items.filter(([to]) => mobile.includes(to)).map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={end(to)} className={({ isActive: a }) => (isActive(to, a) ? 'active' : '')}>
              <Icon name={icon} size={20} />
              <span>{SHORT[to] || label}</span>
            </NavLink>
          ))}
          <NavLink to="/settings" className={({ isActive: a }) => (a ? 'active' : '')}>
            <Icon name="user" size={20} />
            <span>Profile</span>
          </NavLink>
        </nav>
      </div>
    </UnreadContext.Provider>
  );
}
