const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 500, default: '' },
    url: { type: String, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

// A community is created and administered by a Business account (User Story 7).
// Individual users join it, share tips, and (with permission) share footprints.
const communitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    type: { type: String, enum: ['company', 'college', 'city', 'interest', 'society', 'ngo'], default: 'company' },
    icon: { type: String, default: '', maxlength: 20 },
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    city: { type: String, trim: true, maxlength: 60, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    inviteCode: { type: String, required: true, unique: true },
    resources: [resourceSchema],
    memberCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

communitySchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Community', communitySchema);
