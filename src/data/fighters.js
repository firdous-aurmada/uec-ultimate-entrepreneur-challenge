// The default roster — original, fictional founders only.
// Each fighter: identity, palette, body styling, stats, and a signature special.

export const SPECIALS = {
  pitchdeck: {
    id: 'pitchdeck',
    name: 'PITCH DECK STRIKE',
    icon: '📊',
    type: 'projectile',
    desc: 'Launches a volley of three razor-sharp pitch slides across the arena.',
    dmg: 8, count: 3, speed: 560, interval: 0.14, startup: 0.16, recovery: 0.34,
  },
  burnrate: {
    id: 'burnrate',
    name: 'BURN RATE BLAST',
    icon: '🔥',
    type: 'aoe',
    desc: 'Torches the runway in a point-blank inferno. Slow, brutal, close-range.',
    dmg: 22, reach: 150, startup: 0.30, active: 0.16, recovery: 0.42, kb: 460, kbUp: -260,
  },
  pivot: {
    id: 'pivot',
    name: 'PIVOT PUNCH',
    icon: '🔄',
    type: 'teleport',
    desc: 'Vanishes mid-strategy and reappears behind you — fist first.',
    dmg: 16, startup: 0.12, active: 0.10, recovery: 0.30, kb: 340, kbUp: -160,
  },
  growthhack: {
    id: 'growthhack',
    name: 'GROWTH HACK',
    icon: '📈',
    type: 'rush',
    desc: 'Goes viral: a hockey-stick rush of multiplying hits across the screen.',
    dmg: 5, hits: 4, hitInterval: 0.11, speed: 640, startup: 0.14, duration: 0.5, recovery: 0.3, kb: 140,
  },
  fundinground: {
    id: 'fundinground',
    name: 'FUNDING ROUND',
    icon: '💰',
    type: 'rain',
    desc: 'Makes it rain a punishing round of gold — and pockets energy on every hit.',
    dmg: 7, count: 3, startup: 0.24, recovery: 0.4, energyRefund: 8,
  },
  takeover: {
    id: 'takeover',
    name: 'HOSTILE TAKEOVER',
    icon: '🦈',
    type: 'grab',
    desc: 'An unblockable seizure of assets at close range. Jump to escape it.',
    dmg: 20, reach: 118, startup: 0.20, recovery: 0.55, kb: 520, kbUp: -300,
  },
};

export const UNICORN_META = {
  name: 'UNICORN MODE',
  icon: '🦄',
  desc: 'Full meter: ascend to mythical valuation for 6s — +35% damage, +25% speed, no chip damage. Fabulous.',
};

// hair: 'ponytail' | 'cap' | 'neat' | 'puffs' | 'bob' | 'slick'
// outfit: 'blazer' | 'hoodie' | 'turtleneck' | 'bomber' | 'suit' | 'pinstripe'
export const FIGHTERS = [
  {
    id: 'ava', name: 'LIZBETH HOLMEZ', title: 'THE VISIONARY', company: 'THERAMOS',
    tagline: 'It works. Trust the vision. Do not test it.',
    special: 'pivot',
    stats: { speed: 1.0, power: 1.0, hp: 100 },
    ai: { aggr: 0.55, jump: 0.3, prefRange: 'far' },
    c: { skin: '#e8b48c', suit: '#5865f2', suit2: '#3d47c9', accent: '#29d9ff', hair: '#cfd6f6', pants: '#23294f', shoe: '#eef1ff' },
    hairStyle: 'ponytail', outfit: 'blazer', accessory: 'visor',
  },
  {
    id: 'max', name: 'ADAM WEUMANN', title: 'THE BURNER', company: 'WEWERK',
    tagline: 'Burned $47B, elevated consciousness, expensed both.',
    special: 'burnrate',
    stats: { speed: 0.95, power: 1.2, hp: 95 },
    ai: { aggr: 0.85, jump: 0.35, prefRange: 'close' },
    c: { skin: '#c68a5a', suit: '#ff7a1a', suit2: '#d15505', accent: '#ffd23f', hair: '#2b2b33', pants: '#33241d', shoe: '#f5f5f5' },
    hairStyle: 'cap', outfit: 'hoodie', accessory: 'stubble',
  },
  {
    id: 'kai', name: 'STEVE JOBZ', title: 'THE KEYNOTE', company: 'PEAR', 
    tagline: 'One more thing… it’s a fist.',
    special: 'pitchdeck',
    stats: { speed: 1.15, power: 0.9, hp: 95 },
    ai: { aggr: 0.6, jump: 0.55, prefRange: 'mid' },
    c: { skin: '#f0c896', suit: '#1fb9a5', suit2: '#128372', accent: '#eef1ff', hair: '#191a22', pants: '#20263f', shoe: '#dfe4ff' },
    hairStyle: 'neat', outfit: 'turtleneck', accessory: 'glasses',
  },
  {
    id: 'zara', name: 'KIM KOINDASHIAN', title: 'THE INFLUENCER', company: 'SKIMZCOIN',
    tagline: 'Broke the internet. Now breaking you.',
    special: 'growthhack',
    stats: { speed: 1.1, power: 0.95, hp: 95 },
    ai: { aggr: 0.75, jump: 0.5, prefRange: 'mid' },
    c: { skin: '#8a5a3b', suit: '#e332a9', suit2: '#a91277', accent: '#57ff8a', hair: '#1c1424', pants: '#2c1a3d', shoe: '#57ff8a' },
    hairStyle: 'puffs', outfit: 'bomber', accessory: 'earrings',
  },
  {
    id: 'eleanor', name: 'CATHIE WOODZ', title: 'THE BELIEVER', company: 'ARKK CAPITAL',
    tagline: 'Buys every dip. Including yours.',
    special: 'fundinground',
    stats: { speed: 0.9, power: 1.05, hp: 105 },
    ai: { aggr: 0.65, jump: 0.2, prefRange: 'far' },
    c: { skin: '#f2cdb2', suit: '#1c2a5e', suit2: '#111a3d', accent: '#ffd23f', hair: '#efe6d8', pants: '#141d42', shoe: '#1a1a24' },
    hairStyle: 'bob', outfit: 'suit', accessory: 'brooch',
  },
  {
    id: 'dex', name: 'CARL ICAHNT', title: 'THE RAIDER', company: 'ICAHNT HOLDINGS',
    tagline: 'Your board seat? Occupied.',
    special: 'takeover',
    stats: { speed: 0.85, power: 1.25, hp: 110 },
    ai: { aggr: 0.8, jump: 0.15, prefRange: 'close' },
    c: { skin: '#d9a06b', suit: '#2c2f3a', suit2: '#191b23', accent: '#ff3d6e', hair: '#101116', pants: '#22242e', shoe: '#101116' },
    hairStyle: 'slick', outfit: 'pinstripe', accessory: 'shades',
  },
  // ---- cameo tier: 100% parody, 0% affiliation ----
  {
    id: 'elo', name: 'ELO MA', title: 'THE TECHNOKING', company: 'SPACEY-X',
    tagline: 'Sells flamethrowers. Expenses them as "marketing".',
    special: 'burnrate',
    stats: { speed: 1.05, power: 1.15, hp: 100 },
    ai: { aggr: 0.82, jump: 0.4, prefRange: 'close' },
    c: { skin: '#eec9a6', suit: '#1a1c24', suit2: '#0e0f15', accent: '#ff3d2e', hair: '#2a2118', pants: '#1a1c24', shoe: '#c9ced9' },
    hairStyle: 'short', outfit: 'tee', accessory: null, cameo: true,
  },
  {
    id: 'bozo', name: 'JEFF BOZO', title: 'THE EVERYTHING GUY', company: 'PRIMEZON',
    tagline: 'Your margin is his entrance music.',
    special: 'takeover',
    stats: { speed: 0.9, power: 1.2, hp: 108 },
    ai: { aggr: 0.75, jump: 0.2, prefRange: 'close' },
    c: { skin: '#e2ab84', suit: '#243447', suit2: '#141f2c', accent: '#ff9d1a', hair: '#101116', pants: '#2c3644', shoe: '#3d4a5c' },
    hairStyle: 'bald', outfit: 'vest', accessory: 'shades', cameo: true,
  },
  {
    id: 'scam', name: 'SCAM ALT', title: 'THE ALIGNMENT GUY', company: 'CLOSEDAI',
    tagline: 'It’s a nonprofit. The profits are simply aligned.',
    special: 'pivot',
    stats: { speed: 1.1, power: 0.9, hp: 96 },
    ai: { aggr: 0.6, jump: 0.5, prefRange: 'mid' },
    c: { skin: '#ecc39e', suit: '#6d7382', suit2: '#4a4f5c', accent: '#29d9ff', hair: '#4a3527', pants: '#2c3040', shoe: '#f0f0f0' },
    hairStyle: 'curly', outfit: 'henley', accessory: null, cameo: true,
  },
];

export function getFighter(id) {
  return FIGHTERS.find(f => f.id === id) || FIGHTERS[0];
}

// Builds a fighter definition for a user profile (custom colors/special/photo).
export function buildCustomFighter(profile) {
  const base = getFighter(profile.baseId || 'ava');
  return {
    ...base,
    id: 'custom',
    name: (profile.name || 'YOU').toUpperCase(),
    title: 'CHALLENGER',
    company: (profile.company || 'STEALTH STARTUP').toUpperCase(),
    tagline: 'Player-founded. Player-funded.',
    special: profile.special || base.special,
    photo: profile.photo || null,
    c: { ...base.c, suit: profile.c1 || base.c.suit, suit2: shade(profile.c1 || base.c.suit, -28), accent: profile.c2 || base.c.accent },
  };
}

// Ghost fighter for an incoming challenge link.
export function buildGhostFighter(ch) {
  const base = getFighter(ch.f);
  return {
    ...base,
    id: 'ghost-' + base.id,
    name: (ch.n || 'RIVAL').toUpperCase(),
    company: (ch.co || 'RIVAL VENTURES').toUpperCase(),
    title: 'CHALLENGER',
    special: ch.sp && SPECIALS[ch.sp] ? ch.sp : base.special,
  };
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
