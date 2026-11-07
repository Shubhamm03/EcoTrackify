const express = require('express');
const Goal = require('../models/Goal');
const { protect } = require('../middleware/auth');
const { dailyBaseline, emissionsBetween, progressFor, evaluateGoals } = require('../utils/goals');
const { ApiError, asyncHandler, startOfDay, daysBetween, parseDate } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

const CATEGORIES = ['overall', 'transport', 'energy', 'waste'];

async function buildGoal(userId, body) {
  const { title, category } = body;
  const targetKg = Number(body.targetKg);
  if (!title || !String(title).trim()) throw new ApiError(400, 'Give your goal a title.');
  if (!CATEGORIES.includes(category)) throw new ApiError(400, 'Choose a valid category.');
  if (!Number.isFinite(targetKg) || targetKg <= 0) throw new ApiError(400, 'Target must be a positive number of kg CO₂.');

  const startDate = startOfDay(body.startDate ? parseDate(body.startDate) : new Date());
  const endDate = new Date(startOfDay(parseDate(body.endDate)).getTime() + 86400000 - 1);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) throw new ApiError(400, 'Invalid dates.');
  if (startDate < startOfDay(new Date(Date.now() - 7 * 86400000))) throw new ApiError(400, 'Start date can be at most 7 days in the past.');
  const days = daysBetween(startDate, endDate) + 1;
  if (days < 7) throw new ApiError(400, 'Goals should run for at least 7 days.');
  if (days > 365) throw new ApiError(400, 'Goals can run for at most one year.');

  // Any positive budget is allowed: the user decides how ambitious the goal is
  const daily = await dailyBaseline(userId, category);
  const baselineKg = daily != null ? Math.round(daily * days * 100) / 100 : null;
  return { title: String(title).trim().slice(0, 100), category, targetKg, baselineKg, startDate, endDate, source: body.source === 'suggested' ? 'suggested' : 'custom' };
}

// GET /api/goals/suggest?category=energy&days=30 — suggests a 15% cut on the user's usual emissions
router.get(
  '/suggest',
  asyncHandler(async (req, res) => {
    const category = CATEGORIES.includes(req.query.category) ? req.query.category : 'overall';
    const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 30));
    const daily = await dailyBaseline(req.user._id, category);
    const baselineKg = daily != null ? Math.round(daily * days * 100) / 100 : null;
    const suggested = baselineKg ? Math.round(baselineKg * 0.85 * 10) / 10 : null;
    res.json({ category, days, baselineKg, suggestedKg: suggested });
  })
);

// GET /api/goals
router.get(
  '/',
  asyncHandler(async (req, res) => {
    await evaluateGoals(req.user._id);
    const goals = await Goal.find({ user: req.user._id }).sort({ status: 1, endDate: 1 }).lean();
    const withProgress = await Promise.all(
      goals.map(async (g) => ({
        ...g,
        progress: progressFor(g, await emissionsBetween(req.user._id, g.category, g.startDate, g.endDate)),
      }))
    );
    res.json({ goals: withProgress });
  })
);

// POST /api/goals
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const active = await Goal.countDocuments({ user: req.user._id, status: 'active' });
    if (active >= 10) throw new ApiError(400, 'You can have at most 10 active goals.');
    const goal = await Goal.create({ ...(await buildGoal(req.user._id, req.body)), user: req.user._id });
    res.status(201).json({ goal });
  })
);

// PUT /api/goals/:id — only active goals can be edited
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });
    if (!goal) throw new ApiError(404, 'Goal not found.');
    if (goal.status !== 'active') throw new ApiError(400, 'Finished goals cannot be edited.');
    Object.assign(goal, await buildGoal(req.user._id, { startDate: goal.startDate, ...req.body }));
    await goal.save();
    res.json({ goal });
  })
);

// DELETE /api/goals/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!goal) throw new ApiError(404, 'Goal not found or already deleted.');
    res.json({ message: 'Goal deleted.' });
  })
);

module.exports = router;
