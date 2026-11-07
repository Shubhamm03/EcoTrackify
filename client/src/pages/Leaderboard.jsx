import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useApi from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { Avatar, Empty, ErrorMsg, Medal, PageHeader, Spinner } from '../components/ui';
import { shortDate } from '../utils/format';
import Icon from '../components/Icon';


export default function Leaderboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('week');
  const [params, setParams] = useSearchParams();
  const scope = params.get('community') || '';
  const setScope = (id) => setParams(id ? { community: id } : {});
  const mine = useApi('/communities?mine=true');
  const myCommunities = (mine.data?.communities || []).filter((c) => c.membership?.status === 'active');
  const board = useApi(`/leaderboard?period=${period}${scope ? `&community=${scope}` : ''}`);
  const d = board.data;
  const top3 = d?.leaders.slice(0, 3) || [];
  // Podium order: 2nd, 1st, 3rd
  const podium = [top3[1], top3[0], top3[2]];

  return (
    <div className="stack">
      <PageHeader title="Leaderboard" subtitle="Ranked by points earned in green challenges." />

      <div className="row spread">
        <div className="chips">
          <button className={`chip ${period === 'week' ? 'active' : ''}`} onClick={() => setPeriod('week')}>This week</button>
          <button className={`chip ${period === 'all' ? 'active' : ''}`} onClick={() => setPeriod('all')}>All time</button>
        </div>
        {myCommunities.length > 0 && (
          <select id="lb-scope" aria-label="Leaderboard scope" style={{ width: 'auto' }} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">Everyone</option>
            {myCommunities.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <ErrorMsg message={board.error} onRetry={board.reload} />
      {board.loading && !d ? <Spinner /> : d && (
        d.leaders.length === 0 ? (
          <div className="card"><Empty icon="trophy" title="No points yet this period"><Link to="/challenges">Join a challenge to get on the board</Link></Empty></div>
        ) : (
          <>
            <div className="podium">
              {podium.map((p, i) => p ? (
                <div key={p.userId} className={`podium-step ${i === 1 ? 'first' : ''}`}>
                  <Medal place={p.rank} />
                  <div style={{ fontWeight: 700, marginTop: 6 }}>{p.name}{p.isMe && ' (you)'}</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem' }}>{p.points}</div>
                  <div className="small muted">{p.completed} completed</div>
                </div>
              ) : <div key={i} />)}
            </div>

            {d.me ? (
              <div className="alert alert-ok"><Icon name="trophy" size={17} /><span>You're ranked <strong>#{d.me.rank}</strong> of {d.totalParticipants} with <strong>{d.me.points} points</strong>{period === 'week' && d.weekStart ? ` this week (since ${shortDate(d.weekStart)})` : ''}.</span></div>
            ) : (
              <div className="alert alert-warn"><span>You're not on the board yet. <Link to="/challenges">Check in to a challenge</Link> to earn points.</span></div>
            )}

            <div className="card">
              <div className="table-wrap">
                <table className="table stackable">
                  <thead><tr><th>Rank</th><th>Name</th><th className="num">Check-ins</th><th className="num">Completed</th><th className="num">Points</th></tr></thead>
                  <tbody>
                    {d.leaders.map((r) => (
                      <tr key={r.userId} className={r.isMe ? 'me-row' : ''}>
                        <td className="rank" data-label="Rank">{r.rank <= 3 ? <Medal place={r.rank} /> : `#${r.rank}`}</td>
                        <td className="cell-first"><span className="row" style={{ flexWrap: 'nowrap', display: 'inline-flex' }}><Avatar user={r} size="sm" /><strong>{r.name}</strong>{r.username && <span className="small muted"> @{r.username}</span>}</span>{r.isMe && <span className="pill" style={{ marginLeft: 6 }}>You</span>}</td>
                        <td className="num" data-label="Check-ins">{r.checkIns}</td>
                        <td className="num" data-label="Completed">{r.completed}</td>
                        <td className="num" data-label="Points"><strong>{r.points}</strong></td>
                      </tr>
                    ))}
                    {d.me && !d.leaders.some((r) => r.isMe) && (
                      <tr className="me-row">
                        <td className="rank" data-label="Rank">#{d.me.rank}</td>
                        <td className="cell-first"><strong>{d.me.name}</strong> <span className="pill">You</span></td>
                        <td className="num" data-label="Check-ins">{d.me.checkIns}</td>
                        <td className="num" data-label="Completed">{d.me.completed}</td>
                        <td className="num" data-label="Points"><strong>{d.me.points}</strong></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
