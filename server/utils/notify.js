const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendEmail } = require('./email');

const SETTING_FOR_TYPE = {
  reminder: 'logReminders',
  goal: 'goalUpdates',
  challenge: 'challengeUpdates',
  achievement: 'goalUpdates',
  insight: 'goalUpdates',
  community: 'communityUpdates',
  social: 'socialUpdates',
};

// Creates an in-app notification (and optionally an email) while respecting the
// user's notification settings. `force` is for account/system messages.
async function notify(userOrId, { type = 'system', title, message, link = '' }, { force = false } = {}) {
  const user = userOrId && userOrId.notificationSettings ? userOrId : await User.findById(userOrId);
  if (!user) return null;
  const s = user.notificationSettings || {};
  const settingKey = SETTING_FOR_TYPE[type];
  if (!force && (s.enabled === false || (settingKey && s[settingKey] === false))) return null;

  const n = await Notification.create({ user: user._id, type, title, message, link });
  if (s.enabled !== false && s.email) {
    sendEmail({ to: user.email, subject: `Ecotrackify: ${title}`, text: message });
  }
  return n;
}

module.exports = { notify };
