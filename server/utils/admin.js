const User = require('../models/User');
const Activity = require('../models/Activity');
const Goal = require('../models/Goal');
const Notification = require('../models/Notification');
const Community = require('../models/Community');
const Membership = require('../models/Membership');
const Post = require('../models/Post');
const Challenge = require('../models/Challenge');
const ChallengeParticipation = require('../models/ChallengeParticipation');
const PersonalTip = require('../models/PersonalTip');
const { removeOldAvatar } = require('../middleware/upload');

// There is no admin registration. On every start the admin from .env is created,
// or its password/name refreshed, so the person running the server controls it.
async function ensureAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('Warning: ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin account will be available.');
    return;
  }
  let admin = await User.findOne({ email }).select('+password');
  if (admin && admin.role !== 'admin') {
    console.warn(`Warning: ${email} is already used by a ${admin.role} account; choose another ADMIN_EMAIL.`);
    return;
  }
  if (!admin) {
    admin = new User({ role: 'admin', emailVerified: true, email, password, name: process.env.ADMIN_NAME || 'Ecotrackify Admin', city: 'Head office' });
    await admin.save();
    console.log(`Admin account created for ${email}`);
    return;
  }
  admin.name = process.env.ADMIN_NAME || admin.name;
  admin.status = 'active';
  admin.emailVerified = true;
  if (!(await admin.comparePassword(password))) admin.password = password;
  await admin.save();
}

// Removes a community with its members, posts and challenges
async function deleteCommunity(communityId) {
  const challenges = await Challenge.find({ community: communityId }).select('_id');
  await Promise.all([
    Membership.deleteMany({ community: communityId }),
    Post.deleteMany({ community: communityId }),
    ChallengeParticipation.deleteMany({ challenge: { $in: challenges.map((c) => c._id) } }),
    Challenge.deleteMany({ community: communityId }),
  ]);
  await Community.deleteOne({ _id: communityId });
}

// Removes an account and everything that belongs to it
async function deleteAccount(user) {
  const owned = await Community.find({ owner: user._id }).select('_id');
  for (const c of owned) await deleteCommunity(c._id);
  const memberships = await Membership.find({ user: user._id, status: 'active' }).select('community');
  await Promise.all([
    Activity.deleteMany({ user: user._id }),
    Goal.deleteMany({ user: user._id }),
    ChallengeParticipation.deleteMany({ user: user._id }),
    Notification.deleteMany({ user: user._id }),
    Post.deleteMany({ author: user._id }),
    Post.updateMany({}, { $pull: { replies: { author: user._id }, likes: user._id } }),
    Membership.deleteMany({ user: user._id }),
    PersonalTip.deleteMany({ $or: [{ business: user._id }, { member: user._id }] }),
    PersonalTip.updateMany({}, { $pull: { replies: { author: user._id } } }),
    ...memberships.map((m) => Community.updateOne({ _id: m.community }, { $inc: { memberCount: -1 } })),
  ]);
  removeOldAvatar(user.avatarUrl);
  await User.deleteOne({ _id: user._id });
}

module.exports = { ensureAdmin, deleteAccount, deleteCommunity };
