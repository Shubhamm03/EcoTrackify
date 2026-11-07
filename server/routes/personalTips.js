const express = require('express');
const PersonalTip = require('../models/PersonalTip');
const { protect } = require('../middleware/auth');
const { notify } = require('../utils/notify');
const { ApiError, asyncHandler } = require('../utils/helpers');
const { shapeTip } = require('../utils/personalTips');

// Personal tips seen by the member they were written for
const router = express.Router();
router.use(protect);

// GET /api/personal-tips — tips written to me by my organisations
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tips = await PersonalTip.find({ member: req.user._id }).sort({ updatedAt: -1 }).limit(30)
      .populate('business', 'companyName name avatarUrl role').populate('replies.author', 'name username companyName role avatarUrl').lean();
    res.json({ tips: tips.map((t) => shapeTip(t, req.user._id)) });
  })
);

// POST /api/personal-tips/:id/replies { content } — the member replies to the organisation
router.post(
  '/:id/replies',
  asyncHandler(async (req, res) => {
    const content = String(req.body.content || '').trim();
    if (content.length < 1) throw new ApiError(400, 'Write a reply first.');
    if (content.length > 1000) throw new ApiError(400, 'Replies can be at most 1000 characters.');
    const tip = await PersonalTip.findOne({ _id: req.params.id, member: req.user._id });
    if (!tip) throw new ApiError(404, 'Tip not found.');
    tip.replies.push({ author: req.user._id, content });
    tip.readByMember = true;
    await tip.save();
    await notify(tip.business, { type: 'tip', title: 'Reply to your personal tip', message: `${req.user.name || req.user.username} replied: "${content.slice(0, 120)}"`, link: '/business/members' });
    const full = await PersonalTip.findById(tip._id).populate('business', 'companyName name avatarUrl role').populate('replies.author', 'name username companyName role avatarUrl').lean();
    res.status(201).json({ tip: shapeTip(full, req.user._id) });
  })
);

module.exports = router;
