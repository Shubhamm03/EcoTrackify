import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useApi from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar, Co2, Empty, ErrorMsg, PageHeader, RedKg, Spinner, Stat } from '../components/ui';
import { CARBON_RED, CATEGORY_META, LEVEL, kg, shortDate } from '../utils/format';
import Icon from '../components/Icon';

export default function BusinessOverview() {
  const { user } = useAuth();
  const toast = useToast();
  const ov = useApi('/business/overview', [], { refreshMs: 15000 });
  const summary = useApi('/activities/summary?days=30');
  const insights = useApi('/insights/me');
  const d = ov.data;
  const s = summary.data;
  const ins = insights.data;
  const worst = ins?.categories.find((c) => c.category === ins.worst);
  const firstCommunity = d?.communities[0];

  const copy = (code) => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(() => toast('Invitation code copied'), () => toast('Select the code to copy it'));
    else toast('Select the code to copy it');
  };

  return (
    <div className="stack">
      <PageHeader title={user.companyName} subtitle={`Business overview · ${user.orgType}${user.industry ? ` · ${user.industry}` : ''}`}>
        <Link className="btn" to="/tracker">+ Log company activity</Link>
      </PageHeader>
      <ErrorMsg message={ov.error} onRetry={ov.reload} />
      {!d ? <Spinner /> : (
        <>
          {d.company.totalKg === 0 && d.membersCount === 0 && (
            <div className="card stack" style={{ gap: 10, borderColor: 'var(--biz)' }}>
              <h2>Set up your organisation</h2>
              <div className="grid grid-3">
                <Link className="type-card" to="/tracker"><span className="icon-tile sm red"><Icon name="factory" size={17} /></span><strong>Log company emissions</strong><span className="small muted">Office electricity, fleet, business travel, waste.</span></Link>
                {firstCommunity ? (
                  <button type="button" className="type-card" onClick={() => copy(firstCommunity.inviteCode)}>
                    <span className="icon-tile sm biz"><Icon name="mail" size={17} /></span><strong>Invite your people</strong><span className="small muted">Share code <code>{firstCommunity.inviteCode}</code> (tap to copy)</span>
                  </button>
                ) : (
                  <Link className="type-card" to="/communities?create=1" id="setup-create-community">
                    <span className="icon-tile sm biz"><Icon name="users" size={17} /></span><strong>Create a community</strong><span className="small muted">Each community gets its own invitation code for your people.</span>
                  </Link>
                )}
                <Link className="type-card" to="/business/challenges"><span className="icon-tile sm"><Icon name="bolt" size={17} /></span><strong>Create a challenge</strong><span className="small muted">For members of your communities.</span></Link>
              </div>
            </div>
          )}

          <div className="grid grid-4">
            <Stat red label="Company CO₂ (30 days)" value={d.company.totalKg} unit="kg" sub={<span className="small muted">From your own logs</span>} />
            <Stat red label="Members' CO₂ (30 days)" value={d.membersTotalKg} unit="kg" sub={<span className="small muted">{d.sharingWithData} sharing members</span>} />
            <Stat label="Members" value={d.membersCount} sub={<span className="small muted">in {d.communities.length} communit{d.communities.length === 1 ? 'y' : 'ies'}</span>} />
            <Stat label="Pending requests" value={d.pendingRequests} sub={d.pendingRequests > 0 && <Link to="/communities" className="small">Review →</Link>} />
          </div>

          <div className="card">
            <div className="card-head"><h2>Tip for {user.companyName}</h2><Link to="/goals" className="small">All tips & goals →</Link></div>
            {!ins ? <Spinner /> : worst ? (
              <div className={`insight ${LEVEL[worst.level].insight}`}><strong><RedKg text={worst.headline} /></strong> <RedKg text={worst.tips[0]} /></div>
            ) : <div className="insight mid">{ins.starterTip}</div>}
          </div>

          <div className="grid grid-2">
            <div className="card">
              <div className="card-head"><h2>Company daily emissions</h2><span className="small muted">kg CO₂ by source</span></div>
              {!s || s.total === 0 ? (
                <Empty icon="factory" title="No company activity logged yet"><Link to="/tracker">Log activity</Link></Empty>
              ) : (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer>
                    <AreaChart data={s.series} margin={{ left: -18, right: 6, top: 6 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={24} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip labelFormatter={shortDate} formatter={(v, n) => [kg(v, 2), CATEGORY_META[n].label]} />
                      {['transport', 'energy', 'waste'].map((k) => (
                        <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={CATEGORY_META[k].color} fill={CATEGORY_META[k].color} fillOpacity={0.55} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="card">
              <h2 style={{ marginBottom: 10 }}>Highest-emitting members</h2>
              {d.topEmitters.length === 0 ? (
                <Empty icon="users" title="No member data yet">Appears when members who share their data log activities.</Empty>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  {d.topEmitters.map((m) => (
                    <div key={m.userId}>
                      <div className="row spread small">
                        <span className="row" style={{ flexWrap: 'nowrap' }}><Avatar user={m} size="sm" />{m.name}{m.level && <span className={`pill ${LEVEL[m.level].cls}`}>{LEVEL[m.level].short}</span>}</span>
                        <Co2 value={m.totalKg} />
                      </div>
                      <div className="progress"><span style={{ width: `${(m.totalKg / d.topEmitters[0].totalKg) * 100}%`, background: CARBON_RED }} /></div>
                    </div>
                  ))}
                  <p className="hint">Last 30 days, members who share their footprint.</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>Your communities</h2><Link to="/communities" className="small">Manage →</Link></div>
            {d.communities.length === 0 ? <Empty icon="users" title="No communities yet"><Link className="btn btn-sm" to="/communities?create=1"><Icon name="plus" size={14} />Create community</Link></Empty> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Community</th><th className="num">Members</th><th className="num">CO₂ / member</th><th>Invitation code</th></tr></thead>
                  <tbody>
                    {d.communities.map((c) => (
                      <tr key={c._id}>
                        <td><Link to={`/communities/${c._id}`}>{c.name}</Link><div className="small muted">{c.visibility === 'private' ? 'Private' : 'Public'}</div></td>
                        <td className="num">{c.members}</td>
                        <td className="num">{c.perMemberKg == null ? <span className="small muted">No data</span> : <Co2 value={c.perMemberKg} digits={0} />}</td>
                        <td><code style={{ userSelect: 'all' }}>{c.inviteCode}</code> <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(c.inviteCode)}>Copy</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
