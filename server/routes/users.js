const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { handleAvatarUpload, removeOldAvatar } = require('../middleware/upload');
const { getAchievements } = require('../utils/achievements');
const { deleteAccount } = require('../utils/admin');
const { ApiError, asyncHandler, PHONE_RE, USERNAME_RE, passwordProblem } = require('../utils/helpers');

const router = express.Router();
router.use(protect);
const { OPTIONS } = User;
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// PUT /api/users/me — update profile (fields depend on the account type)
router.put(
  '/me',
  asyncHandler(async (req, res) => {
    const b = req.body;
    const u = {};
    if (b.name !== undefined) {
      if (!str(b.name)) throw new ApiError(400, 'Name is required.');
      u.name = str(b.name, 60);
    }
    if (b.city !== undefined) {
      if (!str(b.city)) throw new ApiError(400, 'City is required.');
      u.city = str(b.city, 60);
    }
    if (b.country !== undefined) u.country = str(b.country, 60);

    if (req.user.role === 'business') {
      if (b.companyName !== undefined) {
        if (!str(b.companyName)) throw new ApiError(400, 'Company name is required.');
        u.companyName = str(b.companyName, 100);
      }
      if (b.phone !== undefined) {
        const phone = str(b.phone, 20).replace(/[\s-]/g, '');
        if (phone && !PHONE_RE.test(phone)) throw new ApiError(400, 'Enter a valid phone number or leave it empty.');
        u.phone = phone;
      }
      if (b.department !== undefined) u.department = str(b.department, 60);
      if (b.address !== undefined) u.address = str(b.address, 200);
      if (b.industry !== undefined) {
        if (b.industry && !OPTIONS.industries.includes(b.industry)) throw new ApiError(400, 'Choose a valid industry.');
        u.industry = b.industry;
      }
      if (b.companySize !== undefined) {
        if (b.companySize && !OPTIONS.sizes.includes(b.companySize)) throw new ApiError(400, 'Choose a valid company size.');
        u.companySize = b.companySize;
      }
      if (b.website !== undefined) {
        const w = str(b.website);
        if (w && !/^https?:\/\/\S+\.\S+/i.test(w)) throw new ApiError(400, 'Website must start with http:// or https://');
        u.website = w;
      }
      if (Array.isArray(b.focusAreas)) u.focusAreas = [...new Set(b.focusAreas.filter((x) => OPTIONS.focusAreas.includes(x)))];
    } else {
      if (b.username !== undefined) {
        const un = str(b.username, 20).toLowerCase();
        if (!USERNAME_RE.test(un)) throw new ApiError(400, 'Username must be 3-20 characters: lowercase letters, numbers or _.');
        if (await User.exists({ username: un, _id: { $ne: req.user._id } })) throw new ApiError(409, 'Username already exists.');
        u.username = un;
      }
      if (b.age !== undefined) {
        const age = Number(b.age);
        if (!Number.isInteger(age) || age < 13 || age > 120) throw new ApiError(400, 'Age must be between 13 and 120.');
        u.age = age;
      }
      if (b.gender !== undefined) {
        if (!['female', 'male', 'other', 'prefer_not'].includes(b.gender)) throw new ApiError(400, 'Choose a gender option.');
        u.gender = b.gender;
      }
      if (Array.isArray(b.interests)) u.interests = [...new Set(b.interests.filter((x) => OPTIONS.interests.includes(x)))];
      if (b.bio !== undefined) u.bio = str(b.bio, 200);
    }
    const user = await User.findByIdAndUpdate(req.user._id, u, { new: true, runValidators: true });
    res.json({ user });
  })
);

// POST /api/users/me/avatar — multipart form field "avatar"
router.post(
  '/me/avatar',
  handleAvatarUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'Choose an image to upload.');
    const url = `/uploads/avatars/${req.file.filename}`;
    removeOldAvatar(req.user.avatarUrl);
    const user = await User.findByIdAndUpdate(req.user._id, { avatarUrl: url }, { new: true });
    res.json({ user });
  })
);

// DELETE /api/users/me/avatar
router.delete(
  '/me/avatar',
  asyncHandler(async (req, res) => {
    removeOldAvatar(req.user.avatarUrl);
    const user = await User.findByIdAndUpdate(req.user._id, { avatarUrl: '' }, { new: true });
    res.json({ user });
  })
);

// PUT /api/users/me/password
router.put(
  '/me/password',
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword || ''))) throw new ApiError(400, 'Current password is incorrect.');
    const problem = passwordProblem(newPassword, { username: user.username, email: user.email, name: user.name });
    if (problem) throw new ApiError(400, problem);
    if (confirmPassword !== undefined && confirmPassword !== newPassword) throw new ApiError(400, 'Passwords do not match.');
    if (await user.comparePassword(newPassword)) throw new ApiError(400, 'New password must be different from the current one.');
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed.' });
  })
);

// PUT /api/users/me/notifications — customise notification settings
router.put(
  '/me/notifications',
  asyncHandler(async (req, res) => {
    const allowed = ['enabled', 'email', 'logReminders', 'goalUpdates', 'challengeUpdates', 'communityUpdates', 'socialUpdates'];
    const update = {};
    allowed.forEach((k) => {
      if (typeof req.body[k] === 'boolean') update[`notificationSettings.${k}`] = req.body[k];
    });
    if (req.body.reminderFrequencyDays != null) {
      const f = Number(req.body.reminderFrequencyDays);
      if (!Number.isInteger(f) || f < 1 || f > 14) throw new ApiError(400, 'Reminder frequency must be 1-14 days.');
      update['notificationSettings.reminderFrequencyDays'] = f;
    }
    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true });
    res.json({ user });
  })
);

// GET /api/users/me/achievements
router.get('/me/achievements', asyncHandler(async (req, res) => res.json(await getAchievements(req.user))));

// DELETE /api/users/me — delete your own account and its data.
// A business account also deletes the communities it runs (with their posts and challenges).
router.delete(
  '/me',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') throw new ApiError(400, 'The admin account is managed from the server settings.');
    await deleteAccount(req.user);
    res.json({ message: 'Account deleted.' });
  })
);

module.exports = router;
