const cron = require('node-cron');
const User = require('../models/User');
const Activity = require('../models/Activity');
const Goal = require('../models/Goal');
const Challenge = require('../models/Challenge');
const ChallengeParticipation = require('../models/ChallengeParticipation');
const Notification = require('../models/Notification');
const { ensureWeeklyChallenges } = require('./challenges');
const { evaluateGoals } = require('./goals');
const { notify } = require('./notify');
const { startOfWeek, dayKey } = require('./helpers');

// Hard cap so the app never spams anyone: max automated notifications per user per day
const MAX_AUTO_PER_DAY = 2;

async function autoCountToday(userId) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  return Notification.countDocuments({ user: userId, type: { $in: ['reminder', 'challenge'] }, createdAt: { $gte: since } });
}

// Daily: remind users who haven't logged recently (respecting their chosen frequency)
async function sendLogReminders() {
  const users = await User.find({ role: { $ne: 'admin' }, emailVerified: { $ne: false }, 'notificationSettings.enabled': { $ne: false }, 'notificationSettings.logReminders': { $ne: false } });
  for (const user of users) {
    try {
      const freq = user.notificationSettings?.reminderFrequencyDays || 3;
      const cutoff = new Date(Date.now() - freq * 86400000);
      if (user.lastReminderAt && user.lastReminderAt > cutoff) continue;
      const recent = await Activity.exists({ user: user._id, createdAt: { $gte: cutoff } });
      if (recent) continue;
      if ((await autoCountToday(user._id)) >= MAX_AUTO_PER_DAY) continue;
      const sent = await notify(user, {
        type: 'reminder',
        title: 'Time to log your footprint',
        message: `You haven't logged any activities in ${freq} day${freq > 1 ? 's' : ''}. A quick update keeps your goals on track.`,
        link: '/tracker',
      });
      if (sent) await User.updateOne({ _id: user._id }, { lastReminderAt: new Date() });
    } catch (err) {
      console.error('Reminder failed for', user.email, err.message);
    }
  }
}

// Daily evening: nudge joined challengers who haven't checked in today
async function sendChallengeNudges() {
  const weekStart = startOfWeek();
  const today = dayKey();
  const parts = await ChallengeParticipation.find({ weekStart, completed: false, checkIns: { $ne: today } }).populate('challenge', 'title');
  const byUser = new Map();
  parts.forEach((p) => {
    if (!p.challenge) return;
    const k = String(p.user);
    byUser.set(k, [...(byUser.get(k) || []), p.challenge.title]);
  });
  for (const [userId, titles] of byUser) {
    try {
      if ((await autoCountToday(userId)) >= MAX_AUTO_PER_DAY) continue;
      await notify(userId, {
        type: 'challenge',
        title: "Don't forget today's check-in",
        message: `Still open today: ${titles.slice(0, 3).join(', ')}.`,
        link: '/challenges',
      });
    } catch (err) {
      console.error('Challenge nudge failed', err.message);
    }
  }
}

// Daily: settle goals whose period has ended (and notify achievements)
async function settleGoals() {
  const userIds = await Goal.distinct('user', { status: 'active', endDate: { $lt: new Date() } });
  for (const id of userIds) {
    try { await evaluateGoals(id); } catch (err) { console.error('Goal evaluation failed', err.message); }
  }
}

// Monday: announce the new week's challenges
async function announceNewWeek() {
  await ensureWeeklyChallenges();
  const count = await Challenge.countDocuments({ weekStart: startOfWeek(), community: null });
  const users = await User.find({ role: 'user', emailVerified: { $ne: false }, 'notificationSettings.enabled': { $ne: false }, 'notificationSettings.challengeUpdates': { $ne: false } }).select('_id notificationSettings email');
  for (const u of users) {
    await notify(u, { type: 'challenge', title: 'New green challenges are live', message: `${count} new weekly challenges are waiting. Join now to climb the leaderboard.`, link: '/challenges' });
  }
}

// Daily: remove sign-ups that never verified their email within 7 days
async function removeUnverified() {
  const cutoff = new Date(Date.now() - 7 * 86400000);
  const { deletedCount } = await User.deleteMany({ emailVerified: false, role: { $ne: 'admin' }, createdAt: { $lt: cutoff } });
  if (deletedCount) console.log(`Removed ${deletedCount} unverified sign-up(s)`);
}

function startScheduler() {
  const tz = { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  cron.schedule('5 0 * * 1', () => announceNewWeek().catch(console.error), tz); // Mon 00:05
  cron.schedule('15 0 * * *', () => settleGoals().catch(console.error), tz); // daily 00:15
  cron.schedule('0 10 * * *', () => sendLogReminders().catch(console.error), tz); // daily 10:00
  cron.schedule('30 2 * * *', () => removeUnverified().catch(console.error), tz); // daily 02:30
  cron.schedule('0 19 * * *', () => sendChallengeNudges().catch(console.error), tz); // daily 19:00
  console.log('Scheduler started (reminders, goal settlement, weekly challenges)');
}

module.exports = { startScheduler, removeUnverified, sendLogReminders, sendChallengeNudges, settleGoals, announceNewWeek };
