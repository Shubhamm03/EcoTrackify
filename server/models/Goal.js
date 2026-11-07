const mongoose = require('mongoose');

// A goal is an emissions budget: "keep my <category> emissions under targetKg
// between startDate and endDate". baselineKg is what the user's recent habits
// would produce over the same period, used to show savings.
const goalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, enum: ['transport', 'energy', 'waste', 'overall'], required: true },
    targetKg: { type: Number, required: true, min: 0.01 },
    baselineKg: { type: Number, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'achieved', 'missed'], default: 'active' },
    completedAt: { type: Date, default: null },
    savedKg: { type: Number, default: 0 }, // CO2 saved vs baseline when achieved
    source: { type: String, enum: ['custom', 'suggested'], default: 'custom' },
    // Reminder flags so each "almost there" notification is sent only once
    budgetWarned: { type: Boolean, default: false }, // 80% of the budget used
    endingNotified: { type: Boolean, default: false }, // 3 days or less left
  },
  { timestamps: true }
);

module.exports = mongoose.model('Goal', goalSchema);
