const mongoose = require('mongoose');
const Community = require('../models/Community');
const Membership = require('../models/Membership');
const Activity = require('../models/Activity');
const { ApiError } = require('./helpers');
const { AVERAGE_PER_DAY } = require('./insights');

async function loadCommunity(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Community not found.');
  const community = await Community.findById(id);
  if (!community) throw new ApiError(404, 'Community not found.');
  return community;
}

async function activeMembership(communityId, userId) {
  return Membership.findOne({ community: communityId, user: userId, status: 'active' });
}

async function requireMember(communityId, user) {
  const m = await activeMembership(communityId, user._id);
  if (!m) throw new ApiError(403, 'Join this community to see this.');
  return m;
}

async function requireAdmin(communityId, user) {
  const m = await activeMembership(communityId, user._id);
  if (!m || m.role !== 'admin') throw new ApiError(403, 'Only community admins can do this.');
  return m;
}

const AVG_TOTAL = Object.values(AVERAGE_PER_DAY).reduce((a, b) => a + b, 0);

// 30-day CO2 totals per user (and per category) for a set of users
async function footprintsFor(userIds, days = 30) {
  if (!userIds.length) return new Map();
  const from = new Date(Date.now() - days * 86400000);
  const rows = await Activity.aggregate([
    { $match: { user: { $in: userIds.map((id) => new mongoose.Types.ObjectId(String(id))) }, date: { $gte: from } } },
    { $group: { _id: { u: '$user', c: '$category' }, kg: { $sum: '$co2Kg' }, first: { $min: '$date' } } },
  ]);
  const map = new Map();
  rows.forEach((r) => {
    const k = String(r._id.u);
    const cur = map.get(k) || { transport: 0, energy: 0, waste: 0, totalKg: 0, first: Date.now() };
    cur.first = Math.min(cur.first, new Date(r.first).getTime());
    cur[r._id.c] = Math.round(r.kg * 100) / 100;
    cur.totalKg = Math.round((cur.totalKg + r.kg) * 100) / 100;
    map.set(k, cur);
  });
  map.forEach((v) => {
    // Average over the days actually tracked, so new members are not judged on empty days
    const tracked = Math.min(days, Math.max(1, Math.round((Date.now() - v.first) / 86400000) + 1));
    delete v.first;
    const ratio = v.totalKg / tracked / AVG_TOTAL;
    v.level = ratio > 1.25 ? 'high' : ratio < 0.8 ? 'low' : 'average';
  });
  return map;
}

module.exports = { loadCommunity, activeMembership, requireMember, requireAdmin, footprintsFor };
