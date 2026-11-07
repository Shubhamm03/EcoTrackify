import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useApi from '../hooks/useApi';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useUnread } from '../context/UnreadContext';
import { Empty, ErrorMsg, PageHeader, Spinner } from '../components/ui';
import { timeAgo } from '../utils/format';
import Icon from '../components/Icon';

// Alerts about something going wrong are shown in red, warnings in amber (display only)
const toneOf = (item) => (item.type === 'insight' || /exceeded|emissions are high|removed|declined|reported|suspended/i.test(item.title) ? 'danger'
  : /almost at its budget|at risk/i.test(item.title) ? 'warn' : '');
const DANGER_ICON = { goal: 'alert', insight: 'alert', community: 'alert' };
const ICONS = { reminder: 'clock', goal: 'target', challenge: 'bolt', achievement: 'trophy', system: 'leaf', community: 'users', social: 'message', insight: 'alert', tip: 'bulb' };

// Which notifications to receive. Opened from the gear button on this page.
function Preferences({ onClose }) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const ns = user.notificationSettings || {};
  const biz = user.role === 'business';
  const admin = user.role === 'admin';
  const save = async (patch) => {
    try {
      const res = await api.put('/users/me/notifications', patch);
      setUser(res.user);
      toast('Notification settings saved');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const toggle = (key) => save({ [key]: !(ns[key] !== false) });
  return (
    <div className="card form" id="notif-prefs">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <h2>Notification settings</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close notification settings"><Icon name="x" size={15} />Close</button>
      </div>
      <label className="checkbox"><input type="checkbox" checked={ns.enabled !== false} onChange={() => toggle('enabled')} />Enable notifications</label>
      <fieldset disabled={ns.enabled === false} className="prefs-set" style={{ opacity: ns.enabled === false ? 0.5 : 1 }}>
        <label className="checkbox"><input type="checkbox" checked={ns.socialUpdates !== false} onChange={() => toggle('socialUpdates')} />Replies and likes on my posts</label>
        <label className="checkbox"><input type="checkbox" checked={ns.communityUpdates !== false} onChange={() => toggle('communityUpdates')} />Community announcements, tips and join requests</label>
        <label className="checkbox"><input type="checkbox" checked={ns.goalUpdates !== false} onChange={() => toggle('goalUpdates')} />Goals and high-emission alerts</label>
        {!biz && !admin && <label className="checkbox"><input type="checkbox" checked={ns.challengeUpdates !== false} onChange={() => toggle('challengeUpdates')} />New challenges and check-in nudges</label>}
        <label className="checkbox"><input type="checkbox" checked={ns.logReminders !== false} onChange={() => toggle('logReminders')} />Reminders to log activities</label>
        <label className="checkbox"><input type="checkbox" checked={!!ns.email} onChange={() => save({ email: !ns.email })} />Also send by email</label>
      </fieldset>
    </div>
  );
}

export default function Notifications() {
  const toast = useToast();
  const navigate = useNavigate();
  const { refreshUnread, setUnread } = useUnread();
  const n = useApi('/notifications', [], { refreshMs: 10000 });
  const [showPrefs, setShowPrefs] = useState(false);

  const markAll = async () => {
    try {
      await api.put('/notifications/read-all');
      setUnread(0);
      n.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const open = async (item) => {
    if (!item.read) api.put(`/notifications/${item._id}/read`).then(refreshUnread).catch(() => {});
    if (item.link) navigate(item.link);
    else n.setData((d) => ({ ...d, items: d.items.map((x) => (x._id === item._id ? { ...x, read: true } : x)), unread: Math.max(0, d.unread - 1) }));
  };

  const remove = async (item) => {
    n.setData((d) => ({ ...d, items: d.items.filter((x) => x._id !== item._id) }));
    api.del(`/notifications/${item._id}`).then(refreshUnread).catch(() => n.reload());
  };

  return (
    <div className="stack">
      <PageHeader title="Notifications" subtitle="Replies and likes, community announcements, goals, high-emission alerts and challenges.">
        {n.data?.unread > 0 && <button className="btn btn-ghost" onClick={markAll}>Mark all read</button>}
        <button id="notif-settings" type="button" className={`icon-btn ${showPrefs ? 'on' : ''}`} onClick={() => setShowPrefs((v) => !v)} aria-expanded={showPrefs} aria-label="Notification settings" title="Notification settings">
          <Icon name="settings" size={18} />
        </button>
      </PageHeader>
      {showPrefs && <Preferences onClose={() => setShowPrefs(false)} />}
      <ErrorMsg message={n.error} onRetry={n.reload} />
      <div className="card">
        {n.loading && !n.data ? <Spinner /> : n.data?.items.length === 0 ? (
          <Empty icon="bell" title="You're all caught up" />
        ) : n.data && (
          <div className="list">
            {n.data.items.map((item) => (
              <div key={item._id} className={`list-item notif ${toneOf(item) ? `notif-${toneOf(item)}` : ''} ${item.read ? 'is-read' : ''}`}>
                <div className={`icon-tile sm ${toneOf(item) === 'danger' ? 'red' : toneOf(item) === 'warn' ? 'amber' : ''}`}><Icon name={(toneOf(item) && DANGER_ICON[item.type]) || ICONS[item.type] || 'bell'} size={17} /></div>
                <button className="link-btn notif-open" onClick={() => open(item)}>
                  <div className="row"><strong className="notif-title">{item.title}</strong>{!item.read && <span className={`pill ${toneOf(item) === 'danger' ? 'pill-red' : 'pill-ok'}`}>New</span>}</div>
                  <div className="small" style={{ color: 'var(--ink-2)' }}>{item.message}</div>
                  <div className="small muted">{timeAgo(item.createdAt)}</div>
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(item)} aria-label="Delete notification"><Icon name="x" size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
