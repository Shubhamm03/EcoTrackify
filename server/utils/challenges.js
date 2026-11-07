// Every challenge runs one week, Monday to Sunday. Check in on all 7 days to complete it:
// 10 points per check-in plus a completion bonus.
const WEEK_DAYS = 7;
const COMPLETION_BONUS = 50;
const Challenge = require('../models/Challenge');
const { startOfWeek, endOfWeek } = require('./helpers');

const CHALLENGE_TEMPLATES = [
  { key: 'no-single-use-plastic', icon: 'bag', category: 'waste', title: 'Avoid single-use plastic', description: 'Carry your own bag, bottle and cup. No plastic straws, cutlery or carry bags for the day.' },
  { key: 'car-free-commute', icon: 'bike', category: 'transport', title: 'Car-free commute', description: 'Walk, cycle, or take public transport instead of a private car or cab.' },
  { key: 'meatless-day', icon: 'salad', category: 'food', title: 'Plant-based meals', description: 'Eat only plant-based meals for the day.' },
  { key: 'unplug-standby', icon: 'plug', category: 'energy', title: 'Unplug standby devices', description: 'Switch off chargers, TVs and appliances at the wall before bed.' },
  { key: 'short-showers', icon: 'droplet', category: 'water', title: '5-minute showers', description: 'Keep every shower under five minutes.' },
  { key: 'zero-food-waste', icon: 'apple', category: 'waste', title: 'Zero food waste', description: 'Plan portions, store leftovers and compost scraps — nothing edible goes in the bin.' },
  { key: 'no-ac-hour', icon: 'wind', category: 'energy', title: 'Fan over AC', description: 'Use a fan or natural ventilation instead of the AC (or set the AC to 26°C or higher).' },
  { key: 'local-produce', icon: 'basket', category: 'food', title: 'Buy local & seasonal', description: 'Choose locally grown, seasonal produce for your groceries today.' },
  { key: 'digital-declutter', icon: 'mail', category: 'energy', title: 'Digital declutter', description: 'Delete 50 old emails/files and unsubscribe from newsletters you never read.' },
  { key: 'segregate-waste', icon: 'recycle', category: 'waste', title: 'Segregate your waste', description: 'Separate wet, dry and recyclable waste at home every day.' },
];

const PER_WEEK = 4;

function weekIndex(date) {
  return Math.floor(startOfWeek(date).getTime() / (7 * 86400000));
}

// Idempotently makes sure the global challenges for the given week exist.
// Picks PER_WEEK templates, rotating through the list week by week.
async function ensureWeeklyChallenges(date = new Date()) {
  const weekStart = startOfWeek(date);
  const weekEnd = endOfWeek(date);
  const idx = weekIndex(date);
  const picks = [];
  for (let i = 0; i < PER_WEEK; i += 1) {
    picks.push(CHALLENGE_TEMPLATES[(idx * PER_WEEK + i) % CHALLENGE_TEMPLATES.length]);
  }
  // Always keep the flagship plastic challenge in rotation
  if (!picks.find((p) => p.key === 'no-single-use-plastic')) picks[0] = CHALLENGE_TEMPLATES[0];

  for (const t of picks) {
    await Challenge.updateOne(
      { weekStart, templateKey: t.key, community: null },
      {
        $setOnInsert: {
          title: t.title,
          description: t.description,
          icon: t.icon,
          category: t.category,
          targetDays: WEEK_DAYS,
          weekEnd,
          pointsPerCheckIn: 10,
          completionBonus: COMPLETION_BONUS,
        },
      },
      { upsert: true }
    );
  }
  // Older challenges created with fewer days are brought to the full week
  await Challenge.updateMany({ weekStart, targetDays: { $ne: WEEK_DAYS } }, { $set: { targetDays: WEEK_DAYS, completionBonus: COMPLETION_BONUS } });
}

module.exports = { WEEK_DAYS, COMPLETION_BONUS, CHALLENGE_TEMPLATES, ensureWeeklyChallenges };
