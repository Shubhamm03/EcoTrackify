const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const Goal = require('../models/Goal');
const { notify } = require('./notify');

async function emissionsBetween(userId, category, from, to) {
  const match = { user: new mongoose.Types.ObjectId(String(userId)), date: { $gte: from, $lte: to } };
  if (category && category !== 'overall') match.category = category;
  const [row] = await Activity.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$co2Kg' } } }]);
  return row ? Math.round(row.total * 100) / 100 : 0;
}

// Average daily emissions over the last 30 days (null if the user has no history)
async function dailyBaseline(userId, category) {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  const count = await Activity.countDocuments({
    user: userId,
    date: { $gte: from, $lte: to },
    ...(category !== 'overall' ? { category } : {}),
  });
  if (count < 3) return null;
  const total = await emissionsBetween(userId, category, from, to);
  return total / 30;
}

function progressFor(goal, emittedKg) {
  const now = new Date();
  const totalMs = goal.endDate - goal.startDate;
  const elapsedMs = Math.min(Math.max(now - goal.startDate, 0), totalMs);
  const timePct = totalMs > 0 ? Math.round((elapsedMs / totalMs) * 100) : 100;
  const budgetPct = Math.round((emittedKg / goal.targetKg) * 100);
  let pace = 'on-track';
  if (budgetPct > 100) pace = 'over-budget';
  else if (budgetPct > timePct + 10) pace = 'at-risk';
  return {
    emittedKg,
    remainingKg: Math.max(0, Math.round((goal.targetKg - emittedKg) * 100) / 100),
    budgetPct,
    timePct,
    pace,
    savedVsBaselineKg: goal.baselineKg != null ? Math.round((goal.baselineKg - emittedKg) * 100) / 100 : null,
  };
}

const DAY = 86400000;
const WARN_PCT = 80; // warn when this share of the budget is used
const ENDING_DAYS = 3; // remind when this many days or fewer are left

// Updates goal statuses: missed as soon as the budget is exceeded,
// achieved once the period ends within budget. Also sends one-off reminders when a goal
// is close to its budget or about to finish. Runs after each logged activity and daily.
async function evaluateGoals(userId) {
  const goals = await Goal.find({ user: userId, status: 'active' });
  const now = new Date();
  for (const goal of goals) {
    const emitted = await emissionsBetween(userId, goal.category, goal.startDate, goal.endDate);
    if (emitted > goal.targetKg) {
      goal.status = 'missed';
      goal.completedAt = now;
      await goal.save();
      await notify(userId, {
        type: 'goal',
        title: 'Goal budget exceeded',
        message: `"${goal.title}" went over its ${goal.targetKg} kg CO₂ budget. Set a new goal and try again!`,
        link: '/goals',
      });
    } else if (now > goal.endDate) {
      goal.status = 'achieved';
      goal.completedAt = now;
      goal.savedKg = goal.baselineKg != null ? Math.max(0, Math.round((goal.baselineKg - emitted) * 100) / 100) : 0;
      await goal.save();
      await notify(userId, {
        type: 'achievement',
        title: 'Goal achieved',
        message: `You achieved "${goal.title}" — ${emitted} kg CO₂ out of a ${goal.targetKg} kg budget.`,
        link: '/goals',
      });
    } else {
      // Still running: warn once when the budget is nearly used, and once when the end is near
      const pct = goal.targetKg > 0 ? (emitted / goal.targetKg) * 100 : 0;
      const daysLeft = Math.max(0, Math.ceil((goal.endDate - now) / DAY));
      const left = Math.max(0, Math.round((goal.targetKg - emitted) * 100) / 100);
      if (!goal.budgetWarned && pct >= WARN_PCT) {
        goal.budgetWarned = true;
        await goal.save();
        await notify(userId, {
          type: 'goal',
          title: 'Goal almost at its budget',
          message: `"${goal.title}" has used ${Math.round(pct)}% of its budget. Only ${left} kg CO₂ left for the next ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
          link: '/goals',
        });
      }
      if (!goal.endingNotified && daysLeft <= ENDING_DAYS) {
        goal.endingNotified = true;
        await goal.save();
        await notify(userId, {
          type: 'goal',
          title: daysLeft <= 1 ? 'Your goal ends tomorrow' : `Your goal ends in ${daysLeft} days`,
          message: `"${goal.title}": ${emitted} of ${goal.targetKg} kg CO₂ used. Stay under ${left} kg more to achieve it.`,
          link: '/goals',
        });
      }
    }
  }
}

module.exports = { emissionsBetween, dailyBaseline, progressFor, evaluateGoals };
