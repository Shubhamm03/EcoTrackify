const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ApiError, asyncHandler } = require('../utils/helpers');

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Not authenticated. Please log in.');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Session expired or invalid. Please log in again.');
  }
  const user = await User.findById(payload.id);
  if (!user) throw new ApiError(401, 'Account no longer exists.');
  if (user.emailVerified === false) throw new ApiError(401, 'Please verify your email, then log in.');
  if (user.status === 'suspended') throw new ApiError(403, 'Your account has been suspended. Contact support@ecotrackify.app.');
  req.user = user;
  next();
});

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have access to this resource.'));
  next();
};

module.exports = { protect, requireRole };
