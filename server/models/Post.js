const mongoose = require('mongoose');

const replySchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 500 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    category: {
      type: String,
      enum: ['transport', 'energy', 'waste', 'food', 'water', 'lifestyle', 'general'],
      default: 'general',
    },
    isAnnouncement: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    replies: [replySchema],
    reports: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

postSchema.index({ community: 1, pinned: -1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
