const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Community = require('../models/Community');
const Membership = require('../models/Membership');
const { protect } = require('../middleware/auth');
const { sendEmail, emailConfigured } = require('../utils/email');
const { notify } = require('../utils/notify');
const { ApiError, asyncHandler, EMAIL_RE, PHONE_RE, USERNAME_RE, emailProblem, passwordProblem } = require('../utils/helpers');
const captcha = require('../utils/captcha');
const { issueOtp, checkOtp, resendWait, MAX_ATTEMPTS } = require('../utils/otp');

const router = express.Router();
const { OPTIONS } = User;

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

const signToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const pick = (list, allowed) => (Array.isArray(list) ? [...new Set(list.filter((x) => allowed.includes(x)))] : []);

function checkEmail(email) {
  const problem = emailProblem(email);
  if (problem) throw new ApiError(400, problem);
}

function checkPassword(body, context) {
  const problem = passwordProblem(body.password, context);
  if (problem) throw new ApiError(400, problem);
  if (body.confirmPassword !== undefined && body.confirmPassword !== body.password) throw new ApiError(400, 'Passwords do not match.');
}

const GENDERS = ['female', 'male', 'other', 'prefer_not'];

// ---------- Individual: username, email, password, full name, age, gender, city,
// optional invitation code ----------
function parseIndividual(b) {
  const username = str(b.username, 20).toLowerCase();
  const email = str(b.email).toLowerCase();
  if (!USERNAME_RE.test(username)) throw new ApiError(400, 'Username must be 3-20 characters: lowercase letters, numbers or _.');
  checkEmail(email);
  checkPassword(b, { username, email, name: b.name });
  if (!str(b.name)) throw new ApiError(400, 'Please enter your full name.');
  const age = Number(b.age);
  if (!Number.isInteger(age) || age < 13 || age > 120) throw new ApiError(400, 'Please enter your age (13 or older).');
  if (!GENDERS.includes(b.gender)) throw new ApiError(400, 'Please choose a gender option.');
  if (!str(b.city)) throw new ApiError(400, 'Please enter your city.');
  if (b.acceptTerms !== true) throw new ApiError(400, 'Please accept the Terms of Service and Privacy Policy.');
  return {
    role: 'user',
    username,
    email,
    password: b.password,
    name: str(b.name, 60),
    age,
    gender: b.gender,
    city: str(b.city, 60),
  };
}

// ---------- Business: company info, contact person, location, optional details ----------
function parseBusiness(b) {
  const email = str(b.email).toLowerCase();
  const phone = str(b.phone, 20).replace(/[\s-]/g, '');
  const website = str(b.website);
  if (!str(b.companyName)) throw new ApiError(400, 'Please enter your company or organisation name.');
  checkEmail(email);
  checkPassword(b, { email, name: `${b.companyName || ''} ${b.name || ''}` });
  if (!OPTIONS.orgTypes.includes(b.orgType)) throw new ApiError(400, 'Please choose your organisation type.');
  if (!str(b.name)) throw new ApiError(400, "Please enter the contact person's full name.");
  if (phone && !PHONE_RE.test(phone)) throw new ApiError(400, 'Please enter a valid phone number or leave it empty.');
  if (!str(b.city)) throw new ApiError(400, 'Please enter the company city.');
  if (b.industry && !OPTIONS.industries.includes(b.industry)) throw new ApiError(400, 'Choose a valid industry.');
  if (b.companySize && !OPTIONS.sizes.includes(b.companySize)) throw new ApiError(400, 'Choose a valid company size.');
  if (website && !/^https?:\/\/\S+\.\S+/i.test(website)) throw new ApiError(400, 'Website must start with http:// or https://');
  if (b.acceptTerms !== true) throw new ApiError(400, 'Please accept the Terms of Service and Privacy Policy.');
  return {
    role: 'business',
    email,
    password: b.password,
    companyName: str(b.companyName, 100),
    orgType: b.orgType,
    name: str(b.name, 60),
    phone,
    department: str(b.department, 60),
    city: str(b.city, 60),
    address: str(b.address, 200),
    industry: b.industry || '',
    companySize: b.companySize || '',
    website,
    focusAreas: pick(b.focusAreas, OPTIONS.focusAreas),
  };
}

// POST /api/auth/check-availability { email, username } — used before moving to step 2
router.post(
  '/check-availability',
  authLimiter,
  asyncHandler(async (req, res) => {
    const email = str(req.body.email).toLowerCase();
    const username = str(req.body.username, 20).toLowerCase();
    const [emailTaken, usernameTaken] = await Promise.all([
      email ? User.exists({ email, emailVerified: { $ne: false } }) : null,
      username ? User.exists({ username, emailVerified: { $ne: false } }) : null,
    ]);
    res.json({ emailTaken: Boolean(emailTaken), usernameTaken: Boolean(usernameTaken) });
  })
);

// POST /api/auth/check-invite { code } — "Verify code" on the registration form
router.post(
  '/check-invite',
  authLimiter,
  asyncHandler(async (req, res) => {
    const code = str(req.body.code, 20).toUpperCase();
    const community = code ? await Community.findOne({ inviteCode: code }).select('name icon type').lean() : null;
    if (!community) throw new ApiError(404, 'That invitation code is not valid.');
    res.json({ community: { name: community.name, icon: community.icon, type: community.type } });
  })
);

// Runs once, when the email is verified: invitation join and welcome messages
async function completeSignup(user) {
  let joined = null;
  if (user.role === 'business') {
    // No community is created automatically: the organisation creates its own communities after logging in
    await notify(user, { type: 'community', title: 'Create your first community', message: 'Open Communities and create one for your people. Each community gets its own invitation code.', link: '/communities' }, { force: true });
  } else {
    const code = user.pendingInviteCode;
    const target = code ? await Community.findOne({ inviteCode: code }) : null;
    if (target && !(await Membership.exists({ community: target._id, user: user._id }))) {
      await Membership.create({ community: target._id, user: user._id, role: 'member', status: 'active', shareFootprint: true });
      await Community.updateOne({ _id: target._id }, { $inc: { memberCount: 1 } });
      const admins = await Membership.find({ community: target._id, role: 'admin', status: 'active' }).select('user');
      await Promise.all(admins.map((a) => notify(a.user, { type: 'community', title: 'New member joined', message: `${user.name} joined ${target.name} with the invitation code.`, link: `/communities/${target._id}` })));
      joined = { _id: target._id, name: target.name };
    }
    await notify(user, { type: 'system', title: 'Welcome to Ecotrackify', message: 'Log your first activity to get personalised goals and tips.', link: '/tracker' }, { force: true });
  }
  await User.updateOne({ _id: user._id }, { $set: { pendingInviteCode: '' } });
  await sendEmail({
    to: user.email,
    subject: 'Welcome to Ecotrackify',
    text: `Hi ${user.name},\n\nYour email is verified and your Ecotrackify ${user.role === 'business' ? 'business ' : ''}account is ready.${user.role === 'business' ? '\n\nLog in and open Communities to create a community for your people. Each community gets its own invitation code.' : ''}${joined ? `\n\nYou have joined ${joined.name}.` : ''}\n\n${process.env.CLIENT_URL || ''}\n\nThe Ecotrackify team`,
  });
  return { community: null, joined };
}

// POST /api/auth/register { accountType: 'user' | 'business', ...fields }
// Creates the account unverified and emails a 6-digit code. No login token until the code is confirmed.
router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const isBusiness = req.body.accountType === 'business';
    const data = isBusiness ? parseBusiness(req.body) : parseIndividual(req.body);

    // An earlier sign-up that was never verified does not block the email or username
    const byEmail = await User.findOne({ email: data.email });
    if (byEmail && byEmail.emailVerified !== false) throw new ApiError(409, 'An account with this email already exists. Log in instead.');
    if (data.username) {
      const byName = await User.findOne({ username: data.username });
      if (byName && byName.emailVerified !== false && String(byName._id) !== String(byEmail?._id)) throw new ApiError(409, 'Username already exists.');
      if (byName && byName.emailVerified === false) await User.deleteOne({ _id: byName._id });
    }
    if (byEmail) await User.deleteOne({ _id: byEmail._id });

    // Individuals may enter an invitation code; it is checked now and used after verification
    if (!isBusiness && str(req.body.inviteCode)) {
      const code = str(req.body.inviteCode, 20).toUpperCase();
      if (!(await Community.exists({ inviteCode: code }))) throw new ApiError(400, 'That invitation code is not valid. Clear it to continue without joining.');
      data.pendingInviteCode = code;
    }

    const user = await User.create({ ...data, emailVerified: false });
    const sent = await issueOtp(await User.findById(user._id));
    res.status(201).json({ verification: true, email: user.email, message: `We sent a 6-digit code to ${user.email}.`, ...sent });
  })
);

// POST /api/auth/verify-email { email, otp } — confirms the code, then logs the user in
router.post(
  '/verify-email',
  authLimiter,
  asyncHandler(async (req, res) => {
    const email = str(req.body.email).toLowerCase();
    const otp = str(req.body.otp, 10);
    checkEmail(email);
    if (!/^\d{6}$/.test(otp)) throw new ApiError(400, 'Enter the 6-digit code from the email.');
    const user = await User.findOne({ email }).select('+otpHash +otpExpires +otpAttempts +otpSentAt +pendingInviteCode');
    if (!user) throw new ApiError(404, 'No sign-up found for this email. Please register again.');
    if (user.emailVerified !== false) throw new ApiError(400, 'This email is already verified. Please log in.');

    const result = await checkOtp(user, otp);
    if (result === 'none') throw new ApiError(400, 'No code is active. Request a new code.');
    if (result === 'expired') throw new ApiError(400, 'This code has expired. Request a new code.');
    if (result === 'locked') throw new ApiError(429, 'Too many incorrect attempts. Request a new code.');
    if (result === 'wrong') {
      const left = MAX_ATTEMPTS - user.otpAttempts;
      throw new ApiError(400, left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many incorrect attempts. Request a new code.');
    }

    user.emailVerified = true;
    user.otpHash = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    user.otpSentAt = undefined;
    await user.save();
    const extra = await completeSignup(user);
    const fresh = await User.findById(user._id);
    res.json({ token: signToken(fresh), user: fresh, ...extra });
  })
);

// POST /api/auth/resend-otp { email } — a new code, at most once a minute
router.post(
  '/resend-otp',
  authLimiter,
  asyncHandler(async (req, res) => {
    const email = str(req.body.email).toLowerCase();
    checkEmail(email);
    const user = await User.findOne({ email }).select('+otpSentAt');
    if (!user) throw new ApiError(404, 'No sign-up found for this email. Please register again.');
    if (user.emailVerified !== false) throw new ApiError(400, 'This email is already verified. Please log in.');
    const wait = resendWait(user);
    if (wait > 0) {
      const err = new ApiError(429, `Please wait ${wait} seconds before requesting a new code.`);
      err.details = { resendIn: wait };
      throw err;
    }
    const sent = await issueOtp(user);
    res.json({ message: `A new code was sent to ${user.email}.`, ...sent });
  })
);

// GET /api/auth/captcha — new image captcha for the login form
router.get('/captcha', authLimiter, (req, res) => res.json(captcha.create()));

// POST /api/auth/login { login (email or username), password, captchaId, captchaAnswer }
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const login = str(req.body.login ?? req.body.email).toLowerCase();
    const { password } = req.body;
    if (!login) throw new ApiError(400, 'Please enter your email or username.');
    if (login.includes('@')) checkEmail(login);
    if (!password) throw new ApiError(400, 'Please enter your password.');
    // Captcha is checked first and can be used once, so bots cannot guess passwords
    const result = captcha.verify(req.body.captchaId, req.body.captchaAnswer);
    if (result !== 'ok') {
      const err = new ApiError(400, result === 'expired' ? 'The captcha expired. Please type the new code.' : 'The captcha code is incorrect. Please try again.');
      err.details = { captcha: true };
      throw err;
    }
    const query = login.includes('@') ? { email: login } : { username: login };
    const user = await User.findOne(query).select('+password');
    if (!user || !(await user.comparePassword(password))) throw new ApiError(401, 'Incorrect email/username or password.');
    if (user.status === 'suspended') throw new ApiError(403, `Your account has been suspended${user.suspendedReason ? `: ${user.suspendedReason}` : ''}. Contact support@ecotrackify.app.`);
    if (user.role !== 'admin' && user.emailVerified === false) {
      // Send a fresh code (unless one was sent in the last minute) and ask the client to verify
      const withOtp = await User.findById(user._id).select('+otpSentAt');
      const sent = resendWait(withOtp) > 0 ? { resendIn: resendWait(withOtp) } : await issueOtp(withOtp);
      const err = new ApiError(403, 'Please verify your email to continue. We sent a 6-digit code to your inbox.');
      err.details = { verifyEmail: true, email: user.email, ...sent };
      throw err;
    }
    res.json({ token: signToken(user), user });
  })
);

// GET /api/auth/me
router.get('/me', protect, (req, res) => res.json({ user: req.user }));

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const email = str(req.body.email).toLowerCase();
    checkEmail(email);
    const user = await User.findOne({ email });
    const response = { message: 'If an account exists for that email, a password reset link has been sent.' };
    if (!user) return res.json(response);

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Reset your Ecotrackify password',
      text: `Hi ${user.name},\n\nUse this link to reset your password (valid for 30 minutes):\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
    });
    if (!emailConfigured() && process.env.NODE_ENV !== 'production') response.devResetUrl = resetUrl;
    res.json(response);
  })
);

// POST /api/auth/reset-password/:token
router.post(
  '/reset-password/:token',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { password } = req.body;
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpires: { $gt: new Date() } }).select(
      '+resetPasswordToken +resetPasswordExpires'
    );
    if (!user) throw new ApiError(400, 'This reset link is invalid or has expired.');
    checkPassword(req.body, { username: user.username, email: user.email, name: user.name });
    const wasUnverified = user.emailVerified === false;
    user.password = password;
    user.emailVerified = true;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    if (wasUnverified) await completeSignup(await User.findById(user._id).select('+pendingInviteCode'));
    res.json({ message: 'Password updated. You can now log in.', token: signToken(user), user });
  })
);

module.exports = router;
