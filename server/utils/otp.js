const crypto = require('crypto');
const { sendEmail, emailConfigured } = require('./email');

// Email verification codes: 6 digits, valid 10 minutes, 5 tries, a new code at most once a minute.
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashOtp = (userId, code) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');

// Seconds until a new code may be sent (0 = now)
function resendWait(user) {
  if (!user.otpSentAt) return 0;
  return Math.max(0, Math.ceil((user.otpSentAt.getTime() + RESEND_AFTER_MS - Date.now()) / 1000));
}

// Creates a new code, stores only its hash and emails it.
// In development without SMTP the code is also returned so it can be shown on screen.
async function issueOtp(user) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  user.otpHash = hashOtp(user._id, code);
  user.otpExpires = new Date(Date.now() + OTP_TTL_MS);
  user.otpAttempts = 0;
  user.otpSentAt = new Date();
  await user.save();

  const name = user.role === 'business' ? user.companyName || user.name : user.name;
  const mail = await sendEmail({
    to: user.email,
    subject: `${code} is your Ecotrackify verification code`,
    text: `Hi ${name},\n\nYour Ecotrackify verification code is: ${code}\n\nIt expires in 10 minutes. If you did not create an Ecotrackify account, you can ignore this email.\n\nThe Ecotrackify team`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#17351f">
      <h2 style="color:#23854f;margin:0 0 12px">Verify your email</h2>
      <p>Hi ${name},</p>
      <p>Enter this code in Ecotrackify to finish creating your account:</p>
      <p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:20px 0">${code}</p>
      <p style="color:#5a7563">The code expires in 10 minutes. If you did not create an Ecotrackify account, you can ignore this email.</p>
    </div>`,
  });

  // With SMTP set up the code goes only to the inbox. Without SMTP (or if sending failed) during
  // development, the code is also shown on screen so you can keep testing.
  const delivered = Boolean(mail.delivered);
  const showOnScreen = !delivered && process.env.NODE_ENV !== 'production';
  return {
    emailSent: delivered,
    ...(emailConfigured() && !delivered ? { emailError: 'We could not send the email. Check the SMTP settings in server/.env.' } : {}),
    resendIn: RESEND_AFTER_MS / 1000,
    ...(showOnScreen ? { devOtp: code } : {}),
  };
}

// 'ok' | 'none' | 'expired' | 'locked' | 'wrong' (also counts the attempt)
async function checkOtp(user, code) {
  if (!user.otpHash || !user.otpExpires) return 'none';
  if (user.otpExpires < new Date()) return 'expired';
  if (user.otpAttempts >= MAX_ATTEMPTS) return 'locked';
  const given = hashOtp(user._id, String(code || '').trim());
  const ok = crypto.timingSafeEqual(Buffer.from(given), Buffer.from(user.otpHash));
  if (!ok) {
    user.otpAttempts += 1;
    await user.save();
    return 'wrong';
  }
  return 'ok';
}

module.exports = { issueOtp, checkOtp, resendWait, MAX_ATTEMPTS };
