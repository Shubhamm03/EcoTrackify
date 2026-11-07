import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Footer, PublicNav } from '../components/PublicChrome';
import Icon from '../components/Icon';

const UPDATED = '30 October 2026';
const CONTACT = 'support@ecotrackify.app';

// Scroll to a section. Buttons (not "#" links) so it works everywhere, including inside apps
// that handle "#" addresses themselves. The offset keeps the heading below the sticky top bar.
function goTo(id) {
  const el = document.getElementById(`legal-${id}`);
  if (!el) return;
  const bar = document.querySelector('.pub-nav-wrap');
  const offset = (bar ? bar.getBoundingClientRect().height : 0) + 16;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
  el.querySelector('h2')?.focus({ preventScroll: true });
}

// Link between the two legal pages that keeps where "Back" should return to
function CrossLink({ to, children }) {
  const location = useLocation();
  return <Link to={to} state={location.state}>{children}</Link>;
}

// "Back" returns to the page that linked here (links pass { from } in their state), or home
function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  return (
    <button type="button" id="legal-back" className="btn btn-ghost btn-sm legal-back" onClick={() => navigate(from || '/')}>
      <Icon name="arrowLeft" size={15} />{from ? 'Back' : 'Back to home'}
    </button>
  );
}

function LegalBody({ title, intro, sections, embedded }) {
  return (
    <>
      <span className="eyebrow">Legal</span>
      <h1 style={{ marginTop: 8 }}>{title}</h1>
      <p className="updated">Last updated {UPDATED}</p>
      <p style={{ marginTop: 16 }}>{intro}</p>
      {!embedded && (
        <nav className="toc" aria-label="Sections">
          {sections.map(([id, heading]) => <button key={id} type="button" className="toc-link" onClick={() => goTo(id)}>{heading}</button>)}
        </nav>
      )}
      {sections.map(([id, heading, body]) => (
        <section key={id} id={embedded ? undefined : `legal-${id}`}>
          <h2 tabIndex={-1}>{heading}</h2>
          {body}
        </section>
      ))}
    </>
  );
}

function LegalPage({ embedded, ...doc }) {
  useEffect(() => {
    if (embedded) return undefined;
    window.scrollTo(0, 0);
    document.title = `${doc.title} | Ecotrackify`;
    return () => { document.title = 'Ecotrackify'; };
  }, [doc.title, embedded]);
  if (embedded) return <LegalBody {...doc} embedded />;
  return (
    <div className="auth-page">
      <PublicNav />
      <article className="legal">
        <BackButton />
        <LegalBody {...doc} />
      </article>
      <Footer />
    </div>
  );
}

export function Terms({ embedded = false }) {
  return (
    <LegalPage
      embedded={embedded}
      title="Terms of Service"
      intro="These terms explain how you may use Ecotrackify, the app for tracking your carbon footprint, setting sustainability goals and working on them with communities and organisations. By creating an account you agree to these terms. If you do not agree, please do not use Ecotrackify."
      sections={[
        ['accounts', '1. Your account', (
          <>
            <p>There are two kinds of account. An <strong>individual account</strong> is for one person tracking their own footprint. A <strong>business account</strong> is for a company, college, NGO, residential society or similar organisation, managed by a named contact person.</p>
            <ul>
              <li>You must be at least 13 years old to create an individual account. If you are under 18, use Ecotrackify with the permission of a parent or guardian.</li>
              <li>Give accurate information and keep it up to date. You must verify your email address with the code we send before you can use your account.</li>
              <li>Keep your password private. You are responsible for activity on your account. Tell us at {CONTACT} if you think someone else has used it.</li>
              <li>One person may hold one individual account. A business account may only be created by someone allowed to act for that organisation.</li>
            </ul>
          </>
        )],
        ['estimates', '2. Carbon figures are estimates', (
          <>
            <p>Ecotrackify converts the activities you log (travel distances, electricity units, LPG, waste and similar) into kilograms of CO₂ using published average emission factors, mostly for India. The results are estimates meant to help you see trends and make better choices.</p>
            <p>They are not an audited carbon report and must not be used for regulatory filings, carbon credit claims or legal compliance. Goals, tips and comparisons are suggestions, not professional environmental, financial or health advice.</p>
          </>
        )],
        ['communities', '3. Communities and shared content', (
          <>
            <p>Business accounts can create communities and invite people with an invitation code. Community admins can approve members, pin or delete posts, send announcements and create challenges. Organisations can remove members and send a member personal tips that only that member can see.</p>
            <ul>
              <li>Your footprint is shared with a community only while footprint sharing is on for that community. You can turn it off at any time from the community page.</li>
              <li>You keep ownership of the tips, posts and replies you write. You allow Ecotrackify and the members of that community to display them inside the app.</li>
              <li>Be respectful. Do not post abusive, hateful, misleading, illegal or promotional content, or other people's personal information.</li>
              <li>Members can report posts. Reported content may be hidden automatically and reviewed by community admins or the Ecotrackify administrator.</li>
            </ul>
          </>
        )],
        ['challenges', '4. Challenges, points and leaderboards', (
          <p>Weekly green challenges work on trust: you check in on the days you complete them. Points and leaderboard positions have no cash value and cannot be exchanged. We may correct points or remove entries that are clearly false or automated.</p>
        )],
        ['acceptable-use', '5. Acceptable use', (
          <ul>
            <li>Do not try to break, overload or get around the security of the service, including the login captcha and email verification.</li>
            <li>Do not create fake accounts, impersonate others or collect other users' data.</li>
            <li>Do not use automated tools to log activities, check in to challenges or post content.</li>
          </ul>
        )],
        ['suspension', '6. Suspension and closing your account', (
          <>
            <p>The Ecotrackify administrator may suspend or delete accounts and communities that break these terms. Where possible we will tell you why. A suspended account cannot log in.</p>
            <p>You can delete your account at any time from your profile settings. This removes your activities, goals, memberships and challenge history. Deleting a business account also deletes the communities it runs.</p>
          </>
        )],
        ['changes', '7. Changes to the service and these terms', (
          <p>Ecotrackify is provided as it is, and we may change or stop features. If we change these terms in a meaningful way, we will tell you in the app before the changes apply. Continuing to use Ecotrackify after that means you accept the new terms.</p>
        )],
        ['liability', '8. Liability and governing law', (
          <p>To the extent the law allows, Ecotrackify is not liable for indirect losses, or for decisions you make based on the estimates shown in the app. These terms are governed by the laws of India, and the courts of Hyderabad, Telangana have jurisdiction.</p>
        )],
        ['contact', '9. Contact', (
          <p>Questions about these terms: <span style={{ userSelect: 'all' }}>{CONTACT}</span>. See also our {embedded ? 'Privacy Policy' : <CrossLink to="/privacy">Privacy Policy</CrossLink>}.</p>
        )],
      ]}
    />
  );
}

export function Privacy({ embedded = false }) {
  return (
    <LegalPage
      embedded={embedded}
      title="Privacy Policy"
      intro="This policy explains what information Ecotrackify collects, why we need it, who can see it and the choices you have. We collect only what the app needs to measure your footprint and help you reduce it."
      sections={[
        ['collect', '1. Information we collect', (
          <>
            <p><strong>Individual accounts:</strong> username, email address, password (stored only as a secure hash), full name, age, gender, city, and optionally a profile photo, short bio and sustainability interests.</p>
            <p><strong>Business accounts:</strong> organisation name and type, business email, contact person's name, city, and optionally phone number, department, address, industry, company size, website, focus areas and a logo.</p>
            <p><strong>What you do in the app:</strong> the activities you log and their CO₂ estimates, goals, challenge check-ins and points, communities you join, your posts, replies and likes, and notification settings.</p>
            <p><strong>Technical data:</strong> a login token stored in your browser, your light or dark theme choice, and basic server logs (such as IP address and time of request) used to keep the service secure.</p>
          </>
        )],
        ['use', '2. How we use it', (
          <ul>
            <li>To create your account and confirm your email address with a one-time code.</li>
            <li>To calculate your carbon footprint and suggest goals and tips that match your own emissions.</li>
            <li>To run communities, challenges, leaderboards and comparisons.</li>
            <li>To send notifications and emails you asked for, such as verification codes, password reset links, reminders and announcements.</li>
            <li>To protect the service: the login captcha, rate limits, and reviewing reported content.</li>
          </ul>
        )],
        ['visible', '3. Who can see your information', (
          <ul>
            <li><strong>Other members</strong> see your display name, username and profile photo on posts, replies and leaderboards.</li>
            <li><strong>Community members and admins</strong>, including the business that runs the community, see your footprint totals only while footprint sharing is on for that community. You can switch it off at any time.</li>
            <li><strong>The Ecotrackify administrator</strong> can see account details and activity summaries in order to manage accounts, respond to reports and keep the service safe.</li>
            <li>We do not sell your personal information or share it with advertisers.</li>
            <li>We may disclose information if Indian law requires it.</li>
          </ul>
        )],
        ['security', '4. How we protect it', (
          <p>Passwords are hashed with bcrypt and never stored in plain text. Verification codes and password reset tokens are stored only as hashes and expire within minutes. Logins require a captcha, and repeated attempts are rate-limited. No system is completely secure, so please use a strong password that you do not use elsewhere.</p>
        )],
        ['retention', '5. How long we keep it', (
          <p>We keep your information while your account is active. Sign-ups that are never verified are deleted after 7 days. When you delete your account we remove your profile, activities, goals, memberships and challenge history. Notifications are kept for up to 90 days.</p>
        )],
        ['choices', '6. Your choices and rights', (
          <ul>
            <li>View and correct your profile in your profile settings (click your name in the side bar).</li>
            <li>Turn footprint sharing on or off for each community.</li>
            <li>Choose which notifications you receive, and whether they are also sent by email, from the settings button on the Notifications page.</li>
            <li>Delete your account from your profile settings, or write to {CONTACT} for help.</li>
          </ul>
        )],
        ['children', '7. Children', (
          <p>Ecotrackify is not meant for children under 13, and we do not knowingly collect their information. If you believe a child under 13 has created an account, contact us and we will delete it.</p>
        )],
        ['changes', '8. Changes to this policy', (
          <p>If we change this policy in a meaningful way, we will tell you in the app before the change applies.</p>
        )],
        ['contact', '9. Contact', (
          <p>Privacy questions or requests: <span style={{ userSelect: 'all' }}>{CONTACT}</span>, Ecotrackify, Hyderabad, India. See also our {embedded ? 'Terms of Service' : <CrossLink to="/terms">Terms of Service</CrossLink>}.</p>
        )],
      ]}
    />
  );
}

// Terms or Privacy shown over a form (registration), so nothing typed is lost.
// "Back to registration" closes it and returns to the form.
export function LegalDialog({ doc, onClose, backLabel = 'Back to registration' }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal legal" role="dialog" aria-modal="true" aria-label={doc === 'terms' ? 'Terms of Service' : 'Privacy Policy'} tabIndex={-1} ref={ref}>
        <div className="modal-top">
          <button type="button" id="legal-dialog-back" className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="arrowLeft" size={15} />{backLabel}</button>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={17} /></button>
        </div>
        <div className="modal-body">{doc === 'terms' ? <Terms embedded /> : <Privacy embedded />}</div>
        <div className="modal-foot"><button type="button" className="btn" onClick={onClose}>{backLabel}</button></div>
      </div>
    </div>
  );
}
