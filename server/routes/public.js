const express = require('express');
const User = require('../models/User');
const Activity = require('../models/Activity');
const Goal = require('../models/Goal');
const Community = require('../models/Community');
const Membership = require('../models/Membership');
const Post = require('../models/Post');
const Challenge = require('../models/Challenge');
const ChallengeParticipation = require('../models/ChallengeParticipation');
const { footprintsFor } = require('../utils/communityAccess');
const { ensureWeeklyChallenges } = require('../utils/challenges');
const { asyncHandler, startOfWeek } = require('../utils/helpers');

const router = express.Router();
const round = (n) => Math.round(n * 10) / 10;
let cache = { at: 0, data: null };

// GET /api/public/stats — everything on the landing page, generated from real data
// (cached for 2 minutes). Nothing here is typed in by hand.
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    if (cache.data && Date.now() - cache.at < 2 * 60 * 1000) return res.json(cache.data);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    await ensureWeeklyChallenges();

    const [individuals, businesses, activities, tracked, month, goalsAchieved, saved, challengesCompleted, communities, posts] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'business' }),
      Activity.countDocuments(),
      Activity.aggregate([{ $group: { _id: null, kg: { $sum: '$co2Kg' } } }]),
      Activity.aggregate([{ $match: { date: { $gte: monthStart } } }, { $group: { _id: '$category', kg: { $sum: '$co2Kg' } } }]),
      Goal.countDocuments({ status: 'achieved' }),
      Goal.aggregate([{ $match: { status: 'achieved' } }, { $group: { _id: null, kg: { $sum: '$savedKg' } } }]),
      ChallengeParticipation.countDocuments({ completed: true }),
      Community.find().select('name icon type visibility').lean(),
      Post.countDocuments({ hidden: false }),
    ]);

    // This month's CO2 by source
    const thisMonth = { transport: 0, energy: 0, waste: 0 };
    month.forEach((m) => { thisMonth[m._id] = round(m.kg); });

    // Top 3 communities: lowest CO2 per sharing individual member, last 30 days
    const memberships = await Membership.find({ status: 'active', shareFootprint: true }).populate('user', 'role').lean();
    const people = memberships.filter((m) => m.user && m.user.role !== 'business');
    const footprints = await footprintsFor([...new Set(people.map((m) => String(m.user._id)))]);
    const topCommunities = communities
      .map((c) => {
        const ms = people.filter((m) => String(m.community) === String(c._id) && footprints.has(String(m.user._id)));
        if (!ms.length) return null;
        const total = ms.reduce((a, m) => a + footprints.get(String(m.user._id)).totalKg, 0);
        return { _id: c._id, name: c.name, icon: c.icon, type: c.type, perMemberKg: round(total / ms.length), members: ms.length };
      })
      .filter(Boolean)
      .sort((a, b) => a.perMemberKg - b.perMemberKg)
      .slice(0, 3);

    // This week's global challenges and how many joined
    const week = await Challenge.find({ weekStart: startOfWeek(), community: null }).select('title icon targetDays').lean();
    const joined = await ChallengeParticipation.aggregate([{ $match: { challenge: { $in: week.map((c) => c._id) } } }, { $group: { _id: '$challenge', n: { $sum: 1 } } }]);
    const weeklyChallenges = week.map((c) => ({ _id: c._id, title: c.title, icon: c.icon, targetDays: c.targetDays, joined: joined.find((j) => String(j._id) === String(c._id))?.n || 0 }));

    // Most-liked tips from public communities
    const publicIds = communities.filter((c) => c.visibility === 'public').map((c) => c._id);
    const popular = await Post.aggregate([
      { $match: { community: { $in: publicIds }, hidden: false } },
      { $addFields: { likeCount: { $size: '$likes' } } },
      { $sort: { likeCount: -1, createdAt: -1 } },
      { $limit: 3 },
      { $lookup: { from: 'users', localField: 'author', foreignField: '_id', as: 'a' } },
      { $unwind: '$a' },
      { $project: { content: { $substrCP: ['$content', 0, 160] }, likeCount: 1, authorName: { $cond: [{ $eq: ['$a.role', 'business'] }, '$a.companyName', '$a.name'] } } },
    ]);

    const data = {
      individuals,
      businesses,
      activities,
      co2TrackedKg: round(tracked[0]?.kg || 0),
      co2SavedKg: round(saved[0]?.kg || 0),
      goalsAchieved,
      challengesCompleted,
      communities: communities.length,
      posts,
      thisMonth,
      topCommunities,
      weeklyChallenges,
      popularTips: popular,
    };
    cache = { at: Date.now(), data };
    res.json(data);
  })
);

module.exports = router;
