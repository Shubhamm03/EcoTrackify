// Sends a test email with your SMTP settings from server/.env.
// Usage:  npm run test-email -- you@example.com     (defaults to SMTP_USER)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sendEmail, emailConfigured, verifyEmailSetup } = require('../utils/email');

(async () => {
  if (!emailConfigured()) {
    console.error('SMTP_HOST is empty in server/.env, so emails are only printed to the console.');
    console.error('Gmail: SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_USER=you@gmail.com  SMTP_PASS=<16-letter App Password>');
    process.exit(1);
  }
  const to = process.argv[2] || process.env.SMTP_USER;
  if (!to) {
    console.error('Give an address: npm run test-email -- you@example.com');
    process.exit(1);
  }
  if (!(await verifyEmailSetup())) process.exit(1);
  const r = await sendEmail({
    to,
    subject: 'Ecotrackify test email',
    text: 'Your SMTP settings work. Ecotrackify can now send verification codes, password reset links and notifications by email.',
  });
  if (r.delivered) {
    console.log(`Sent. Check the inbox (and spam folder) of ${to}.`);
    process.exit(0);
  }
  console.error(`Not sent: ${r.error || 'unknown error'}`);
  process.exit(1);
})();
