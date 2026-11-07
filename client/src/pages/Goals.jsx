import { useEffect, useState } from 'react';
import useApi from '../hooks/useApi';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Co2, Empty, ErrorMsg, PageHeader, Progress, Spinner } from '../components/ui';
import { CATEGORY_META, LEVEL, fmtDate, kg, toInputDate } from '../utils/format';
import Icon from '../components/Icon';
import useForm from '../hooks/useForm';
import { SelectField, TextField } from '../components/FormFields';

const PACE = {
  'on-track': { label: 'On track', cls: 'pill-ok' },
  'at-risk': { label: 'At risk', cls: 'pill-warn' },
  'over-budget': { label: 'Over budget', cls: 'pill-red' },
};

const addDays = (n) => toInputDate(new Date(Date.now() + n * 86400000));
const spanDays = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
const validateGoal = (v) => {
  const t = Number(v.targetKg);
  const days = spanDays(v.startDate, v.endDate);
  const earliest = addDays(-7);
  return {
    title: !v.title.trim() ? 'Give your goal a title.' : v.title.trim().length < 3 ? 'Title needs at least 3 characters.' : null,
    startDate: !v.startDate ? 'Choose a start date.' : v.startDate < earliest ? 'Start can be at most 7 days in the past.' : null,
    endDate: !v.endDate ? 'Choose an end date.' : !Number.isFinite(days) || days < 7 ? 'The goal must run for at least 7 days.' : days > 365 ? 'The goal can run for at most one year.' : null,
    targetKg: String(v.targetKg).trim() === '' ? 'Enter a budget in kg.' : !Number.isFinite(t) || t <= 0 ? 'Budget must be more than 0 kg.' : null,
  };
};

export default function Goals() {
  const toast = useToast();
  const { user } = useAuth();
  const goals = useApi('/goals');
  const insights = useApi('/insights/me');
  const [tab, setTab] = useState('active');
  const [showForm, setShowForm] = useState(false);
  const f = useForm({ title: '', category: 'transport', targetKg: '', startDate: toInputDate(), endDate: addDays(29) }, validateGoal);
  const form = f.values;
  const [suggest, setSuggest] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  // The goal just added glows for a moment (display only)
  const [fresh, setFresh] = useState('');
  useEffect(() => {
    if (!fresh) return undefined;
    const t = setTimeout(() => setFresh(''), 2000);
    return () => clearTimeout(t);
  }, [fresh]);

  const days = Math.max(1, Math.round((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1);

  useEffect(() => {
    if (!showForm || !Number.isFinite(days)) return undefined;
    const ctrl = new AbortController();
    api.get(`/goals/suggest?category=${form.category}&days=${days}`, { signal: ctrl.signal }).then(setSuggest).catch(() => {});
    return () => ctrl.abort();
  }, [showForm, form.category, days]);

  // One click: turn a suggested goal into a real 30-day goal
  const applySuggestion = async (g) => {
    setAdding(g.title);
    try {
      await api.post('/goals', { title: g.title, category: g.category, targetKg: g.targetKg, startDate: toInputDate(), endDate: addDays(g.days - 1), source: 'suggested' });
      toast('Goal added');
      setFresh(g.title);
      setTab('active');
      goals.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAdding('');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!f.check()) return;
    setBusy(true);
    try {
      await api.post('/goals', { ...form, targetKg: Number(form.targetKg) });
      toast('Goal created');
      setFresh(form.title.trim());
      setShowForm(false);
      f.reset({ ...form, title: '', targetKg: '' });
      setTab('active');
      goals.reload();
    } catch (err) {
      const m = err.message;
      f.fieldError(/title/i.test(m) ? 'title' : /start/i.test(m) ? 'startDate' : /days|year|date/i.test(m) ? 'endDate' : 'targetKg', m);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (g) => {
    const prev = goals.data;
    goals.setData({ goals: prev.goals.filter((x) => x._id !== g._id) });
    setConfirmId(null);
    try {
      await api.del(`/goals/${g._id}`);
      toast('Goal deleted');
    } catch (err) {
      goals.setData(prev);
      toast(err.message, 'error');
    }
  };

  const all = goals.data?.goals || [];
  const shown = all.filter((g) => (tab === 'active' ? g.status === 'active' : g.status !== 'active'));
  const ins = insights.data;
  const activeTitles = new Set(all.filter((g) => g.status === 'active').map((g) => g.title));

  return (
    <div className="stack">
      <PageHeader title="Goals & tips" subtitle={user?.role === 'business' ? 'Set from your company emissions per employee: bigger cuts where you are high, advanced goals where you are already low.' : 'Set from your own emissions: bigger cuts where you are high, advanced goals where you are already low.'} />

      {/* Suggestions per source, based on the user's level vs the average */}
      <ErrorMsg message={insights.error} onRetry={insights.reload} />
      {!ins ? <Spinner /> : (
        <>
          {ins.starterTip && <div className="insight mid">{ins.starterTip}</div>}
          {(ins.overallLevel === 'low' || ins.allLowOrUnknown) && (
            <div className="insight good"><strong>Your total footprint is below average.</strong> We've added advanced goals so you can keep improving.</div>
          )}
          {/* One clean card per source: where you stand, then 1-2 goals you can add with one click */}
          <div className="grid grid-3 stagger suggest-grid">
            {ins.categories.filter((c) => ['transport', 'energy', 'waste'].includes(c.category)).map((c) => (
              <div key={c.category} className="card suggest-card">
                <div className="suggest-head">
                  <span className="icon-tile sm"><Icon name={CATEGORY_META[c.category].icon} size={17} /></span>
                  <strong>{c.label}</strong>
                  <span className={`pill ${LEVEL[c.level].cls}`}>{LEVEL[c.level].short}</span>
                </div>
                <p className="small muted suggest-level">
                  {c.perDayKg == null ? 'No data yet' : <>You: <Co2 value={c.perDayKg} digits={2} suffix="/day" /></>} · average <Co2 value={c.averagePerDayKg} digits={2} />/day
                </p>
                <ul className="suggest-list">
                  {c.suggestedGoals.slice(0, 2).map((g) => {
                    const active = activeTitles.has(g.title);
                    return (
                      <li key={g.title}>
                        <span className="suggest-title">{g.title}</span>
                        <div className="suggest-act">
                          <span className="small muted">{g.savingKg > 0 ? <>Saves about <Co2 value={g.savingKg} /> a month</> : <>Budget <Co2 value={g.targetKg} /></>}</span>
                          <button className={`btn btn-sm ${active ? 'btn-ghost' : ''}`} disabled={adding === g.title || active} onClick={() => applySuggestion(g)} aria-label={`Add goal: ${g.title}`}>
                            {active ? <><Icon name="check" size={14} />Added</> : adding === g.title ? 'Adding…' : <><Icon name="plus" size={14} />Add</>}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Custom goal: the button sits under the suggestions and the form opens right below it */}
      <div className="custom-goal-bar">
        <div>
          <strong>Want a different target?</strong>
          <p className="small muted">Set your own budget for any period of 7 days or more.</p>
        </div>
        <button id="custom-goal-btn" className={`btn ${showForm ? 'btn-ghost' : ''}`} aria-expanded={showForm} onClick={() => setShowForm((v) => !v)}>
          <Icon name={showForm ? 'x' : 'plus'} size={16} />{showForm ? 'Close' : 'Custom goal'}
        </button>
      </div>

      {showForm && (
        <div className="card custom-goal-form">
          <form className="form" onSubmit={submit} noValidate>
            <TextField id="goal-title" label="Title" maxLength={100} value={form.title} onChange={(v) => f.set('title', v)} onBlur={() => f.blur('title')} error={f.err('title')} placeholder="e.g. Cut my commute emissions" />
            <div className="form-row">
              <SelectField id="goal-cat" label="Category" placeholder={null} value={form.category} onChange={(v) => f.set('category', v)} options={['transport', 'energy', 'waste', 'overall'].map((c) => [c, CATEGORY_META[c].label])} />
              <TextField id="goal-start" label="Start" type="date" value={form.startDate} onChange={(v) => f.set('startDate', v)} error={f.err('startDate')} />
              <TextField id="goal-end" label="End" type="date" min={form.startDate} value={form.endDate} onChange={(v) => f.set('endDate', v)} error={f.err('endDate')} />
              <TextField id="goal-target" label="Budget (kg CO₂)" type="number" min="0" step="any" inputMode="decimal" value={form.targetKg} onChange={(v) => f.set('targetKg', v)} onBlur={() => f.blur('targetKg')} error={f.err('targetKg')} />
            </div>
            {suggest?.suggestedKg > 0 && (
              <div className="alert alert-warn small">
                Based on the last 30 days you'd emit about <strong className="co2">{kg(suggest.baselineKg)}</strong> in {days} days.
                A 15% cut would be <button type="button" className="link-btn" onClick={() => f.set('targetKg', String(suggest.suggestedKg))}><strong className="co2">{kg(suggest.suggestedKg)}</strong> (use this)</button>.
              </div>
            )}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Create goal'}</button>
            </div>
          </form>
        </div>
      )}

      <h2>My goals</h2>
      <div className="chips">
        <button className={`chip ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>Active ({all.filter((g) => g.status === 'active').length})</button>
        <button className={`chip ${tab === 'done' ? 'active' : ''}`} onClick={() => setTab('done')}>Finished ({all.filter((g) => g.status !== 'active').length})</button>
      </div>

      <ErrorMsg message={goals.error} onRetry={goals.reload} />
      {goals.loading && !goals.data ? <Spinner /> : shown.length === 0 ? (
        <div className="card"><Empty icon="target" title={tab === 'active' ? 'No active goals' : 'No finished goals yet'}>{tab === 'active' && <span className="small muted">Pick one of the suggested goals above.</span>}</Empty></div>
      ) : (
        <div className="grid grid-2 stagger">
          {shown.map((g) => {
            const p = g.progress;
            const pace = PACE[p.pace];
            return (
              <div key={g._id} className={`card goal-card ${g.status === 'achieved' ? 'completed-card' : ''} ${fresh && g.title === fresh && g.status === 'active' ? 'fresh' : ''}`}>
                <div className="goal-top">
                  <span className={`icon-tile sm ${g.status === 'achieved' ? '' : 'red'}`}><Icon name={g.status === 'achieved' ? 'trophy' : CATEGORY_META[g.category].icon} size={17} /></span>
                  <div className="pills">
                    <span className="pill pill-red">{CATEGORY_META[g.category].label}</span>
                    {g.status === 'active' ? <span className={`pill ${pace.cls}`}>{pace.label}</span>
                      : g.status === 'achieved' ? <span className="pill pill-ok"><Icon name="check" size={12} />Achieved</span> : <span className="pill pill-red">Missed</span>}
                  </div>
                </div>
                <h3 style={{ margin: '14px 0 4px' }}>{g.title}</h3>
                <p className="small muted">{fmtDate(g.startDate)} – {fmtDate(g.endDate)}{g.source === 'suggested' ? ' · suggested for you' : ''}</p>
                <div style={{ margin: '16px 0 8px' }}>
                  <Progress value={p.budgetPct} marker={g.status === 'active' ? p.timePct : null} />
                </div>
                <div className="row spread small">
                  <span><Co2 value={p.emittedKg} /> <span className="muted">of <Co2 value={g.targetKg} /> budget ({p.budgetPct}%)</span></span>
                </div>
                {g.status === 'achieved' && g.savedKg > 0 && (
                  <p className="small" style={{ marginTop: 8, color: 'var(--brand-ink)' }}>Saved ~<span className="co2">{kg(g.savedKg)}</span> CO₂ compared with your usual habits</p>
                )}
                <div className="goal-foot">
                  {confirmId === g._id ? (
                    <>
                      <span className="small muted">Delete this goal?</span>
                      <button className="btn btn-red btn-sm" onClick={() => remove(g)}>Delete</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmId(g._id)}>Delete</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
