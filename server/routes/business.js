const express = require('express');
const mongoose = require('mongoose');
const Community = require('../models/Community');
const Membership = require('../models/Membership');
const Activity = require('../models/Activity');
const Goal = require('../models/Goal');
const Challenge = require('../models/Challenge');
const ChallengeParticipation = require('../models/ChallengeParticipation');
const PersonalTip = require('../models/PersonalTip');
const { protect, requireRole } = require('../middleware/auth');
const { footprintsFor } = require('../utils/communityAccess');
const { notify } = require('../utils/notify');
const { shapeTip } = require('../utils/personalTips');
const { ApiError, asyncHandler } = require('../utils/helpers');

// Pages only a business account sees: Overview, Members, Challenges
const router = express.Router();
router.use(protect, requireRole('business'));

const round = (n) => Math.round(n * 100) / 100;

// Communities this business administers and the individual members in them
async function people(user) {
  const adminOf = await Membership.find({ user: user._id, role: 'admin', status: 'active' }).select('community').lean();
  const cids = adminOf.map((m) => m.community);
  const ms = await Membership.find({ community: { $in: cids }, status: { $in: ['active', 'pending'] }, user: { $ne: user._id } })
    .populate('user', 'name username city avatarUrl role')
    .lean();
  const active = ms.filter((m) => m.status === 'active' && m.user && m.user.role !== 'business');
  const byUser = new Map();
  active.forEach((m) => {
    const k = String(m.user._id);
    const cur = byUser.get(k) || { user: m.user, communities: [], sharing: false };
    cur.communities.push(m.community);
    cur.sharing = cur.sharing || m.shareFootprint;
    byUser.set(k, cur);
  });
  return { cids, members: [...byUser.values()], pending: ms.filter((m) => m.status === 'pending').length };
}

// GET /api/business/overview — company footprint + members + communities
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const { cids, members, pending } = await people(req.user);
    const from = new Date(Date.now() - 30 * 86400000);
    const [own, communities] = await Promise.all([
      Activity.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(String(req.user._id)), date: { $gte: from } } },
        { $group: { _id: '$category', kg: { $sum: '$co2Kg' } } },
      ]),
      Community.find({ _id: { $in: cids } }).sort({ createdAt: 1 }).lean(),
    ]);
    const company = { transport: 0, energy: 0, waste: 0 };
    own.forEach((r) => { company[r._id] = round(r.kg); });
    company.totalKg = round(company.transport + company.energy + company.waste);

    const sharing = members.filter((m) => m.sharing);
    const footprints = await footprintsFor(sharing.map((m) => m.user._id));
    const withData = sharing.filter((m) => footprints.has(String(m.user._id)));
    const membersTotalKg = round(withData.reduce((a, m) => a + footprints.get(String(m.user._id)).totalKg, 0));
    const topEmitters = withData
      .map((m) => ({ userId: m.user._id, name: m.user.name, username: m.user.username, avatarUrl: m.user.avatarUrl, totalKg: footprints.get(String(m.user._id)).totalKg, level: footprints.get(String(m.user._id)).level }))
      .sort((a, b) => b.totalKg - a.totalKg)
      .slice(0, 5);

    const communityRows = communities.map((c) => {
      const ms = withData.filter((m) => m.communities.some((id) => String(id) === String(c._id)));
      const total = ms.reduce((a, m) => a + footprints.get(String(m.user._id)).totalKg, 0);
      return {
        _id: c._id,
        name: c.name,
        icon: c.icon,
        inviteCode: c.inviteCode,
        visibility: c.visibility,
        members: members.filter((m) => m.communities.some((id) => String(id) === String(c._id))).length,
        perMemberKg: ms.length ? round(total / ms.length) : null,
      };
    });

    res.json({
      company,
      membersCount: members.length,
      sharingWithData: withData.length,
      membersTotalKg,
      pendingRequests: pending,
      topEmitters,
      communities: communityRows,
    });
  })
);

// GET /api/business/members — everyone in this business's communities
router.get(
  '/members',
  asyncHandler(async (req, res) => {
    const { members } = await people(req.user);
    const ids = members.map((m) => m.user._id);
    const footprints = await footprintsFor(members.filter((m) => m.sharing).map((m) => m.user._id));
    const oids = ids.map((id) => new mongoose.Types.ObjectId(String(id)));
    const [goals, points, communities, tipCounts] = await Promise.all([
      Goal.aggregate([{ $match: { user: { $in: oids }, status: 'achieved' } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
      ChallengeParticipation.aggregate([{ $match: { user: { $in: oids } } }, { $group: { _id: '$user', p: { $sum: '$points' } } }]),
      Community.find({ _id: { $in: [...new Set(members.flatMap((m) => m.communities.map(String)))] } }).select('name').lean(),
      PersonalTip.aggregate([{ $match: { business: new mongoose.Types.ObjectId(String(req.user._id)), member: { $in: oids } } }, { $group: { _id: '$member', n: { $sum: 1 } } }]),
    ]);
    const cname = new Map(communities.map((c) => [String(c._id), c.name]));
    const rows = members.map((m) => {
      const id = String(m.user._id);
      const f = m.sharing ? footprints.get(id) || { transport: 0, energy: 0, waste: 0, totalKg: 0, level: null } : null;
      return {
        userId: m.user._id,
        name: m.user.name,
        username: m.user.username,
        city: m.user.city,
        avatarUrl: m.user.avatarUrl,
        communities: m.communities.map((c) => cname.get(String(c))).filter(Boolean),
        footprint: f,
        goalsAchieved: goals.find((g) => String(g._id) === id)?.n || 0,
        tipCount: tipCounts.find((t) => String(t._id) === id)?.n || 0,
        points: points.find((p) => String(p._id) === id)?.p || 0,
      };
    });
    rows.sort((a, b) => (a.footprint == null) - (b.footprint == null) || (b.footprint?.totalKg ?? 0) - (a.footprint?.totalKg ?? 0));
    res.json({ members: rows });
  })
);

// GET /api/business/challenges — challenges this business created, with participation
router.get(
  '/challenges',
  asyncHandler(async (req, res) => {
    const { cids } = await people(req.user);
    const list = await Challenge.find({ community: { $in: cids } }).sort({ weekStart: -1, createdAt: -1 }).limit(50).populate('community', 'name icon').lean();
    const stats = await ChallengeParticipation.aggregate([
      { $match: { challenge: { $in: list.map((c) => c._id) } } },
      { $group: { _id: '$challenge', joined: { $sum: 1 }, completed: { $sum: { $cond: ['$completed', 1, 0] } } } },
    ]);
    const communities = await Community.find({ _id: { $in: cids } }).select('name icon').lean();
    res.json({
      communities,
      challenges: list.map((c) => {
        const s = stats.find((x) => String(x._id) === String(c._id));
        return { ...c, joined: s?.joined || 0, completed: s?.completed || 0 };
      }),
    });
  })
);

// The member must be in one of this business's communities
async function requireMember(user, memberId) {
  const { cids, members } = await people(user);
  const member = members.find((m) => String(m.user._id) === String(memberId));
  if (!member) throw new ApiError(404, 'This person is not a member of your communities.');
  return { cids, member };
}

// DELETE /api/business/members/:userId — remove a member from all of this organisation's communities
router.delete(
  '/members/:userId',
  asyncHandler(async (req, res) => {
    const { cids, member } = await requireMember(req.user, req.params.userId);
    const ms = await Membership.find({ user: member.user._id, community: { $in: cids }, status: 'active' }).select('community');
    await Membership.deleteMany({ _id: { $in: ms.map((m) => m._id) } });
    await Promise.all(ms.map((m) => Community.updateOne({ _id: m.community }, { $inc: { memberCount: -1 } })));
    await notify(member.user._id, { type: 'community', title: 'Removed from an organisation', message: `${req.user.companyName || req.user.name} removed you from its communities.`, link: '/communities' });
    res.json({ message: `${member.user.name} was removed.`, removedFrom: ms.length });
  })
);

const populateTip = (q) => q.populate('business', 'companyName name avatarUrl role').populate('replies.author', 'name username companyName role avatarUrl');

// GET /api/business/members/:userId/tips — the private tip thread with one member
router.get(
  '/members/:userId/tips',
  asyncHandler(async (req, res) => {
    await requireMember(req.user, req.params.userId);
    const tips = await populateTip(PersonalTip.find({ business: req.user._id, member: req.params.userId }).sort({ createdAt: -1 }).limit(30)).lean();
    res.json({ tips: tips.map((t) => shapeTip(t, req.user._id)) });
  })
);

// POST /api/business/members/:userId/tips { content } — send a personal tip only this member can see
router.post(
  '/members/:userId/tips',
  asyncHandler(async (req, res) => {
    const { member } = await requireMember(req.user, req.params.userId);
    const content = String(req.body.content || '').trim();
    if (content.length < 5) throw new ApiError(400, 'Write a little more (at least 5 characters).');
    if (content.length > 1000) throw new ApiError(400, 'Tips can be at most 1000 characters.');
    const tip = await PersonalTip.create({ business: req.user._id, member: member.user._id, content });
    await notify(member.user._id, { type: 'tip', title: `A personal tip from ${req.user.companyName || req.user.name}`, message: content.slice(0, 160), link: '/dashboard' });
    const full = await populateTip(PersonalTip.findById(tip._id)).lean();
    res.status(201).json({ tip: shapeTip(full, req.user._id) });
  })
);

// POST /api/business/tips/:id/replies { content } — the organisation answers in a tip thread
router.post(
  '/tips/:id/replies',
  asyncHandler(async (req, res) => {
    const content = String(req.body.content || '').trim();
    if (!content) throw new ApiError(400, 'Write a reply first.');
    if (content.length > 1000) throw new ApiError(400, 'Replies can be at most 1000 characters.');
    const tip = await PersonalTip.findOne({ _id: req.params.id, business: req.user._id });
    if (!tip) throw new ApiError(404, 'Tip not found.');
    tip.replies.push({ author: req.user._id, content });
    await tip.save();
    await notify(tip.member, { type: 'tip', title: `${req.user.companyName || req.user.name} replied`, message: content.slice(0, 160), link: '/dashboard' });
    const full = await populateTip(PersonalTip.findById(tip._id)).lean();
    res.status(201).json({ tip: shapeTip(full, req.user._id) });
  })
);

// DELETE /api/business/tips/:id — delete a tip you sent
router.delete(
  '/tips/:id',
  asyncHandler(async (req, res) => {
    const r = await PersonalTip.deleteOne({ _id: req.params.id, business: req.user._id });
    if (!r.deletedCount) throw new ApiError(404, 'Tip not found.');
    res.json({ message: 'Tip deleted.' });
  })
);

module.exports = router;
