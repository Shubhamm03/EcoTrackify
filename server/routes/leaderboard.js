const express = require('express');
const mongoose = require('mongoose');
const ChallengeParticipation = require('../models/ChallengeParticipation');
const Community = require('../models/Community');
const Membership = require('../models/Membership');
const { protect } = require('../middleware/auth');
const { ApiError, asyncHandler, startOfWeek } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

// GET /api/leaderboard?period=week|all&community=<id>&limit=50
// Ranks participants by challenge points. Ties share a rank (1, 2, 2, 4).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const period = req.query.period === 'all' ? 'all' : 'week';
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 50));

    let community = null;
    let memberIds = null;
    if (req.query.community) {
      if (!mongoose.isValidObjectId(req.query.community)) throw new ApiError(404, 'Community not found.');
      community = await Community.findById(req.query.community).select('name').lean();
      if (!community) throw new ApiError(404, 'Community not found.');
      const me = await Membership.exists({ community: community._id, user: req.user._id, status: 'active' });
      if (!me) throw new ApiError(403, 'Join this community to see its leaderboard.');
      memberIds = (await Membership.find({ community: community._id, status: 'active' }).select('user').lean()).map((m) => m.user);
    }

    const match = {};
    if (period === 'week') match.weekStart = startOfWeek();
    if (memberIds) match.user = { $in: memberIds };

    const rows = await ChallengeParticipation.aggregate([
      { $match: match },
      { $group: { _id: '$user', points: { $sum: '$points' }, completed: { $sum: { $cond: ['$completed', 1, 0] } }, checkIns: { $sum: { $size: '$checkIns' } } } },
      { $match: { points: { $gt: 0 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $match: { 'user.role': { $ne: 'business' } } },
      { $sort: { points: -1, completed: -1, 'user.name': 1 } },
      { $project: { points: 1, completed: 1, checkIns: 1, name: '$user.name', username: '$user.username', avatarUrl: '$user.avatarUrl', userId: '$user._id' } },
    ]);
    let rank = 0;
    let prev = null;
    rows.forEach((r, i) => {
      if (r.points !== prev) rank = i + 1;
      prev = r.points;
      r.rank = rank;
      r.isMe = String(r.userId) === String(req.user._id);
    });

    res.json({
      period,
      community: community ? { _id: community._id, name: community.name } : null,
      weekStart: period === 'week' ? startOfWeek() : null,
      totalParticipants: rows.length,
      leaders: rows.slice(0, limit),
      me: rows.find((r) => r.isMe) || null,
    });
  })
);

module.exports = router;
