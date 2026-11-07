// Same rules as server/utils/helpers.js, so people see problems while typing, under each field.

export const EMAIL_RE = /^(?!\.)(?!.*\.\.)[a-z0-9._%+-]{1,64}(?<!\.)@(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const PHONE_RE = /^(\+91)?[6-9]\d{9}$/;
export const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i;

export function emailProblem(raw, { label = 'email address' } = {}) {
  const email = String(raw || '').trim();
  if (!email) return `Please enter your ${label}.`;
  if (/\s/.test(email)) return 'Email address cannot contain spaces.';
  if ((email.match(/@/g) || []).length !== 1) return 'Email address must contain exactly one @.';
  if (email.length > 254) return 'Email address is too long.';
  if (!EMAIL_RE.test(email)) return 'Please enter a valid email address, like name@example.com.';
  return null;
}

export function usernameProblem(raw) {
  const v = String(raw || '').trim();
  if (!v) return 'Please enter a username.';
  if (v.length < 3) return 'Username must be at least 3 characters.';
  if (v.length > 20) return 'Username can be at most 20 characters.';
  if (!USERNAME_RE.test(v)) return 'Use only lowercase letters, numbers and _.';
  return null;
}

// Every password rule that is not met yet, in plain words. Shown live under the field.
export function passwordIssues(raw, { username = '', email = '', name = '', nameLabel = 'your name' } = {}) {
  const p = String(raw || '');
  if (!p) return [];
  const issues = [];
  if (p.length < 8) issues.push('Use at least 8 characters.');
  if (p.length > 64) issues.push('Use at most 64 characters.');
  if (!/[A-Z]/.test(p)) issues.push('Add an uppercase letter (A–Z).');
  if (!/[a-z]/.test(p)) issues.push('Add a lowercase letter (a–z).');
  if (!/\d/.test(p)) issues.push('Add a number (0–9).');
  if (!/[^A-Za-z0-9\s]/.test(p)) issues.push('Add a special character (! @ # $ …).');
  if (/\s/.test(p)) issues.push('Remove the spaces.');
  const lower = p.toLowerCase();
  const has = (x) => String(x || '').length >= 3 && lower.includes(String(x).toLowerCase());
  if (has(username)) issues.push('Must not contain your username.');
  if (has(String(email).split('@')[0])) issues.push('Must not contain your email address.');
  if (String(name).split(/\s+/).some(has)) issues.push(`Must not contain ${nameLabel}.`);
  const plain = lower.replace(/0/g, 'o').replace(/[1!]/g, 'i').replace(/3/g, 'e').replace(/[@4]/g, 'a').replace(/\$/g, 's');
  if (/^(password|passw|qwerty|12345678|abcd1234|welcome|ecotrackify|iloveyou|admin)/.test(plain)) issues.push('Too common. Choose something harder to guess.');
  return issues;
}

export function passwordProblem(raw, context) {
  if (!raw) return 'Please enter a password.';
  const issues = passwordIssues(raw, context);
  return issues.length ? issues[0] : null;
}

// Small helpers for the common checks
export const required = (v, msg) => (String(v ?? '').trim() ? null : msg);
export const minLen = (v, n, what) => {
  const len = String(v ?? '').trim().length;
  if (!len) return `Please enter ${what}.`;
  return len < n ? `${what[0].toUpperCase()}${what.slice(1)} needs at least ${n} characters (${len}/${n}).` : null;
};
