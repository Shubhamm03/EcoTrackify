import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useApi from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { Co2, Empty, ErrorMsg, Medal, PageHeader, Spinner } from '../components/ui';
import { CATEGORY_META, COMMUNITY_TYPES, kg } from '../utils/format';


export default function Compare() {
  const { user } = useAuth();
  // A business compares only its own communities, ranked among themselves (no type or "mine" filters)
  const biz = user?.role === 'business';
  const cmp = useApi('/communities/compare');
  const [type, setType] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const all = cmp.data?.communities || [];
  let rank = 0;
  const rows = biz
    ? all.filter((c) => c.isMember).map((c) => ({ ...c, rank: c.perMemberKg == null ? null : ++rank }))
    : all.filter((c) => (!type || c.type === type) && (!onlyMine || c.isMember));
  const ranked = rows.filter((c) => c.perMemberKg != null);
  const chart = ranked.slice(0, 10).map((c) => ({
    name: c.name.length > 18 ? `${c.name.slice(0, 17)}…` : c.name,
    transport: c.perMemberByCategory.transport,
    energy: c.perMemberByCategory.energy,
    waste: c.perMemberByCategory.waste,
  }));

  return (
    <div className="stack">
      <PageHeader title={biz ? 'Compare your communities' : 'Compare communities'} subtitle={`${biz ? 'Your organisation\'s communities, ranked' : 'Ranked'} by CO₂ per member over the last 30 days. Lower is better. Only members who share their footprint are counted.`} />

      {!biz && (
      <div className="row spread">
        <div className="chips">
          <button className={`chip ${!type ? 'active' : ''}`} onClick={() => setType('')}>All</button>
          {Object.entries(COMMUNITY_TYPES).map(([k, v]) => <button key={k} className={`chip ${type === k ? 'active' : ''}`} onClick={() => setType(k)}>{v}</button>)}
        </div>
        <label className="checkbox"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />Only my communities</label>
      </div>
      )}

      <ErrorMsg message={cmp.error} onRetry={cmp.reload} />
      {cmp.loading && !cmp.data ? <Spinner /> : rows.length === 0 ? (
        <div className="card"><Empty icon="compare" title="No communities to compare"><Link to="/communities">{biz ? 'Create a community' : 'Find a community'}</Link></Empty></div>
      ) : (
        <>
          {chart.length > 0 && (
            <div className="card">
              <h2 style={{ marginBottom: 12 }}>CO₂ per member by source</h2>
              <div style={{ height: Math.max(200, chart.length * 44) }}>
                <ResponsiveContainer>
                  <BarChart data={chart} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v, n) => [kg(v), CATEGORY_META[n].label]} />
                    <Legend formatter={(n) => CATEGORY_META[n].label} />
                    {['transport', 'energy', 'waste'].map((k) => <Bar key={k} dataKey={k} stackId="a" fill={CATEGORY_META[k].color} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Rank</th><th>Community</th><th className="num">Members</th><th className="num">CO₂ / member</th><th className="num">Goals achieved</th><th className="num">Challenge points</th></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c._id} className={c.isMember && !biz ? 'me-row' : ''}>
                      <td className="rank">{c.rank ? (c.rank <= 3 ? <Medal place={c.rank} /> : `#${c.rank}`) : '—'}</td>
                      <td>
                        {c.isMember ? <Link to={`/communities/${c._id}`}>{c.name}</Link> : c.name}
                        <div className="small muted">{COMMUNITY_TYPES[c.type]}{c.city ? ` · ${c.city}` : ''}{c.isMember && !biz ? ' · joined' : ''}</div>
                      </td>
                      <td className="num">{c.members}<div className="small muted">{c.membersCounted} counted</div></td>
                      <td className="num">{c.perMemberKg == null ? <span className="muted small">No data</span> : <Co2 value={c.perMemberKg} digits={0} />}</td>
                      <td className="num">{c.goalsAchieved}</td>
                      <td className="num">{c.challengePoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
