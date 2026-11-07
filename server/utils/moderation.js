// Lightweight content filter for community tips. Swap for a proper moderation
// service in production; this blocks obvious abuse, spam and links-only posts.
const BLOCKED_WORDS = [
  'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cunt', 'slut', 'whore',
  'nigger', 'faggot', 'retard', 'kill yourself', 'kys', 'porn', 'xxx', 'casino',
  'viagra', 'crypto giveaway', 'onlyfans',
];

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

function checkContent(...parts) {
  const raw = parts.join(' ');
  const text = ` ${normalize(raw)} `;
  for (const w of BLOCKED_WORDS) {
    if (text.includes(` ${w} `) || text.includes(` ${w}s `)) {
      return { ok: false, reason: 'Your tip contains language that is not allowed in the community.' };
    }
  }
  const links = (raw.match(/https?:\/\//gi) || []).length;
  if (links > 2) return { ok: false, reason: 'Tips can include at most 2 links.' };
  if (/(.)\1{9,}/.test(raw)) return { ok: false, reason: 'Your tip looks like spam.' };
  const letters = raw.replace(/[^A-Za-z]/g, '');
  if (letters.length > 20 && letters === letters.toUpperCase()) {
    return { ok: false, reason: 'Please avoid writing your tip in all caps.' };
  }
  return { ok: true };
}

module.exports = { checkContent };
