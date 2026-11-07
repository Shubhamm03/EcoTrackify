import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../utils/api';
import useForm from '../hooks/useForm';
import { Footer, PublicNav } from '../components/PublicChrome';
import { CheckField, ConfirmField, EmailField, FieldError, PasswordField, SelectField, TextField } from '../components/FormFields';
import Icon from '../components/Icon';
import { LegalDialog } from './Legal';
import { PHONE_RE, USERNAME_RE, emailProblem, passwordProblem, required, usernameProblem } from '../utils/validation';
import { GENDERS, ORG_TYPES, homeFor } from '../utils/format';

/* ---------------- Shared layout pieces ---------------- */
const Feat = ({ icon, title, text }) => (
  <div className="feat"><span className="icon-tile sm"><Icon name={icon} /></span><div><strong>{title}</strong><p className="small muted">{text}</p></div></div>
);

function AsideIndividual() {
  return (
    <aside className="auth-aside">
      <span className="eyebrow">For individuals</span>
      <h1>A cleaner planet <em>starts with you.</em></h1>
      <p className="muted">Measure the CO₂ from your travel, energy and waste, then reduce it with goals built from your own numbers.</p>
      <div className="stack" style={{ gap: 14 }}>
        <Feat icon="footprint" title="Track your footprint" text="Log trips, electricity and waste in seconds." />
        <Feat icon="target" title="Personal goals" text="Targets based on your own emissions." />
        <Feat icon="users" title="Communities" text="Share tips with people working on the same thing." />
      </div>
    </aside>
  );
}

function AsideBusiness() {
  return (
    <aside className="auth-aside">
      <span className="eyebrow">For organisations</span>
      <h1>Build a <em>sustainable</em> organisation, together.</h1>
      <p className="muted">Track company emissions and help your people reduce theirs.</p>
      <div className="stack" style={{ gap: 14 }}>
        <Feat icon="factory" title="Company emissions" text="Office energy, fleet, business travel and waste." />
        <Feat icon="users" title="Engage your people" text="Communities, challenges and announcements." />
        <Feat icon="chart" title="Member progress" text="See how members are doing, with their permission." />
      </div>
    </aside>
  );
}

function AuthLayout({ business = false, narrow = false, children }) {
  return (
    <div className="auth-page">
      <PublicNav />
      <div className="auth-split" style={narrow ? { gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: 560 } : undefined}>
        {!narrow && (business ? <AsideBusiness /> : <AsideIndividual />)}
        <section className={`auth-form-card ${narrow ? 'solo' : ''}`}>{children}</section>
      </div>
      <Footer />
    </div>
  );
}

function Stepper({ labels, step }) {
  return (
    <div className="stepper">
      {labels.map((l, i) => (
        <span key={l} style={{ display: 'contents' }}>
          {i > 0 && <span className="step-line" />}
          <span className={`step ${i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}`}><b>{i + 1 < step ? <Icon name="check" size={13} strokeWidth={2.4} /> : i + 1}</b>{l}</span>
        </span>
      ))}
    </div>
  );
}


const ErrorBox = ({ message }) => (message ? <div className="alert alert-error" role="alert"><Icon name="alert" size={17} />{message}</div> : null);

// Sends a server message to the field it is about; anything else is shown at the top of the form
function routeError(f, message, rules, setTop) {
  const hit = rules.find(([re]) => re.test(message));
  if (hit) f.fieldError(hit[1], message);
  else setTop(message);
}

// Checks while typing whether an email (and username) is already registered
function useTaken(f, { email, username }) {
  useEffect(() => {
    const e = String(email || '').trim().toLowerCase();
    if (!e || emailProblem(e)) return undefined;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await api.post('/auth/check-availability', { email: e });
        if (live && r.emailTaken) f.fieldError('email', 'An account with this email already exists.');
      } catch { /* checked again on submit */ }
    }, 450);
    return () => { live = false; clearTimeout(t); };
  }, [email]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const u = String(username || '');
    if (username === undefined || !USERNAME_RE.test(u)) return undefined;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await api.post('/auth/check-availability', { username: u });
        if (live && r.usernameTaken) f.fieldError('username', 'Username already exists.');
      } catch { /* checked again on submit */ }
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [username]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Terms checkbox. The links open the text in a dialog over the form, with a "Back to registration" button.
function TermsCheck({ f }) {
  const [doc, setDoc] = useState(null);
  const open = (d) => (e) => { e.preventDefault(); setDoc(d); };
  return (
    <>
      <CheckField id="rg-terms" checked={f.values.acceptTerms} onChange={(v) => f.set('acceptTerms', v)} error={f.err('acceptTerms')}>
        I agree to the <a href="/terms" onClick={open('terms')}>Terms of Service</a> and the <a href="/privacy" onClick={open('privacy')}>Privacy Policy</a>. <span className="req">*</span>
      </CheckField>
      {doc && <LegalDialog doc={doc} onClose={() => setDoc(null)} />}
    </>
  );
}

const ageProblem = (v) => {
  if (String(v ?? '').trim() === '') return 'Please enter your age.';
  const n = Number(v);
  if (!Number.isInteger(n)) return 'Age must be a whole number.';
  if (n < 13) return 'You must be 13 or older to register.';
  if (n > 120) return 'Please enter a real age.';
  return null;
};
const phoneProblem = (v) => (v && !PHONE_RE.test(String(v).replace(/[\s-]/g, '')) ? 'Enter a 10-digit Indian mobile number (optionally starting +91), or leave it empty.' : null);

/* ---------------- Image captcha for login ---------------- */
function Captcha({ captcha, answer, onAnswer, onRefresh, loading, error }) {
  return (
    <div className="captcha field">
      <span className="small" style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Security check <span className="req">*</span></span>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <div className="captcha-img">{captcha ? <img src={captcha.image} alt="Captcha code. Type the characters you see." width="180" height="60" /> : <span className="small muted">{loading ? 'Loading…' : 'Could not load'}</span>}</div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh} aria-label="Get a new captcha code"><Icon name="refresh" size={15} />New code</button>
      </div>
      <input id="login-captcha" aria-label="Type the characters in the image" placeholder="Type the 5 characters above" maxLength={5} autoComplete="off" autoCapitalize="characters" spellCheck={false}
        aria-invalid={Boolean(error)} className={error ? 'invalid' : ''} value={answer} onChange={(e) => onAnswer(e.target.value.toUpperCase())} />
      <FieldError id="login-captcha-err" message={error} />
    </div>
  );
}

/* ---------------- Login ---------------- */
const validateLogin = (v) => ({
  login: !v.login.trim() ? 'Please enter your email or username.' : v.login.includes('@') ? emailProblem(v.login) : null,
  password: v.password ? null : 'Please enter your password.',
  captcha: v.captcha.trim().length === 5 ? null : 'Type the 5 characters shown in the image.',
});

export function Login() {
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const f = useForm({ login: '', password: '', captcha: '' }, validateLogin);
  const [top, setTop] = useState('');
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState(null);
  const [captchaLoading, setCaptchaLoading] = useState(true);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      setCaptcha(await api.get('/auth/captcha'));
    } catch {
      setCaptcha(null);
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => { loadCaptcha(); }, [loadCaptcha]);

  if (ready && user && !busy) return <Navigate to={homeFor(user)} replace />;

  const edit = (k) => (v) => { setTop(''); f.set(k, v); };

  const submit = async (e) => {
    e.preventDefault();
    setTop('');
    if (!f.check()) return;
    setBusy(true);
    try {
      const res = await login(f.values.login.trim(), f.values.password, captcha?.captchaId, f.values.captcha);
      navigate(location.state?.from || homeFor(res.user), { replace: true });
    } catch (err) {
      setBusy(false);
      if (err.details?.verifyEmail) {
        // Account exists but the email is not verified yet: go to the code screen
        navigate('/verify-email', { state: { email: err.details.email, devOtp: err.details.devOtp, emailError: err.details.emailError, resendIn: err.details.resendIn, fromLogin: true } });
        return;
      }
      f.setMany({ captcha: '' }); // every attempt needs a fresh code
      routeError(f, err.message, [[/captcha/i, 'captcha'], [/password/i, 'password']], setTop);
      loadCaptcha();
    }
  };

  return (
    <AuthLayout>
      <div className="row spread"><span /><span className="small">New here? <Link to="/register">Create an account</Link></span></div>
      <h2>Welcome back</h2>
      <p className="muted">Log in to your individual or organisation account.</p>
      <form className="form auth-narrow" onSubmit={submit} noValidate style={{ marginTop: 20 }}>
        <ErrorBox message={top} />
        <TextField id="login-id" label="Email or username" value={f.values.login} onChange={edit('login')} onBlur={() => f.blur('login')} error={f.err('login')} autoComplete="username" />
        <PasswordField id="login-password" label="Password" value={f.values.password} onChange={edit('password')} onBlur={() => f.blur('password')} error={f.err('password')} showRules={false} autoComplete="current-password" placeholder="Your password" />
        <Captcha captcha={captcha} answer={f.values.captcha} onAnswer={edit('captcha')} onRefresh={loadCaptcha} loading={captchaLoading} error={f.err('captcha')} />
        <div className="row spread"><span /><Link to="/forgot-password" className="small">Forgot password?</Link></div>
        <button className="btn btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </AuthLayout>
  );
}

/* ---------------- Choose account type ---------------- */
export function ChooseAccountType() {
  const { user, ready } = useAuth();
  if (ready && user) return <Navigate to={homeFor(user)} replace />;
  return (
    <AuthLayout>
      <div className="row spread"><span /><span className="small">Already have an account? <Link to="/login">Log in</Link></span></div>
      <h2>Create your account</h2>
      <p className="muted">Choose the account type that fits you.</p>
      <div className="grid grid-2" style={{ marginTop: 20 }}>
        <Link className="type-card" to="/register/individual">
          <span className="icon-tile"><Icon name="user" size={20} /></span><strong>Individual</strong>
          <span className="small muted">Track your own footprint, get personal goals and tips, join communities and challenges.</span>
        </Link>
        <Link className="type-card" to="/register/business">
          <span className="icon-tile biz"><Icon name="building" size={20} /></span><strong>Business or organisation</strong>
          <span className="small muted">Track company emissions, create communities, invite members and see their progress.</span>
        </Link>
      </div>
    </AuthLayout>
  );
}

/* ---------------- Individual registration (one page) ---------------- */
const validateIndividual = (d) => ({
  username: usernameProblem(d.username),
  email: emailProblem(d.email),
  password: passwordProblem(d.password, { username: d.username, email: d.email, name: d.name }),
  confirmPassword: !d.confirmPassword ? 'Please enter your password again.' : d.confirmPassword !== d.password ? 'Passwords do not match.' : null,
  name: required(d.name, 'Please enter your full name.'),
  age: ageProblem(d.age),
  gender: d.gender ? null : 'Please choose a gender option.',
  city: required(d.city, 'Please enter your city.'),
  acceptTerms: d.acceptTerms ? null : 'Please accept the Terms of Service and Privacy Policy.',
});

export function RegisterIndividual() {
  const { register, user, ready } = useAuth();
  const navigate = useNavigate();
  const f = useForm({ username: '', email: '', password: '', confirmPassword: '', name: '', age: '', gender: '', city: '', inviteCode: '', acceptTerms: false }, validateIndividual);
  const d = f.values;
  const [top, setTop] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState({ ok: '', error: '' });
  const set = (k) => (v) => { setTop(''); f.set(k, v); };
  const blur = (k) => () => f.blur(k);
  useTaken(f, { email: d.email, username: d.username });

  if (ready && user) return <Navigate to={homeFor(user)} replace />;

  const verifyCode = async () => {
    setCode({ ok: '', error: '' });
    if (!d.inviteCode.trim()) return setCode({ ok: '', error: 'Enter an invitation code to verify, or skip this.' });
    try {
      const r = await api.post('/auth/check-invite', { code: d.inviteCode });
      setCode({ ok: r.community.name, error: '' });
    } catch (err) {
      setCode({ ok: '', error: err.message });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setTop('');
    if (!f.check()) return;
    setBusy(true);
    try {
      const res = await register({
        accountType: 'user', username: d.username.trim().toLowerCase(), email: d.email.trim().toLowerCase(), password: d.password, confirmPassword: d.confirmPassword,
        name: d.name, age: Number(d.age), gender: d.gender, city: d.city, acceptTerms: true, inviteCode: d.inviteCode.trim(),
      });
      navigate('/verify-email', { state: { email: res.email, devOtp: res.devOtp, emailError: res.emailError, resendIn: res.resendIn, emailSent: res.emailSent } });
    } catch (err) {
      setBusy(false);
      routeError(f, err.message, [[/username/i, 'username'], [/email/i, 'email'], [/password/i, 'password'], [/invitation code/i, 'inviteCode']], (m) => {
        if (/invitation code/i.test(m)) setCode({ ok: '', error: m }); else setTop(m);
      });
    }
  };

  return (
    <AuthLayout>
      <div className="row spread">
        <Link to="/register" className="small row" style={{ gap: 4 }}><Icon name="arrowLeft" size={15} />Account type</Link>
        <span className="small">Already have an account? <Link to="/login">Log in</Link></span>
      </div>
      <h2>Create your <em>individual</em> account</h2>

      <form className="form" onSubmit={submit} noValidate style={{ marginTop: 20 }}>
        <ErrorBox message={top} />
        <div className="sec-h">Account</div>
        <div className="form-row">
          <TextField id="rg-username" label="Username" value={d.username} onChange={(v) => set('username')(v.toLowerCase().replace(/\s/g, ''))} onBlur={blur('username')} error={f.err('username')} placeholder="e.g. green_learner" autoComplete="username" maxLength={20} />
          <EmailField id="rg-email" value={d.email} onChange={set('email')} onBlur={blur('email')} error={f.err('email')} />
        </div>
        <div className="form-row">
          <PasswordField id="rg-password" value={d.password} onChange={set('password')} onBlur={blur('password')} error={f.err('password')} context={{ username: d.username, email: d.email, name: d.name }} />
          <ConfirmField id="rg-confirm" value={d.confirmPassword} password={d.password} onChange={set('confirmPassword')} onBlur={blur('confirmPassword')} error={f.err('confirmPassword')} />
        </div>

        <div className="sec-h">About you</div>
        <div className="form-row">
          <TextField id="rg-name" label="Full name" value={d.name} onChange={set('name')} onBlur={blur('name')} error={f.err('name')} placeholder="Your full name" autoComplete="name" maxLength={60} />
          <TextField id="rg-age" label="Age" type="number" inputMode="numeric" value={d.age} onChange={set('age')} onBlur={blur('age')} error={f.err('age')} placeholder="e.g. 21" />
        </div>
        <div className="form-row">
          <SelectField id="rg-gender" label="Gender" value={d.gender} onChange={set('gender')} onBlur={blur('gender')} error={f.err('gender')} options={GENDERS} placeholder="Select gender" />
          <TextField id="rg-city" label="City" value={d.city} onChange={set('city')} onBlur={blur('city')} error={f.err('city')} placeholder="e.g. Mysuru" autoComplete="address-level2" maxLength={60} />
        </div>

        <details className="disclosure" open={Boolean(d.inviteCode)}>
          <summary>
            <span className="row" style={{ gap: 8 }}><Icon name="building" size={17} />Join a company or community</span>
            <span className="small muted" style={{ fontWeight: 400 }}>Optional · skip if you have no code</span>
          </summary>
          <div className="disclosure-body">
            <p className="small muted">If an organisation invited you, enter its invitation code. You can also join later from the Communities page.</p>
            <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <input id="rg-code" aria-label="Invitation code" placeholder="Invitation code" value={d.inviteCode} aria-invalid={Boolean(code.error)} className={code.error ? 'invalid' : ''}
                onChange={(e) => { f.setMany({ inviteCode: e.target.value.toUpperCase() }); setCode({ ok: '', error: '' }); }} style={{ flex: 1 }} />
              <button type="button" className="btn btn-ghost" onClick={verifyCode}>Verify</button>
            </div>
            <FieldError id="rg-code-err" message={code.error} />
            {code.ok && <span className="field-ok"><Icon name="check" size={13} />Valid code. You will join {code.ok}.</span>}
          </div>
        </details>

        <TermsCheck f={f} />
        <button className="btn btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthLayout>
  );
}

/* ---------------- Business registration (2 short steps) ---------------- */
const STEP1 = ['companyName', 'email', 'password', 'confirmPassword', 'orgType'];
const STEP2 = ['name', 'phone', 'city', 'acceptTerms'];
const validateBusiness = (d) => ({
  companyName: required(d.companyName, 'Please enter your company or organisation name.') || (d.companyName.trim().length < 2 ? 'Name needs at least 2 characters.' : null),
  email: emailProblem(d.email, { label: 'business email' }),
  password: passwordProblem(d.password, { email: d.email, name: d.companyName, nameLabel: 'your organisation name' }),
  confirmPassword: !d.confirmPassword ? 'Please enter your password again.' : d.confirmPassword !== d.password ? 'Passwords do not match.' : null,
  orgType: d.orgType ? null : 'Please choose your organisation type.',
  name: required(d.name, "Please enter the contact person's full name."),
  phone: phoneProblem(d.phone),
  city: required(d.city, 'Please enter the company city.'),
  acceptTerms: d.acceptTerms ? null : 'Please accept the Terms of Service and Privacy Policy.',
});

export function RegisterBusiness() {
  const { register, user, ready } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const f = useForm({ companyName: '', email: '', password: '', confirmPassword: '', orgType: '', name: '', phone: '', department: '', city: '', address: '', acceptTerms: false }, validateBusiness);
  const d = f.values;
  const [top, setTop] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => { setTop(''); f.set(k, v); };
  const blur = (k) => () => f.blur(k);
  useTaken(f, { email: d.email });

  if (ready && user) return <Navigate to={homeFor(user)} replace />;

  const go = (n) => { setTop(''); setStep(n); f.setSubmitted(false); window.scrollTo(0, 0); };

  const next1 = (e) => {
    e.preventDefault();
    setTop('');
    if (f.check(STEP1)) go(2);
  };

  const finish = async (e) => {
    e.preventDefault();
    setTop('');
    if (!f.check(STEP2)) return;
    if (STEP1.some((k) => f.errors[k])) { go(1); f.check(STEP1); return; }
    setBusy(true);
    try {
      const res = await register({ accountType: 'business', ...d, email: d.email.trim().toLowerCase(), acceptTerms: true });
      navigate('/verify-email', { state: { email: res.email, devOtp: res.devOtp, emailError: res.emailError, resendIn: res.resendIn, emailSent: res.emailSent } });
    } catch (err) {
      setBusy(false);
      if (/email|password/i.test(err.message)) go(1);
      routeError(f, err.message, [[/email/i, 'email'], [/password/i, 'password'], [/phone/i, 'phone'], [/city/i, 'city'], [/contact person/i, 'name']], setTop);
    }
  };

  const back = step === 1
    ? <Link to="/register" className="small row" style={{ gap: 4 }}><Icon name="arrowLeft" size={15} />Account type</Link>
    : <button type="button" className="link-btn small" onClick={() => go(step - 1)}><Icon name="arrowLeft" size={15} />Back</button>;

  return (
    <AuthLayout business>
      <div className="row spread">{back}<span className="small">Already have an account? <Link to="/login">Log in</Link></span></div>
      <h2>Register your <em>organisation</em></h2>
      <Stepper labels={['Organisation', 'Contact']} step={step} />

      {step === 1 && (
        <form className="form" onSubmit={next1} noValidate>
          <ErrorBox message={top} />
          <div className="form-row">
            <TextField id="rg-companyName" label="Company or organisation name" value={d.companyName} onChange={set('companyName')} onBlur={blur('companyName')} error={f.err('companyName')} placeholder="e.g. GreenTech Solutions" autoComplete="organization" maxLength={100} />
            <EmailField id="rg-email" label="Business email" value={d.email} onChange={set('email')} onBlur={blur('email')} error={f.err('email')} placeholder="admin@company.com" />
          </div>
          <div className="form-row">
            <PasswordField id="rg-password" label="Create password" value={d.password} onChange={set('password')} onBlur={blur('password')} error={f.err('password')} context={{ email: d.email, name: d.companyName, nameLabel: 'your organisation name' }} />
            <ConfirmField id="rg-confirm" value={d.confirmPassword} password={d.password} onChange={set('confirmPassword')} onBlur={blur('confirmPassword')} error={f.err('confirmPassword')} />
          </div>
          <div className="form-row">
            <SelectField id="rg-orgType" label="Organisation type" value={d.orgType} onChange={set('orgType')} onBlur={blur('orgType')} error={f.err('orgType')} options={ORG_TYPES} />
            <span />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn">Continue<Icon name="arrowRight" size={16} /></button></div>
        </form>
      )}

      {step === 2 && (
        <form className="form" onSubmit={finish} noValidate>
          <ErrorBox message={top} />
          <div className="sec-h">Contact person</div>
          <div className="form-row">
            <TextField id="rg-name" label="Full name" value={d.name} onChange={set('name')} onBlur={blur('name')} error={f.err('name')} placeholder="Your full name" autoComplete="name" maxLength={60} />
            <TextField id="rg-phone" label="Phone number" type="tel" required={false} value={d.phone} onChange={set('phone')} onBlur={blur('phone')} error={f.err('phone')} placeholder="e.g. +91 98765 43210" autoComplete="tel" />
          </div>
          <div className="form-row">
            <TextField id="rg-department" label="Department" required={false} value={d.department} onChange={set('department')} placeholder="e.g. Sustainability" maxLength={60} />
            <span />
          </div>
          <div className="sec-h">Location</div>
          <div className="form-row">
            <TextField id="rg-city" label="City" value={d.city} onChange={set('city')} onBlur={blur('city')} error={f.err('city')} placeholder="e.g. Bengaluru" autoComplete="address-level2" maxLength={60} />
            <TextField id="rg-address" label="Address" required={false} value={d.address} onChange={set('address')} placeholder="Company address" autoComplete="street-address" maxLength={200} />
          </div>
          <TermsCheck f={f} />
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" disabled={busy}>{busy ? 'Creating account…' : 'Create organisation account'}</button></div>
        </form>
      )}
    </AuthLayout>
  );
}

/* ---------------- Email verification with a 6-digit code ---------------- */
export function VerifyEmail() {
  const { verifyEmail, resendOtp, user, ready } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const initial = location.state || {};
  const [email, setEmail] = useState(initial.email || params.get('email') || '');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(initial.fromLogin ? 'Your email is not verified yet. We sent a new code to your inbox.' : '');
  const [devOtp, setDevOtp] = useState(initial.devOtp || '');
  const [mailError, setMailError] = useState(initial.emailError || '');
  const [wait, setWait] = useState(initial.resendIn || 0);
  const [busy, setBusy] = useState(false);
  const boxes = useRef([]);
  const done = useRef(false);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  useEffect(() => { boxes.current[0]?.focus(); }, []);

  if (ready && user && !done.current) return <Navigate to={homeFor(user)} replace />;

  const code = digits.join('');

  const setDigit = (i, v) => {
    setError('');
    const clean = v.replace(/\D/g, '');
    if (clean.length > 1) {
      // Pasted or auto-filled code: spread it across the boxes
      const next = clean.slice(0, 6).split('');
      setDigits([...next, ...Array(6 - next.length).fill('')]);
      boxes.current[Math.min(next.length, 5)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) boxes.current[i + 1]?.focus();
  };

  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) boxes.current[i + 1]?.focus();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (emailProblem(email)) return setError(emailProblem(email));
    if (!/^\d{6}$/.test(code)) return setError('Enter all 6 digits of the code.');
    setBusy(true);
    done.current = true;
    try {
      const res = await verifyEmail(email.trim().toLowerCase(), code);
      if (res.community) toast(`Email verified. Your invitation code is ${res.community.inviteCode}.`);
      else if (res.joined) toast(`Email verified. You joined ${res.joined.name}.`);
      else toast('Email verified. Welcome to Ecotrackify.');
      navigate(homeFor(res.user), { replace: true });
    } catch (err) {
      done.current = false;
      setBusy(false);
      setError(err.message);
      setDigits(['', '', '', '', '', '']);
      boxes.current[0]?.focus();
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    if (emailProblem(email)) return setError(emailProblem(email));
    try {
      const r = await resendOtp(email.trim().toLowerCase());
      setInfo(r.message);
      setDevOtp(r.devOtp || '');
      setMailError(r.emailError || '');
      setWait(r.resendIn || 60);
      setDigits(['', '', '', '', '', '']);
      boxes.current[0]?.focus();
    } catch (err) {
      setError(err.message);
      if (err.details?.resendIn) setWait(err.details.resendIn);
    }
  };

  return (
    <AuthLayout narrow>
      <div className="stack" style={{ gap: 14, alignItems: 'flex-start' }}>
        <span className="icon-tile"><Icon name="mail" size={22} /></span>
        <div>
          <h2 style={{ marginTop: 0 }}>Check your email</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            {initial.email ? <>We sent a 6-digit code to <strong style={{ color: 'var(--ink)' }}>{initial.email}</strong>. It expires in 10 minutes.</> : 'Enter your email and the 6-digit code we sent you.'}
          </p>
        </div>
      </div>
      <form className="form" onSubmit={submit} noValidate style={{ marginTop: 20 }}>
        {info && <div className="alert alert-ok" role="status"><Icon name="check" size={17} />{info}</div>}
        {mailError && <div className="alert alert-error" role="alert"><Icon name="alert" size={17} />{mailError}</div>}
        {devOtp && (
          <div className="alert alert-warn"><Icon name="info" size={17} />
            <span>{mailError ? 'Development mode: the email could not be sent, so the code is shown here.' : 'Development mode: email is not set up, so the code is shown here.'} Your code is <strong>{devOtp}</strong>. Add SMTP settings in <code>server/.env</code> to send real emails.</span>
          </div>
        )}
        {!initial.email && <EmailField id="otp-email" value={email} onChange={(v) => { setError(''); setEmail(v); }} />}
        <div>
          <span className="small" style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Verification code</span>
          <div className="otp-inputs" style={{ marginTop: 8 }}>
            {digits.map((v, i) => (
              <input key={i} ref={(el) => { boxes.current[i] = el; }} id={`otp-${i}`} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
                aria-label={`Digit ${i + 1}`} aria-invalid={Boolean(error)} className={error ? 'invalid' : ''} maxLength={i === 0 ? 6 : 1} value={v} onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => onKey(i, e)} />
            ))}
          </div>
          <div style={{ marginTop: 8 }}><FieldError id="otp-err" message={error} /></div>
        </div>
        <button className="btn btn-block" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
        <div className="row spread small">
          <span className="muted">Didn't get it? Check spam, or</span>
          <button type="button" className="link-btn" onClick={resend} disabled={wait > 0}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button>
        </div>
        <p className="small muted">Wrong email? <Link to="/register">Register again</Link> with the right address.</p>
      </form>
    </AuthLayout>
  );
}

/* ---------------- Password reset ---------------- */
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const problem = emailProblem(email);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      setResult(await api.post('/auth/forgot-password', { email: email.trim() }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout narrow>
      <h2>Reset your password</h2>
      <p className="muted" style={{ marginBottom: 18 }}>We'll email you a link to choose a new password.</p>
      <form className="form" onSubmit={submit} noValidate>
        {result && (
          <div className="alert alert-ok">
            {result.message}
            {result.devResetUrl && <div style={{ marginTop: 8 }}><strong>Dev mode (no SMTP configured):</strong> <a href={result.devResetUrl}>open reset link</a></div>}
          </div>
        )}
        <EmailField id="forgot-email" label="Email" value={email} onChange={(v) => { setError(''); setEmail(v); }} error={error} />
        <button className="btn btn-block" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        <p className="small muted" style={{ textAlign: 'center' }}><Link to="/login">Back to login</Link></p>
      </form>
    </AuthLayout>
  );
}

const validateReset = (v) => ({
  password: passwordProblem(v.password),
  confirm: !v.confirm ? 'Please enter your password again.' : v.confirm !== v.password ? 'Passwords do not match.' : null,
});

export function ResetPassword() {
  const { token } = useParams();
  const { resetPassword } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const f = useForm({ password: '', confirm: '' }, validateReset);
  const [top, setTop] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setTop('');
    if (!f.check()) return;
    setBusy(true);
    try {
      const res = await resetPassword(token, f.values.password);
      toast('Password updated. You are logged in.');
      navigate(homeFor(res.user), { replace: true });
    } catch (err) {
      setBusy(false);
      routeError(f, err.message, [[/^password|password (must|needs)/i, 'password']], setTop);
    }
  };

  return (
    <AuthLayout narrow>
      <h2>Choose a new password</h2>
      <p className="muted" style={{ marginBottom: 18 }}>This link is valid for 30 minutes.</p>
      <form className="form" onSubmit={submit} noValidate>
        <ErrorBox message={top} />
        <PasswordField id="reset-password" label="New password" value={f.values.password} onChange={(v) => f.set('password', v)} onBlur={() => f.blur('password')} error={f.err('password')} />
        <ConfirmField id="reset-confirm" value={f.values.confirm} password={f.values.password} onChange={(v) => f.set('confirm', v)} onBlur={() => f.blur('confirm')} error={f.err('confirm')} />
        <button className="btn btn-block" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
        <p className="small muted" style={{ textAlign: 'center' }}><Link to="/login">Back to login</Link></p>
      </form>
    </AuthLayout>
  );
}
