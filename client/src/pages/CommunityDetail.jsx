import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useApi from '../hooks/useApi';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar, Co2, Empty, ErrorMsg, PageHeader, RedKg, Spinner, Stat } from '../components/ui';
import { CARBON_RED, CATEGORY_META, COMMUNITY_TYPES, LEVEL, kg, timeAgo } from '../utils/format';
import Icon from '../components/Icon';
import { SelectField, TextField } from '../components/FormFields';
import { URL_RE, minLen } from '../utils/validation';

const POST_CATS = ['general', 'transport', 'energy', 'waste', 'food', 'water', 'lifestyle'];
const catLabel = (c) => (c === 'general' ? 'General' : CATEGORY_META[c]?.label || c);

/* ---------------- Feed: posts, replies, likes ---------------- */
function Feed({ community, isAdmin }) {
  const toast = useToast();
  const base = `/communities/${community._id}/posts`;
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const feed = useApi(`${base}?page=${page}${category ? `&category=${category}` : ''}`, [], { refreshMs: 10000 });
  const [draft, setDraft] = useState({ content: '', category: 'general' });
  const [busy, setBusy] = useState(false);
  const [postTouched, setPostTouched] = useState(false);
  const [postServer, setPostServer] = useState('');
  const postErr = postServer || (postTouched ? minLen(draft.content, 5, 'your post') : null);
  const [openReply, setOpenReply] = useState(null);
  const [reply, setReply] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  const replacePost = (post) => feed.setData((d) => ({ ...d, posts: d.posts.map((p) => (p._id === post._id ? post : p)) }));

  const submit = async (e) => {
    e.preventDefault();
    setPostTouched(true);
    if (minLen(draft.content, 5, 'your post')) { document.getElementById('post-content')?.focus(); return; }
    setBusy(true);
    try {
      await api.post(base, draft);
      setDraft({ content: '', category: draft.category });
      setPostTouched(false);
      setPage(1);
      feed.reload();
      toast('Posted');
    } catch (err) {
      setPostServer(err.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn, okMsg) => {
    try {
      const res = await fn();
      if (res?.post) replacePost(res.post);
      if (okMsg) toast(okMsg);
      return res;
    } catch (err) {
      toast(err.message, 'error');
      return null;
    }
  };

  const sendReply = async (e, post) => {
    e.preventDefault();
    if (!reply.trim()) return;
    if (await act(() => api.post(`${base}/${post._id}/replies`, { content: reply }), 'Reply posted')) {
      setReply('');
    }
  };

  const removePost = async (post) => {
    if (await act(() => api.del(`${base}/${post._id}`), 'Post deleted')) {
      setConfirmDel(null);
      feed.setData((d) => ({ ...d, posts: d.posts.filter((p) => p._id !== post._id) }));
    }
  };

  const d = feed.data;
  return (
    <div className="stack">
      <form className="card form" onSubmit={submit} noValidate>
        <TextField id="post-content" label={`Share a tip with ${community.name}`} required={false} multiline counter maxLength={1000} value={draft.content}
          onChange={(v) => { setDraft({ ...draft, content: v }); setPostTouched(true); setPostServer(''); }} error={postErr} placeholder="What helped you cut emissions this week?" />
        <div className="row spread">
          <select id="post-cat" aria-label="Topic" style={{ width: 'auto' }} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            {POST_CATS.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
          <button className="btn" disabled={busy}>{busy ? 'Posting…' : 'Post'}</button>
        </div>
      </form>

      <div className="chips">
        {['', ...POST_CATS].map((c) => (
          <button key={c || 'all'} className={`chip ${category === c ? 'active' : ''}`} onClick={() => { setCategory(c); setPage(1); }}>{c ? catLabel(c) : 'All topics'}</button>
        ))}
      </div>

      <ErrorMsg message={feed.error} onRetry={feed.reload} />
      <div className="card">
        {feed.loading && !d ? <Spinner /> : d?.posts.length === 0 ? <Empty icon="message" title="No posts yet. Share the first tip." /> : d && d.posts.map((p) => (
          <div key={p._id} className="post">
            <Avatar user={p.author} />
            <div className="post-body">
              <div className="row" style={{ gap: 6 }}>
                <strong>{p.author.name}</strong>
                {p.pinned && <span className="pill pill-warn"><Icon name="pinned" size={12} />Pinned</span>}
                {p.isAnnouncement && <span className="pill pill-ok"><Icon name="megaphone" size={12} />Announcement</span>}
                {p.category !== 'general' && <span className="pill">{catLabel(p.category)}</span>}
                <span className="small muted">· {timeAgo(p.createdAt)}</span>
              </div>
              <p style={{ marginTop: 4 }}>{p.content}</p>
              <div className="row" style={{ marginTop: 8, gap: 6 }}>
                <button className={`chip ${p.liked ? 'liked' : ''}`} aria-pressed={p.liked} aria-label={p.liked ? 'Unlike' : 'Like'} onClick={() => act(() => api.post(`${base}/${p._id}/like`))}><Icon name="heart" size={15} />{p.likeCount}</button>
                <button className="chip" onClick={() => { setOpenReply(openReply === p._id ? null : p._id); setReply(''); }}><Icon name="message" size={15} />Reply ({p.replies.length})</button>
                {isAdmin && <button className="chip" onClick={() => act(() => api.put(`${base}/${p._id}/pin`, { pinned: !p.pinned }), p.pinned ? 'Unpinned' : 'Pinned').then((r) => r && feed.reload())}><Icon name="pinned" size={15} />{p.pinned ? 'Unpin' : 'Pin'}</button>}
                {!p.canDelete && <button className="chip" onClick={() => act(() => api.post(`${base}/${p._id}/report`)).then((r) => r && toast(r.message))}>Report</button>}
                {p.canDelete && (confirmDel === p._id ? (
                  <>
                    <button className="btn btn-red btn-sm" onClick={() => removePost(p)}>Delete post</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(null)}>Cancel</button>
                  </>
                ) : <button className="chip" style={{ color: 'var(--carbon)' }} onClick={() => setConfirmDel(p._id)}><Icon name="trash" size={14} />Delete</button>)}
              </div>

              {p.replies.map((r) => (
                <div key={r._id} className="reply">
                  <Avatar user={r.author} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}><strong className="small">{r.author.name}</strong><span className="small muted">{timeAgo(r.createdAt)}</span></div>
                    <p className="small" style={{ overflowWrap: 'anywhere' }}>{r.content}</p>
                    <div className="row" style={{ gap: 6, marginTop: 4 }}>
                      <button className="link-btn small" style={{ color: r.liked ? 'var(--carbon)' : 'var(--ink-3)' }} aria-pressed={r.liked} aria-label={r.liked ? 'Unlike reply' : 'Like reply'} onClick={() => act(() => api.post(`${base}/${p._id}/replies/${r._id}/like`))}><Icon name="heart" size={14} />{r.likeCount}</button>
                      {r.canDelete && <button className="link-btn small" style={{ color: 'var(--carbon)' }} onClick={() => act(() => api.del(`${base}/${p._id}/replies/${r._id}`), 'Reply deleted')}>Delete</button>}
                    </div>
                  </div>
                </div>
              ))}

              {openReply === p._id && (
                <form className="reply-form" onSubmit={(e) => sendReply(e, p)}>
                  <input id={`reply-${p._id}`} aria-label="Write a reply" maxLength={500} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} autoFocus />
                  <button className="btn btn-sm" disabled={!reply.trim()}>Reply</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
      {d?.pages > 1 && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Newer</button>
          <span className="small muted">Page {page} of {d.pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= d.pages} onClick={() => setPage(page + 1)}>Older →</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Members and their footprints ---------------- */
function Members({ community, isAdmin, isOwner, onChanged }) {
  const toast = useToast();
  const members = useApi(`/communities/${community._id}/members`, [], { refreshMs: 15000 });
  const run = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      members.reload();
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const d = members.data;
  return (
    <div className="stack">
      {isAdmin && d?.pending.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 8 }}>Join requests ({d.pending.length})</h2>
          {d.pending.map((p) => (
            <div key={p.userId} className="post" style={{ alignItems: 'center' }}>
              <Avatar user={p} />
              <div className="post-body"><strong>{p.name}</strong><p className="small muted">asked {timeAgo(p.requestedAt)}</p></div>
              <button className="btn btn-sm" onClick={() => run(() => api.post(`/communities/${community._id}/requests/${p.userId}/approve`), 'Request approved')}>Approve</button>
              <button className="btn btn-ghost btn-sm" onClick={() => run(() => api.post(`/communities/${community._id}/requests/${p.userId}/reject`), 'Request rejected')}>Reject</button>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Members{d ? ` (${d.members.length})` : ''}</h2>
            <p className="small muted">CO₂ over the last 30 days, updated live. Footprints show only for members who allow sharing.</p>
          </div>
          {isAdmin && <span className="small muted">To remove someone, use your organisation's Members page.</span>}
        </div>
        <ErrorMsg message={members.error} onRetry={members.reload} />
        {members.loading && !d ? <Spinner /> : d && (
          <div className="table-wrap">
            <table className="table stackable" id="community-members">
              <thead>
                <tr>
                  <th>Member</th><th>Role</th>
                  <th className="num">Transport</th><th className="num">Energy</th><th className="num">Waste</th><th className="num">Total CO₂</th>
                  <th>Level</th>{isOwner && <th />}
                </tr>
              </thead>
              <tbody>
                {sortMembers(d.members).map((m) => {
                  const f = m.footprint;
                  const none = <span className="dash">—</span>;
                  return (
                    <tr key={m.userId} className={m.isMe ? 'me-row' : ''}>
                      <td className="cell-first">
                        <div className="cell-main">
                          <Avatar user={m} size="sm" />
                          <div className="who"><strong>{m.name}{m.isMe ? ' (you)' : ''}</strong>{m.username && <span>@{m.username}</span>}</div>
                        </div>
                      </td>
                      <td data-label="Role">
                        {m.isOwner ? <span className="pill pill-warn">Owner</span> : m.role === 'admin' ? <span className="pill pill-biz">Co-admin</span> : <span className="pill">Member</span>}
                      </td>
                      <td data-label="Transport" className={`num ${f ? '' : 'no-data'}`}>{f ? <Co2 value={f.transport} digits={0} /> : none}</td>
                      <td data-label="Energy" className={`num ${f ? '' : 'no-data'}`}>{f ? <Co2 value={f.energy} digits={0} /> : none}</td>
                      <td data-label="Waste" className={`num ${f ? '' : 'no-data'}`}>{f ? <Co2 value={f.waste} digits={0} /> : none}</td>
                      <td data-label="Total CO₂" className={`num ${f ? '' : 'no-data'}`}>{f ? <strong><Co2 value={f.totalKg} digits={0} /></strong> : none}</td>
                      <td data-label="Level">
                        {m.isOrganisation ? <span className="pill">Organisation</span>
                          : !f ? <span className="pill" title="This member does not share their footprint"><Icon name="lock" size={12} />Private</span>
                            : f.level ? <span className={`pill ${LEVEL[f.level].cls}`}>{LEVEL[f.level].short}</span> : <span className="small muted">No data</span>}
                      </td>
                      {isOwner && (
                        <td className="actions">
                          {!m.isOwner && !m.isMe && !m.isOrganisation && (
                            <button className="btn btn-ghost btn-sm" onClick={() => run(() => api.put(`/communities/${community._id}/members/${m.userId}/role`, { role: m.role === 'admin' ? 'member' : 'admin' }), m.role === 'admin' ? 'Admin removed' : 'Made co-admin')}>{m.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Owner first, then co-admins, then members from lowest to highest CO₂ (private ones last)
function sortMembers(list) {
  const rank = (m) => (m.isOwner ? 0 : m.role === 'admin' ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b)
    || (a.footprint == null) - (b.footprint == null)
    || (a.footprint?.totalKg ?? 0) - (b.footprint?.totalKg ?? 0));
}

/* ---------------- Community-level tips from its emissions ---------------- */
function CommunityTips({ community }) {
  const ins = useApi(`/communities/${community._id}/insights`);
  const d = ins.data;
  if (ins.error) return <ErrorMsg message={ins.error} onRetry={ins.reload} />;
  if (!d) return <Spinner />;
  if (!d.membersCounted) return <div className="card"><Empty icon="chart" title="No shared footprint data yet">Tips appear once members who share their data log activities.</Empty></div>;
  const chart = d.categories.map((c) => ({ name: c.label, key: c.category, perDay: c.perDayKg, avg: c.averagePerDayKg }));
  return (
    <div className="stack">
      <div className="grid grid-2">
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Where {community.name} emits most</h2>
          <p className="small muted" style={{ marginBottom: 10 }}>kg CO₂ per member per day ({d.membersCounted} members counted) vs the average person</p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ left: -18 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => [kg(v, 2), n === 'perDay' ? 'This community' : 'Average person']} />
                <Bar dataKey="perDay" name="perDay" radius={[6, 6, 0, 0]}>{chart.map((c) => <Cell key={c.key} fill={CATEGORY_META[c.key].color} />)}</Bar>
                <Bar dataKey="avg" name="avg" fill="#c9bfbd" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card stack" style={{ gap: 10 }}>
          <h2>Tips for this community</h2>
          {d.categories.map((c) => (
            <div key={c.category} className={`insight ${LEVEL[c.level].insight}`}>
              <strong><RedKg text={c.headline} /></strong>
              <ul className="tip-list" style={{ marginTop: 6 }}>{c.tips.slice(0, 2).map((t) => <li key={t}><RedKg text={t} /></li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Admin panel (business account) ---------------- */
function AdminPanel({ community, isOwner, onChanged }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const progress = useApi(`/communities/${community._id}/progress?days=${days}`, [], { refreshMs: 15000 });
  const [code, setCode] = useState(community.inviteCode);
  const [ann, setAnn] = useState('');
  const [annTouched, setAnnTouched] = useState(false);
  const annErr = annTouched ? minLen(ann, 5, 'the announcement') : null;
  const [res, setRes] = useState({ title: '', description: '', url: '' });
  const [resTouched, setResTouched] = useState({});
  const resErrs = { title: minLen(res.title, 3, 'a title'), url: res.url && !URL_RE.test(res.url.trim()) ? 'Links must start with http:// or https://' : null };
  const resErr = (k) => (resTouched[k] ? resErrs[k] : null);
  const setResField = (k) => (v) => { setRes((x) => ({ ...x, [k]: v })); setResTouched((t) => ({ ...t, [k]: true })); };
  const [confirmDelete, setConfirmDelete] = useState('');

  const run = async (fn, msg, after) => {
    try {
      const r = await fn();
      if (msg) toast(typeof msg === 'function' ? msg(r) : msg);
      after?.(r);
      return r;
    } catch (err) {
      toast(err.message, 'error');
      return null;
    }
  };

  const copy = () => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(() => toast('Invite code copied'), () => toast('Select the code to copy it'));
    else toast('Select the code to copy it');
  };

  const p = progress.data;
  return (
    <div className="stack">
      <div className="card row spread">
        <div>
          <div className="stat-label">Invite code</div>
          <div className="row"><code style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.1em', userSelect: 'all' }}>{code}</code>
            <button className="btn btn-ghost btn-sm" onClick={copy}>Copy</button>
            <button className="btn btn-ghost btn-sm" onClick={() => run(() => api.post(`/communities/${community._id}/invite-code/regenerate`), 'New code created. The old one no longer works.', (r) => setCode(r.inviteCode))}>New code</button>
          </div>
          <p className="hint">Members enter this on the Communities page.</p>
        </div>
        <select id="prog-days" style={{ width: 'auto' }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
      </div>

      <ErrorMsg message={progress.error} onRetry={progress.reload} />
      {p && (
        <>
          <div className="grid grid-4">
            <Stat red label={`Community CO₂ (${days}d)`} value={Math.round(p.totals.totalKg)} unit="kg" />
            <Stat red label="Per member" value={p.totals.perMemberKg} unit="kg" />
            <Stat label="Goals achieved" value={p.totals.goalsAchieved} />
            <Stat label="Members sharing data" value={p.sharingCount} unit={`/ ${p.memberCount}`} />
          </div>
          <div className="grid grid-2">
            <div className="card">
              <h2 style={{ marginBottom: 12 }}>Monthly CO₂ per member</h2>
              {p.monthly.length === 0 ? <Empty icon="chart" title="No data yet" /> : (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={p.monthly} margin={{ left: -18 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => kg(v)} />
                      <Bar dataKey="perMemberKg" name="kg per member" fill={CARBON_RED} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="card">
              <h2 style={{ marginBottom: 10 }}>Member progress</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Member</th><th className="num">CO₂</th><th className="num">Goals ✓</th><th className="num">Points</th></tr></thead>
                  <tbody>
                    {p.members.map((m) => (
                      <tr key={m.userId}><td>{m.name}</td><td className="num"><Co2 value={m.footprint.totalKg} digits={0} /></td><td className="num">{m.goals.achieved}</td><td className="num">{m.challengePoints}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-2">
        <form className="card form" noValidate onSubmit={(e) => {
          e.preventDefault();
          setAnnTouched(true);
          if (minLen(ann, 5, 'the announcement')) return;
          run(() => api.post(`/communities/${community._id}/announcements`, { content: ann }), (r) => `Announcement sent to ${r.notified} members`, () => { setAnn(''); setAnnTouched(false); onChanged(); });
        }}>
          <div><h2>Send an announcement</h2><p className="small muted">Pinned to the feed and sent to every member as a notification.</p></div>
          <TextField id="ann" label="Message" multiline counter maxLength={1000} value={ann} onChange={(v) => { setAnn(v); setAnnTouched(true); }} error={annErr} placeholder="e.g. Car-pool sign-ups close Friday" />
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn">Send</button></div>
        </form>

        <form className="card form" noValidate onSubmit={(e) => {
          e.preventDefault();
          setResTouched({ title: true, url: true });
          if (resErrs.title || resErrs.url) return;
          run(() => api.post(`/communities/${community._id}/resources`, res), 'Resource shared with members', () => { setRes({ title: '', description: '', url: '' }); setResTouched({}); onChanged(); });
        }}>
          <h2>Share a resource</h2>
          <TextField id="res-title" label="Title" maxLength={100} value={res.title} onChange={setResField('title')} error={resErr('title')} />
          <TextField id="res-desc" label="Description" required={false} maxLength={500} value={res.description} onChange={setResField('description')} />
          <TextField id="res-url" label="Link" type="url" required={false} placeholder="https://" value={res.url} onChange={setResField('url')} error={resErr('url')} />
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn">Share</button></div>
        </form>
      </div>

      {isOwner && (
        <div className="card stack" style={{ gap: 10, borderColor: 'var(--carbon)' }}>
          <h2>Delete community</h2>
          <p className="small muted">Removes all posts, members and community challenges. Type the community name to confirm.</p>
          <div className="row">
            <input id="del-confirm" aria-label="Type the community name" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder={community.name} style={{ flex: 1, minWidth: 180 }} />
            <button className="btn btn-red" disabled={confirmDelete !== community.name} onClick={() => run(() => api.del(`/communities/${community._id}`), 'Community deleted', () => navigate('/communities'))}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Edit community details (admins) ---------------- */
function EditCommunity({ community, onSaved, onCancel }) {
  const toast = useToast();
  const { user } = useAuth();
  const initial = { name: community.name || '', description: community.description || '', type: community.type, visibility: community.visibility, city: community.city || '' };
  const [edit, setEdit] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [serverErr, setServerErr] = useState('');
  const dirty = JSON.stringify(edit) !== JSON.stringify(initial);
  const nameErr = serverErr || minLen(edit.name, 3, 'a community name');
  const set = (k) => (v) => { setEdit((x) => ({ ...x, [k]: v })); setServerErr(''); };

  const save = async (e) => {
    e.preventDefault();
    if (nameErr) { document.getElementById('ed-name')?.focus(); return; }
    setBusy(true);
    try {
      await api.put(`/communities/${community._id}`, edit);
      toast('Community updated');
      onSaved();
    } catch (err) {
      setServerErr(err.message);
      setBusy(false);
    }
  };

  return (
    <form id="community-edit" className="card form" onSubmit={save} noValidate>
      <h2>Edit community</h2>
      <div className="form-row">
        <TextField id="ed-name" label="Name" maxLength={80} value={edit.name} onChange={set('name')} error={nameErr} />
      </div>
      <div className="form-row">
        {user?.role !== 'business' && <SelectField id="ed-type" label="Type" placeholder={null} value={edit.type} onChange={set('type')} options={Object.entries(COMMUNITY_TYPES)} />}
        <SelectField id="ed-vis" label="Visibility" placeholder={null} value={edit.visibility} onChange={set('visibility')} options={[['private', 'Private (approve or invite code)'], ['public', 'Public (anyone can join)']]} />
      </div>
      <TextField id="ed-desc" label="Description" required={false} multiline counter maxLength={500} value={edit.description} onChange={set('description')} />
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button id="ed-save" className="btn" disabled={!dirty || busy || Boolean(nameErr)}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  );
}

/* ---------------- Page ---------------- */
export default function CommunityDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const detail = useApi(`/communities/${id}`, [id]);
  const [tab, setTab] = useState('feed');
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [editing, setEditing] = useState(false);

  const c = detail.data?.community;
  const m = c?.membership;
  const isMember = m?.status === 'active';
  const isAdmin = isMember && m.role === 'admin';
  const isOwner = c && String(c.owner) === String(user._id);

  const toggleShare = async () => {
    try {
      await api.put(`/communities/${id}/sharing`, { share: !m.shareFootprint });
      toast(m.shareFootprint ? 'Your footprint is now private in this community' : 'Your footprint is now shared with members');
      detail.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const leave = async () => {
    try {
      const r = await api.post(`/communities/${id}/leave`);
      toast(r.message);
      navigate('/communities');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const join = async () => {
    try {
      const r = await api.post(`/communities/${id}/join`, { shareFootprint: true });
      toast(r.status === 'pending' ? 'Request sent to the admin.' : 'You joined!');
      detail.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (detail.error) return <div className="stack"><PageHeader title="Community" /><ErrorMsg message={detail.error} onRetry={detail.reload} /><Link to="/communities">← All communities</Link></div>;
  if (!c) return <Spinner />;

  const tabs = [['feed', 'Feed'], ['members', 'Members & footprints'], ['tips', 'Community tips'], ['resources', 'Resources'], ...(isAdmin ? [['admin', 'Admin']] : [])];

  return (
    <div className="stack">
      <PageHeader title={c.name} subtitle={`${COMMUNITY_TYPES[c.type]}${c.city ? ` · ${c.city}` : ''} · ${c.visibility === 'private' ? 'Private' : 'Public'} · ${c.memberCount} member${c.memberCount === 1 ? "" : "s"} · admin: ${c.ownerInfo?.name || '—'}`}>
        <Link className="btn btn-ghost" to="/communities">← All</Link>
        {isAdmin && !editing && <button id="community-edit-btn" className="btn btn-ghost" onClick={() => setEditing(true)}><Icon name="edit" size={16} />Edit</button>}
        {/* Business accounts don't take part in challenges, so they get no leaderboard button here */}
        {isMember && user?.role !== 'business' && <Link className="btn btn-ghost" to={`/leaderboard?community=${c._id}`}><Icon name="trophy" size={16} />Leaderboard</Link>}
      </PageHeader>

      {editing && isAdmin ? (
        <EditCommunity community={c} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); detail.reload(); }} />
      ) : c.description && <p style={{ color: 'var(--ink-2)', maxWidth: '65ch' }}>{c.description}</p>}

      {!isMember ? (
        <div className="card">
          <Empty icon="lock" title={m?.status === 'pending' ? 'Your join request is waiting for the admin' : 'Join this community to see posts and footprints'}>
            {!m && <button className="btn" onClick={join}>{c.visibility === 'private' ? 'Request to join' : 'Join community'}</button>}
          </Empty>
        </div>
      ) : (
        <>
          {user.role !== 'business' && (
          <div className="card row spread">
            <label className="checkbox"><input type="checkbox" checked={m.shareFootprint} onChange={toggleShare} />Share my carbon footprint with this community</label>
            {!isOwner && (leaveConfirm ? (
              <span className="row"><span className="small muted">Leave {c.name}?</span><button className="btn btn-red btn-sm" onClick={leave}>Leave</button><button className="btn btn-ghost btn-sm" onClick={() => setLeaveConfirm(false)}>Cancel</button></span>
            ) : <button className="btn btn-ghost btn-sm" onClick={() => setLeaveConfirm(true)}>Leave community</button>)}
          </div>
          )}

          <div className="tabs" role="tablist">
            {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
          </div>

          {tab === 'feed' && <Feed community={c} isAdmin={isAdmin} />}
          {tab === 'members' && <Members community={c} isAdmin={isAdmin} isOwner={isOwner} onChanged={detail.reload} />}
          {tab === 'tips' && <CommunityTips community={c} />}
          {tab === 'resources' && (
            <div className="card">
              {c.resources.length === 0 ? <Empty icon="book" title="No resources shared yet" /> : (
                <div className="list">
                  {c.resources.map((r) => (
                    <div key={r._id} className="list-item" style={{ flexDirection: 'column', gap: 2 }}>
                      <strong>{r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a> : r.title}</strong>
                      {r.description && <span className="small muted">{r.description}</span>}
                      {isAdmin && <button className="link-btn small" style={{ color: 'var(--carbon)', alignSelf: 'flex-start' }} onClick={() => api.del(`/communities/${c._id}/resources/${r._id}`).then(() => { toast('Resource removed'); detail.reload(); }, (err) => toast(err.message, 'error'))}>Remove</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === 'admin' && isAdmin && <AdminPanel community={c} isOwner={isOwner} onChanged={detail.reload} />}
        </>
      )}
    </div>
  );
}
