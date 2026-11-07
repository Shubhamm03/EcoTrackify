const express = require('express');
const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const Tip = require('../models/Tip');
const { protect } = require('../middleware/auth');
const { EMISSION_FACTORS, factorsFor, calculateCo2 } = require('../config/emissionFactors');
const { evaluateGoals } = require('../utils/goals');
const { maybeAlertHighEmissions } = require('../utils/insights');
const { ApiError, asyncHandler, startOfDay, dayKey, parseDate } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

const MAX_QUANTITY = 100000;
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function parseActivityInput(body, user) {
  const FACTORS = factorsFor(user);
  const { category, type, note } = body;
  const quantity = Number(body.quantity);
  if (!FACTORS[category]) throw new ApiError(400, 'Choose a valid category: transport, energy or waste.');
  const def = FACTORS[category][type];
  if (!def) throw new ApiError(400, `Choose a valid ${category} type.`);
  if (body.quantity === '' || body.quantity == null || !Number.isFinite(quantity)) {
    throw new ApiError(400, 'Quantity must be a number.');
  }
  if (quantity < 0) throw new ApiError(400, 'Quantity cannot be negative.');
  if (quantity > MAX_QUANTITY) throw new ApiError(400, `Quantity looks too large (max ${MAX_QUANTITY}).`);

  const date = body.date ? parseDate(body.date) : new Date();
  // A date-only entry for today is stamped with the current time; past days at noon
  if (typeof body.date === 'string' && body.date.length === 10) {
    if (dayKey(date) === dayKey()) date.setTime(Date.now());
    else date.setHours(12, 0, 0, 0);
  }
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'Invalid date.');
  const endToday = new Date(startOfDay().getTime() + 86400000);
  if (date >= endToday) throw new ApiError(400, 'Date cannot be in the future.');
  if (date < new Date(Date.now() - 366 * 86400000)) throw new ApiError(400, 'Date cannot be more than a year ago.');

  return {
    category,
    type,
    quantity,
    unit: def.unit,
    co2Kg: calculateCo2(category, type, quantity, FACTORS),
    date,
    note: String(note || '').slice(0, 200),
  };
}

// GET /api/activities/factors — emission types for the tracker form
router.get('/factors', (req, res) => res.json({ factors: factorsFor(req.user), scope: req.user.role === 'business' ? 'organisation' : 'personal' }));

// GET /api/activities?category=&from=&to=&page=&limit=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = { user: req.user._id };
    if (req.query.category && EMISSION_FACTORS[req.query.category]) filter.category = req.query.category;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) filter.date.$lte = new Date(req.query.to);
    }
    const [items, total] = await Promise.all([
      Activity.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Activity.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  })
);

// POST /api/activities
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseActivityInput(req.body, req.user);
    const activity = await Activity.create({ ...data, user: req.user._id });
    await evaluateGoals(req.user._id);
    if (req.user.role !== 'business') maybeAlertHighEmissions(req.user).catch((err) => console.error('Insight alert failed:', err.message));
    res.status(201).json({ activity });
  })
);

// PUT /api/activities/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = parseActivityInput(req.body, req.user);
    const activity = await Activity.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, data, { new: true });
    if (!activity) throw new ApiError(404, 'Activity not found.');
    await evaluateGoals(req.user._id);
    res.json({ activity });
  })
);

// DELETE /api/activities/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const activity = await Activity.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!activity) throw new ApiError(404, 'Activity not found.');
    res.json({ message: 'Activity deleted.' });
  })
);

// GET /api/activities/summary?days=30
// Totals per source, daily trend and reduction tips for each source.
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 30));
    const to = new Date();
    const from = startOfDay(new Date(to.getTime() - (days - 1) * 86400000));
    const userId = new mongoose.Types.ObjectId(String(req.user._id));

    const prevFrom = new Date(from.getTime() - days * 86400000);

    const [byCategory, byDay, byType, prevTotalRow] = await Promise.all([
      Activity.aggregate([
        { $match: { user: userId, date: { $gte: from, $lte: to } } },
        { $group: { _id: '$category', total: { $sum: '$co2Kg' }, count: { $sum: 1 } } },
      ]),
      Activity.aggregate([
        { $match: { user: userId, date: { $gte: from, $lte: to } } },
        { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: TZ } }, c: '$category' }, total: { $sum: '$co2Kg' } } },
      ]),
      Activity.aggregate([
        { $match: { user: userId, date: { $gte: from, $lte: to } } },
        { $group: { _id: { c: '$category', t: '$type' }, total: { $sum: '$co2Kg' } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]),
      Activity.aggregate([
        { $match: { user: userId, date: { $gte: prevFrom, $lt: from } } },
        { $group: { _id: null, total: { $sum: '$co2Kg' } } },
      ]),
    ]);

    const round = (n) => Math.round(n * 100) / 100;
    const categories = { transport: 0, energy: 0, waste: 0 };
    byCategory.forEach((c) => { categories[c._id] = round(c.total); });
    const total = round(Object.values(categories).reduce((a, b) => a + b, 0));

    // Build a continuous daily series (days with no logs show as 0)
    const series = [];
    const map = {};
    byDay.forEach((r) => {
      const k = r._id.day;
      map[k] = map[k] || { transport: 0, energy: 0, waste: 0 };
      map[k][r._id.c] += r.total;
    });
    for (let i = 0; i < days; i += 1) {
      const d = new Date(from.getTime() + i * 86400000);
      const k = dayKey(d);
      const v = map[k] || { transport: 0, energy: 0, waste: 0 };
      series.push({ date: k, transport: round(v.transport), energy: round(v.energy), waste: round(v.waste), total: round(v.transport + v.energy + v.waste) });
    }

    // Tips for each source: biggest source first
    const tipsBySource = {};
    for (const cat of Object.keys(categories)) {
      tipsBySource[cat] = await Tip.find({ category: cat, isOfficial: true, hidden: false }).limit(3).select('title content').lean();
    }

    const prevTotal = prevTotalRow[0] ? round(prevTotalRow[0].total) : 0;
    res.json({
      days,
      total,
      dailyAverage: round(total / days),
      previousTotal: prevTotal,
      changePct: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null,
      categories,
      topSources: byType.map((t) => ({
        category: t._id.c,
        type: t._id.t,
        label: factorsFor(req.user)[t._id.c]?.[t._id.t]?.label || t._id.t,
        total: round(t.total),
      })),
      series,
      tipsBySource,
    });
  })
);

module.exports = router;
