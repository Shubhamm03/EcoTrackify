import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useApi from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { Footer, PublicNav } from '../components/PublicChrome';
import Icon from '../components/Icon';
import { Medal } from '../components/ui';
import { CATEGORY_META, homeFor } from '../utils/format';

const fmt = (n) => Number(n || 0).toLocaleString();
const weight = (kg) => (kg >= 1000 ? `${(kg / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} t` : `${fmt(Math.round(kg))} kg`);
const Quiet = ({ title, note }) => (
  <div className="empty" style={{ padding: '14px 8px' }}><h3>{title}</h3>{note && <p className="small">{note}</p>}</div>
);

const STEPS = [
  ['footprint', 'Log what you do', 'Trips, electricity units, LPG and waste become kilograms of CO₂ using Indian emission factors.'],
  ['target', 'Get goals that fit', 'Ecotrackify compares each source with the average and suggests cuts sized to your own numbers.'],
  ['users', 'Reduce it together', 'Join your company or college community, share tips, take weekly challenges and compare progress.'],
];

// Background video for the hero: put an MP4 at client/public/hero.mp4. Until then (or if it
// fails to load) an animated nature background is shown instead.
const HERO_VIDEO = '/hero.mp4';
const RING_R = 180;
const RING_C = 2 * Math.PI * RING_R;
const LEAVES = [[8, 14, 0], [22, 18, -6], [41, 16, -3], [63, 20, -9], [78, 15, -12], [90, 22, -4]];

// Adds .in-view to elements with .on-scroll as they enter the screen (display only)
function useScrollReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const els = root.querySelectorAll('.on-scroll');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in-view')); return undefined; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in-view'); io.unobserve(en.target); } }), { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  });
  return ref;
}

// Every number and list on this page comes from /api/public/stats (real data only)
export default function Landing() {
  const { user } = useAuth();
  const stats = useApi('/public/stats');
  const s = stats.data;
  const month = s?.thisMonth || { transport: 0, energy: 0, waste: 0 };
  const monthTotal = month.transport + month.energy + month.waste;
  // Ring around the globe: one arc per source, sized by its share (display only)
  let ringAt = 0;
  const ring = monthTotal > 0 ? ['transport', 'energy', 'waste'].filter((k) => month[k] > 0).map((k, i, arr) => {
    const gap = arr.length > 1 ? 10 : 0;
    const len = Math.max(2, (month[k] / monthTotal) * RING_C - gap);
    const r = { key: k, i: ['transport', 'energy', 'waste'].indexOf(k), label: CATEGORY_META[k].label, pct: Math.round((month[k] / monthTotal) * 100), len, start: ringAt };
    ringAt += len + gap;
    return r;
  }) : [];

  const headline = s && [
    [fmt(s.individuals), 'people tracking their footprint'],
    [fmt(s.businesses), 'organisations'],
    [weight(s.co2TrackedKg), 'CO₂ measured', 'co2'],
    [weight(s.co2SavedKg), 'CO₂ saved through goals', 'saved'],
  ];

  const pageRef = useScrollReveal();
  // Parallax: the hero background moves slower than the page as you scroll (display only)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = Math.min(window.scrollY, 900);
        pageRef.current?.style.setProperty('--py', `${y}px`);
        pageRef.current?.style.setProperty('--pyf', String(y / 1100));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [pageRef]);
  const [video, setVideo] = useState(true); // false once the video is missing or fails
  const [playing, setPlaying] = useState(false);

  return (
    <div className="auth-page" ref={pageRef}>
      <PublicNav links={[['#home', 'Home'], ['#about', 'How it works'], ['#impact', 'Impact'], ['#contact', 'Contact']]} />

      <section className={`hero ${playing ? 'has-video' : ''}`} id="home">
        <div className="hero-media" aria-hidden="true">
          {video && (
            <video className={playing ? 'ready' : ''} src={HERO_VIDEO} autoPlay muted loop playsInline preload="auto"
              onPlaying={() => setPlaying(true)} onError={() => setVideo(false)} />
          )}
          <span className="blob b1" /><span className="blob b2" /><span className="blob b3" />
          {LEAVES.map(([left, dur, delay]) => (
            <span key={left} className="leaf-fall" style={{ left: `${left}%`, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}><Icon name="leaf" size={18 + (left % 3) * 4} /></span>
          ))}
        </div>
        <div className="hero-inner">
          <div>
            <span className="eyebrow reveal-up d1"><Icon name="leaf" size={14} />Carbon footprint tracker</span>
            <h1 className="reveal-up d2">See your carbon footprint.<span className="l2">Then reduce it, <em className="accent">together.</em></span></h1>
            <p className="lead reveal-up d3">
              Ecotrackify measures the CO₂ from your travel, energy and waste, sets goals that match your own numbers,
              and connects people and organisations working towards the same thing.
            </p>
            <div className="cta reveal-up d4">
              {user ? (
                <Link className="btn" to={homeFor(user)}>Go to my dashboard<Icon name="arrowRight" size={16} /></Link>
              ) : (
                <>
                  <Link className="btn" to="/register/individual">Join as an individual</Link>
                  <Link className="btn btn-ghost" to="/register/business">Register an organisation</Link>
                </>
              )}
            </div>
          </div>
          {/* The globe shows this month's CO₂: total in the middle, a ring split by source around it */}
          <div className="globe-stat reveal-up d5">
            <svg className="globe-ring" viewBox="0 0 400 400" role="img" aria-label={monthTotal > 0 ? `CO₂ logged this month: ${weight(monthTotal)}. ${ring.map((r) => `${r.label} ${r.pct}%`).join(', ')}` : 'No CO₂ logged this month yet'}>
              <circle cx="200" cy="200" r={RING_R} fill="none" className="globe-track" strokeWidth="14" />
              {ring.map((r) => (
                <circle key={r.key} className={`globe-seg seg-${r.i}`} cx="200" cy="200" r={RING_R} fill="none" strokeWidth="14" strokeLinecap="round"
                  strokeDasharray={`${r.len} ${RING_C}`} strokeDashoffset={-r.start} transform="rotate(-90 200 200)" style={{ animationDelay: `${0.6 + r.i * 0.2}s` }} />
              ))}
              <circle cx="200" cy="200" r="196" fill="none" className="globe-orbit" strokeDasharray="2 9" />
            </svg>
            <div className="globe-orb">
              <span className="globe-live"><i />Live · this month</span>
              {monthTotal > 0 ? (
                <>
                  <span className="globe-total">{weight(monthTotal).replace(/\s?(kg|t)$/, '')}<small>{/t$/.test(weight(monthTotal)) ? 't' : 'kg'}</small></span>
                  <span className="globe-cap">CO₂ logged by<br />Ecotrackify users</span>
                </>
              ) : (
                <span className="globe-cap" style={{ marginTop: 10 }}>{stats.loading ? 'Loading…' : <>No activities logged<br />this month yet</>}</span>
              )}
            </div>
            {monthTotal > 0 && ring.map((r) => (
              <span key={r.key} className={`globe-chip gc-${r.i}`}>
                <i className={`seg-${r.i}`} />
                <Icon name={CATEGORY_META[r.key].icon} size={15} />
                <b>{r.label}</b>
                <span className="co2">{weight(month[r.key])}</span>
                <em>{r.pct}%</em>
              </span>
            ))}
          </div>
        </div>
        <span className="scroll-cue" aria-hidden="true" />
      </section>

      {/* Endless strip of what Ecotrackify covers */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <span key={k} className="marquee-set">
              {['Transport', 'Energy', 'Waste', 'Personal goals', 'Green challenges', 'Communities', 'Leaderboard', 'Eco tips'].map((t) => <span key={t} className="marquee-item"><Icon name="leaf" size={14} />{t}</span>)}
            </span>
          ))}
        </div>
      </div>

      <section className="pub-section" id="about">
        <div className="pub-inner">
          <h2 className="section-title on-scroll" style={{ textAlign: 'center', marginBottom: 28 }}>Three steps to a <em className="accent">lighter footprint</em></h2>
          <div className="eco-cards on-scroll">
            {STEPS.map(([icon, title, text]) => (
              <div key={title} className="eco-card">
                <span className="thumb"><Icon name={icon} size={34} strokeWidth={1.6} /></span>
                <h3>{title}</h3>
                <p className="small">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-section" id="impact">
        <div className="pub-inner on-scroll">
          <h2 className="section-title">What the community has <em className="accent">achieved</em></h2>
          <p className="muted">Live totals from everyone using Ecotrackify.</p>
          {stats.error && <p className="small muted" style={{ marginTop: 12 }}>Live totals are unavailable right now.</p>}
          {headline && (
            <>
              <div className="grid grid-4 stagger" style={{ marginTop: 20 }}>
                {headline.map(([n, label, kind]) => (
                  <div key={label} className="card stat">
                    <span className={`stat-value ${kind ? 'co2' : ''}`}>{n}</span>
                    <span className="stat-label">{label}</span>
                  </div>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 12 }}>
                {fmt(s.goalsAchieved)} goals achieved · {fmt(s.challengesCompleted)} challenges completed · {fmt(s.communities)} communities · {fmt(s.posts)} tips shared
              </p>
            </>
          )}

          <div className="grid grid-3 stagger" style={{ marginTop: 28 }}>
            <div className="card stack" style={{ gap: 12 }}>
              <div><h3>Top communities</h3><p className="small muted">Lowest CO₂ per member, last 30 days</p></div>
              {s?.topCommunities.length ? s.topCommunities.map((c, i) => (
                <div key={c._id} className="row spread" style={{ flexWrap: 'nowrap' }}><span className="row" style={{ gap: 10, flexWrap: 'nowrap', minWidth: 0 }}><Medal place={i + 1} /><span style={{ overflowWrap: 'anywhere' }}>{c.name}</span></span><span className="co2">{weight(c.perMemberKg)}</span></div>
              )) : <Quiet title="No community data yet" note="Organisations can register and create one." />}
            </div>
            <div className="card stack" style={{ gap: 12 }}>
              <div><h3>This week's green challenges</h3><p className="small muted">New challenges every Monday</p></div>
              {s?.weeklyChallenges.length ? s.weeklyChallenges.map((c) => (
                <div key={c._id} className="row spread" style={{ flexWrap: 'nowrap' }}><span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><span className="icon-tile sm"><Icon name={c.icon} size={16} /></span>{c.title}</span><span className="small muted" style={{ whiteSpace: 'nowrap' }}>{c.joined} joined</span></div>
              )) : <Quiet title="Challenges appear here" />}
            </div>
            <div className="card stack" style={{ gap: 12 }}>
              <div><h3>Popular tips</h3><p className="small muted">Most liked in public communities</p></div>
              {s?.popularTips.length ? s.popularTips.map((t) => (
                <div key={t._id}><p className="small" style={{ overflowWrap: 'anywhere', color: 'var(--ink-2)' }}>“{t.content}”</p><p className="small muted" style={{ marginTop: 2 }}>{t.authorName} · {t.likeCount} like{t.likeCount === 1 ? '' : 's'}</p></div>
              )) : <Quiet title="No tips shared yet" note="Tips from public communities appear here." />}
            </div>
          </div>
        </div>
      </section>

      <section className="pub-section">
        <div className="pub-inner">
          <div className="cta-band on-scroll">
            <h2>Ready to make your footprint <em className="accent">smaller?</em></h2>
            <p>Start with one trip or one electricity bill. Ecotrackify does the maths and suggests what to change first.</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 22 }}>
              {user ? (
                <Link className="btn" to={homeFor(user)}>Go to my dashboard<Icon name="arrowRight" size={16} /></Link>
              ) : (
                <>
                  <Link className="btn" to="/register/individual">Join as an individual</Link>
                  <Link className="btn btn-outline-light" to="/register/business">Register an organisation</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
