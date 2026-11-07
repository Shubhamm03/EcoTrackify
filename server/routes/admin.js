const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Activity = require('../models/Activity');
const Goal = require('../models/Goal');
const Community = require('../models/Community');
const Membership = require('../models/Membership');
const Post = require('../models/Post');
const Tip = require('../models/Tip');
const ChallengeParticipation = require('../models/ChallengeParticipation');
const { protect, requireRole } = require('../middleware/auth');
const { notify } = require('../utils/notify');
const { deleteAccount, deleteCommunity } = require('../utils/admin');
const { ApiError, asyncHandler, escapeRegex } = require('../utils/helpers');

// Platform administration: individuals, businesses, communities and reported content
const router = express.Router();
router.use(protect, requireRole('admin'));

const round = (n) => Math.round(n * 10) / 10;
const oid = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Not found.');
  return new mongoose.Types.ObjectId(String(id));
};

// GET /api/admin/stats
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const [individuals, businesses, suspended, newThisWeek, communities, posts, reported, activities, co2, goals, recent] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'business' }),
      User.countDocuments({ status: 'suspended' }),
      User.countDocuments({ role: { $ne: 'admin' }, createdAt: { $gte: weekAgo } }),
      Community.countDocuments(),
      Post.countDocuments(),
      Post.countDocuments({ 'reports.0': { $exists: true } }),
      Activity.countDocuments(),
      Activity.aggregate([{ $group: { _id: null, kg: { $sum: '$co2Kg' } } }]),
      Goal.countDocuments({ status: 'achieved' }),
      User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 }).limit(8).select('name companyName role email username city createdAt status emailVerified avatarUrl').lean(),
    ]);
    res.json({
      individuals, businesses, suspended, newThisWeek, communities, posts, reported, activities,
      co2TrackedKg: round(co2[0]?.kg || 0), goalsAchieved: goals,
      recent: recent.map((u) => ({ ...u, displayName: User.displayNameOf(u) })),
    });
  })
);

// GET /api/admin/users?role=user|business&status=&q=&page=
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 25;
    const filter = { role: ['user', 'business'].includes(req.query.role) ? req.query.role : { $ne: 'admin' } };
    if (['active', 'suspended'].includes(req.query.status)) filter.status = req.query.status;
    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { username: rx }, { companyName: rx }, { city: rx }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .select('role status emailVerified name username companyName orgType email city country age gender companySize createdAt avatarUrl totalPoints').lean(),
      User.countDocuments(filter),
    ]);
    const ids = users.map((u) => u._id);
    const [acts, comms] = await Promise.all([
      Activity.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: '$user', n: { $sum: 1 }, kg: { $sum: '$co2Kg' } } }]),
      Membership.aggregate([{ $match: { user: { $in: ids }, status: 'active' } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
    ]);
    res.json({
      page,
      pages: Math.ceil(total / limit) || 1,
      total,
      users: users.map((u) => {
        const a = acts.find((x) => String(x._id) === String(u._id));
        return { ...u, displayName: User.displayNameOf(u), activities: a?.n || 0, co2Kg: round(a?.kg || 0), communities: comms.find((x) => String(x._id) === String(u._id))?.n || 0 };
      }),
    });
  })
);

// GET /api/admin/users/:id — full profile and activity summary
router.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: oid(req.params.id), role: { $ne: 'admin' } });
    if (!user) throw new ApiError(404, 'Account not found.');
    const [co2, goals, points, memberships, owned, posts] = await Promise.all([
      Activity.aggregate([{ $match: { user: user._id } }, { $group: { _id: '$category', kg: { $sum: '$co2Kg' }, n: { $sum: 1 } } }]),
      Goal.aggregate([{ $match: { user: user._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      ChallengeParticipation.aggregate([{ $match: { user: user._id } }, { $group: { _id: null, p: { $sum: '$points' } } }]),
      Membership.find({ user: user._id }).populate('community', 'name icon').lean(),
      Community.find({ owner: user._id }).select('name icon memberCount inviteCode visibility').lean(),
      Post.countDocuments({ author: user._id }),
    ]);
    res.json({
      user,
      footprint: Object.fromEntries(co2.map((r) => [r._id, { kg: round(r.kg), entries: r.n }])),
      goals: Object.fromEntries(goals.map((g) => [g._id, g.n])),
      points: points[0]?.p || 0,
      posts,
      memberships: memberships.filter((m) => m.community).map((m) => ({ community: m.community, role: m.role, status: m.status })),
      ownedCommunities: owned,
    });
  })
);

// PUT /api/admin/users/:id/status { status: 'active'|'suspended', reason }
router.put(
  '/users/:id/status',
  asyncHandler(async (req, res) => {
    if (!['active', 'suspended'].includes(req.body.status)) throw new ApiError(400, 'Status must be active or suspended.');
    const user = await User.findOne({ _id: oid(req.params.id), role: { $ne: 'admin' } });
    if (!user) throw new ApiError(404, 'Account not found.');
    user.status = req.body.status;
    user.suspendedReason = req.body.status === 'suspended' ? String(req.body.reason || '').trim().slice(0, 300) : '';
    await user.save();
    if (user.status === 'active') {
      await notify(user, { type: 'system', title: 'Your account is active again', message: 'An administrator has restored your account.', link: '' }, { force: true });
    }
    res.json({ message: user.status === 'suspended' ? 'Account suspended. The user can no longer log in.' : 'Account reactivated.', user });
  })
);

// DELETE /api/admin/users/:id — removes the account and all its data
router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: oid(req.params.id), role: { $ne: 'admin' } });
    if (!user) throw new ApiError(404, 'Account not found.');
    await deleteAccount(user);
    res.json({ message: `${User.displayNameOf(user)} and all their data were deleted.` });
  })
);

// GET /api/admin/communities?q=
router.get(
  '/communities',
  asyncHandler(async (req, res) => {
    const filter = {};
    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q) filter.name = new RegExp(escapeRegex(q), 'i');
    const list = await Community.find(filter).sort({ createdAt: -1 }).limit(200).populate('owner', 'companyName name email role').lean();
    const counts = await Post.aggregate([{ $match: { community: { $in: list.map((c) => c._id) } } }, { $group: { _id: '$community', n: { $sum: 1 } } }]);
    res.json({
      communities: list.map((c) => ({
        _id: c._id, name: c.name, icon: c.icon, type: c.type, visibility: c.visibility, city: c.city, memberCount: c.memberCount,
        createdAt: c.createdAt, owner: c.owner ? { _id: c.owner._id, name: User.displayNameOf(c.owner), email: c.owner.email } : null,
        posts: counts.find((x) => String(x._id) === String(c._id))?.n || 0,
      })),
    });
  })
);

// DELETE /api/admin/communities/:id
router.delete(
  '/communities/:id',
  asyncHandler(async (req, res) => {
    const c = await Community.findById(oid(req.params.id));
    if (!c) throw new ApiError(404, 'Community not found.');
    const members = await Membership.find({ community: c._id, status: 'active' }).select('user');
    await deleteCommunity(c._id);
    await Promise.all(members.map((m) => notify(m.user, { type: 'community', title: 'Community removed', message: `${c.name} was removed by an administrator.`, link: '/communities' }, { force: true })));
    res.json({ message: `${c.name} was deleted.` });
  })
);

// GET /api/admin/reports — reported community posts and community tips
router.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const [posts, tips] = await Promise.all([
      Post.find({ $or: [{ 'reports.0': { $exists: true } }, { hidden: true }] }).sort({ updatedAt: -1 }).limit(100)
        .populate('author', 'name companyName role email').populate('community', 'name icon').lean(),
      Tip.find({ $or: [{ 'reports.0': { $exists: true } }, { hidden: true }] }).sort({ updatedAt: -1 }).limit(100).populate('author', 'name email').lean(),
    ]);
    res.json({
      posts: posts.map((p) => ({ _id: p._id, content: p.content, hidden: p.hidden, reports: p.reports.length, createdAt: p.createdAt, community: p.community, author: p.author ? { _id: p.author._id, name: User.displayNameOf(p.author), email: p.author.email } : null })),
      tips: tips.map((t) => ({ _id: t._id, title: t.title, content: t.content, hidden: t.hidden, reports: t.reports.length, createdAt: t.createdAt, author: t.author ? { _id: t.author._id, name: t.author.name, email: t.author.email } : null })),
    });
  })
);

// GET /api/admin/posts?q=&page= — every post members shared in communities, newest first
router.get(
  '/posts',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const q = String(req.query.q || '').trim();
    const filter = q ? { content: { $regex: escapeRegex(q), $options: 'i' } } : {};
    const [list, total] = await Promise.all([
      Post.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('author', 'name companyName role email').populate('community', 'name icon').lean(),
      Post.countDocuments(filter),
    ]);
    res.json({
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      total,
      posts: list.map((p) => ({ _id: p._id, content: p.content, category: p.category, hidden: p.hidden, isAnnouncement: p.isAnnouncement, reports: p.reports.length, likes: p.likes.length, replies: p.replies.length, createdAt: p.createdAt, community: p.community, author: p.author ? { _id: p.author._id, name: User.displayNameOf(p.author), email: p.author.email } : null })),
    });
  })
);

// PUT /api/admin/:kind(posts|tips)/:id { hidden } — hide or restore; DELETE removes it
router.put(
  '/:kind(posts|tips)/:id',
  asyncHandler(async (req, res) => {
    const Model = req.params.kind === 'posts' ? Post : Tip;
    const doc = await Model.findById(oid(req.params.id));
    if (!doc) throw new ApiError(404, 'Not found.');
    doc.hidden = Boolean(req.body.hidden);
    if (!doc.hidden) doc.reports = [];
    await doc.save();
    res.json({ message: doc.hidden ? 'Hidden from members.' : 'Restored and reports cleared.' });
  })
);

router.delete(
  '/:kind(posts|tips)/:id',
  asyncHandler(async (req, res) => {
    const Model = req.params.kind === 'posts' ? Post : Tip;
    const doc = await Model.findByIdAndDelete(oid(req.params.id));
    if (!doc) throw new ApiError(404, 'Not found or already deleted.');
    res.json({ message: 'Deleted.' });
  })
);

// POST /api/admin/tips — add an official tip shown on Discover
router.post(
  '/tips',
  asyncHandler(async (req, res) => {
    const title = String(req.body.title || '').trim();
    const content = String(req.body.content || '').trim();
    const categories = ['transport', 'energy', 'waste', 'food', 'water', 'lifestyle'];
    if (title.length < 5 || content.length < 20) throw new ApiError(400, 'Title needs 5+ characters and the tip 20+ characters.');
    if (!categories.includes(req.body.category)) throw new ApiError(400, 'Choose a valid category.');
    const tip = await Tip.create({ title, content, category: req.body.category, isOfficial: true });
    res.status(201).json({ tip });
  })
);

module.exports = router;
