const express = require('express');
const Tip = require('../models/Tip');
const { protect } = require('../middleware/auth');
const { checkContent } = require('../utils/moderation');
const { ApiError, asyncHandler, escapeRegex } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

const CATEGORIES = ['transport', 'energy', 'waste', 'food', 'water', 'lifestyle'];
const REPORTS_TO_HIDE = 3;

const shape = (tip, userId) => ({
  _id: tip._id,
  title: tip.title,
  content: tip.content,
  category: tip.category,
  isOfficial: tip.isOfficial,
  author: tip.author ? { _id: tip.author._id, name: tip.author.name } : null,
  likeCount: tip.likes.length,
  liked: tip.likes.some((id) => String(id) === String(userId)),
  isMine: tip.author && String(tip.author._id) === String(userId),
  createdAt: tip.createdAt,
});

// GET /api/tips?q=&category=&sort=popular|new&source=official|community&page=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 12);
    const filter = { hidden: false };
    if (CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
    if (req.query.source === 'official') filter.isOfficial = true;
    if (req.query.source === 'community') filter.isOfficial = false;
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: rx }, { content: rx }];
    }

    const pipelineSort = req.query.sort === 'new' ? { createdAt: -1 } : { likeCount: -1, createdAt: -1 };
    const [ids, total] = await Promise.all([
      Tip.aggregate([
        { $match: filter },
        { $addFields: { likeCount: { $size: '$likes' } } },
        { $sort: pipelineSort },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: { _id: 1 } },
      ]),
      Tip.countDocuments(filter),
    ]);
    const docs = await Tip.find({ _id: { $in: ids.map((i) => i._id) } }).populate('author', 'name');
    const order = new Map(ids.map((i, idx) => [String(i._id), idx]));
    docs.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));

    res.json({ tips: docs.map((t) => shape(t, req.user._id)), total, page, pages: Math.ceil(total / limit) || 1 });
  })
);

// POST /api/tips
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const title = String(req.body.title || '').trim();
    const content = String(req.body.content || '').trim();
    const { category } = req.body;
    if (title.length < 5) throw new ApiError(400, 'Title should be at least 5 characters.');
    if (content.length < 20) throw new ApiError(400, 'Tip should be at least 20 characters.');
    if (!CATEGORIES.includes(category)) throw new ApiError(400, 'Choose a valid category.');
    const verdict = checkContent(title, content);
    if (!verdict.ok) throw new ApiError(400, verdict.reason);

    const today = new Date(Date.now() - 86400000);
    const recent = await Tip.countDocuments({ author: req.user._id, createdAt: { $gte: today } });
    if (recent >= 10) throw new ApiError(429, 'You can share up to 10 tips per day.');

    const tip = await Tip.create({ title, content, category, author: req.user._id });
    await tip.populate('author', 'name');
    res.status(201).json({ tip: shape(tip, req.user._id) });
  })
);

// POST /api/tips/:id/like — toggles like
router.post(
  '/:id/like',
  asyncHandler(async (req, res) => {
    const tip = await Tip.findOne({ _id: req.params.id, hidden: false });
    if (!tip) throw new ApiError(404, 'Tip not found.');
    const liked = tip.likes.some((id) => String(id) === String(req.user._id));
    const update = liked ? { $pull: { likes: req.user._id } } : { $addToSet: { likes: req.user._id } };
    const updated = await Tip.findByIdAndUpdate(tip._id, update, { new: true }).populate('author', 'name');
    res.json({ tip: shape(updated, req.user._id) });
  })
);

// POST /api/tips/:id/report — hides a tip once it gets enough reports
router.post(
  '/:id/report',
  asyncHandler(async (req, res) => {
    const tip = await Tip.findByIdAndUpdate(req.params.id, { $addToSet: { reports: req.user._id } }, { new: true });
    if (!tip) throw new ApiError(404, 'Tip not found.');
    if (!tip.isOfficial && tip.reports.length >= REPORTS_TO_HIDE && !tip.hidden) {
      tip.hidden = true;
      await tip.save();
    }
    res.json({ message: 'Thanks — the tip has been reported for review.' });
  })
);

// DELETE /api/tips/:id — authors (or admins) only
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const tip = await Tip.findById(req.params.id);
    if (!tip) throw new ApiError(404, 'Tip not found.');
    if (String(tip.author) !== String(req.user._id) && req.user.role !== 'admin') {
      throw new ApiError(403, 'You can only delete your own tips.');
    }
    await tip.deleteOne();
    res.json({ message: 'Tip deleted.' });
  })
);

module.exports = router;
