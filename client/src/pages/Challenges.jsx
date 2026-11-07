import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useApi from '../hooks/useApi';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Empty, ErrorMsg, PageHeader, Progress, Spinner } from '../components/ui';
import { fmtDate, shortDate } from '../utils/format';
import Icon from '../components/Icon';

// Individuals join weekly challenges (global + their communities') and check in daily
export default function Challenges() {
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const current = useApi('/challenges/current');
  const history = useApi('/challenges/history');
  const [busyId, setBusyId] = useState(null);
  // Brief success animation on the card after a check-in (display only)
  const [celebrate, setCelebrate] = useState(null);
  useEffect(() => {
    if (!celebrate) return undefined;
    const t = setTimeout(() => setCelebrate(null), 1500);
    return () => clearTimeout(t);
  }, [celebrate]);

  const replace = (ch) =>
    current.setData((d) => ({ ...d, challenges: d.challenges.map((c) => (c._id === ch._id ? { ...c, ...ch, community: c.community, participants: c.participants + (!c.joined && ch.joined ? 1 : 0) } : c)) }));

  const act = async (ch, action) => {
    setBusyId(ch._id);
    try {
      if (action === 'join') {
        const res = await api.post(`/challenges/${ch._id}/join`);
        replace(res.challenge);
        toast(`Joined "${ch.title}" — check in each day you do it!`);
      } else if (action === 'checkin') {
        const res = await api.post(`/challenges/${ch._id}/checkin`);
        replace(res.challenge);
        setCelebrate({ id: ch._id, earned: res.earned, done: res.justCompleted });
        toast(res.justCompleted ? `Challenge complete. +${res.earned} points` : `+${res.earned} points. Nice work.`);
        refreshUser();
        history.reload();
      } else if (action === 'leave') {
        await api.del(`/challenges/${ch._id}/join`);
        current.reload();
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const d = current.data;
  const weekPoints = d?.challenges.reduce((a, c) => a + c.points, 0) || 0;
  const pastHistory = (history.data?.history || []).filter((h) => !d || new Date(h.weekStart).getTime() !== new Date(d.weekStart).getTime());

  return (
    <div className="stack">
      <PageHeader title="Green challenges" subtitle={d ? `This week: ${shortDate(d.weekStart)} – ${shortDate(d.weekEnd)}. Each challenge runs Monday to Sunday. Check in every day: 10 points a day, plus a bonus for all 7.` : 'Weekly challenges'}>
        <Link className="btn btn-ghost" to="/leaderboard"><Icon name="trophy" size={16} />Leaderboard</Link>
      </PageHeader>

      {d && (
        <div className="card stat-strip stagger">
          <div className="stat"><span className="stat-label">Points this week</span><span className="stat-value">{weekPoints}</span></div>
          <div className="stat"><span className="stat-label">All-time points</span><span className="stat-value">{user?.totalPoints ?? 0}</span></div>
          <div className="stat"><span className="stat-label">Joined</span><span className="stat-value">{d.challenges.filter((c) => c.joined).length}<small>/ {d.challenges.length}</small></span></div>
          <div className="stat"><span className="stat-label">Completed</span><span className="stat-value">{d.challenges.filter((c) => c.completed).length}</span></div>
        </div>
      )}

      <ErrorMsg message={current.error} onRetry={current.reload} />
      {current.loading && !d ? <Spinner /> : d && (
        <div className="grid grid-2 stagger">
          {d.challenges.map((c) => (
            <div key={c._id} className={`card challenge ${c.completed ? 'completed-card' : ''} ${celebrate?.id === c._id ? 'celebrate' : ''}`}>
              {celebrate?.id === c._id && (
                <>
                  <span className="celebrate-burst" aria-hidden="true" />
                  <span className="float-pts" aria-hidden="true">+{celebrate.earned} pts{celebrate.done ? ' · complete' : ''}</span>
                </>
              )}
              <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <div className="challenge-icon"><Icon name={c.icon} size={22} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row"><h3>{c.title}</h3>{c.community && <span className="pill pill-biz">{c.community.name}</span>}</div>
                  <p className="small muted" style={{ marginTop: 4 }}>{c.description}</p>
                </div>
              </div>
              <div className="challenge-meta small muted"><span>Up to {c.maxPoints} pts</span><span>{c.participants} joined</span></div>
              {c.joined && (
                <>
                  <div className="dots" aria-label={`${c.checkIns.length} of ${c.targetDays} check-ins`}>
                    {Array.from({ length: c.targetDays }, (_, i) => <span key={i} className={`dot ${i < c.checkIns.length ? 'on' : ''} ${celebrate?.id === c._id && i === c.checkIns.length - 1 ? 'just' : ''}`} />)}
                  </div>
                  <Progress value={(c.checkIns.length / c.targetDays) * 100} tone="green" />
                </>
              )}
              <div className="row spread challenge-foot">
                <strong className="tnum">{c.joined ? `${c.points} pts earned` : ''}</strong>
                <div className="row">
                  {!c.joined && <button className="btn" disabled={busyId === c._id} onClick={() => act(c, 'join')}>Join challenge</button>}
                  {c.joined && !c.completed && c.checkIns.length === 0 && <button className="btn btn-ghost btn-sm" disabled={busyId === c._id} onClick={() => act(c, 'leave')}>Leave</button>}
                  {c.joined && !c.completed && (
                    <button className="btn checkin-btn" disabled={busyId === c._id || c.checkedInToday} onClick={() => act(c, 'checkin')}><Icon name="check" size={16} />{c.checkedInToday ? 'Done today' : 'I did it today'}</button>
                  )}
                  {c.completed && <span className="pill pill-ok"><Icon name="check" size={13} />Completed</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: 10 }}>Past challenges</h2>
        {history.loading && !history.data ? <Spinner /> : pastHistory.length === 0 ? (
          <Empty icon="calendar" title="Your completed weeks will show up here" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Week of</th><th>Challenge</th><th className="num">Check-ins</th><th className="num">Points</th><th /></tr></thead>
              <tbody>
                {pastHistory.map((h) => (
                  <tr key={h._id}>
                    <td>{fmtDate(h.weekStart)}</td>
                    <td>{h.challenge.title}</td>
                    <td className="num">{h.checkIns.length}/{h.challenge.targetDays}</td>
                    <td className="num"><strong>{h.points}</strong></td>
                    <td>{h.completed ? <span className="pill pill-ok">Completed</span> : <span className="pill">Partial</span>}</td>
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
