import { useState } from 'react';
import useApi from '../hooks/useApi';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { Empty, ErrorMsg, PageHeader, Spinner } from '../components/ui';
import { shortDate } from '../utils/format';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import useForm from '../hooks/useForm';
import { SelectField, TextField } from '../components/FormFields';
import { minLen } from '../utils/validation';

// Icon names the server accepts for challenges
const ICONS = [['bus', 'Transport'], ['bike', 'Cycling'], ['bag', 'Plastic'], ['plug', 'Energy'], ['recycle', 'Recycling'], ['salad', 'Food'], ['droplet', 'Water'], ['leaf', 'General']];

const validateChallenge = (v) => ({ title: minLen(v.title, 3, 'a title'), description: minLen(v.description, 5, 'a short description') });

export default function BusinessChallenges() {
  const toast = useToast();
  const data = useApi('/business/challenges');
  const weekly = useApi('/challenges/current');
  const f = useForm({ community: '', title: '', description: '', icon: 'bus' }, validateChallenge);
  const form = f.values;
  const [busy, setBusy] = useState(false);
  const communities = data.data?.communities || [];

  const create = async (e) => {
    e.preventDefault();
    if (!f.check()) return;
    setBusy(true);
    try {
      await api.post('/challenges', { ...form, community: form.community || communities[0]?._id });
      toast('Challenge created and members notified');
      f.reset({ ...form, title: '', description: '' });
      data.reload();
    } catch (err) {
      f.fieldError(/description/i.test(err.message) ? 'description' : 'title', err.message);
    } finally {
      setBusy(false);
    }
  };

  const globals = (weekly.data?.challenges || []).filter((c) => !c.community);

  return (
    <div className="stack">
      <PageHeader title="Challenges" subtitle="Create weekly challenges for your communities and see who takes part." />
      <ErrorMsg message={data.error} onRetry={data.reload} />
      {!data.data ? <Spinner /> : communities.length === 0 ? (
        <div className="card"><Empty icon="users" title="Create a community first"><Link className="btn btn-sm" to="/communities?create=1"><Icon name="plus" size={14} />Create community</Link></Empty></div>
      ) : (
        <form className="card form" onSubmit={create} noValidate>
          <h2>New challenge for this week</h2>
          <p className="small muted">Challenges run Monday to Sunday. Members check in each day: 10 points a check-in, plus a bonus for all 7 days.</p>
          <div className="form-row">
            <SelectField id="bc-comm" label="Community" placeholder={null} value={form.community || communities[0]._id} onChange={(v) => f.set('community', v)} options={communities.map((c) => [c._id, c.name])} />
            <TextField id="bc-title" label="Title" maxLength={80} placeholder="e.g. Car-pool week" value={form.title} onChange={(v) => f.set('title', v)} onBlur={() => f.blur('title')} error={f.err('title')} />
            <SelectField id="bc-icon" label="Category" placeholder={null} value={form.icon} onChange={(v) => f.set('icon', v)} options={ICONS} />
          </div>
          <TextField id="bc-desc" label="Description" multiline counter maxLength={300} value={form.description} onChange={(v) => f.set('description', v)} onBlur={() => f.blur('description')} error={f.err('description')} placeholder="What should members do each day?" />
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create & notify members'}</button></div>
        </form>
      )}

      <div className="card">
        <h2 style={{ marginBottom: 10 }}>Your challenges</h2>
        {(data.data?.challenges || []).length === 0 ? <Empty icon="bolt" title="No challenges yet" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Challenge</th><th>Community</th><th>Week of</th><th className="num">Joined</th><th className="num">Completed</th></tr></thead>
              <tbody>
                {data.data.challenges.map((c) => (
                  <tr key={c._id}>
                    <td><span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><span className="icon-tile sm"><Icon name={c.icon} size={16} /></span>{c.title}</span></td>
                    <td>{c.community?.name}</td>
                    <td>{shortDate(c.weekStart)}</td>
                    <td className="num">{c.joined}</td>
                    <td className="num">{c.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 10 }}>This week's global challenges</h2>
        {weekly.loading && !weekly.data ? <Spinner /> : globals.map((c) => (
          <div key={c._id} className="row spread" style={{ padding: '6px 0' }}><span className="row" style={{ gap: 8 }}><Icon name={c.icon} size={16} />{c.title}</span><span className="small muted">{c.participants} joined</span></div>
        ))}
      </div>
    </div>
  );
}
