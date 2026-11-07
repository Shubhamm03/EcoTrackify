const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Options shown in the registration forms (kept here so API validation and UI agree)
const OPTIONS = {
  interests: ['carbon', 'living', 'energy', 'transport', 'waste', 'water', 'community', 'education', 'food'],
  initialGoals: ['reduce', 'lifestyle', 'community'],
  focusAreas: ['energy', 'waste', 'transport', 'supply', 'employees', 'reporting', 'resources', 'other'],
  orgTypes: ['Company', 'College / University', 'School', 'NGO / Non-profit', 'Residential society', 'City / Government body', 'Other'],
  industries: ['IT / Software', 'Manufacturing', 'Education', 'Healthcare', 'Retail', 'Finance', 'Hospitality', 'Logistics', 'Construction', 'NGO / Non-profit', 'Government', 'Other'],
  sizes: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
};

const notificationSettingsSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    logReminders: { type: Boolean, default: true },
    goalUpdates: { type: Boolean, default: true },
    challengeUpdates: { type: Boolean, default: true },
    communityUpdates: { type: Boolean, default: true },
    socialUpdates: { type: Boolean, default: true },
    reminderFrequencyDays: { type: Number, default: 3, min: 1, max: 14 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // 'admin' accounts are never registered: one is created from ADMIN_EMAIL / ADMIN_PASSWORD in .env
    role: { type: String, enum: ['user', 'business', 'admin'], default: 'user' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    suspendedReason: { type: String, maxlength: 300, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    // Individual: full name. Business: the administrator / contact person.
    name: { type: String, required: true, trim: true, maxlength: 60 },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    country: { type: String, trim: true, maxlength: 60, default: '' },
    avatarUrl: { type: String, default: '' },

    // ---- Individual accounts ----
    username: { type: String, lowercase: true, trim: true, maxlength: 20, unique: true, sparse: true },
    interests: [{ type: String, enum: OPTIONS.interests }],
    initialGoal: { type: String, enum: ['', ...OPTIONS.initialGoals], default: '' },
    age: { type: Number, min: 13, max: 120 },
    gender: { type: String, enum: ['', 'female', 'male', 'other', 'prefer_not'], default: '' },
    bio: { type: String, trim: true, maxlength: 200, default: '' },

    // ---- Business accounts ----
    companyName: { type: String, trim: true, maxlength: 100, default: '' },
    orgType: { type: String, default: '' },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    department: { type: String, trim: true, maxlength: 60, default: '' },
    address: { type: String, trim: true, maxlength: 200, default: '' },
    industry: { type: String, default: '' },
    companySize: { type: String, enum: ['', ...OPTIONS.sizes], default: '' },
    website: { type: String, trim: true, maxlength: 200, default: '' },
    focusAreas: [{ type: String, enum: OPTIONS.focusAreas }],

    totalPoints: { type: Number, default: 0 },
    notificationSettings: { type: notificationSettingsSchema, default: () => ({}) },
    lastReminderAt: { type: Date, default: null },
    lastInsightAlertAt: { type: Date, default: null },
    // Email verification with a 6-digit code (only a hash of the code is stored)
    // New sign-ups are created with false; accounts made before verification existed count as verified
    emailVerified: { type: Boolean, default: true },
    otpHash: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
    otpSentAt: { type: Date, select: false },
    // Invitation code typed at registration; used once the email is verified
    pendingInviteCode: { type: String, default: '', select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// The name other people see: the company for business accounts, the person otherwise
userSchema.virtual('displayName').get(function displayName() {
  if (this.role === 'admin') return 'Ecotrackify Admin';
  return this.role === 'business' ? this.companyName || this.name : this.name;
});

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.otpHash;
  delete obj.otpExpires;
  delete obj.otpAttempts;
  delete obj.otpSentAt;
  delete obj.pendingInviteCode;
  delete obj.__v;
  delete obj.id;
  return obj;
};

const User = mongoose.model('User', userSchema);
User.OPTIONS = OPTIONS;
// Same rule for plain objects returned by .lean() / populate
User.displayNameOf = (u) => (!u ? 'Former member' : u.role === 'admin' ? 'Ecotrackify Admin' : u.role === 'business' ? u.companyName || u.name : u.name);
module.exports = User;
