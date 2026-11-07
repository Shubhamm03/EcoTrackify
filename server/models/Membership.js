const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema(
  {
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    status: { type: String, enum: ['active', 'pending', 'banned'], default: 'active' },
    // Permission for other members / the admin to see this member's footprint
    shareFootprint: { type: Boolean, default: true },
  },
  { timestamps: true }
);

membershipSchema.index({ community: 1, user: 1 }, { unique: true });
membershipSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Membership', membershipSchema);
