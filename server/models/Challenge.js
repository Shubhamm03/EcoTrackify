const mongoose = require('mongoose');

// A weekly green challenge, e.g. "Avoid single-use plastic".
// Participants check in once per day; each check-in earns pointsPerCheckIn and
// reaching targetDays check-ins earns the completion bonus.
const challengeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 500 },
    icon: { type: String, default: 'leaf' },
    category: { type: String, default: 'lifestyle' },
    weekStart: { type: Date, required: true, index: true },
    weekEnd: { type: Date, required: true },
    targetDays: { type: Number, default: 7, min: 1, max: 7 }, // always 7: one check-in per day, Mon–Sun
    pointsPerCheckIn: { type: Number, default: 10 },
    completionBonus: { type: Number, default: 50 },
    templateKey: { type: String, default: null },
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

challengeSchema.index({ weekStart: 1, templateKey: 1 });

module.exports = mongoose.model('Challenge', challengeSchema);
