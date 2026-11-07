const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Community = require('../models/Community');
const Membership = require('../models/Membership');
const Post = require('../models/Post');
const User = require('../models/User');
const Goal = require('../models/Goal');
const Challenge = require('../models/Challenge');
const ChallengeParticipation = require('../models/ChallengeParticipation');
const { protect, requireRole } = require('../middleware/auth');
const { notify } = require('../utils/notify');
const { communityInsights } = require('../utils/insights');
const { checkContent } = require('../utils/moderation');
const { loadCommunity, activeMembership, requireMember, requireAdmin, footprintsFor } = require('../utils/communityAccess');
const { ApiError, asyncHandler, escapeRegex } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

const TYPES = ['company', 'college', 'city', 'interest', 'society', 'ngo'];
const dn = User.displayNameOf;
const makeInviteCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();
const round = (n) => Math.round(n * 100) / 100;

function shapeCommunity(c, membership, { includeCode = false } = {}) {
  const obj = c.toObject ? c.toObject() : c;
  const isAdmin = membership?.status === 'active' && membership.role === 'admin';
  return {
    _id: obj._id,
    name: obj.name,
    description: obj.description,
    type: obj.type,
    icon: obj.icon,
    visibility: obj.visibility,
    city: obj.city,
    memberCount: obj.memberCount,
    owner: obj.owner,
    createdAt: obj.createdAt,
    resources: membership?.status === 'active' ? (obj.resources || []).slice().reverse() : [],
    inviteCode: isAdmin || includeCode ? obj.inviteCode : undefined,
    membership: membership ? { role: membership.role, status: membership.status, shareFootprint: membership.shareFootprint } : null,
  };
}

async function notifyAdmins(communityId, payload, exceptUserId) {
  const admins = await Membership.find({ community: communityId, role: 'admin', status: 'active' }).select('user');
  await Promise.all(admins.filter((a) => String(a.user) !== String(exceptUserId)).map((a) => notify(a.user, payload)));
}

async function addMember(community, user, shareFootprint) {
  if (user.role !== 'user') throw new ApiError(400, 'Business accounts create communities; individuals join them.');
  const existing = await Membership.findOne({ community: community._id, user: user._id });
  if (existing?.status === 'banned') throw new ApiError(403, 'You cannot join this community.');
  if (existing?.status === 'active') throw new ApiError(400, 'You are already a member.');
  const status = community.visibility === 'private' && !existing ? 'pending' : 'active';
  await Membership.updateOne(
    { community: community._id, user: user._id },
    { $set: { status, shareFootprint: shareFootprint !== false }, $setOnInsert: { role: 'member' } },
    { upsert: true }
  );
  if (status === 'active') await Community.updateOne({ _id: community._id }, { $inc: { memberCount: 1 } });
  return status;
}

// ---------- Listing & creation ----------

// GET /api/communities?q=&type=&mine=true
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const memberships = await Membership.find({ user: req.user._id, status: { $in: ['active', 'pending'] } }).lean();
    const byId = new Map(memberships.map((m) => [String(m.community), m]));
    const filter = {};
    if (req.query.mine === 'true') filter._id = { $in: memberships.map((m) => m.community) };
    if (TYPES.includes(req.query.type)) filter.type = req.query.type;
    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q) filter.name = new RegExp(escapeRegex(q), 'i');
    const list = await Community.find(filter).sort({ memberCount: -1, createdAt: -1 }).limit(100);
    res.json({ communities: list.map((c) => shapeCommunity(c, byId.get(String(c._id)))) });
  })
);

// POST /api/communities — business accounts create communities and become admin
router.post(
  '/',
  requireRole('business', 'admin'),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim();
    if (name.length < 3) throw new ApiError(400, 'Community name should be at least 3 characters.');
    const type = TYPES.includes(req.body.type) ? req.body.type : 'company';
    const visibility = req.body.visibility === 'public' ? 'public' : 'private';
    const verdict = checkContent(name, req.body.description || '');
    if (!verdict.ok) throw new ApiError(400, verdict.reason);
    const owned = await Community.countDocuments({ owner: req.user._id });
    if (owned >= 20) throw new ApiError(400, 'You can create up to 20 communities.');
    const community = await Community.create({
      name,
      description: String(req.body.description || '').trim().slice(0, 500),
      type,
      icon: '',
      visibility,
      city: String(req.body.city || req.user.city || '').trim().slice(0, 60),
      owner: req.user._id,
      inviteCode: makeInviteCode(),
    });
    const membership = await Membership.create({ community: community._id, user: req.user._id, role: 'admin', status: 'active' });
    res.status(201).json({ community: shapeCommunity(community, membership) });
  })
);

// GET /api/communities/compare — every community ranked by CO2 per member (30 days)
router.get(
  '/compare',
  asyncHandler(async (req, res) => {
    const communities = await Community.find().lean();
    const memberships = await Membership.find({ status: 'active' }).select('community user shareFootprint').lean();
    const individuals = new Set((await User.find({ role: { $ne: 'business' } }).select('_id').lean()).map((u) => String(u._id)));
    const sharingIds = [...new Set(memberships.filter((m) => m.shareFootprint && individuals.has(String(m.user))).map((m) => String(m.user)))];
    const [footprints, goals, points] = await Promise.all([
      footprintsFor(sharingIds),
      Goal.aggregate([{ $match: { status: 'achieved' } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
      ChallengeParticipation.aggregate([{ $group: { _id: '$user', p: { $sum: '$points' } } }]),
    ]);
    const goalsBy = new Map(goals.map((g) => [String(g._id), g.n]));
    const pointsBy = new Map(points.map((p) => [String(p._id), p.p]));
    const mine = new Set(memberships.filter((m) => String(m.user) === String(req.user._id)).map((m) => String(m.community)));

    const rows = communities.map((c) => {
      const ms = memberships.filter((m) => String(m.community) === String(c._id) && individuals.has(String(m.user)));
      const sharing = ms.filter((m) => m.shareFootprint && footprints.has(String(m.user)));
      const cats = { transport: 0, energy: 0, waste: 0 };
      let total = 0;
      sharing.forEach((m) => {
        const f = footprints.get(String(m.user));
        total += f.totalKg;
        Object.keys(cats).forEach((k) => { cats[k] += f[k]; });
      });
      const n = sharing.length;
      return {
        _id: c._id,
        name: c.name,
        icon: c.icon,
        type: c.type,
        city: c.city,
        members: ms.length,
        membersCounted: n,
        perMemberKg: n ? round(total / n) : null,
        perMemberByCategory: n ? Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, round(v / n)])) : null,
        goalsAchieved: ms.reduce((a, m) => a + (goalsBy.get(String(m.user)) || 0), 0),
        challengePoints: ms.reduce((a, m) => a + (pointsBy.get(String(m.user)) || 0), 0),
        isMember: mine.has(String(c._id)),
      };
    });
    rows.sort((a, b) => (a.perMemberKg == null) - (b.perMemberKg == null) || (a.perMemberKg ?? 0) - (b.perMemberKg ?? 0));
    let rank = 0;
    rows.forEach((r) => { r.rank = r.perMemberKg == null ? null : ++rank; });
    res.json({ days: 30, communities: rows });
  })
);

// POST /api/communities/join-code { inviteCode, shareFootprint }
router.post(
  '/join-code',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'user') throw new ApiError(400, 'Business accounts create communities; individuals join them.');
    const code = String(req.body.inviteCode || '').trim().toUpperCase();
    if (!code) throw new ApiError(400, 'Enter an invitation code.');
    const community = await Community.findOne({ inviteCode: code });
    if (!community) throw new ApiError(404, 'That invitation code is not valid.');
    const existing = await Membership.findOne({ community: community._id, user: req.user._id });
    if (existing?.status === 'banned') throw new ApiError(403, 'You cannot join this community.');
    if (existing?.status === 'active') throw new ApiError(400, `You are already a member of ${community.name}.`);
    // An invite code skips approval, even for private communities
    await Membership.updateOne(
      { community: community._id, user: req.user._id },
      { $set: { status: 'active', shareFootprint: req.body.shareFootprint !== false }, $setOnInsert: { role: 'member' } },
      { upsert: true }
    );
    await Community.updateOne({ _id: community._id }, { $inc: { memberCount: 1 } });
    await notifyAdmins(community._id, { type: 'community', title: 'New member joined', message: `${req.user.name} joined ${community.name} with the invite code.`, link: `/communities/${community._id}` }, req.user._id);
    const m = await activeMembership(community._id, req.user._id);
    res.json({ community: shapeCommunity(await Community.findById(community._id), m) });
  })
);

// ---------- Single community ----------

// GET /api/communities/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    const m = await Membership.findOne({ community: community._id, user: req.user._id });
    if (m?.status === 'banned') throw new ApiError(403, 'You do not have access to this community.');
    const owner = await User.findById(community.owner).select('name companyName role avatarUrl').lean();
    res.json({ community: { ...shapeCommunity(community, m), ownerInfo: owner ? { name: dn(owner), avatarUrl: owner.avatarUrl } : null } });
  })
);

// PUT /api/communities/:id — admins edit details
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    const m = await requireAdmin(community._id, req.user);
    const b = req.body;
    if (b.name !== undefined) {
      if (String(b.name).trim().length < 3) throw new ApiError(400, 'Community name should be at least 3 characters.');
      community.name = String(b.name).trim().slice(0, 80);
    }
    if (b.description !== undefined) community.description = String(b.description).trim().slice(0, 500);
    if (TYPES.includes(b.type)) community.type = b.type;
    if (['public', 'private'].includes(b.visibility)) community.visibility = b.visibility;
    if (b.icon) community.icon = String(b.icon).slice(0, 8);
    if (b.city !== undefined) community.city = String(b.city).trim().slice(0, 60);
    const verdict = checkContent(community.name, community.description);
    if (!verdict.ok) throw new ApiError(400, verdict.reason);
    await community.save();
    res.json({ community: shapeCommunity(community, m) });
  })
);

// DELETE /api/communities/:id — owner only
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    if (String(community.owner) !== String(req.user._id)) throw new ApiError(403, 'Only the owner can delete this community.');
    await Promise.all([
      Membership.deleteMany({ community: community._id }),
      Post.deleteMany({ community: community._id }),
      Challenge.deleteMany({ community: community._id }),
    ]);
    await community.deleteOne();
    res.json({ message: 'Community deleted.' });
  })
);

// POST /api/communities/:id/invite-code/regenerate
router.post(
  '/:id/invite-code/regenerate',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    await requireAdmin(community._id, req.user);
    community.inviteCode = makeInviteCode();
    await community.save();
    res.json({ inviteCode: community.inviteCode });
  })
);

// ---------- Membership ----------

// POST /api/communities/:id/join { shareFootprint }
router.post(
  '/:id/join',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    const status = await addMember(community, req.user, req.body.shareFootprint);
    if (status === 'pending') {
      await notifyAdmins(community._id, { type: 'community', title: 'New join request', message: `${req.user.name}${req.user.username ? ` (@${req.user.username})` : ''} asked to join ${community.name}.`, link: `/communities/${community._id}` });
    }
    const m = await Membership.findOne({ community: community._id, user: req.user._id });
    res.json({ status, community: shapeCommunity(await Community.findById(community._id), m) });
  })
);

// POST /api/communities/:id/leave
router.post(
  '/:id/leave',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    if (String(community.owner) === String(req.user._id)) throw new ApiError(400, 'The owner cannot leave. Delete the community instead.');
    const m = await Membership.findOneAndDelete({ community: community._id, user: req.user._id, status: { $in: ['active', 'pending'] } });
    if (!m) throw new ApiError(400, 'You are not a member of this community.');
    if (m.status === 'active') await Community.updateOne({ _id: community._id }, { $inc: { memberCount: -1 } });
    res.json({ message: `You left ${community.name}.` });
  })
);

// PUT /api/communities/:id/sharing { share } — grant or revoke footprint sharing
router.put(
  '/:id/sharing',
  asyncHandler(async (req, res) => {
    const m = await requireMember(req.params.id, req.user);
    m.shareFootprint = Boolean(req.body.share);
    await m.save();
    res.json({ membership: { role: m.role, status: m.status, shareFootprint: m.shareFootprint } });
  })
);

// GET /api/communities/:id/members — members with footprints (only for those who share)
router.get(
  '/:id/members',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    const me = await requireMember(community._id, req.user);
    const isAdmin = me.role === 'admin';
    const ms = await Membership.find({ community: community._id, status: isAdmin ? { $in: ['active', 'pending'] } : 'active' })
      .populate('user', 'name companyName role username avatarUrl city')
      .lean();
    const valid = ms.filter((m) => m.user);
    const footprints = await footprintsFor(valid.filter((m) => m.status === 'active' && m.shareFootprint && m.user.role !== 'business').map((m) => m.user._id));
    const shape = (m) => {
      const isOrg = m.user.role === 'business';
      const f = m.shareFootprint && !isOrg ? footprints.get(String(m.user._id)) : null;
      return {
        userId: m.user._id,
        name: dn(m.user),
        username: m.user.username || '',
        isOrganisation: isOrg,
        avatarUrl: m.user.avatarUrl,
        city: m.user.city,
        role: m.role,
        isOwner: String(community.owner) === String(m.user._id),
        isMe: String(m.user._id) === String(req.user._id),
        sharing: m.shareFootprint && !isOrg,
        footprint: m.shareFootprint && !isOrg ? f || { transport: 0, energy: 0, waste: 0, totalKg: 0, level: null } : null,
        joinedAt: m.createdAt,
      };
    };
    const active = valid.filter((m) => m.status === 'active').map(shape)
      .sort((a, b) => (a.footprint == null) - (b.footprint == null) || (a.footprint?.totalKg ?? 0) - (b.footprint?.totalKg ?? 0));
    res.json({
      members: active,
      pending: isAdmin ? valid.filter((m) => m.status === 'pending').map((m) => ({ userId: m.user._id, name: dn(m.user), username: m.user.username || '', avatarUrl: m.user.avatarUrl, requestedAt: m.updatedAt })) : [],
    });
  })
);

// POST /api/communities/:id/requests/:userId/(approve|reject)
router.post(
  '/:id/requests/:userId/:action',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    await requireAdmin(community._id, req.user);
    if (!['approve', 'reject'].includes(req.params.action)) throw new ApiError(404, 'Unknown action.');
    const m = await Membership.findOne({ community: community._id, user: req.params.userId, status: 'pending' });
    if (!m) throw new ApiError(404, 'Join request not found.');
    if (req.params.action === 'approve') {
      m.status = 'active';
      await m.save();
      await Community.updateOne({ _id: community._id }, { $inc: { memberCount: 1 } });
      await notify(m.user, { type: 'community', title: 'Join request approved', message: `Welcome to ${community.name}!`, link: `/communities/${community._id}` });
    } else {
      await m.deleteOne();
      await notify(m.user, { type: 'community', title: 'Join request declined', message: `Your request to join ${community.name} was not approved.`, link: '/communities' });
    }
    res.json({ message: req.params.action === 'approve' ? 'Request approved.' : 'Request rejected.' });
  })
);

// DELETE /api/communities/:id/members/:userId?ban=true — admins remove (or ban) a member
router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    await requireAdmin(community._id, req.user);
    if (String(community.owner) === String(req.params.userId)) throw new ApiError(400, 'The owner cannot be removed.');
    if (String(req.user._id) === String(req.params.userId)) throw new ApiError(400, 'Use "Leave community" to remove yourself.');
    const m = await Membership.findOne({ community: community._id, user: req.params.userId, status: 'active' });
    if (!m) throw new ApiError(404, 'Member not found.');
    if (req.query.ban === 'true') {
      m.status = 'banned';
      m.role = 'member';
      await m.save();
    } else {
      await m.deleteOne();
    }
    await Community.updateOne({ _id: community._id }, { $inc: { memberCount: -1 } });
    res.json({ message: req.query.ban === 'true' ? 'Member removed and blocked.' : 'Member removed.' });
  })
);

// PUT /api/communities/:id/members/:userId/role { role } — owner promotes/demotes co-admins
router.put(
  '/:id/members/:userId/role',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    if (String(community.owner) !== String(req.user._id)) throw new ApiError(403, 'Only the owner can change admin roles.');
    if (!['admin', 'member'].includes(req.body.role)) throw new ApiError(400, 'Role must be admin or member.');
    if (String(community.owner) === String(req.params.userId)) throw new ApiError(400, "The owner's role cannot change.");
    const m = await Membership.findOneAndUpdate({ community: community._id, user: req.params.userId, status: 'active' }, { role: req.body.role }, { new: true });
    if (!m) throw new ApiError(404, 'Member not found.');
    if (req.body.role === 'admin') await notify(m.user, { type: 'community', title: 'You are now a co-admin', message: `You can now moderate ${community.name}.`, link: `/communities/${community._id}` });
    res.json({ message: 'Role updated.' });
  })
);

// ---------- Insights, progress, announcements, resources ----------

// GET /api/communities/:id/insights — community-level levels and tips
router.get(
  '/:id/insights',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    await requireMember(community._id, req.user);
    res.json(await communityInsights(community._id));
  })
);

// GET /api/communities/:id/progress?days=30 — admin view of member progress (User Story 7)
router.get(
  '/:id/progress',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    await requireAdmin(community._id, req.user);
    const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 30));
    const ms = (await Membership.find({ community: community._id, status: 'active' }).populate('user', 'name username email avatarUrl role').lean()).filter((m) => m.user && m.user.role !== 'business');
    const sharing = ms.filter((m) => m.shareFootprint);
    const ids = sharing.map((m) => m.user._id);
    const oid = ids.map((id) => new mongoose.Types.ObjectId(String(id)));
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const Activity = require('../models/Activity');
    const [footprints, monthly, goals, points] = await Promise.all([
      footprintsFor(ids, days),
      Activity.aggregate([
        { $match: { user: { $in: oid }, date: { $gte: sixMonthsAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: TZ } }, kg: { $sum: '$co2Kg' }, users: { $addToSet: '$user' } } },
        { $sort: { _id: 1 } },
      ]),
      Goal.aggregate([{ $match: { user: { $in: oid } } }, { $group: { _id: { u: '$user', s: '$status' }, n: { $sum: 1 } } }]),
      ChallengeParticipation.aggregate([{ $match: { user: { $in: oid } } }, { $group: { _id: '$user', p: { $sum: '$points' }, done: { $sum: { $cond: ['$completed', 1, 0] } } } }]),
    ]);
    const members = sharing.map((m) => {
      const id = String(m.user._id);
      const f = footprints.get(id) || { transport: 0, energy: 0, waste: 0, totalKg: 0, level: null };
      const g = { active: 0, achieved: 0, missed: 0 };
      goals.filter((r) => String(r._id.u) === id).forEach((r) => { g[r._id.s] = r.n; });
      const p = points.find((r) => String(r._id) === id);
      return { userId: m.user._id, name: m.user.name, username: m.user.username, email: m.user.email, avatarUrl: m.user.avatarUrl, footprint: f, goals: g, challengePoints: p?.p || 0, challengesCompleted: p?.done || 0 };
    });
    const totals = { transport: 0, energy: 0, waste: 0 };
    members.forEach((e) => Object.keys(totals).forEach((k) => { totals[k] = round(totals[k] + e.footprint[k]); }));
    const totalKg = round(totals.transport + totals.energy + totals.waste);
    res.json({
      days,
      memberCount: ms.length,
      sharingCount: sharing.length,
      totals: { totalKg, perMemberKg: sharing.length ? round(totalKg / sharing.length) : 0, categories: totals, goalsAchieved: members.reduce((a, e) => a + e.goals.achieved, 0), challengePoints: members.reduce((a, e) => a + e.challengePoints, 0) },
      monthly: monthly.map((r) => ({ month: r._id, totalKg: round(r.kg), perMemberKg: round(r.kg / r.users.length) })),
      members: members.sort((a, b) => b.footprint.totalKg - a.footprint.totalKg),
    });
  })
);

// POST /api/communities/:id/announcements { content } — pinned post + notification to all members
router.post(
  '/:id/announcements',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    await requireAdmin(community._id, req.user);
    const content = String(req.body.content || '').trim();
    if (content.length < 5) throw new ApiError(400, 'Announcement should be at least 5 characters.');
    const verdict = checkContent(content);
    if (!verdict.ok) throw new ApiError(400, verdict.reason);
    const post = await Post.create({ community: community._id, author: req.user._id, content: content.slice(0, 1000), isAnnouncement: true, pinned: true });
    const members = await Membership.find({ community: community._id, status: 'active', user: { $ne: req.user._id } }).select('user');
    await Promise.all(members.map((m) => notify(m.user, { type: 'community', title: `Announcement from ${community.name}`, message: content.slice(0, 160), link: `/communities/${community._id}` })));
    res.status(201).json({ postId: post._id, notified: members.length });
  })
);

// POST /api/communities/:id/resources
router.post(
  '/:id/resources',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    await requireAdmin(community._id, req.user);
    const title = String(req.body.title || '').trim();
    const url = String(req.body.url || '').trim();
    if (title.length < 3) throw new ApiError(400, 'Resource title is required.');
    if (url && !/^https?:\/\/\S+$/i.test(url)) throw new ApiError(400, 'Link must start with http:// or https://');
    community.resources.push({ title, description: String(req.body.description || '').trim().slice(0, 500), url });
    await community.save();
    const members = await Membership.find({ community: community._id, status: 'active', user: { $ne: req.user._id } }).select('user');
    await Promise.all(members.map((m) => notify(m.user, { type: 'community', title: `New resource in ${community.name}`, message: title, link: `/communities/${community._id}` })));
    res.status(201).json({ resources: community.resources.slice().reverse() });
  })
);

// DELETE /api/communities/:id/resources/:rid
router.delete(
  '/:id/resources/:rid',
  asyncHandler(async (req, res) => {
    const community = await loadCommunity(req.params.id);
    await requireAdmin(community._id, req.user);
    const r = community.resources.id(req.params.rid);
    if (!r) throw new ApiError(404, 'Resource not found.');
    r.deleteOne();
    await community.save();
    res.json({ resources: community.resources.slice().reverse() });
  })
);

// Posts, replies and likes live in their own router
router.use('/:id/posts', require('./posts'));

module.exports = router;
