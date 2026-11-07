import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useApi from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { Co2, CountUp, Empty, ErrorMsg, PageHeader, ProgressRing, RedKg, Skeleton } from '../components/ui';
import { CATEGORY_META, kg, shortDate } from '../utils/format';
import Icon from '../components/Icon';
import PersonalTips from '../components/PersonalTips';

// Number formats used on this page (same values as before, only animated)
const one = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
const two = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
const SOURCES = ['transport', 'energy', 'waste'];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function Dashboard() {
  const { user } = useAuth();
  // Same five requests as before the redesign
  const summary = useApi('/activities/summary?days=30');
  const insights = useApi('/insights/me');
  const goals = useApi('/goals');
  const ach = useApi('/users/me/achievements');
  const comms = useApi('/communities?mine=true');

  const s = summary.data;
  const ins = insights.data;
  const worst = ins?.categories.find((c) => c.category === ins.worst);
  const allActive = (goals.data?.goals || []).filter((g) => g.status === 'active');
  const activeGoals = allActive.slice(0, 3);
  const myCommunities = (comms.data?.communities || []).filter((c) => c.membership?.status === 'active');
  const firstName = user?.name?.split(' ')[0];
  const earned = ach.data ? ach.data.badges.filter((b) => b.earned).length : 0;
  const points = ach.data?.stats.points ?? user?.totalPoints ?? 0;
  // Your daily average as a share of the average person's (both from the API)
  const vsAverage = s && ins?.averageTotalPerDayKg ? Math.round((s.dailyAverage / ins.averageTotalPerDayKg) * 100) : null;
  const maxSource = s ? Math.max(...Object.values(s.categories), 0.0001) : 1;

  // Shortcuts to features that already exist, each with a real count where there is one
  const quick = [
    ['/tracker', 'footprint', 'Log activity', 'Trips, energy, waste', 'rose'],
    ['/goals', 'target', 'Goals & tips', goals.data ? `${allActive.length} active` : '', 'mint'],
    ['/challenges', 'bolt', 'Challenges', `${points.toLocaleString()} pts`, 'amber'],
    ['/communities', 'users', 'Communities', comms.data ? `${myCommunities.length} joined` : '', 'sky'],
  ];

  return (
    <div className="stack">
      <PageHeader eyebrow={greeting()} title={`Hi ${firstName}`} subtitle="Your carbon footprint over the last 30 days." />

      <ErrorMsg message={summary.error} onRetry={summary.reload} />

      <div className="dash-top">
        {/* Footprint summary: total, daily average and how it compares */}
        <section className="card ring-card" aria-label="Your footprint, last 30 days">
          <div className="ring-side">
            {vsAverage != null && s.total > 0 ? (
              <>
                <ProgressRing value={vsAverage} size={136} stroke={12} label={`${vsAverage}%`} caption="of average" className={vsAverage > 100 ? 'over' : ''} />
                <span className="small">of the average person's daily footprint</span>
              </>
            ) : s ? (
              <ProgressRing value={0} size={136} stroke={12} label="—" caption="no data yet" />
            ) : <Skeleton width={136} height={136} radius={999} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <span className="lbl">Your CO₂, last 30 days</span>
            {s ? <span className="big-co2"><CountUp value={s.total} format={one} /><small>kg</small></span> : <Skeleton width={160} height={44} style={{ margin: '6px 0 12px' }} />}
            <div className="soft-chips">
              {s && <span className="soft-chip"><span className="co2"><CountUp value={s.dailyAverage} format={two} /> kg</span>/ day</span>}
              {ins && <span className="soft-chip">Average person <Co2 value={ins.averageTotalPerDayKg} digits={2} /></span>}
              {s?.changePct != null && (
                <span className={`soft-chip ${s.changePct > 0 ? 'up' : ''}`}>
                  <Icon name={s.changePct > 0 ? 'arrowRight' : 'check'} size={13} />{Math.abs(s.changePct)}% {s.changePct > 0 ? 'more' : 'less'} than before
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Emissions by source */}
        <section className="card">
          <div className="card-head"><h2>By source</h2><Link to="/tracker" className="small">Details <Icon name="arrowRight" size={13} /></Link></div>
          <div className="cat-tiles stagger">
            {SOURCES.map((k) => {
              const v = s?.categories[k] ?? 0;
              return (
                <Link key={k} to="/tracker" className="cat-tile">
                  <span className="icon-tile sm white"><Icon name={CATEGORY_META[k].icon} size={17} /></span>
                  <span className="lbl">{CATEGORY_META[k].label}</span>
                  {s ? <Co2 value={v} /> : <Skeleton width={60} height={20} />}
                  <span className="mini-meter" aria-hidden="true"><span style={{ width: `${s ? (v / maxSource) * 100 : 0}%` }} /></span>
                  {s && <span className="share">{s.total ? Math.round((v / s.total) * 100) : 0}% of total</span>}
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {s && s.total === 0 && (
        <div className="card stack" style={{ gap: 14 }}>
          <div><h2>Let's get started</h2><p className="muted">Your dashboard fills up as you log activities. Here's what to do first:</p></div>
          <div className="grid grid-3 stagger">
            <Link className="type-card" to="/tracker"><span className="icon-tile sm red"><Icon name="footprint" size={17} /></span><strong>Log your first activity</strong><span className="small muted">A trip, your electricity bill or today's waste.</span></Link>
            <Link className="type-card" to="/communities"><span className="icon-tile sm sky"><Icon name="users" size={17} /></span><strong>Join a community</strong><span className="small muted">Use an invitation code or join a public one.</span></Link>
            <Link className="type-card" to="/challenges"><span className="icon-tile sm amber"><Icon name="bolt" size={17} /></span><strong>Join a challenge</strong><span className="small muted">Earn points on the leaderboard.</span></Link>
          </div>
        </div>
      )}

      <nav className="quick-tiles stagger" aria-label="Quick actions">
        {quick.map(([to, icon, title, meta, tone]) => (
          <Link key={to} to={to} className={`quick-tile ${tone}`}>
            <span className="ic"><Icon name={icon} size={19} /></span>
            <strong>{title}</strong>
            {meta && <span className="meta">{meta}</span>}
            <Icon name="arrowRight" size={16} className="go" />
          </Link>
        ))}
      </nav>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h2>Active goals</h2><Link to="/goals" className="small">All goals <Icon name="arrowRight" size={13} /></Link></div>
          {goals.loading && !goals.data ? <div className="stack" style={{ gap: 10 }}><Skeleton height={66} radius={18} /><Skeleton height={66} radius={18} /></div> : activeGoals.length === 0 ? (
            <Empty icon="target" title="No active goals"><Link to="/goals">Pick a suggested goal</Link></Empty>
          ) : (
            <div className="stack stagger" style={{ gap: 10 }}>
              {activeGoals.map((g) => (
                <Link key={g._id} to="/goals" className="goal-row" style={{ color: 'inherit' }}>
                  <ProgressRing value={g.progress.budgetPct} size={52} stroke={6} label={`${g.progress.budgetPct}%`} className={g.progress.budgetPct > 100 ? 'red' : g.progress.pace === 'at-risk' ? 'warn' : ''} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong>{g.title}</strong>
                    <span className="small"><Co2 value={g.progress.emittedKg} /> of <Co2 value={g.targetKg} /> budget · {CATEGORY_META[g.category].label}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Personalised tip based on the user's own emissions */}
        <div className="card tip-card">
          <span className="icon-tile"><Icon name="bulb" size={22} /></span>
          <div style={{ minWidth: 0 }}>
            <h2>Your personalised tip</h2>
            {!ins ? <div className="stack" style={{ gap: 8 }}><Skeleton width="80%" /><Skeleton width="60%" /></div> : worst ? (
              <p>
                <strong style={{ color: '#fff' }}><RedKg text={worst.headline} /></strong> <RedKg text={worst.tips[0]} />
                {worst.suggestedGoals[0] && <> Suggested goal: keep it under <Co2 value={worst.suggestedGoals[0].targetKg} /> this month.</>}
              </p>
            ) : (
              <p>{ins.starterTip || 'Log a few activities to get tips based on your own footprint.'}</p>
            )}
            <p style={{ marginTop: 12 }}><Link to="/goals" className="small">All tips & suggested goals <Icon name="arrowRight" size={13} /></Link></p>
          </div>
        </div>
      </div>

      <PersonalTips />

      {summary.loading && !s ? (
        <div className="card"><Skeleton height={240} /></div>
      ) : s && (
        <div className="card">
          <div className="card-head"><h2>Daily emissions</h2><span className="small muted">kg CO₂ by source, last 30 days</span></div>
          {s.total === 0 ? (
            <Empty icon="footprint" title="No activities yet"><Link to="/tracker">Log your first activity</Link></Empty>
          ) : (
            <>
              <div style={{ height: 250 }}>
                <ResponsiveContainer>
                  <AreaChart data={s.series} margin={{ left: -18, right: 6, top: 6 }}>
                    <defs>
                      {SOURCES.map((k) => (
                        <linearGradient key={k} id={`dash-${k}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CATEGORY_META[k].color} stopOpacity={0.65} />
                          <stop offset="100%" stopColor={CATEGORY_META[k].color} stopOpacity={0.12} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={24} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip labelFormatter={shortDate} formatter={(v, n) => [kg(v, 2), CATEGORY_META[n].label]} />
                    {SOURCES.map((k) => (
                      <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={CATEGORY_META[k].color} strokeWidth={2} fill={`url(#dash-${k})`} animationDuration={900} animationEasing="ease-out" />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="row" style={{ gap: 16, marginTop: 10 }}>
                {SOURCES.map((k) => (
                  <span key={k} className="row small" style={{ gap: 6 }}><i className="swatch" style={{ width: 10, height: 10, borderRadius: 4, background: CATEGORY_META[k].color, display: 'inline-block' }} />{CATEGORY_META[k].label} <Co2 value={s.categories[k]} /></span>
                ))}
                <span className="small" style={{ marginLeft: 'auto' }}>Total <span className="co2">{kg(s.total)}</span></span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-head"><h2>Achievements</h2><span className="small muted">{earned} / {ach.data?.badges.length || 0} earned</span></div>
        {ach.data ? (
          <div className="badges stagger">
            {ach.data.badges.map((b) => (
              <div key={b.key} className={`badge ${b.earned ? '' : 'locked'}`} title={b.description}>
                <span className="icon-tile"><Icon name={b.icon} size={19} /></span>
                <div className="t">{b.title}</div>
              </div>
            ))}
          </div>
        ) : <div className="badges">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={84} radius={16} />)}</div>}
      </div>
    </div>
  );
}
