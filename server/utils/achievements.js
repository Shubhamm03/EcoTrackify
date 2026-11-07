const Activity = require('../models/Activity');
const Goal = require('../models/Goal');
const Tip = require('../models/Tip');
const ChallengeParticipation = require('../models/ChallengeParticipation');
const { dayKey } = require('./helpers');

const BADGES = [
  { key: 'first-log', icon: 'sprout', title: 'First Step', description: 'Logged your first activity' },
  { key: 'logs-25', icon: 'book', title: 'Consistent Tracker', description: 'Logged 25 activities' },
  { key: 'streak-7', icon: 'flame', title: 'Week Streak', description: 'Logged activities 7 days in a row' },
  { key: 'goal-1', icon: 'target', title: 'Goal Getter', description: 'Achieved your first goal' },
  { key: 'goal-5', icon: 'trophy', title: 'Goal Master', description: 'Achieved 5 goals' },
  { key: 'challenge-1', icon: 'bolt', title: 'Challenger', description: 'Completed a green challenge' },
  { key: 'challenge-10', icon: 'star', title: 'Eco Hero', description: 'Completed 10 green challenges' },
  { key: 'tip-1', icon: 'bulb', title: 'Helpful Neighbour', description: 'Shared a tip with the community' },
  { key: 'points-500', icon: 'gem', title: 'Points Collector', description: 'Earned 500 challenge points' },
];

async function currentStreak(userId) {
  const since = new Date(Date.now() - 60 * 86400000);
  const acts = await Activity.find({ user: userId, date: { $gte: since } }).select('date').lean();
  const days = new Set(acts.map((a) => dayKey(a.date)));
  let streak = 0;
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); // today not logged yet doesn't break streak
  while (days.has(dayKey(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

async function getAchievements(user) {
  const [logs, goalsAchieved, challengesDone, tips, streak] = await Promise.all([
    Activity.countDocuments({ user: user._id }),
    Goal.countDocuments({ user: user._id, status: 'achieved' }),
    ChallengeParticipation.countDocuments({ user: user._id, completed: true }),
    Tip.countDocuments({ author: user._id }),
    currentStreak(user._id),
  ]);
  const earned = {
    'first-log': logs >= 1,
    'logs-25': logs >= 25,
    'streak-7': streak >= 7,
    'goal-1': goalsAchieved >= 1,
    'goal-5': goalsAchieved >= 5,
    'challenge-1': challengesDone >= 1,
    'challenge-10': challengesDone >= 10,
    'tip-1': tips >= 1,
    'points-500': user.totalPoints >= 500,
  };
  return {
    stats: { logs, goalsAchieved, challengesDone, tips, streak, points: user.totalPoints },
    badges: BADGES.map((b) => ({ ...b, earned: earned[b.key] })),
  };
}

module.exports = { getAchievements, currentStreak };
