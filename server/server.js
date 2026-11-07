require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const connectDB = require('./config/db');
const app = require('./app');
const Tip = require('./models/Tip');
const officialTips = require('./utils/officialTips');
const { ensureWeeklyChallenges } = require('./utils/challenges');
const { startScheduler } = require('./utils/scheduler');
const { ensureAdmin } = require('./utils/admin');
const { verifyEmailSetup } = require('./utils/email');

const PORT = process.env.PORT || 5000;

async function seedOfficialTips() {
  const count = await Tip.countDocuments({ isOfficial: true });
  if (count === 0) {
    await Tip.insertMany(officialTips.map((t) => ({ ...t, isOfficial: true })));
    console.log(`Seeded ${officialTips.length} official tips`);
  }
}

(async () => {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is missing. Create server/.env (copy server/.env.example) and set JWT_SECRET.');
    process.exit(1);
  }
  try {
    await connectDB(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ecotrackify');
    await seedOfficialTips();
    await ensureAdmin();
    await ensureWeeklyChallenges();
    startScheduler();
    verifyEmailSetup();
    app.listen(PORT, () => console.log(`Ecotrackify API running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
})();
