import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useApi from '../hooks/useApi';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { Avatar, Co2, Empty, ErrorMsg, Modal, Monogram, PageHeader, Spinner, Stat } from '../components/ui';
import { CATEGORY_META, COMMUNITY_TYPES, GENDERS, fmtDate, timeAgo } from '../utils/format';
import Icon from '../components/Icon';
import useForm from '../hooks/useForm';
import { SelectField, TextField } from '../components/FormFields';
import { minLen } from '../utils/validation';

const validateOfficialTip = (v) => ({ title: minLen(v.title, 5, 'a title'), content: minLen(v.content, 20, 'the tip') });

const roleLabel = (r) => (r === 'business' ? 'Business' : 'Individual');
const genderLabel = (g) => GENDERS.find((x) => x[0] === g)?.[1] || '—';

/* ---------------- Overview ---------------- */
export function AdminOverview() {
  const s = useApi('/admin/stats');
  const d = s.data;
  const [open, setOpen] = useState(null);
  return (
    <div className="stack">
      <PageHeader title="Admin overview" subtitle="Everything on Ecotrackify: individuals, businesses, communities and reported content." />
      <ErrorMsg message={s.error} onRetry={s.reload} />
      {!d ? <Spinner /> : (
        <>
          <div className="grid grid-4">
            <Stat label="Individuals" value={d.individuals} sub={<Link to="/admin/users?role=user" className="small">Manage →</Link>} />
            <Stat label="Businesses" value={d.businesses} sub={<Link to="/admin/users?role=business" className="small">Manage →</Link>} />
            <Stat label="Communities" value={d.communities} sub={<Link to="/admin/communities" className="small">Manage →</Link>} />
            <Stat label="Reported posts" value={d.reported} sub={<Link to="/admin/reports" className="small">Review →</Link>} />
            <Stat label="New this week" value={d.newThisWeek} />
            <Stat label="Suspended accounts" value={d.suspended} />
            <Stat red label="CO₂ tracked" value={Math.round(d.co2TrackedKg).toLocaleString()} unit="kg" sub={<span className="small muted">{d.activities} activities</span>} />
            <Stat label="Goals achieved" value={d.goalsAchieved} />
          </div>
          <div className="card">
            <div className="card-head"><h2>Newest accounts</h2><span className="small muted">Manage opens the account</span></div>
            {d.recent.length === 0 ? <Empty icon="users" title="No one has registered yet" /> : (
              <div className="table-wrap">
                <table className="table stackable">
                  <thead><tr><th>Account</th><th>Type</th><th>City</th><th>Joined</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {d.recent.map((u) => (
                      <tr key={u._id}>
                        <td className="cell-first"><div className="cell-main"><Avatar user={u} size="sm" /><div className="who"><strong>{u.displayName}</strong><span>{u.email}</span></div></div></td>
                        <td data-label="Type">{roleLabel(u.role)}</td>
                        <td data-label="City">{u.city || <span className="dash">—</span>}</td>
                        <td data-label="Joined" className="small">{timeAgo(u.createdAt)}</td>
                        <td data-label="Status"><StatusPill u={u} /></td>
                        <td className="actions"><button className="btn btn-ghost btn-sm" onClick={() => setOpen(u._id)}>Manage</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {open && <UserDetail id={open} onClose={() => setOpen(null)} onChanged={s.reload} />}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Individuals / Businesses ---------------- */
const StatusPill = ({ u }) => (
  <span className="row" style={{ gap: 4 }}>
    {u.status === 'suspended' ? <span className="pill pill-red">Suspended</span> : <span className="pill pill-ok">Active</span>}
    {u.emailVerified === false && <span className="pill pill-warn">Email not verified</span>}
  </span>
);

// One account, opened in a dialog: details, footprint summary and the account actions
function UserDetail({ id, onClose, onChanged }) {
  const toast = useToast();
  const d = useApi(`/admin/users/${id}`, [id]);
  const [reason, setReason] = useState('');
  const [step, setStep] = useState(''); // '' | 'suspend' | 'delete'
  const [busy, setBusy] = useState(false);
  const run = async (fn, after) => {
    setBusy(true);
    try {
      const r = await fn();
      toast(r.message);
      setStep('');
      setReason('');
      after?.();
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const u = d.data?.user;
  const biz = u?.role === 'business';
  const name = u ? (biz ? u.companyName : u.name) : 'Account';
  let body;
  if (d.error) body = <ErrorMsg message={d.error} onRetry={d.reload} />;
  else if (!d.data) body = <Spinner />;
  else {
    const { footprint, goals, points, posts, memberships, ownedCommunities } = d.data;
    const total = Object.values(footprint).reduce((a, f) => a + f.kg, 0);
    const details = biz
      ? [['Organisation type', u.orgType], ['Contact person', u.name], ['Email', u.email], ['Phone', u.phone], ['Industry', u.industry], ['Company size', u.companySize && `${u.companySize} employees`], ['City', u.city], ['Website', u.website]]
      : [['Username', u.username && `@${u.username}`], ['Email', u.email], ['Age', u.age], ['Gender', genderLabel(u.gender)], ['City', u.city]];
    body = (
      <div className="stack" style={{ gap: 18 }}>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <Avatar user={{ ...u, displayName: name }} size="lg" />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '1.25rem' }}>{name}</h2>
            <p className="small muted">{roleLabel(u.role)} · joined {fmtDate(u.createdAt)}</p>
            <div style={{ marginTop: 6 }}><StatusPill u={u} /></div>
          </div>
        </div>
        {u.status === 'suspended' && u.suspendedReason && <div className="alert alert-warn">Suspended: {u.suspendedReason}</div>}

        <dl className="kv">{details.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || <span className="muted">—</span>}</dd></div>)}</dl>

        <div className="grid grid-4">
          <div className="card stat"><span className="stat-label">CO₂ logged</span><span className="stat-value co2" style={{ fontSize: '1.3rem' }}>{Math.round(total).toLocaleString()}<small>kg</small></span></div>
          <div className="card stat"><span className="stat-label">Goals achieved</span><span className="stat-value" style={{ fontSize: '1.3rem' }}>{goals.achieved || 0}<small>/ {(goals.achieved || 0) + (goals.active || 0) + (goals.missed || 0)}</small></span></div>
          <div className="card stat"><span className="stat-label">{biz ? 'Communities run' : 'Challenge points'}</span><span className="stat-value" style={{ fontSize: '1.3rem' }}>{biz ? ownedCommunities.length : points}</span></div>
          <div className="card stat"><span className="stat-label">Community posts</span><span className="stat-value" style={{ fontSize: '1.3rem' }}>{posts}</span></div>
        </div>
        {Object.keys(footprint).length > 0 && (
          <div className="chips">{Object.entries(footprint).map(([k, f]) => <span key={k} className="pill pill-red">{CATEGORY_META[k]?.label}: {Math.round(f.kg)} kg · {f.entries} entries</span>)}</div>
        )}
        {(ownedCommunities.length > 0 || memberships.length > 0) && (
          <div>
            <div className="small" style={{ fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>Communities</div>
            <div className="chips">
              {ownedCommunities.map((c) => <span key={c._id} className="pill pill-biz">Runs {c.name} · {c.memberCount} members</span>)}
              {memberships.filter((m) => m.role !== 'admin').map((m) => <span key={m.community._id} className="pill">{m.community.name}{m.status !== 'active' ? ` · ${m.status}` : ''}</span>)}
            </div>
          </div>
        )}

        {/* Account actions */}
        <div className="danger-zone" id="account-actions">
          <strong>Account actions</strong>
          {step === 'suspend' ? (
            <>
              <label className="field">
                <span className="field-label">Reason <span className="opt-l">(shown to the user when they try to log in)</span></span>
                <input id="suspend-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Repeated spam in communities" autoFocus />
              </label>
              <div className="row">
                <button className="btn btn-red btn-sm" disabled={busy} onClick={() => run(() => api.put(`/admin/users/${u._id}/status`, { status: 'suspended', reason }), d.reload)}>Suspend account</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setStep('')}>Cancel</button>
              </div>
            </>
          ) : step === 'delete' ? (
            <>
              <p className="small">Delete <strong>{name}</strong> and all their data{biz ? ', including the communities they run' : ''}? This cannot be undone.</p>
              <div className="row">
                <button id="delete-account-confirm" className="btn btn-red btn-sm" disabled={busy} onClick={() => run(() => api.del(`/admin/users/${u._id}`), onClose)}>Delete permanently</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setStep('')}>Cancel</button>
              </div>
            </>
          ) : (
            <div className="row">
              {u.status === 'active'
                ? <button id="suspend-btn" className="btn btn-ghost btn-sm" onClick={() => setStep('suspend')}><Icon name="lock" size={15} />Suspend…</button>
                : <button id="reactivate-btn" className="btn btn-sm" disabled={busy} onClick={() => run(() => api.put(`/admin/users/${u._id}/status`, { status: 'active' }), d.reload)}><Icon name="check" size={15} />Reactivate</button>}
              <button id="delete-btn" className="btn btn-ghost btn-sm danger-text" onClick={() => setStep('delete')}><Icon name="trash" size={15} />Delete account…</button>
            </div>
          )}
        </div>
      </div>
    );
  }
  return <Modal title={biz ? 'Business account' : 'Individual account'} onClose={onClose} wide id="account-dialog">{body}</Modal>;
}

export function AdminUsers() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const role = params.get('role') === 'business' ? 'business' : 'user';
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const list = useApi(`/admin/users?role=${role}&page=${page}${query ? `&q=${encodeURIComponent(query)}` : ''}${status ? `&status=${status}` : ''}`);
  const stats = useApi('/admin/stats');

  useEffect(() => { const t = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setOpen(null); setPage(1); }, [role]);

  const changed = () => { list.reload(); stats.reload(); };
  const reactivate = async (u) => {
    try {
      const r = await api.put(`/admin/users/${u._id}/status`, { status: 'active' });
      toast(r.message);
      changed();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const d = list.data;
  const biz = role === 'business';
  const s = stats.data;
  return (
    <div className="stack">
      <PageHeader title={biz ? 'Businesses' : 'Individuals'} subtitle={biz ? 'Organisation accounts: view details, suspend, reactivate or delete.' : 'Personal accounts: view details, suspend, reactivate or delete.'} />
      <div className="row spread">
        <div className="seg-tabs" role="tablist" aria-label="Account type">
          <button role="tab" aria-selected={!biz} className={!biz ? 'on' : ''} onClick={() => setParams({ role: 'user' })}><Icon name="user" size={15} />Individuals{s && <span className="n">{s.individuals}</span>}</button>
          <button role="tab" aria-selected={biz} className={biz ? 'on' : ''} onClick={() => setParams({ role: 'business' })}><Icon name="building" size={15} />Businesses{s && <span className="n">{s.businesses}</span>}</button>
        </div>
        <div className="seg-tabs" role="tablist" aria-label="Status">
          {[['', 'All'], ['active', 'Active'], ['suspended', 'Suspended']].map(([k, l]) => (
            <button key={k || 'all'} role="tab" aria-selected={status === k} className={status === k ? 'on' : ''} onClick={() => { setStatus(k); setPage(1); }}>{l}</button>
          ))}
        </div>
      </div>
      <span className="search"><Icon name="search" size={16} /><input id="admin-q" type="search" aria-label="Search accounts" placeholder={biz ? 'Search company, contact, email or city' : 'Search name, username, email or city'} value={q} onChange={(e) => setQ(e.target.value)} /></span>
      {open && <UserDetail id={open} onClose={() => setOpen(null)} onChanged={changed} />}
      <ErrorMsg message={list.error} onRetry={list.reload} />
      <div className="card">
        {list.loading && !d ? <Spinner /> : d?.users.length === 0 ? <Empty icon="search" title={query ? 'No accounts match your search' : status ? `No ${status} accounts` : `No ${biz ? 'businesses' : 'individuals'} yet`} /> : d && (
          <>
            <p className="small muted" style={{ marginBottom: 8 }}>{d.total} account{d.total === 1 ? '' : 's'}</p>
            <div className="table-wrap">
              <table className="table stackable" id="admin-users">
                <thead>
                  <tr>
                    <th>{biz ? 'Organisation' : 'Person'}</th>
                    {biz ? <th>Type</th> : <th>Age · gender</th>}
                    <th>City</th><th className="num">CO₂ logged</th><th className="num">Communities</th><th>Joined</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {d.users.map((u) => (
                    <tr key={u._id}>
                      <td className="cell-first">
                        <div className="cell-main">
                          <Avatar user={{ ...u, displayName: u.displayName }} size="sm" />
                          <div className="who"><strong>{biz ? u.companyName : u.name}</strong><span>{biz ? u.email : `@${u.username} · ${u.email}`}</span></div>
                        </div>
                      </td>
                      {biz ? <td data-label="Type" className="small">{u.orgType}{u.companySize ? ` · ${u.companySize}` : ''}</td>
                        : <td data-label="Age · gender" className="small">{u.age ?? '—'} · {genderLabel(u.gender)}</td>}
                      <td data-label="City">{u.city || <span className="dash">—</span>}</td>
                      <td data-label="CO₂ logged" className="num"><Co2 value={u.co2Kg} digits={0} /></td>
                      <td data-label="Communities" className="num">{u.communities}</td>
                      <td data-label="Joined" className="small">{fmtDate(u.createdAt)}</td>
                      <td data-label="Status"><StatusPill u={u} /></td>
                      <td className="actions">
                        <div className="row">
                          {u.status === 'suspended' && <button className="btn btn-ghost btn-sm" onClick={() => reactivate(u)}>Reactivate</button>}
                          <button className="btn btn-sm" onClick={() => setOpen(u._id)}>Manage</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {d.pages > 1 && (
              <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
                <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
                <span className="small muted">Page {page} of {d.pages}</span>
                <button className="btn btn-ghost btn-sm" disabled={page >= d.pages} onClick={() => setPage(page + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Communities ---------------- */
export function AdminCommunities() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState('');
  const list = useApi(`/admin/communities${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 350); return () => clearTimeout(t); }, [q]);

  const remove = async (c) => {
    try {
      const r = await api.del(`/admin/communities/${c._id}`);
      toast(r.message);
      setConfirm('');
      list.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const rows = list.data?.communities || [];
  return (
    <div className="stack">
      <PageHeader title="Communities" subtitle="Every community on Ecotrackify and the business that runs it." />
      <span className="search"><Icon name="search" size={16} /><input id="admin-comm-q" type="search" aria-label="Search communities" placeholder="Search communities" value={q} onChange={(e) => setQ(e.target.value)} /></span>
      <ErrorMsg message={list.error} onRetry={list.reload} />
      <div className="card">
        {list.loading && !list.data ? <Spinner /> : rows.length === 0 ? <Empty icon="users" title="No communities yet" /> : (
          <div className="table-wrap">
            <table className="table stackable">
              <thead><tr><th>Community</th><th>Owner</th><th className="num">Members</th><th className="num">Posts</th><th>Created</th><th /></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c._id}>
                    <td className="cell-first"><div className="cell-main"><Monogram name={c.name} size="sm" /><div className="who"><strong>{c.name}</strong><span>{COMMUNITY_TYPES[c.type]} · {c.visibility === 'private' ? 'Private' : 'Public'}{c.city ? ` · ${c.city}` : ''}</span></div></div></td>
                    <td data-label="Owner" className="small">{c.owner ? <div className="who" style={{ display: 'flex', flexDirection: 'column' }}><span>{c.owner.name}</span><span className="muted">{c.owner.email}</span></div> : '—'}</td>
                    <td data-label="Members" className="num">{c.memberCount}</td>
                    <td data-label="Posts" className="num">{c.posts}</td>
                    <td data-label="Created" className="small">{fmtDate(c.createdAt)}</td>
                    <td className="actions">
                      {confirm === c._id ? (
                        <div className="row">
                          <button className="btn btn-red btn-sm" onClick={() => remove(c)}>Delete</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setConfirm('')}>Cancel</button>
                        </div>
                      ) : <button className="btn btn-ghost btn-sm danger-text" onClick={() => setConfirm(c._id)}><Icon name="trash" size={14} />Delete…</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Every tip/post members shared in communities ---------------- */
function CommunityPosts() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null);
  const list = useApi(`/admin/posts?page=${page}${search ? `&q=${encodeURIComponent(search)}` : ''}`, [], { refreshMs: 15000 });
  const d = list.data;

  const remove = async (p) => {
    try {
      await api.del(`/admin/posts/${p._id}`);
      toast('Post deleted');
      setConfirm(null);
      list.setData((x) => ({ ...x, posts: x.posts.filter((y) => y._id !== p._id), total: x.total - 1 }));
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="card" id="admin-posts">
      <div className="card-head">
        <div><h2>Community posts</h2><p className="small muted">Tips and posts members shared in communities{d ? ` · ${d.total} in total` : ''}.</p></div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); setSearch(query.trim()); setPage(1); }}>
          <input id="posts-q" aria-label="Search posts" placeholder="Search posts" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 200 }} />
          <button className="btn btn-ghost btn-sm"><Icon name="search" size={15} />Search</button>
        </form>
      </div>
      <ErrorMsg message={list.error} onRetry={list.reload} />
      {!d ? <Spinner /> : d.posts.length === 0 ? <Empty icon="message" title={search ? 'No posts match your search' : 'No posts yet'} /> : d.posts.map((p) => (
        <div key={p._id} className="post">
          <div className="post-body">
            <div className="row" style={{ gap: 6 }}>
              {p.community && <span className="pill">{p.community.name}</span>}
              {p.isAnnouncement && <span className="pill pill-ok">Announcement</span>}
              {p.reports > 0 && <span className="pill pill-red"><Icon name="flag" size={12} />{p.reports}</span>}
              {p.hidden && <span className="pill">Hidden</span>}
              <span className="small muted">by {p.author?.name || 'Former member'} · {timeAgo(p.createdAt)}</span>
            </div>
            <p style={{ marginTop: 4, overflowWrap: 'anywhere' }}>{p.content}</p>
            <div className="row" style={{ marginTop: 8 }}>
              {confirm === p._id ? (
                <>
                  <span className="small muted">Delete this post for everyone?</span>
                  <button className="btn btn-red btn-sm" onClick={() => remove(p)}>Delete</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
                </>
              ) : <button className="btn btn-ghost btn-sm danger-text" onClick={() => setConfirm(p._id)}><Icon name="trash" size={14} />Delete</button>}
            </div>
          </div>
        </div>
      ))}
      {d?.pages > 1 && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Newer</button>
          <span className="small muted">Page {page} of {d.pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= d.pages} onClick={() => setPage(page + 1)}>Older →</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Reported content + official tips ---------------- */
export function AdminReports() {
  const toast = useToast();
  const reports = useApi('/admin/reports', [], { refreshMs: 15000 });
  const tf = useForm({ title: '', content: '', category: 'energy' }, validateOfficialTip);

  const act = async (fn) => {
    try {
      const r = await fn();
      toast(r.message || 'Done');
      reports.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const addTip = async (e) => {
    e.preventDefault();
    if (!tf.check()) return;
    try {
      await api.post('/admin/tips', tf.values);
      toast('Official tip added to Discover');
      tf.reset({ title: '', content: '', category: tf.values.category });
    } catch (err) {
      tf.fieldError(/title/i.test(err.message) ? 'title' : 'content', err.message);
    }
  };

  const d = reports.data;
  const Item = ({ kind, item, text }) => (
    <div className="post">
      <div className="post-body">
        <div className="row" style={{ gap: 6 }}>
          <span className="pill pill-red"><Icon name="flag" size={12} />{item.reports} report{item.reports === 1 ? '' : 's'}</span>
          {item.hidden && <span className="pill">Hidden</span>}
          {item.community && <span className="pill">{item.community.name}</span>}
          <span className="small muted">by {item.author?.name || 'Former member'} · {timeAgo(item.createdAt)}</span>
        </div>
        <p style={{ marginTop: 4 }}>{text}</p>
        <div className="row" style={{ marginTop: 8 }}>
          {item.hidden
            ? <button className="btn btn-ghost btn-sm" onClick={() => act(() => api.put(`/admin/${kind}/${item._id}`, { hidden: false }))}>Restore</button>
            : <button className="btn btn-ghost btn-sm" onClick={() => act(() => api.put(`/admin/${kind}/${item._id}`, { hidden: true }))}>Hide</button>}
          <button className="btn btn-red btn-sm" onClick={() => act(() => api.del(`/admin/${kind}/${item._id}`))}>Delete</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="stack">
      <PageHeader title="Reports & tips" subtitle="Review reported content, delete community posts and publish official tips." />
      <ErrorMsg message={reports.error} onRetry={reports.reload} />
      <div className="grid grid-2">
        <div className="card">
          <h2 style={{ marginBottom: 6 }}>Reported community posts</h2>
          {!d ? <Spinner /> : d.posts.length === 0 ? <Empty icon="check" title="Nothing reported" /> : d.posts.map((p) => <Item key={p._id} kind="posts" item={p} text={p.content} />)}
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 6 }}>Reported Discover tips</h2>
          {!d ? <Spinner /> : d.tips.length === 0 ? <Empty icon="check" title="Nothing reported" /> : d.tips.map((t) => <Item key={t._id} kind="tips" item={t} text={`${t.title} — ${t.content}`} />)}
        </div>
      </div>
      <CommunityPosts />
      <form className="card form" onSubmit={addTip} noValidate>
        <h2>Add an official tip</h2>
        <div className="form-row">
          <TextField id="tip-title" label="Title" maxLength={100} value={tf.values.title} onChange={(v) => tf.set('title', v)} onBlur={() => tf.blur('title')} error={tf.err('title')} />
          <SelectField id="tip-cat" label="Category" placeholder={null} value={tf.values.category} onChange={(v) => tf.set('category', v)} options={['transport', 'energy', 'waste', 'food', 'water', 'lifestyle'].map((c) => [c, CATEGORY_META[c].label])} />
        </div>
        <TextField id="tip-content" label="Tip" multiline counter maxLength={1000} value={tf.values.content} onChange={(v) => tf.set('content', v)} onBlur={() => tf.blur('content')} error={tf.err('content')} />
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn">Publish tip</button></div>
      </form>
    </div>
  );
}
