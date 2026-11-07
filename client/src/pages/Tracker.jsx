import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useApi from '../hooks/useApi';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Co2, Empty, ErrorMsg, PageHeader, Progress, RedKg, Spinner } from '../components/ui';
import { CATEGORY_META, LEVEL, fmtDate, kg, toInputDate } from '../utils/format';
import Icon from '../components/Icon';
import { FieldError, SelectField, TextField } from '../components/FormFields';

const CATS = ['transport', 'energy', 'waste'];

export default function Tracker() {
  const toast = useToast();
  const { user } = useAuth();
  const biz = user?.role === 'business';
  const factors = useApi('/activities/factors');
  const [days, setDays] = useState(30);
  const summary = useApi(`/activities/summary?days=${days}`);
  const insights = useApi('/insights/me');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const list = useApi(`/activities?page=${page}&limit=10${filter ? `&category=${filter}` : ''}`);

  const [form, setForm] = useState({ category: 'transport', type: 'car_petrol', quantity: '', date: toInputDate(), note: '' });
  const [error, setError] = useState(''); // message from the server
  const [shown, setShown] = useState({}); // fields the person has typed in (or tried to submit)
  const [busy, setBusy] = useState(false);

  const types = factors.data?.factors?.[form.category] || {};
  // Business and personal accounts have different types: fall back to the first valid one
  const type = types[form.type] ? form.type : Object.keys(types)[0] || '';
  const def = types[type];
  const qty = Number(form.quantity);
  const preview = def && form.quantity !== '' && Number.isFinite(qty) && qty >= 0 ? qty * def.factor : null;
  // Live checks, shown under each field
  const today = toInputDate();
  const errs = {
    quantity: form.quantity === '' ? 'Enter the amount.' : !Number.isFinite(qty) ? 'Enter a number.' : qty <= 0 ? 'Amount must be more than 0.' : qty > 100000 ? 'That amount looks too large.' : null,
    date: !form.date ? 'Choose a date.' : form.date > today ? 'The date cannot be in the future.' : null,
  };
  const err = (k) => (shown[k] ? errs[k] : null);
  const edit = (k) => (v) => { setError(''); setForm((x) => ({ ...x, [k]: v })); setShown((t) => ({ ...t, [k]: true })); };

  const pickCategory = (c) => {
    const first = Object.keys(factors.data?.factors?.[c] || {})[0] || '';
    setForm({ ...form, category: c, type: first, quantity: '' });
    setError('');
    setShown({});
  };

  const reloadAll = () => {
    list.reload();
    summary.reload();
    insights.reload();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setShown({ quantity: true, date: true });
    if (errs.quantity || errs.date) { setTimeout(() => document.querySelector('form [aria-invalid="true"]')?.focus(), 0); return; }
    setBusy(true);
    try {
      const { activity } = await api.post('/activities', { ...form, type, quantity: qty });
      toast(`Logged ${kg(activity.co2Kg, 2)} CO₂ from ${def.label.toLowerCase()}`);
      setForm({ ...form, type, quantity: '', note: '' });
      setShown({});
      setPage(1);
      reloadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const [confirmId, setConfirmId] = useState(null);
  const remove = async (id) => {
    try {
      await api.del(`/activities/${id}`);
      toast('Activity deleted');
      setConfirmId(null);
      reloadAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const s = summary.data;
  const ins = insights.data;
  const factorLabel = (a) => factors.data?.factors?.[a.category]?.[a.type]?.label || a.type;

  return (
    <div className="stack">
      <PageHeader title={biz ? 'Company footprint' : 'My carbon footprint'} subtitle={biz ? `Log ${user.companyName}'s office energy, fleet and business travel, and waste.` : 'Log what you travel, use and throw away. We calculate the CO₂.'} />

      <div className="grid grid-2">
        <div className="card log-card">
          <div className="card-head"><h2><span className="icon-tile sm"><Icon name="plus" size={17} /></span>Log an activity</h2></div>
          {factors.loading ? <Spinner /> : (
            <form className="form" onSubmit={submit} noValidate>
              <div className="chips">
                {CATS.map((c) => (
                  <button type="button" key={c} className={`chip ${form.category === c ? 'active' : ''}`} onClick={() => pickCategory(c)}>
                    <Icon name={CATEGORY_META[c].icon} size={16} />{CATEGORY_META[c].label}
                  </button>
                ))}
              </div>
              <SelectField id="act-type" label="Type" placeholder={null} value={type} onChange={edit('type')} options={Object.entries(types).map(([k, v]) => [k, v.label])} />
              <div className="form-row">
                <TextField id="act-qty" label={`Amount${def ? ` (${def.unit})` : ''}`} type="number" inputMode="decimal" min="0" step="any" value={form.quantity} onChange={edit('quantity')} error={err('quantity')} placeholder="e.g. 12" />
                <TextField id="act-date" label="Date" type="date" max={today} value={form.date} onChange={edit('date')} error={err('date')} />
              </div>
              <TextField id="act-note" label="Note" required={false} maxLength={200} value={form.note} onChange={edit('note')} placeholder="Office commute" />
              <FieldError id="act-err" message={error} />
              <div className="row spread">
                <span className="muted small">
                  {preview != null ? <>≈ <Co2 value={preview} digits={2} /> CO₂ ({def.factor} kg per {def.unit})</> : `Factor: ${def ? `${def.factor} kg CO₂ per ${def.unit}` : '—'}`}
                </span>
                <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Add'}</button>
              </div>
            </form>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Footprint by source</h2>
            <select id="sum-days" style={{ width: 'auto' }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>
          <ErrorMsg message={summary.error} onRetry={summary.reload} />
          {s && (
            <>
              <div className="grid grid-3 source-tiles" style={{ gap: 10, marginBottom: 14 }}>
                {CATS.map((c) => (
                  <div key={c} className="source-tile">
                    <span className="lbl"><Icon name={CATEGORY_META[c].icon} size={14} />{CATEGORY_META[c].label}</span>
                    <Co2 value={s.categories[c]} />
                    <span className="small muted">{s.total ? Math.round((s.categories[c] / s.total) * 100) : 0}% of total</span>
                  </div>
                ))}
              </div>
              {s.topSources.length > 0 && (
                <>
                  <h3 className="small muted" style={{ marginBottom: 6 }}>Top emitters</h3>
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer>
                      <BarChart data={s.topSources} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v) => kg(v, 2)} />
                        <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                          {s.topSources.map((t) => <Cell key={t.type} fill={CATEGORY_META[t.category].color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Personal comparison with the average and what to reduce */}
      <div className="card">
        <div className="card-head"><h2>{biz ? 'Per employee vs typical offices' : 'You vs the average person'}</h2><span className="small muted">{biz && ins ? `Based on ${ins.employees} employees · ` : ''}per day</span></div>
        {biz && !user.companySize && (
          <p className="small muted cmp-note"><Icon name="info" size={14} />Using 10 employees for now. <Link to="/settings">Add your company size</Link> for accurate figures.</p>
        )}
        {!ins ? <Spinner /> : (
          <div className="grid grid-3 compare-cols">
            {ins.categories.map((c) => (
              <div key={c.category} className={`compare-col cmp-${c.level}`}>
                <div className="cmp-head">
                  <span className="icon-tile sm red"><Icon name={CATEGORY_META[c.category]?.icon || 'leaf'} size={16} /></span>
                  <strong>{c.label}</strong>
                  <span className={`pill ${LEVEL[c.level].cls}`}>{LEVEL[c.level].label}</span>
                </div>
                <div className="cmp-figures">
                  {c.perDayKg == null ? <span className="cmp-big muted">No data yet</span> : <span className="cmp-big"><Co2 value={c.perDayKg} digits={2} /><small> / day</small></span>}
                  <span className="small muted">{biz ? 'Typical office' : 'Average person'}: <Co2 value={c.averagePerDayKg} digits={2} /> / day</span>
                </div>
                <Progress value={c.ratio == null ? 0 : (c.ratio / 2) * 100} marker={50} tone={c.level === 'low' ? 'green' : ''} />
                <p className="cmp-tip small">
                  <Icon name="bulb" size={15} />
                  <span><strong>{c.level === 'high' ? 'Reduce this: ' : c.level === 'low' ? 'Next step: ' : 'Try: '}</strong><RedKg text={c.tips[0]} /></span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Activity log</h2>
          <div className="chips">
            {['', ...CATS].map((c) => (
              <button key={c || 'all'} className={`chip ${filter === c ? 'active' : ''}`} onClick={() => { setFilter(c); setPage(1); }}>
                {c ? CATEGORY_META[c].label : 'All'}
              </button>
            ))}
          </div>
        </div>
        <ErrorMsg message={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <Spinner /> : list.data?.items.length === 0 ? (
          <Empty icon="book" title="No activities logged yet" />
        ) : list.data && (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Source</th><th className="num">Amount</th><th className="num">CO₂</th><th /></tr></thead>
                <tbody>
                  {list.data.items.map((a) => (
                    <tr key={a._id}>
                      <td>{fmtDate(a.date)}</td>
                      <td>
                        {factorLabel(a)}
                        {a.note && <div className="small muted">{a.note}</div>}
                      </td>
                      <td className="num">{a.quantity} {a.unit}</td>
                      <td className="num"><Co2 value={a.co2Kg} digits={2} /></td>
                      <td className="num">
                        {confirmId === a._id ? (
                          <span className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            <button className="btn btn-red btn-sm" onClick={() => remove(a._id)}>Delete</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmId(null)}>Cancel</button>
                          </span>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmId(a._id)} aria-label="Delete activity"><Icon name="trash" size={15} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.data.pages > 1 && (
              <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
                <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
                <span className="small muted">Page {page} of {list.data.pages}</span>
                <button className="btn btn-ghost btn-sm" disabled={page >= list.data.pages} onClick={() => setPage(page + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
