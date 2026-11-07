const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const Membership = require('../models/Membership');
const User = require('../models/User');
const { EMISSION_FACTORS, BUSINESS_FACTORS } = require('../config/emissionFactors');
const { notify } = require('./notify');

// Reference emissions, kg CO2e per day (approximate Indian urban averages)
const AVERAGE_PER_DAY = { transport: 1.6, energy: 2.4, waste: 0.6 }; // per person
const OFFICE_AVERAGE_PER_DAY = { transport: 0.8, energy: 1.5, waste: 0.25 }; // per employee
const EMPLOYEES_FOR_SIZE = { '1-10': 5, '11-50': 30, '51-200': 125, '201-500': 350, '501-1000': 750, '1000+': 1500 };
const DAYS = 30;
const LABEL = { transport: 'Transport', energy: 'Energy', waste: 'Waste' };
const CUT_PERCENT = { high: 20, average: 10, low: 5, unknown: 10 };
const MONTHLY_FLOOR = { transport: 3, energy: 9, waste: 1.5 }; // smallest realistic monthly budget

const TIPS = {
  transport: {
    high: ['Switch 3 car or cab trips a week to metro or bus.', 'Car-pool with colleagues or classmates on your route.', 'Combine errands into one trip.', 'Cycle or walk trips under 3 km.'],
    average: ['Try one car-free day every week.', 'Cycle or walk short trips.', 'Keep tyres inflated and drive smoothly.'],
    low: ['You are already low. Try a fully car-free week.', 'Help a friend plan a metro or bus commute.', 'Choose trains over short flights.'],
  },
  energy: {
    high: ['Set the AC to 25°C and use a ceiling fan with it.', 'Turn appliances off at the wall at night.', 'Replace old bulbs with LEDs.', 'Use a pressure cooker and lids to save gas.'],
    average: ['Run washing machines only when full, on cold.', 'Dry clothes on a line.', 'Check BEE star ratings before buying appliances.'],
    low: ['You are already efficient. Look into rooftop solar.', 'Share your energy habits with your community.', 'Try a "no AC" day each week.'],
  },
  waste: {
    high: ['Avoid single-use plastic: carry a bag, bottle and cup.', 'Segregate wet and dry waste.', 'Plan meals and use leftovers first.'],
    average: ['Start composting kitchen scraps.', 'Buy in bulk to cut packaging.', 'Repair before you replace.'],
    low: ['Try a zero-waste week.', 'Organise an e-waste drive in your community.', 'Teach a neighbour to compost.'],
  },
};
const BUSINESS_TIPS = {
  transport: {
    high: ['Start an office car-pool or shuttle programme.', 'Replace short business flights with train or video calls.', 'Plan delivery routes to cut fleet kilometres.'],
    average: ['Offer a cycle-to-work scheme.', 'Move one fleet vehicle to electric.'],
    low: ['Publish your low-travel policy to inspire partners.', 'Set an EV target for the remaining fleet.'],
  },
  energy: {
    high: ['Set office ACs to 25°C and switch off after hours.', 'Install motion-sensor lighting in common areas.', 'Service HVAC units to keep them efficient.'],
    average: ['Shut down PCs and screens at night with a policy.', 'Track electricity per floor to find waste.'],
    low: ['Add rooftop solar or a green power plan.', 'Share your energy practices with other businesses.'],
  },
  waste: {
    high: ['Remove single-use cups and bottles from the office.', 'Put segregation bins on every floor.', 'Go paperless for invoices and approvals.'],
    average: ['Partner with an authorised e-waste recycler.', 'Compost canteen food waste.'],
    low: ['Aim for zero-waste-to-landfill certification.', 'Run a supplier packaging-reduction drive.'],
  },
};

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const levelFor = (ratio) => (ratio == null ? 'unknown' : ratio > 1.25 ? 'high' : ratio < 0.8 ? 'low' : 'average');
const oid = (id) => new mongoose.Types.ObjectId(String(id));

async function recentRows(userIds) {
  const from = new Date(Date.now() - DAYS * 86400000);
  return Activity.aggregate([
    { $match: { user: { $in: userIds.map(oid) }, date: { $gte: from } } },
    { $group: { _id: { u: '$user', c: '$category', t: '$type' }, kg: { $sum: '$co2Kg' }, qty: { $sum: '$quantity' }, first: { $min: '$date' } } },
  ]);
}

// Days since the first log in the window (max 30) — new users are not judged on 30 empty days
function trackedDays(rows) {
  if (!rows.length) return 0;
  const first = Math.min(...rows.map((r) => new Date(r.first).getTime()));
  return Math.min(DAYS, Math.max(1, Math.round((Date.now() - first) / 86400000) + 1));
}

function specificTip(category, rows, factors) {
  const by = {};
  rows.filter((r) => r._id.c === category).forEach((r) => {
    by[r._id.t] = by[r._id.t] || { kg: 0, qty: 0 };
    by[r._id.t].kg += r.kg;
    by[r._id.t].qty += r.qty;
  });
  const top = Object.entries(by).sort((a, b) => b[1].kg - a[1].kg)[0];
  if (!top || top[1].kg <= 0) return null;
  const [type, { kg, qty }] = top;
  const def = factors[category][type];
  const label = def ? def.label.toLowerCase() : type;
  if (category === 'transport' && def && def.factor > 0.1) {
    return `Your ${label} travel produced ${round(kg, 1)} kg CO₂ recently. Moving 40% of those km to metro or bus would save about ${round(qty * 0.4 * (def.factor - 0.041), 1)} kg.`;
  }
  if (category === 'energy' && type === 'electricity') {
    return `Electricity produced ${round(kg, 1)} kg CO₂ recently. Cutting use by 15% saves about ${round(kg * 0.15, 1)} kg.`;
  }
  if (category === 'waste' && ['plastic', 'landfill', 'food_waste', 'ewaste'].includes(type)) {
    return `${def.label} produced ${round(kg, 1)} kg CO₂. Recycling or composting half would save about ${round(kg * 0.45, 1)} kg.`;
  }
  return `Your biggest ${LABEL[category].toLowerCase()} source is ${label} (${round(kg, 1)} kg CO₂).`;
}

// perDay is per person (or per employee); scale converts back to what the account logs
function buildCategoryInsight(category, perDay, { scale = 1, tips = TIPS, average = AVERAGE_PER_DAY, who = '', specific = null } = {}) {
  const ratio = perDay == null ? null : perDay / average[category];
  const level = levelFor(ratio);
  const monthly = (perDay == null ? average[category] : perDay) * DAYS * scale;
  const cut = CUT_PERCENT[level];
  const floor = MONTHLY_FLOOR[category];
  const cutTarget = Math.max(monthly * (1 - cut / 100), floor);
  const savingKg = Math.max(0, monthly - cutTarget);
  const list = [...tips[category][level === 'unknown' ? 'average' : level]];
  if (specific) list.unshift(specific);
  const L = LABEL[category];
  let headline;
  if (level === 'unknown') headline = `Log some ${L.toLowerCase()} activities to get advice.`;
  else if (level === 'high') headline = `${L} is ${round(ratio, 1)}× the average${who}. Reduce this first.`;
  else if (level === 'low') headline = `${L} is below average${who}. Great work — here are next steps.`;
  else headline = `${L} is around average${who}. Small changes will push it lower.`;

  const goals = [{
    title: savingKg > 0 ? `Cut ${L.toLowerCase()} emissions by ${cut}% this month` : `Keep ${L.toLowerCase()} under ${round(cutTarget, 1)} kg this month`,
    category,
    days: DAYS,
    targetKg: round(cutTarget, 1),
    savingKg: round(savingKg, 1),
  }];
  // Already low? Offer a more ambitious, advanced goal as well
  if (level === 'low') {
    const adv = Math.max(floor, Math.min(average[category] * DAYS * scale * 0.7, monthly * 0.85));
    if (adv < cutTarget) {
      goals.push({ title: `Advanced: cut ${L.toLowerCase()} a further 15% this month`, category, days: DAYS, targetKg: round(adv, 1), savingKg: round(Math.max(0, monthly - adv), 1), advanced: true });
    }
  }
  return {
    category,
    label: L,
    perDayKg: perDay == null ? null : round(perDay),
    averagePerDayKg: average[category],
    ratio: ratio == null ? null : round(ratio),
    level,
    headline,
    tips: list.slice(0, 4),
    suggestedGoals: goals,
  };
}

function summarise(categories, priority = {}) {
  const known = categories.filter((c) => c.level !== 'unknown');
  const worst = known.slice().sort((a, b) => b.ratio - a.ratio || (priority[b.category] || 0) - (priority[a.category] || 0))[0] || null;
  const totalPerDay = known.reduce((a, c) => a + c.perDayKg, 0);
  return { worst: worst ? worst.category : null, totalPerDayKg: round(totalPerDay) };
}

// ---------- Personal (individual) or organisation (business) insights ----------
async function personalInsights(user) {
  const isBusiness = user.role === 'business';
  const rows = await recentRows([user._id]);
  const days = trackedDays(rows);
  const employees = isBusiness ? EMPLOYEES_FOR_SIZE[user.companySize] || 10 : 1;
  const factors = isBusiness ? BUSINESS_FACTORS : EMISSION_FACTORS;
  const opts = (cat) => ({
    scale: isBusiness ? employees : 1,
    tips: isBusiness ? BUSINESS_TIPS : TIPS,
    average: isBusiness ? OFFICE_AVERAGE_PER_DAY : AVERAGE_PER_DAY,
    who: isBusiness ? ' per employee' : '',
  });
  const categories = ['transport', 'energy', 'waste'].map((cat) => {
    const o = opts(cat);
    if (!rows.some((r) => r._id.c === cat)) return buildCategoryInsight(cat, null, o);
    const total = rows.filter((r) => r._id.c === cat).reduce((a, r) => a + r.kg, 0);
    return buildCategoryInsight(cat, total / o.scale / days, { ...o, specific: specificTip(cat, rows, factors) });
  });
  // Interests chosen at registration break ties between equally high sources
  const interests = user.interests || [];
  const priority = { transport: interests.includes('transport') ? 1 : 0, energy: interests.includes('energy') ? 1 : 0, waste: interests.includes('waste') ? 1 : 0 };
  const summary = summarise(categories, priority);
  const average = isBusiness ? OFFICE_AVERAGE_PER_DAY : AVERAGE_PER_DAY;
  const avgTotal = Object.values(average).reduce((a, b) => a + b, 0);
  const known = categories.filter((c) => c.level !== 'unknown');
  let starterTip = null;
  if (!rows.length) {
    const focus = interests.filter((k) => LABEL[k]).map((k) => LABEL[k].toLowerCase());
    starterTip = isBusiness
      ? 'Log office electricity, fleet travel and waste to get tips for your organisation.'
      : focus.length
        ? `You said you care about ${focus.join(' and ')}. Log those activities first and we'll tell you what to reduce.`
        : 'Log a few activities and we will tell you which source to reduce first.';
  }
  return {
    scope: isBusiness ? 'organisation' : 'personal',
    days,
    employees: isBusiness ? employees : undefined,
    averageTotalPerDayKg: round(avgTotal),
    overallLevel: known.length ? levelFor(summary.totalPerDayKg / avgTotal) : 'unknown',
    allLowOrUnknown: known.length > 0 && known.every((c) => c.level === 'low'),
    starterTip,
    ...summary,
    categories,
  };
}

// ---------- Community: individual members who share their footprint ----------
async function communityInsights(communityId) {
  const ms = await Membership.find({ community: communityId, status: 'active', shareFootprint: true }).populate('user', 'role').lean();
  const people = ms.map((m) => m.user).filter((u) => u && u.role !== 'business');
  if (!people.length) return { scope: 'community', membersCounted: 0, categories: [] };
  const rows = await recentRows(people.map((u) => u._id));
  const per = { transport: 0, energy: 0, waste: 0 };
  let counted = 0;
  people.forEach((u) => {
    const mine = rows.filter((r) => String(r._id.u) === String(u._id));
    if (!mine.length) return;
    counted += 1;
    const d = trackedDays(mine);
    mine.forEach((r) => { per[r._id.c] += r.kg / d; });
  });
  if (!counted) return { scope: 'community', membersCounted: 0, categories: [] };
  const categories = ['transport', 'energy', 'waste'].map((cat) => buildCategoryInsight(cat, per[cat] / counted, { who: ' per member' }));
  return { scope: 'community', days: DAYS, membersCounted: counted, ...summarise(categories), categories };
}

// Notify an individual (at most once a week) when one of their sources is high
async function maybeAlertHighEmissions(user) {
  if (user.role === 'business') return;
  if (user.lastInsightAlertAt && Date.now() - user.lastInsightAlertAt < 7 * 86400000) return;
  const ins = await personalInsights(user);
  const worst = ins.categories.find((c) => c.category === ins.worst);
  if (!worst || worst.level !== 'high' || ins.days < 2) return;
  const sent = await notify(user, { type: 'insight', title: `${worst.label} emissions are high`, message: `${worst.headline} Tip: ${worst.tips[0]}`, link: '/goals' });
  if (sent) await User.updateOne({ _id: user._id }, { lastInsightAlertAt: new Date() });
}

module.exports = { personalInsights, communityInsights, maybeAlertHighEmissions, AVERAGE_PER_DAY, OFFICE_AVERAGE_PER_DAY };
