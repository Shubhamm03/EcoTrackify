const mongoose = require('mongoose');

const tipSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isOfficial: { type: Boolean, default: false },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    category: {
      type: String,
      enum: ['transport', 'energy', 'waste', 'food', 'water', 'lifestyle'],
      required: true,
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reports: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

tipSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Tip', tipSchema);
