const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: ['transport', 'energy', 'waste'], required: true },
    type: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    co2Kg: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    note: { type: String, maxlength: 200, default: '' },
  },
  { timestamps: true }
);

activitySchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('Activity', activitySchema);
