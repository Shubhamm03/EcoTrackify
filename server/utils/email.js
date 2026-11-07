const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    // Gmail shows App Passwords in groups of four ("abcd efgh ..."): spaces are removed
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER.trim(), pass: String(process.env.SMTP_PASS || '').replace(/\s+/g, '') } : undefined,
  });
  return transporter;
}

const emailConfigured = () => Boolean(process.env.SMTP_HOST);

// Checks the SMTP login once at startup and prints the result, so a wrong password is noticed early
async function verifyEmailSetup() {
  const t = getTransporter();
  if (!t) {
    console.log('Email: SMTP not configured. Verification codes are printed here and shown on the verify page.');
    return false;
  }
  try {
    await t.verify();
    console.log(`Email: SMTP ready (${process.env.SMTP_HOST} as ${process.env.SMTP_USER || 'no user'}). Codes are sent by email.`);
    return true;
  } catch (err) {
    console.error(`Email: SMTP login failed (${err.message}). Check SMTP_* in server/.env, then run "npm run test-email".`);
    return false;
  }
}

// Sends an email, or prints it to the console when SMTP isn't configured.
// Never throws: a mail failure must not break registration or other flows.
async function sendEmail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[email:console] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return { delivered: false, logged: true };
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || `Ecotrackify <${process.env.SMTP_USER}>`, to, subject, text, html });
    return { delivered: true };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { delivered: false, error: err.message };
  }
}

module.exports = { sendEmail, emailConfigured, verifyEmailSetup };
