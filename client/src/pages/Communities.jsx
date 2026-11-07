import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useApi from '../hooks/useApi';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Empty, ErrorMsg, Monogram, PageHeader, Spinner } from '../components/ui';
import Icon from '../components/Icon';
import useForm from '../hooks/useForm';
import { FieldError, SelectField, TextField } from '../components/FormFields';
import { COMMUNITY_TYPES, communityTypeFor } from '../utils/format';

function CommunityCard({ c, onJoin, busy, canJoin }) {
  const m = c.membership;
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Monogram name={c.name} />
        <div style={{ minWidth: 0 }}>
          <h3 style={{ overflowWrap: 'anywhere' }}>{c.name}</h3>
          <p className="small muted">{COMMUNITY_TYPES[c.type]} · {c.visibility === 'private' ? 'Private' : 'Public'} · {c.memberCount} member{c.memberCount === 1 ? '' : 's'}{c.city ? ` · ${c.city}` : ''}</p>
        </div>
      </div>
      {c.description && <p className="small" style={{ color: 'var(--ink-2)' }}>{c.description}</p>}
      <div className="row spread">
        {m?.status === 'active' ? <span className={`pill ${m.role === 'admin' ? 'pill-biz' : 'pill-ok'}`}>{m.role === 'admin' ? 'Admin' : 'Member'}</span>
          : m?.status === 'pending' ? <span className="pill pill-warn">Request pending</span> : <span />}
        {m?.status === 'active' ? <Link className="btn btn-sm" to={`/communities/${c._id}`}>Open</Link>
          : m?.status === 'pending' ? null
            : m?.status === 'banned' || !canJoin ? null
              : <button className="btn btn-sm" disabled={busy} onClick={() => onJoin(c)}>{c.visibility === 'private' ? 'Request to join' : 'Join'}</button>}
      </div>
    </div>
  );
}

const validateCommunity = (v) => ({
  name: !v.name.trim() ? 'Please enter a community name.' : v.name.trim().length < 3 ? `Name needs at least 3 characters (${v.name.trim().length}/3).` : null,
});

export default function Communities() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('mine');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const params = new URLSearchParams({ ...(tab === 'mine' && { mine: 'true' }), ...(query && { q: query }), ...(type && { type }) });
  const list = useApi(`/communities?${params}`);
  const [joining, setJoining] = useState(null); // community awaiting the share-footprint choice
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState('');
  const isBusiness = user.role === 'business' || user.role === 'admin';
  // Links such as the business overview open the create form directly (?create=1)
  const location = useLocation();
  const [showCreate, setShowCreate] = useState(() => isBusiness && new URLSearchParams(location.search).get('create') === '1');
  // Business accounts don't pick a type: their communities take the organisation's type
  const ownType = user.role === 'business' ? communityTypeFor(user.orgType) : 'company';
  const f = useForm({ name: '', description: '', type: ownType, visibility: 'private' }, validateCommunity);

  useEffect(() => {
    const id = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(id);
  }, [q]);

  const join = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/communities/${joining._id}/join`, { shareFootprint: share });
      toast(res.status === 'pending' ? 'Request sent. The admin will review it.' : `You joined ${joining.name}!`);
      setJoining(null);
      if (res.status === 'active') navigate(`/communities/${joining._id}`);
      else list.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const joinWithCode = async (e) => {
    e.preventDefault();
    if (!code.trim()) return setCodeErr('Enter the invite code.');
    if (!/^[A-Z0-9]{6,12}$/.test(code.trim().toUpperCase())) return setCodeErr('Invite codes are 6–12 letters and numbers.');
    setBusy(true);
    try {
      const res = await api.post('/communities/join-code', { inviteCode: code, shareFootprint: share });
      toast(`You joined ${res.community.name}!`);
      navigate(`/communities/${res.community._id}`);
    } catch (err) {
      setCodeErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!f.check()) return;
    setBusy(true);
    try {
      const res = await api.post('/communities', f.values);
      toast(`Community created. Invite code: ${res.community.inviteCode}`);
      navigate(`/communities/${res.community._id}`);
    } catch (err) {
      f.fieldError(/description/i.test(err.message) ? 'description' : 'name', err.message);
    } finally {
      setBusy(false);
    }
  };

  const items = list.data?.communities || [];
  const shown = tab === 'mine' ? items.filter((c) => c.membership) : items.filter((c) => !c.membership || c.membership.status !== 'active');

  return (
    <div className="stack">
      <PageHeader title="Communities" subtitle={isBusiness ? 'Create and manage communities for your people.' : "Share tips, reply and like, and see each other's footprints."}>
        <Link className="btn btn-ghost" to="/compare"><Icon name="compare" size={16} />Compare</Link>
        {isBusiness && <button className="btn" onClick={() => setShowCreate((v) => !v)}>{showCreate ? 'Close' : <><Icon name="plus" size={16} />Create community</>}</button>}
      </PageHeader>

      {showCreate && (
        <form className="card form" onSubmit={create} noValidate>
          <h2>Create a community</h2>
          <p className="small muted">You will be the admin. Members join with your invite code, or by request if the community is public.</p>
          <div className="form-row">
            <TextField id="cc-name" label="Name" maxLength={80} value={f.values.name} onChange={(v) => f.set('name', v)} onBlur={() => f.blur('name')} error={f.err('name')} />
            {user.role !== 'business' && <SelectField id="cc-type" label="Type" placeholder={null} value={f.values.type} onChange={(v) => f.set('type', v)} options={Object.entries(COMMUNITY_TYPES)} />}
            <SelectField id="cc-vis" label="Visibility" placeholder={null} value={f.values.visibility} onChange={(v) => f.set('visibility', v)} options={[['private', 'Private (invite code or approval)'], ['public', 'Public (anyone can join)']]} />
          </div>
          <TextField id="cc-desc" label="Description" required={false} multiline counter maxLength={500} value={f.values.description} onChange={(v) => f.set('description', v)} error={f.err('description')} />
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" disabled={busy}>Create community</button></div>
        </form>
      )}

      {joining && (
        <div className="card stack" style={{ gap: 12, borderColor: 'var(--brand-2)' }}>
          <h2>Join {joining.name}?</h2>
          <label className="checkbox"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />Share my carbon footprint with members and the admin</label>
          <p className="hint">You can change this any time in the community. If off, members see you as "Private".</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setJoining(null)}>Cancel</button>
            <button className="btn" disabled={busy} onClick={join}>{joining.visibility === 'private' ? 'Send request' : 'Join'}</button>
          </div>
        </div>
      )}

      {!isBusiness && (
        <form className="card row spread" onSubmit={joinWithCode}>
          <div style={{ minWidth: 0 }}>
            <h3>Have an invite code?</h3>
            <p className="small muted">Company and college communities give their members a code.</p>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input id="invite-code" aria-label="Invite code" placeholder="e.g. 3FA9C21B" value={code} aria-invalid={Boolean(codeErr)} className={codeErr ? 'invalid' : ''}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeErr(''); }} style={{ width: 170 }} />
              <button className="btn btn-ghost" disabled={busy}>Join</button>
            </div>
            <FieldError id="invite-code-err" message={codeErr} />
          </div>
        </form>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>My communities</button>
        <button className={`tab ${tab === 'discover' ? 'active' : ''}`} onClick={() => setTab('discover')}>Discover</button>
      </div>
      <div className="row">
        <span className="search"><Icon name="search" size={16} /><input id="comm-search" type="search" placeholder="Search communities" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search communities" /></span>
        <select id="comm-type" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(COMMUNITY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <ErrorMsg message={list.error} onRetry={list.reload} />
      {list.loading && !list.data ? <Spinner /> : shown.length === 0 ? (
        <div className="card">
          <Empty icon="users" title={tab === 'mine' ? "You haven't joined a community yet" : 'No communities found'}>
            {tab === 'mine' && <button className="btn" onClick={() => setTab('discover')}>Discover communities</button>}
          </Empty>
        </div>
      ) : (
        <div className="grid grid-2">
          {shown.map((c) => <CommunityCard key={c._id} c={c} busy={busy} canJoin={!isBusiness} onJoin={(x) => { setShare(true); setJoining(x); window.scrollTo(0, 0); }} />)}
        </div>
      )}
    </div>
  );
}
