const express = require('express');
const Challenge = require('../models/Challenge');
const ChallengeParticipation = require('../models/ChallengeParticipation');
const User = require('../models/User');
const Membership = require('../models/Membership');
const { protect, requireRole } = require('../middleware/auth');
const { ensureWeeklyChallenges, WEEK_DAYS, COMPLETION_BONUS } = require('../utils/challenges');
const { notify } = require('../utils/notify');
const { ApiError, asyncHandler, startOfWeek, endOfWeek, dayKey } = require('../utils/helpers');
// Icon names the client knows how to draw for challenges
const ICONS = ['leaf', 'bag', 'bike', 'salad', 'plug', 'droplet', 'apple', 'wind', 'basket', 'mail', 'recycle', 'bolt', 'sun', 'tree', 'bus', 'trash'];

const router = express.Router();
router.use(protect);

// Global challenges plus challenges of communities the user belongs to
async function visibleFilter(user) {
  const ids = (await Membership.find({ user: user._id, status: 'active' }).select('community').lean()).map((m) => m.community);
  return { $or: [{ community: null }, { community: { $in: ids } }] };
}

function shape(ch, part) {
  const today = dayKey();
  return {
    ...ch,
    joined: Boolean(part),
    checkIns: part ? part.checkIns : [],
    checkedInToday: part ? part.checkIns.includes(today) : false,
    completed: part ? part.completed : false,
    points: part ? part.points : 0,
    maxPoints: ch.targetDays * ch.pointsPerCheckIn + ch.completionBonus,
  };
}

async function loadChallenge(id, user) {
  const ch = await Challenge.findOne({ _id: id, ...(await visibleFilter(user)) });
  if (!ch) throw new ApiError(404, 'Challenge not found.');
  const now = new Date();
  if (now < ch.weekStart || now > ch.weekEnd) throw new ApiError(400, 'This challenge is not running this week.');
  return ch;
}

// GET /api/challenges/current — this week's challenges with the user's progress
router.get(
  '/current',
  asyncHandler(async (req, res) => {
    await ensureWeeklyChallenges();
    const weekStart = startOfWeek();
    const challenges = await Challenge.find({ weekStart, ...(await visibleFilter(req.user)) }).sort({ community: -1, createdAt: 1 }).populate('community', 'name icon').lean();
    const parts = await ChallengeParticipation.find({ user: req.user._id, challenge: { $in: challenges.map((c) => c._id) } }).lean();
    const byId = new Map(parts.map((p) => [String(p.challenge), p]));
    const counts = await ChallengeParticipation.aggregate([
      { $match: { challenge: { $in: challenges.map((c) => c._id) } } },
      { $group: { _id: '$challenge', participants: { $sum: 1 }, completed: { $sum: { $cond: ['$completed', 1, 0] } } } },
    ]);
    const countById = new Map(counts.map((c) => [String(c._id), c]));
    res.json({
      weekStart,
      weekEnd: endOfWeek(),
      challenges: challenges.map((c) => ({
        ...shape(c, byId.get(String(c._id))),
        participants: countById.get(String(c._id))?.participants || 0,
        completedBy: countById.get(String(c._id))?.completed || 0,
      })),
    });
  })
);

// Business accounts run challenges for their members; they don't take part themselves
const individualsOnly = (req, res, next) => (req.user.role !== 'user' ? next(new ApiError(400, 'Challenges are for individual members. Create community challenges from the Challenges page.')) : next());

// POST /api/challenges/:id/join
router.post(
  '/:id/join',
  individualsOnly,
  asyncHandler(async (req, res) => {
    const ch = await loadChallenge(req.params.id, req.user);
    await ChallengeParticipation.updateOne(
      { user: req.user._id, challenge: ch._id },
      { $setOnInsert: { weekStart: ch.weekStart } },
      { upsert: true }
    );
    const part = await ChallengeParticipation.findOne({ user: req.user._id, challenge: ch._id }).lean();
    res.json({ challenge: shape(ch.toObject(), part) });
  })
);

// POST /api/challenges/:id/checkin — one check-in per day; awards points
router.post(
  '/:id/checkin',
  individualsOnly,
  asyncHandler(async (req, res) => {
    const ch = await loadChallenge(req.params.id, req.user);
    const today = dayKey();
    const exists = await ChallengeParticipation.findOne({ user: req.user._id, challenge: ch._id });
    if (!exists) throw new ApiError(400, 'Join the challenge before checking in.');
    if (exists.completed) throw new ApiError(400, 'You have already completed this challenge.');

    // Atomic: only succeeds if today's check-in isn't recorded yet
    const part = await ChallengeParticipation.findOneAndUpdate(
      { _id: exists._id, checkIns: { $ne: today }, completed: false },
      { $push: { checkIns: today }, $inc: { points: ch.pointsPerCheckIn } },
      { new: true }
    );
    if (!part) throw new ApiError(400, "You've already checked in today. Come back tomorrow!");
    let earned = ch.pointsPerCheckIn;

    let justCompleted = false;
    let result = part;
    if (part.checkIns.length >= ch.targetDays) {
      const done = await ChallengeParticipation.findOneAndUpdate(
        { _id: part._id, completed: false },
        { $set: { completed: true, completedAt: new Date() }, $inc: { points: ch.completionBonus } },
        { new: true }
      );
      if (done) {
        justCompleted = true;
        earned += ch.completionBonus;
        result = done;
      }
    }
    await User.updateOne({ _id: req.user._id }, { $inc: { totalPoints: earned } });

    if (justCompleted) {
      await notify(req.user, {
        type: 'challenge',
        title: `Challenge complete: ${ch.title}`,
        message: `You finished "${ch.title}" and earned ${result.points} points this week!`,
        link: '/challenges',
      });
    }
    res.json({ challenge: shape(ch.toObject(), result.toObject()), earned, justCompleted });
  })
);

// DELETE /api/challenges/:id/join — leave (only before any check-in)
router.delete(
  '/:id/join',
  asyncHandler(async (req, res) => {
    const part = await ChallengeParticipation.findOne({ user: req.user._id, challenge: req.params.id });
    if (!part) throw new ApiError(404, "You haven't joined this challenge.");
    if (part.checkIns.length > 0) throw new ApiError(400, "You can't leave a challenge after checking in.");
    await part.deleteOne();
    res.json({ message: 'Left challenge.' });
  })
);

// GET /api/challenges/history
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const parts = await ChallengeParticipation.find({ user: req.user._id }).sort({ weekStart: -1 }).limit(50).populate('challenge').lean();
    res.json({ history: parts.filter((p) => p.challenge) });
  })
);

// POST /api/challenges — admins create global challenges; business accounts create
// challenges for a community they administer ({ community: <id> })
router.post(
  '/',
  requireRole('admin', 'business'),
  asyncHandler(async (req, res) => {
    const { title, description, icon, category } = req.body;
    if (!title || !description) throw new ApiError(400, 'Title and description are required.');
    let community = null;
    if (req.user.role === 'business' || req.body.community) {
      const m = await Membership.findOne({ community: req.body.community, user: req.user._id, status: 'active', role: 'admin' });
      if (!m) throw new ApiError(403, 'Choose a community you administer.');
      community = m.community;
    }
    const ch = await Challenge.create({
      title,
      description,
      icon: ICONS.includes(icon) ? icon : 'leaf',
      category: category || 'lifestyle',
      targetDays: WEEK_DAYS,
      completionBonus: COMPLETION_BONUS,
      weekStart: startOfWeek(),
      weekEnd: endOfWeek(),
      community,
      createdBy: req.user._id,
    });
    if (community) {
      const members = await Membership.find({ community, status: 'active', user: { $ne: req.user._id } }).select('user');
      const c = await require('../models/Community').findById(community).select('name');
      await Promise.all(members.map((m) => notify(m.user, { type: 'challenge', title: `New challenge from ${c.name}`, message: `${title}: ${String(description).slice(0, 100)}`, link: '/challenges' })));
    }
    res.status(201).json({ challenge: ch });
  })
);

module.exports = router;
