const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { ApiError } = require('../utils/helpers');

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => cb(null, `${req.user._id}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`),
});

const avatarUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(new ApiError(400, 'Profile photo must be a JPG, PNG or WebP image.'));
    cb(null, true);
  },
}).single('avatar');

// Wraps multer so its errors become friendly API errors
function handleAvatarUpload(req, res, next) {
  avatarUpload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new ApiError(400, 'Profile photo must be 2 MB or smaller.'));
    return next(err.status ? err : new ApiError(400, err.message));
  });
}

function removeOldAvatar(url) {
  if (!url || !url.startsWith('/uploads/avatars/')) return;
  const file = path.join(AVATAR_DIR, path.basename(url));
  fs.promises.unlink(file).catch(() => {});
}

module.exports = { handleAvatarUpload, removeOldAvatar };
