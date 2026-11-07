class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// name@domain.tld — letters, digits and . _ % + - before the @; no consecutive or edge dots
const EMAIL_RE = /^(?!\.)(?!.*\.\.)[a-z0-9._%+-]{1,64}(?<!\.)@(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;
// Kept for compatibility: the full rules are in passwordProblems()
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,64}$/;

// Returns a friendly message if the email is invalid, otherwise null
function emailProblem(raw) {
  const email = String(raw || '').trim();
  if (!email) return 'Please enter your email address.';
  if (/\s/.test(email)) return 'Email address cannot contain spaces.';
  if ((email.match(/@/g) || []).length !== 1) return 'Email address must contain exactly one @.';
  if (email.length > 254) return 'Email address is too long.';
  if (!EMAIL_RE.test(email)) return 'Please enter a valid email address, like name@example.com.';
  return null;
}

// Password rules, shared by registration, reset and change password
const PASSWORD_RULES = [
  [(p) => p.length >= 8 && p.length <= 64, '8 to 64 characters'],
  [(p) => /[A-Z]/.test(p), 'an uppercase letter'],
  [(p) => /[a-z]/.test(p), 'a lowercase letter'],
  [(p) => /\d/.test(p), 'a number'],
  [(p) => /[^A-Za-z0-9\s]/.test(p), 'a special character (e.g. ! @ # $)'],
];

// Returns a message listing what the password is missing, or null when it is fine
function passwordProblem(raw, { username = '', email = '', name = '' } = {}) {
  const p = String(raw || '');
  if (!p) return 'Please enter a password.';
  if (/\s/.test(p)) return 'Password must not contain spaces.';
  const missing = PASSWORD_RULES.filter(([ok]) => !ok(p)).map(([, label]) => label);
  if (missing.length) return `Password needs ${missing.join(', ')}.`;
  const lower = p.toLowerCase();
  const personal = [username, String(email).split('@')[0], ...String(name).split(/\s+/)].map((x) => String(x || '').toLowerCase()).filter((x) => x.length >= 3);
  if (personal.some((x) => lower.includes(x))) return 'Password must not contain your name, username or email.';
  const plain = lower.replace(/0/g, 'o').replace(/[1!]/g, 'i').replace(/3/g, 'e').replace(/[@4]/g, 'a').replace(/\$/g, 's');
  if (/^(password|passw|qwerty|12345678|abcd1234|welcome|ecotrackify|iloveyou|admin)/.test(plain)) return 'That password is too common. Choose something harder to guess.';
  return null;
}
// Indian mobile number, optional +91 prefix (spaces and dashes removed first)
const PHONE_RE = /^(\+91)?[6-9]\d{9}$/;
// Lowercase letters, numbers and underscore, 3-20 characters
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---- Dates (server local time; set TZ env, e.g. TZ=Asia/Kolkata) ----
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d = new Date()) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Weeks run Monday 00:00 -> Sunday 23:59:59.999
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const diff = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - diff);
  return x;
}

function endOfWeek(d = new Date()) {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 7);
  x.setMilliseconds(-1);
  return x;
}

// 'YYYY-MM-DD' strings are parsed as local midnight (new Date() would use UTC)
function parseDate(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(v);
}

function daysBetween(a, b) {
  return Math.max(0, Math.round((startOfDay(b) - startOfDay(a)) / 86400000));
}

module.exports = {
  ApiError,
  asyncHandler,
  EMAIL_RE,
  PASSWORD_RE,
  emailProblem,
  passwordProblem,
  PHONE_RE,
  USERNAME_RE,
  escapeRegex,
  startOfDay,
  dayKey,
  startOfWeek,
  endOfWeek,
  daysBetween,
  parseDate,
};
