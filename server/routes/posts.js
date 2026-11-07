const express = require('express');
const mongoose = require('mongoose');
const Post = require('../models/Post');
const { notify } = require('../utils/notify');
const User = require('../models/User');
const Membership = require('../models/Membership');
const { checkContent } = require('../utils/moderation');
const { loadCommunity, requireMember } = require('../utils/communityAccess');
const { ApiError, asyncHandler } = require('../utils/helpers');

// Mounted at /api/communities/:id/posts (auth already applied by the parent router)
const router = express.Router({ mergeParams: true });

const CATEGORIES = ['transport', 'energy', 'waste', 'food', 'water', 'lifestyle', 'general'];
const REPORTS_TO_HIDE = 3;

const hasUser = (arr, userId) => arr.some((id) => String(id) === String(userId));

function shapePost(p, userId, isAdmin) {
  const author = p.author || {};
  return {
    _id: p._id,
    content: p.content,
    category: p.category,
    isAnnouncement: p.isAnnouncement,
    pinned: p.pinned,
    createdAt: p.createdAt,
    author: { _id: author._id, name: author._id ? User.displayNameOf(author) : 'Former member', avatarUrl: author.avatarUrl || '', isOrganisation: author.role === 'business' },
    likeCount: p.likes.length,
    liked: hasUser(p.likes, userId),
    canDelete: isAdmin || String(author._id) === String(userId),
    replies: p.replies.map((r) => ({
      _id: r._id,
      content: r.content,
      createdAt: r.createdAt,
      author: { _id: r.author?._id, name: r.author ? User.displayNameOf(r.author) : 'Former member', avatarUrl: r.author?.avatarUrl || '' },
      likeCount: r.likes.length,
      liked: hasUser(r.likes, userId),
      canDelete: isAdmin || String(r.author?._id) === String(userId),
    })),
  };
}

async function context(req) {
  const community = await loadCommunity(req.params.id);
  const membership = await requireMember(community._id, req.user);
  return { community, membership, isAdmin: membership.role === 'admin' };
}

async function loadPost(req, communityId) {
  if (!mongoose.isValidObjectId(req.params.postId)) throw new ApiError(404, 'Post not found.');
  const post = await Post.findOne({ _id: req.params.postId, community: communityId, hidden: false });
  if (!post) throw new ApiError(404, 'Post not found or already deleted.');
  return post;
}

const AUTHOR_FIELDS = 'name companyName role avatarUrl';
const populate = (q) => q.populate('author', AUTHOR_FIELDS).populate('replies.author', AUTHOR_FIELDS);

// GET /api/communities/:id/posts?page=&category=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { community, isAdmin } = await context(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 15;
    const filter = { community: community._id, hidden: false };
    if (CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
    const [posts, total] = await Promise.all([
      populate(Post.find(filter).sort({ pinned: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit)),
      Post.countDocuments(filter),
    ]);
    res.json({ posts: posts.map((p) => shapePost(p, req.user._id, isAdmin)), page, pages: Math.ceil(total / limit) || 1 });
  })
);

// POST /api/communities/:id/posts { content, category }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { community, isAdmin } = await context(req);
    const content = String(req.body.content || '').trim();
    if (content.length < 5) throw new ApiError(400, 'Write a little more (at least 5 characters).');
    if (content.length > 1000) throw new ApiError(400, 'Posts can be at most 1000 characters.');
    const verdict = checkContent(content);
    if (!verdict.ok) throw new ApiError(400, verdict.reason);
    const recent = await Post.countDocuments({ author: req.user._id, createdAt: { $gte: new Date(Date.now() - 3600000) } });
    if (recent >= 20) throw new ApiError(429, 'You are posting too fast. Try again later.');
    const post = await Post.create({
      community: community._id,
      author: req.user._id,
      content,
      category: CATEGORIES.includes(req.body.category) ? req.body.category : 'general',
    });
    const full = await populate(Post.findById(post._id));
    res.status(201).json({ post: shapePost(full, req.user._id, isAdmin) });
  })
);

// POST /api/communities/:id/posts/:postId/like — toggle
router.post(
  '/:postId/like',
  asyncHandler(async (req, res) => {
    const { community, isAdmin } = await context(req);
    const post = await loadPost(req, community._id);
    const liked = hasUser(post.likes, req.user._id);
    await Post.updateOne({ _id: post._id }, liked ? { $pull: { likes: req.user._id } } : { $addToSet: { likes: req.user._id } });
    if (!liked && String(post.author) !== String(req.user._id)) {
      notify(post.author, { type: 'social', title: `${User.displayNameOf(req.user)} liked your post`, message: post.content.slice(0, 100), link: `/communities/${community._id}` }).catch(() => {});
    }
    const full = await populate(Post.findById(post._id));
    res.json({ post: shapePost(full, req.user._id, isAdmin) });
  })
);

// POST /api/communities/:id/posts/:postId/replies { content }
router.post(
  '/:postId/replies',
  asyncHandler(async (req, res) => {
    const { community, isAdmin } = await context(req);
    const post = await loadPost(req, community._id);
    const content = String(req.body.content || '').trim();
    if (!content) throw new ApiError(400, 'Write a reply first.');
    if (content.length > 500) throw new ApiError(400, 'Replies can be at most 500 characters.');
    const verdict = checkContent(content);
    if (!verdict.ok) throw new ApiError(400, verdict.reason);
    if (post.replies.length >= 200) throw new ApiError(400, 'This post has reached the reply limit.');
    post.replies.push({ author: req.user._id, content });
    await post.save();
    if (String(post.author) !== String(req.user._id)) {
      notify(post.author, { type: 'social', title: `${User.displayNameOf(req.user)} replied to your post`, message: content.slice(0, 120), link: `/communities/${community._id}` }).catch(() => {});
    }
    const full = await populate(Post.findById(post._id));
    res.status(201).json({ post: shapePost(full, req.user._id, isAdmin) });
  })
);

// POST /api/communities/:id/posts/:postId/replies/:replyId/like — toggle
router.post(
  '/:postId/replies/:replyId/like',
  asyncHandler(async (req, res) => {
    const { community, isAdmin } = await context(req);
    const post = await loadPost(req, community._id);
    const reply = post.replies.id(req.params.replyId);
    if (!reply) throw new ApiError(404, 'Reply not found.');
    if (hasUser(reply.likes, req.user._id)) reply.likes.pull(req.user._id);
    else reply.likes.addToSet(req.user._id);
    await post.save();
    const full = await populate(Post.findById(post._id));
    res.json({ post: shapePost(full, req.user._id, isAdmin) });
  })
);

// DELETE /api/communities/:id/posts/:postId/replies/:replyId — author or admin
router.delete(
  '/:postId/replies/:replyId',
  asyncHandler(async (req, res) => {
    const { community, isAdmin } = await context(req);
    const post = await loadPost(req, community._id);
    const reply = post.replies.id(req.params.replyId);
    if (!reply) throw new ApiError(404, 'Reply not found.');
    if (!isAdmin && String(reply.author) !== String(req.user._id)) throw new ApiError(403, 'You can only delete your own replies.');
    reply.deleteOne();
    await post.save();
    const full = await populate(Post.findById(post._id));
    res.json({ post: shapePost(full, req.user._id, isAdmin) });
  })
);

// PUT /api/communities/:id/posts/:postId/pin { pinned } — admins only
router.put(
  '/:postId/pin',
  asyncHandler(async (req, res) => {
    const { community, isAdmin } = await context(req);
    if (!isAdmin) throw new ApiError(403, 'Only community admins can pin posts.');
    const post = await loadPost(req, community._id);
    post.pinned = Boolean(req.body.pinned);
    await post.save();
    res.json({ message: post.pinned ? 'Post pinned.' : 'Post unpinned.' });
  })
);

// POST /api/communities/:id/posts/:postId/report
router.post(
  '/:postId/report',
  asyncHandler(async (req, res) => {
    const { community } = await context(req);
    const post = await loadPost(req, community._id);
    post.reports.addToSet(req.user._id);
    if (post.reports.length >= REPORTS_TO_HIDE) post.hidden = true;
    await post.save();
    const admins = await Membership.find({ community: community._id, role: 'admin', status: 'active' }).select('user');
    await Promise.all(admins.map((a) => notify(a.user, { type: 'community', title: 'A post was reported', message: post.content.slice(0, 100), link: `/communities/${community._id}` })));
    res.json({ message: 'Thanks — the post has been reported to the admins.' });
  })
);

// DELETE /api/communities/:id/posts/:postId — author or admin
router.delete(
  '/:postId',
  asyncHandler(async (req, res) => {
    const { community, isAdmin } = await context(req);
    const post = await loadPost(req, community._id);
    if (!isAdmin && String(post.author) !== String(req.user._id)) throw new ApiError(403, 'You can only delete your own posts.');
    await post.deleteOne();
    res.json({ message: 'Post deleted.' });
  })
);

module.exports = router;
