const mongoose = require('mongoose');

const participationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    challenge: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
    weekStart: { type: Date, required: true },
    checkIns: [{ type: String }], // 'YYYY-MM-DD' strings so one check-in per day
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    points: { type: Number, default: 0 },
  },
  { timestamps: true }
);

participationSchema.index({ user: 1, challenge: 1 }, { unique: true });
participationSchema.index({ weekStart: 1, points: -1 });

module.exports = mongoose.model('ChallengeParticipation', participationSchema);
