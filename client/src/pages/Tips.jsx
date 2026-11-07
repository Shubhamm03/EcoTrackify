import { useEffect, useState } from 'react';
import useApi from '../hooks/useApi';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { Empty, ErrorMsg, PageHeader, Spinner } from '../components/ui';
import { CATEGORY_META, timeAgo } from '../utils/format';
import Icon from '../components/Icon';
import useForm from '../hooks/useForm';
import { SelectField, TextField } from '../components/FormFields';
import { minLen } from '../utils/validation';

const CATS = ['transport', 'energy', 'waste', 'food', 'water', 'lifestyle'];
const validateTip = (v) => ({ title: minLen(v.title, 5, 'a title'), content: minLen(v.content, 20, 'your tip') });

export default function Tips() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [sort, setSort] = useState('popular');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page, sort, ...(query && { q: query }), ...(category && { category }), ...(source && { source }) });
  const tips = useApi(`/tips?${params}`);

  const [showForm, setShowForm] = useState(false);
  const f = useForm({ title: '', content: '', category: 'waste' }, validateTip);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // { id, action: 'delete' | 'report' }

  // Debounced search
  useEffect(() => {
    const id = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [q]);

  const updateTip = (tip) => tips.setData((d) => ({ ...d, tips: d.tips.map((t) => (t._id === tip._id ? tip : t)) }));

  const like = async (t) => {
    updateTip({ ...t, liked: !t.liked, likeCount: t.likeCount + (t.liked ? -1 : 1) }); // optimistic
    try {
      const res = await api.post(`/tips/${t._id}/like`);
      updateTip(res.tip);
    } catch (err) {
      updateTip(t);
      toast(err.message, 'error');
    }
  };

  // Delete and report ask for confirmation inline (no browser pop-up, which some browsers block)
  const report = async (t) => {
    setConfirm(null);
    try {
      const res = await api.post(`/tips/${t._id}/report`);
      toast(res.message);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (t) => {
    setConfirm(null);
    const prev = tips.data;
    tips.setData((d) => ({ ...d, tips: d.tips.filter((x) => x._id !== t._id), total: Math.max(0, (d.total || 1) - 1) }));
    try {
      await api.del(`/tips/${t._id}`);
      toast('Tip deleted');
    } catch (err) {
      tips.setData(prev);
      toast(err.message, 'error');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!f.check()) return;
    setBusy(true);
    try {
      await api.post('/tips', f.values);
      toast('Thanks for sharing your tip.');
      f.reset({ title: '', content: '', category: f.values.category });
      setShowForm(false);
      setSort('new');
      setPage(1);
      tips.reload();
    } catch (err) {
      f.fieldError(/title/i.test(err.message) ? 'title' : 'content', err.message);
    } finally {
      setBusy(false);
    }
  };

  const d = tips.data;

  return (
    <div className="stack">
      <PageHeader title="Discover" subtitle="Eco-friendly practices from our team and the community.">
        <button className="btn" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : '+ Share a tip'}</button>
      </PageHeader>

      {showForm && (
        <form className="card form" onSubmit={submit} noValidate>
          <h2>Share a tip with the community</h2>
          <div className="form-row">
            <TextField id="tip-title" label="Title" maxLength={100} value={f.values.title} onChange={(v) => f.set('title', v)} onBlur={() => f.blur('title')} error={f.err('title')} placeholder="e.g. Carry a steel bottle" />
            <SelectField id="tip-cat" label="Category" placeholder={null} value={f.values.category} onChange={(v) => f.set('category', v)} options={CATS.map((c) => [c, CATEGORY_META[c].label])} />
          </div>
          <TextField id="tip-content" label="Your tip" multiline maxLength={1000} counter value={f.values.content} onChange={(v) => f.set('content', v)} onBlur={() => f.blur('content')} error={f.err('content')} placeholder="Be kind and practical. Offensive or spammy content is blocked." />
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" disabled={busy}>{busy ? 'Posting…' : 'Post tip'}</button></div>
        </form>
      )}

      <div className="card stack" style={{ gap: 12 }}>
        <span className="search"><Icon name="search" size={16} /><input type="search" placeholder="Search tips" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tips" /></span>
        <div className="row spread">
          <div className="chips">
            <button className={`chip ${!category ? 'active' : ''}`} onClick={() => { setCategory(''); setPage(1); }}>All</button>
            {CATS.map((c) => (
              <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => { setCategory(c); setPage(1); }}>{CATEGORY_META[c].label}</button>
            ))}
          </div>
          <div className="row">
            <select style={{ width: 'auto' }} value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
              <option value="">All sources</option>
              <option value="official">Ecotrackify picks</option>
              <option value="community">Community</option>
            </select>
            <select style={{ width: 'auto' }} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              <option value="popular">Most liked</option>
              <option value="new">Newest</option>
            </select>
          </div>
        </div>
      </div>

      <ErrorMsg message={tips.error} onRetry={tips.reload} />
      {tips.loading && !d ? <Spinner /> : d && (d.tips.length === 0 ? (
        <div className="card"><Empty icon="search" title={query ? `No tips found for "${query}"` : 'No tips here yet'}>{query && <span className="muted small">Try another word, or share the first tip about it.</span>}</Empty></div>
      ) : (
        <>
          <div className="grid grid-3">
            {d.tips.map((t) => (
              <div key={t._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="row spread">
                  <span className={`pill pill-${t.category}`}>{CATEGORY_META[t.category].label}</span>
                  {t.isOfficial && <span className="pill pill-ok">Ecotrackify</span>}
                </div>
                <h3>{t.title}</h3>
                <p className="small" style={{ color: 'var(--ink-2)', flex: 1 }}>{t.content}</p>
                <div className="row spread small muted">
                  <span>{t.author ? `${t.author.name} · ${timeAgo(t.createdAt)}` : 'Ecotrackify team'}</span>
                  <div className="row">
                    {confirm?.id === t._id ? (
                      <>
                        <span className="small">{confirm.action === 'delete' ? 'Delete this tip?' : 'Report this tip?'}</span>
                        <button className="btn btn-red btn-sm" onClick={() => (confirm.action === 'delete' ? remove(t) : report(t))}>{confirm.action === 'delete' ? 'Delete' : 'Report'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
                      </>
                    ) : t.isMine ? <button className="link-btn small danger-text" onClick={() => setConfirm({ id: t._id, action: 'delete' })}><Icon name="trash" size={14} />Delete</button>
                      : !t.isOfficial && <button className="link-btn small" style={{ color: 'var(--ink-3)' }} onClick={() => setConfirm({ id: t._id, action: 'report' })}>Report</button>}
                    <button className={`chip ${t.liked ? 'liked' : ''}`} onClick={() => like(t)} aria-pressed={t.liked} aria-label={t.liked ? 'Unlike' : 'Like'}><Icon name="heart" size={15} />{t.likeCount}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {d.pages > 1 && (
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
              <span className="small muted">Page {page} of {d.pages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= d.pages} onClick={() => setPage(page + 1)}>Next →</button>
            </div>
          )}
        </>
      ))}
    </div>
  );
}
