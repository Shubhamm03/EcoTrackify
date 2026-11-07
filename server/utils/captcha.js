const crypto = require('crypto');

// Simple self-hosted image captcha (no third-party service or API keys).
// The code is drawn as a distorted SVG; only a hash of the answer is kept in memory.
// Note: memory storage works for a single server. With several servers, move this
// store to MongoDB or Redis.
const TTL_MS = 5 * 60 * 1000;
const MAX_STORED = 10000;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to avoid confusion
const store = new Map(); // id -> { hash, expires }

const hash = (s) => crypto.createHash('sha256').update(String(s).trim().toUpperCase()).digest('hex');
const rand = (min, max) => min + Math.random() * (max - min);

function cleanup() {
  const now = Date.now();
  for (const [id, v] of store) if (v.expires < now) store.delete(id);
  while (store.size > MAX_STORED) store.delete(store.keys().next().value);
}

function drawSvg(text) {
  const w = 180;
  const h = 60;
  let lines = '';
  for (let i = 0; i < 6; i += 1) {
    lines += `<path d="M${rand(0, w).toFixed(1)} ${rand(0, h).toFixed(1)} Q${rand(0, w).toFixed(1)} ${rand(0, h).toFixed(1)} ${rand(0, w).toFixed(1)} ${rand(0, h).toFixed(1)}" stroke="hsl(${Math.floor(rand(90, 160))},40%,${Math.floor(rand(40, 65))}%)" stroke-width="${rand(1, 2.2).toFixed(1)}" fill="none"/>`;
  }
  let dots = '';
  for (let i = 0; i < 40; i += 1) dots += `<circle cx="${rand(0, w).toFixed(1)}" cy="${rand(0, h).toFixed(1)}" r="${rand(0.6, 1.6).toFixed(1)}" fill="#6b8f74"/>`;
  const letters = text.split('').map((ch, i) => {
    const x = 22 + i * 28 + rand(-3, 3);
    const y = 40 + rand(-6, 6);
    const rot = rand(-25, 25).toFixed(0);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})" font-family="Verdana,Arial,sans-serif" font-size="${Math.floor(rand(26, 32))}" font-weight="700" fill="hsl(${Math.floor(rand(100, 150))},55%,${Math.floor(rand(18, 32))}%)">${ch}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#eef8f0"/>${dots}${lines}${letters}</svg>`;
}

function create() {
  cleanup();
  const text = Array.from({ length: 5 }, () => CHARS[crypto.randomInt(CHARS.length)]).join('');
  const id = crypto.randomBytes(16).toString('hex');
  store.set(id, { hash: hash(text), expires: Date.now() + TTL_MS });
  const svg = drawSvg(text);
  return { captchaId: id, image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, expiresInSeconds: TTL_MS / 1000 };
}

// 'ok' | 'wrong' | 'expired'. Each captcha can be used only once.
function verify(id, answer) {
  const entry = id ? store.get(String(id)) : null;
  if (id) store.delete(String(id));
  if (!entry || entry.expires < Date.now()) return 'expired';
  return entry.hash === hash(answer || '') ? 'ok' : 'wrong';
}

module.exports = { create, verify };
