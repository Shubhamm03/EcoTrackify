const mongoose = require('mongoose');

// A private tip from an organisation admin to one member. Only that member and the
// organisation can see it, and the member can reply (a small private thread).
const messageSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const personalTipSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    replies: [messageSchema],
    readByMember: { type: Boolean, default: false },
  },
  { timestamps: true }
);

personalTipSchema.index({ business: 1, member: 1, createdAt: -1 });

module.exports = mongoose.model('PersonalTip', personalTipSchema);
