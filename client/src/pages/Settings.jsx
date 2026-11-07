import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../utils/api';
import { Avatar, PageHeader } from '../components/ui';
import Icon from '../components/Icon';
import { ConfirmField, FieldError, PasswordField, SelectField, TextField } from '../components/FormFields';
import { PHONE_RE, URL_RE, passwordProblem, usernameProblem } from '../utils/validation';
import { COMPANY_SIZES, FOCUS_AREAS, GENDERS, INDUSTRIES } from '../utils/format';

const MAX_PHOTO = 2 * 1024 * 1024;

// Live checks for the profile form (shown under each field while editing)
function profileErrors(p, biz) {
  const e = {};
  const blank = (v) => !String(v ?? '').trim();
  if (biz) {
    if (blank(p.companyName)) e.companyName = 'Please enter the company name.';
    if (blank(p.name)) e.name = "Please enter the contact person's name.";
    if (p.phone && !PHONE_RE.test(String(p.phone).replace(/[\s-]/g, ''))) e.phone = 'Enter a 10-digit Indian mobile number, or leave it empty.';
    if (p.website && !URL_RE.test(p.website.trim())) e.website = 'Website must start with http:// or https://';
    if (blank(p.city)) e.city = 'Please enter the city.';
  } else {
    if (blank(p.name)) e.name = 'Please enter your full name.';
    const u = usernameProblem(String(p.username).trim().toLowerCase());
    if (u) e.username = u;
    const age = Number(p.age);
    if (String(p.age).trim() === '') e.age = 'Please enter your age.';
    else if (!Number.isInteger(age)) e.age = 'Age must be a whole number.';
    else if (age < 13 || age > 120) e.age = 'Age must be between 13 and 120.';
    if (!p.gender) e.gender = 'Please choose a gender option.';
    if (blank(p.city)) e.city = 'Please enter your city.';
  }
  return e;
}

const genderLabel = (g) => GENDERS.find((x) => x[0] === g)?.[1] || '';
const focusLabel = (list) => (list || []).map((k) => FOCUS_AREAS.find((f) => f[0] === k)?.[2]).filter(Boolean).join(', ');

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const biz = user.role === 'business';
  const admin = user.role === 'admin';
  // The saved profile, as editable values. Save is enabled only when the form differs from this.
  const saved = useMemo(() => (biz
    ? { companyName: user.companyName || '', name: user.name || '', phone: user.phone || '', department: user.department || '', city: user.city || '', address: user.address || '', industry: user.industry || '', companySize: user.companySize || '', website: user.website || '', focusAreas: user.focusAreas || [] }
    : { name: user.name || '', username: user.username || '', city: user.city || '', age: user.age != null ? String(user.age) : '', gender: user.gender || '', bio: user.bio || '' }), [user, biz]);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(saved);
  const [savingProfile, setSavingProfile] = useState(false);
  const norm = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : String(v ?? '').trim()])));
  const dirty = editing && norm(profile) !== norm(saved);
  const pErr = editing ? profileErrors(profile, biz) : {};
  const [serverErr, setServerErr] = useState({});
  const perr = (k) => serverErr[k] || pErr[k];
  const startEdit = () => { setProfile(saved); setServerErr({}); setEditing(true); };
  const EMPTY_PW = { currentPassword: '', newPassword: '', confirmPassword: '' };
  const [pw, setPw] = useState(EMPTY_PW);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwServer, setPwServer] = useState({});
  const pwFilled = Boolean(pw.currentPassword && pw.newPassword && pw.confirmPassword);
  const closePw = () => { setPw(EMPTY_PW); setPwServer({}); setPwOpen(false); };
  const setPwField = (k) => (v) => { setPw((x) => ({ ...x, [k]: v })); setPwServer((e) => ({ ...e, [k]: undefined })); };
  // Shown under the new password once its other rules pass
  const sameAsOld = pw.newPassword && pw.newPassword === pw.currentPassword ? 'Choose a password different from your current one.' : null;
  const [uploading, setUploading] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (fn, okMsg) => {
    try {
      const res = await fn();
      if (res?.user) setUser(res.user);
      if (okMsg) toast(okMsg);
      return res;
    } catch (err) {
      toast(err.message, 'error');
      return null;
    }
  };

  const setP = (k) => (v) => { setProfile((x) => ({ ...x, [k]: v })); setServerErr((e) => ({ ...e, [k]: undefined })); };
  const toggleList = (k, v) => setProfile({ ...profile, [k]: profile[k].includes(v) ? profile[k].filter((x) => x !== v) : [...profile[k], v] });

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoErr('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setPhotoErr('Choose a JPG, PNG or WebP image.');
    if (file.size > MAX_PHOTO) return setPhotoErr('The image must be 2 MB or smaller.');
    const fd = new FormData();
    fd.append('avatar', file);
    setUploading(true);
    await run(() => api.upload('/users/me/avatar', fd), 'Profile photo updated');
    setUploading(false);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!dirty) return;
    if (Object.keys(pErr).length) { setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0); return; }
    const body = biz ? profile : { ...profile, username: String(profile.username).trim().toLowerCase(), age: Number(profile.age) };
    setSavingProfile(true);
    try {
      const res = await api.put('/users/me', body);
      setUser(res.user);
      toast('Profile saved');
      setEditing(false);
    } catch (err) {
      const m = err.message;
      const field = /username/i.test(m) ? 'username' : /phone/i.test(m) ? 'phone' : /website/i.test(m) ? 'website' : /age/i.test(m) ? 'age' : /company name/i.test(m) ? 'companyName' : null;
      if (field) setServerErr({ [field]: m }); else toast(m, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwordProblem(pw.newPassword, { name: user.name, username: user.username, email: user.email }) || sameAsOld || pw.newPassword !== pw.confirmPassword) {
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    setPwBusy(true);
    try {
      await api.put('/users/me/password', pw);
      toast('Password changed');
      closePw();
    } catch (err) {
      const m = err.message;
      if (/current password/i.test(m)) setPwServer({ currentPassword: m });
      else if (/match/i.test(m)) setPwServer({ confirmPassword: m });
      else setPwServer({ newPassword: m });
    } finally {
      setPwBusy(false);
    }
  };

  const deleteMe = async () => {
    if (await run(() => api.del('/users/me'), 'Account deleted')) {
      logout();
      navigate('/', { replace: true });
    }
  };

  const doLogout = () => {
    logout();
    toast('You have been logged out.');
    navigate('/', { replace: true });
  };

  return (
    <div className="stack">
      <PageHeader title="Profile settings" subtitle={`${user.email} · ${admin ? 'Administrator' : biz ? 'Business account' : 'Individual account'}`} />

      <div className="grid grid-2">
        {!admin && (
          <form className="card form" onSubmit={saveProfile} noValidate>
            <div className="card-head" style={{ marginBottom: 0 }}>
              <h2>Profile</h2>
              {!editing && <button type="button" className="btn btn-ghost btn-sm" onClick={startEdit}><Icon name="settings" size={15} />Edit profile</button>}
            </div>
            <div className="row">
              <Avatar user={user} size="lg" />
              <div className="stack" style={{ gap: 6 }}>
                <div className="row">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? 'Uploading…' : <><Icon name="camera" size={15} />{user.avatarUrl ? 'Change' : 'Upload'} {biz ? 'logo' : 'photo'}</>}</button>
                  {user.avatarUrl && <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(() => api.del('/users/me/avatar'), 'Photo removed')}>Remove</button>}
                </div>
                <input ref={fileRef} id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={uploadPhoto} />
                <span className="hint">JPG, PNG or WebP, up to 2 MB</span>
                <FieldError id="avatar-err" message={photoErr} />
              </div>
            </div>

            {!editing ? (
              <dl className="details">
                {(biz
                  ? [['Company name', user.companyName], ['Contact person', user.name], ['Phone', user.phone], ['Department', user.department], ['City', user.city], ['Address', user.address], ['Industry', user.industry], ['Company size', user.companySize && `${user.companySize} employees`], ['Website', user.website], ['Focus areas', focusLabel(user.focusAreas)]]
                  : [['Full name', user.name], ['Username', user.username && `@${user.username}`], ['Email', user.email], ['Age', user.age], ['Gender', genderLabel(user.gender)], ['City', user.city], ['Bio', user.bio]]
                ).map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v || <span className="muted">Not added</span>}</dd></div>
                ))}
              </dl>
            ) : biz ? (
              <>
                <div className="form-row">
                  <TextField id="s-company" label="Company name" maxLength={100} value={profile.companyName} onChange={setP('companyName')} error={perr('companyName')} />
                  <TextField id="s-name" label="Contact person" maxLength={60} value={profile.name} onChange={setP('name')} error={perr('name')} />
                </div>
                <div className="form-row">
                  <TextField id="s-phone" label="Phone" type="tel" required={false} value={profile.phone} onChange={setP('phone')} error={perr('phone')} />
                  <TextField id="s-dept" label="Department" required={false} maxLength={60} value={profile.department} onChange={setP('department')} />
                </div>
                <TextField id="s-web" label="Website" type="url" required={false} value={profile.website} onChange={setP('website')} error={perr('website')} placeholder="https://" />
                <div className="form-row">
                  <SelectField id="s-ind" label="Industry" required={false} value={profile.industry} onChange={setP('industry')} options={INDUSTRIES} />
                  <SelectField id="s-size" label="Company size" required={false} value={profile.companySize} onChange={setP('companySize')} options={COMPANY_SIZES} />
                </div>
                <div className="form-row">
                  <TextField id="s-city" label="City" maxLength={60} value={profile.city} onChange={setP('city')} error={perr('city')} />
                  <TextField id="s-addr" label="Address" required={false} maxLength={200} value={profile.address} onChange={setP('address')} />
                </div>
                <div>
                  <span className="small" style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Sustainability focus areas</span>
                  <div className="chips" style={{ marginTop: 6 }}>{FOCUS_AREAS.map(([k, i, l]) => <button type="button" key={k} className={`chip ${profile.focusAreas.includes(k) ? 'active' : ''}`} onClick={() => toggleList('focusAreas', k)}><Icon name={i} size={15} />{l}</button>)}</div>
                </div>
              </>
            ) : (
              <>
                <div className="form-row">
                  <TextField id="s-name" label="Full name" maxLength={60} value={profile.name} onChange={setP('name')} error={perr('name')} />
                  <TextField id="s-user" label="Username" maxLength={20} value={profile.username} onChange={(v) => setP('username')(v.toLowerCase().replace(/\s/g, ''))} error={perr('username')} />
                </div>
                <div className="form-row">
                  <TextField id="s-age" label="Age" type="number" inputMode="numeric" value={profile.age} onChange={setP('age')} error={perr('age')} />
                  <SelectField id="s-gender" label="Gender" value={profile.gender} onChange={setP('gender')} error={perr('gender')} options={GENDERS} />
                </div>
                <TextField id="s-city" label="City" maxLength={60} value={profile.city} onChange={setP('city')} error={perr('city')} />
                <TextField id="s-bio" label="Bio" required={false} maxLength={200} counter value={profile.bio} onChange={setP('bio')} placeholder="e.g. Cycling to work since 2024" />
              </>
            )}
            {editing && (
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn" disabled={!dirty || savingProfile || Object.keys(pErr).length > 0} title={dirty ? undefined : 'Change something to save'}>{savingProfile ? 'Saving…' : 'Save changes'}</button>
              </div>
            )}
          </form>
        )}

        <div className="stack">
          {/* Password: hidden behind a button; Update stays disabled until every field is filled */}
          <div className="card form">
            <div className="card-head" style={{ marginBottom: 0 }}>
              <div><h2>Password</h2><p className="small muted">Change the password you use to log in.</p></div>
              {!pwOpen && <button id="pw-open" type="button" className="btn btn-ghost btn-sm" onClick={() => setPwOpen(true)}><Icon name="lock" size={15} />Change password</button>}
            </div>
            {pwOpen && (
              <form className="form" onSubmit={changePassword} noValidate>
                <PasswordField id="pw-current" label="Current password" showRules={false} autoComplete="current-password" placeholder="Your current password" value={pw.currentPassword} onChange={setPwField('currentPassword')} error={pwServer.currentPassword} />
                <PasswordField id="pw-new" label="New password" value={pw.newPassword} onChange={setPwField('newPassword')} error={pwServer.newPassword || sameAsOld} context={{ name: user.name, username: user.username, email: user.email }} />
                <ConfirmField id="pw-confirm" label="Confirm new password" value={pw.confirmPassword} password={pw.newPassword} onChange={setPwField('confirmPassword')} error={pwServer.confirmPassword} />
                {admin && <p className="small muted">The admin password is reset to ADMIN_PASSWORD from the server .env whenever the server restarts, so update it there too.</p>}
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost" onClick={closePw}>Cancel</button>
                  <button id="pw-update" className="btn" disabled={!pwFilled || pwBusy}>{pwBusy ? 'Updating…' : 'Update password'}</button>
                </div>
              </form>
            )}
          </div>

          {/* Log out and Delete account live only here */}
          <div className="card stack" style={{ gap: 16 }}>
            <h2>Account</h2>
            <div className="row spread">
              <div><strong>Log out</strong><p className="small muted">Sign out of Ecotrackify on this device.</p></div>
              <button id="logout-btn" className="btn btn-ghost" onClick={doLogout}><Icon name="logout" size={16} />Log out</button>
            </div>
            {!admin && (
              <div className="row spread" style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <strong>Delete account</strong>
                  <p className="small muted">{biz ? 'Permanently removes your organisation, its communities, posts, challenges and footprint data.' : 'Permanently removes your activities, goals, memberships and challenge history.'}</p>
                </div>
                {confirmDelete ? (
                  <div className="row">
                    <span className="small muted">This cannot be undone.</span>
                    <button id="delete-confirm" className="btn btn-red" onClick={deleteMe}>Delete permanently</button>
                    <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </div>
                ) : <button id="delete-btn" className="btn btn-ghost danger-text" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} />Delete account…</button>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
