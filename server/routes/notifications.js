const express = require('express');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

// GET /api/notifications
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [items, unread] = await Promise.all([
      Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean(),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({ items, unread });
  })
);

// GET /api/notifications/unread-count
router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    res.json({ unread: await Notification.countDocuments({ user: req.user._id, read: false }) });
  })
);

// PUT /api/notifications/read-all
router.put(
  '/read-all',
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read.' });
  })
);

// PUT /api/notifications/:id/read
router.put(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
    res.json({ message: 'Marked as read.' });
  })
);

// DELETE /api/notifications/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Deleted.' });
  })
);

module.exports = router;
