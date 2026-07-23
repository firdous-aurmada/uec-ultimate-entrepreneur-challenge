// The default roster — original, fictional founders only.
// Each fighter: identity, palette, body styling, stats, and a signature special.
//
// Roster stats vary on purpose, but ONLY ever as AI opponents. Human players
// always get PLAYER_STATS, so nobody gains an edge from a cosmetic pick.

import { PLAYER_STATS } from '../config.js';

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
    id: 'kai', name: 'STEVE NOJOBS', title: 'THE KEYNOTE', company: 'PEAR',
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

// ---- BASE CHARACTERS ----------------------------------------------------
// Generic, unbranded silhouettes for the "build your fighter" flow. These are
// the bodies players pick from (NOT the famous-founder roster). Varied skin
// tones, hairstyles and outfits so everyone finds a starting point that fits.
export const BASE_CHARACTERS = [
  { id: 'b-neo',   name: 'THE FOUNDER',   base: true, special: 'pitchdeck',
    stats: { speed: 1.0, power: 1.0, hp: 100 }, ai: { aggr: 0.6, jump: 0.35, prefRange: 'mid' },
    c: { skin: '#f0c896', suit: '#5865f2', suit2: '#3d47c9', accent: '#29d9ff', hair: '#2a2320', pants: '#23294f', shoe: '#eef1ff' },
    hairStyle: 'neat', outfit: 'blazer', accessory: 'glasses' },
  { id: 'b-hack',  name: 'THE HACKER',    base: true, special: 'growthhack',
    stats: { speed: 1.15, power: 0.9, hp: 95 }, ai: { aggr: 0.7, jump: 0.5, prefRange: 'mid' },
    c: { skin: '#e8b48c', suit: '#2ee66b', suit2: '#1a9c46', accent: '#0b0e1a', hair: '#191a22', pants: '#20242f', shoe: '#d9ffe6' },
    hairStyle: 'ponytail', outfit: 'hoodie', accessory: null },
  { id: 'b-growth', name: 'THE OPERATOR',  base: true, special: 'fundinground',
    stats: { speed: 1.05, power: 1.0, hp: 100 }, ai: { aggr: 0.72, jump: 0.4, prefRange: 'mid' },
    c: { skin: '#8a5a3b', suit: '#e332a9', suit2: '#a91277', accent: '#ffd23f', hair: '#1c1424', pants: '#2c1a3d', shoe: '#ffd23f' },
    hairStyle: 'puffs', outfit: 'bomber', accessory: 'earrings' },
  { id: 'b-closer', name: 'THE CLOSER',    base: true, special: 'takeover',
    stats: { speed: 0.9, power: 1.2, hp: 108 }, ai: { aggr: 0.8, jump: 0.18, prefRange: 'close' },
    c: { skin: '#d9a06b', suit: '#1c2a5e', suit2: '#111a3d', accent: '#ff3d6e', hair: '#101116', pants: '#141d42', shoe: '#101116' },
    hairStyle: 'slick', outfit: 'pinstripe', accessory: 'shades' },
  { id: 'b-design', name: 'THE DESIGNER',  base: true, special: 'pivot',
    stats: { speed: 1.1, power: 0.95, hp: 96 }, ai: { aggr: 0.62, jump: 0.5, prefRange: 'mid' },
    c: { skin: '#f2cdb2', suit: '#7b5cff', suit2: '#5a3fd6', accent: '#ff9df3', hair: '#3a2a20', pants: '#2a2340', shoe: '#f0eaff' },
    hairStyle: 'bob', outfit: 'turtleneck', accessory: null },
  { id: 'b-builder', name: 'THE BUILDER',  base: true, special: 'burnrate',
    stats: { speed: 0.95, power: 1.15, hp: 102 }, ai: { aggr: 0.82, jump: 0.3, prefRange: 'close' },
    c: { skin: '#7a4a30', suit: '#ff7a1a', suit2: '#d15505', accent: '#ffd23f', hair: '#12100e', pants: '#2a2018', shoe: '#f5f5f5' },
    hairStyle: 'curly', outfit: 'henley', accessory: null },
  { id: 'b-intern', name: 'THE INTERN',    base: true, special: 'growthhack',
    stats: { speed: 1.1, power: 0.9, hp: 94 }, ai: { aggr: 0.6, jump: 0.55, prefRange: 'mid' },
    c: { skin: '#eec9a6', suit: '#29d9ff', suit2: '#1893b3', accent: '#ff3d6e', hair: '#2a2118', pants: '#20263f', shoe: '#ffffff' },
    hairStyle: 'short', outfit: 'tee', accessory: null },
  { id: 'b-shark',  name: 'THE SHARK',     base: true, special: 'fundinground',
    stats: { speed: 0.9, power: 1.1, hp: 105 }, ai: { aggr: 0.68, jump: 0.2, prefRange: 'far' },
    c: { skin: '#c99a6a', suit: '#0f5f57', suit2: '#0a3f3a', accent: '#ffd23f', hair: '#efe6d8', pants: '#0d3a35', shoe: '#1a1a24' },
    hairStyle: 'bald', outfit: 'vest', accessory: 'shades' },
  { id: 'b-vc',     name: 'THE INVESTOR',  base: true, special: 'fundinground',
    stats: { speed: 0.95, power: 1.05, hp: 104 }, ai: { aggr: 0.6, jump: 0.25, prefRange: 'far' },
    c: { skin: '#f5d9bf', suit: '#3a4a6e', suit2: '#232f4a', accent: '#ffd23f', hair: '#5a4632', pants: '#1c2438', shoe: '#12161f' },
    hairStyle: 'slick', outfit: 'suit', accessory: 'brooch' },
  { id: 'b-ceo',    name: 'THE CHIEF',     base: true, special: 'takeover',
    stats: { speed: 0.9, power: 1.2, hp: 110 }, ai: { aggr: 0.78, jump: 0.2, prefRange: 'close' },
    c: { skin: '#5c3620', suit: '#8a1f3d', suit2: '#5e1228', accent: '#ffd23f', hair: '#0c0a08', pants: '#241016', shoe: '#0c0a08' },
    hairStyle: 'bald', outfit: 'blazer', accessory: 'glasses' },
  { id: 'b-maker',  name: 'THE MAKER',     base: true, special: 'burnrate',
    stats: { speed: 1.0, power: 1.1, hp: 100 }, ai: { aggr: 0.78, jump: 0.35, prefRange: 'close' },
    c: { skin: '#b87a4a', suit: '#d94f2a', suit2: '#a5341a', accent: '#ffd23f', hair: '#1a1410', pants: '#2c211a', shoe: '#e8e8e8' },
    hairStyle: 'cap', outfit: 'tee', accessory: 'stubble' },
  { id: 'b-scout',  name: 'THE SCOUT',     base: true, special: 'pitchdeck',
    stats: { speed: 1.1, power: 0.92, hp: 96 }, ai: { aggr: 0.66, jump: 0.5, prefRange: 'mid' },
    c: { skin: '#ecc39e', suit: '#12b3a6', suit2: '#0a7d73', accent: '#ff9df3', hair: '#2a1c12', pants: '#123a37', shoe: '#dffbf7' },
    hairStyle: 'puffs', outfit: 'turtleneck', accessory: 'earrings' },
  { id: 'b-angel',  name: 'THE ANGEL',     base: true, special: 'pivot',
    stats: { speed: 1.05, power: 1.0, hp: 100 }, ai: { aggr: 0.64, jump: 0.45, prefRange: 'mid' },
    c: { skin: '#caa06f', suit: '#e8b93f', suit2: '#b98c14', accent: '#29d9ff', hair: '#20180f', pants: '#3a2c14', shoe: '#fff6d9' },
    hairStyle: 'bob', outfit: 'blazer', accessory: 'visor' },
  { id: 'b-punk',   name: 'THE DISRUPTOR', base: true, special: 'growthhack',
    stats: { speed: 1.18, power: 0.9, hp: 94 }, ai: { aggr: 0.8, jump: 0.55, prefRange: 'mid' },
    c: { skin: '#8a5a3b', suit: '#ff2e88', suit2: '#c40f5e', accent: '#0b0e1a', hair: '#151018', pants: '#241420', shoe: '#ff2e88' },
    hairStyle: 'ponytail', outfit: 'bomber', accessory: 'shades' },
  { id: 'b-sage',   name: 'THE ADVISOR',   base: true, special: 'pitchdeck',
    stats: { speed: 0.92, power: 1.08, hp: 104 }, ai: { aggr: 0.6, jump: 0.2, prefRange: 'far' },
    c: { skin: '#6e4326', suit: '#4a4f5c', suit2: '#2f333d', accent: '#57ff8a', hair: '#d8d2c8', pants: '#26292f', shoe: '#f0f0f0' },
    hairStyle: 'short', outfit: 'henley', accessory: 'glasses' },
  { id: 'b-nomad',  name: 'THE NOMAD',     base: true, special: 'pivot',
    stats: { speed: 1.12, power: 0.95, hp: 97 }, ai: { aggr: 0.68, jump: 0.5, prefRange: 'mid' },
    c: { skin: '#e2b98c', suit: '#7b5cff', suit2: '#5637c2', accent: '#ffd23f', hair: '#2c2018', pants: '#2a2340', shoe: '#efeaff' },
    hairStyle: 'curly', outfit: 'vest', accessory: null },
];

const ALL_BY_ID = new Map([...FIGHTERS, ...BASE_CHARACTERS].map(f => [f.id, f]));

export function getFighter(id) {
  return ALL_BY_ID.get(id) || FIGHTERS[0];
}

// ---- LOOK CUSTOMISATION --------------------------------------------------
// Everything a player can change about their founder. All of it is purely
// cosmetic — see PLAYER_STATS in config.js: nothing here touches speed,
// power or HP. Anything left unset falls back to the chosen base character.
export const LOOKS = {
  hairStyle: [
    { id: 'short', name: 'SHORT' }, { id: 'buzz', name: 'BUZZ' },
    { id: 'neat', name: 'NEAT' }, { id: 'slick', name: 'SLICK' },
    { id: 'curly', name: 'CURLY' }, { id: 'afro', name: 'AFRO' },
    { id: 'bob', name: 'BOB' }, { id: 'long', name: 'LONG' },
    { id: 'ponytail', name: 'PONYTAIL' }, { id: 'topknot', name: 'TOP KNOT' },
    { id: 'puffs', name: 'PUFFS' }, { id: 'bald', name: 'BALD' },
  ],
  headwear: [
    { id: 'none', name: 'NONE' }, { id: 'headband', name: 'HEADBAND' },
    { id: 'cap', name: 'CAP' }, { id: 'beanie', name: 'BEANIE' },
    { id: 'bandana', name: 'BANDANA' },
  ],
  eyewear: [
    { id: 'none', name: 'NONE' }, { id: 'glasses', name: 'GLASSES' },
    { id: 'shades', name: 'SHADES' }, { id: 'visor', name: 'AR VISOR' },
  ],
  facialHair: [
    { id: 'none', name: 'NONE' }, { id: 'stubble', name: 'STUBBLE' },
    { id: 'moustache', name: 'MOUSTACHE' }, { id: 'goatee', name: 'GOATEE' },
    { id: 'beard', name: 'BEARD' },
  ],
  outfit: [
    { id: 'blazer', name: 'BLAZER' }, { id: 'suit', name: 'SUIT' },
    { id: 'pinstripe', name: 'PINSTRIPE' }, { id: 'hoodie', name: 'HOODIE' },
    { id: 'turtleneck', name: 'TURTLENECK' }, { id: 'tee', name: 'TEE' },
    { id: 'bomber', name: 'BOMBER' }, { id: 'vest', name: 'VEST' },
    { id: 'henley', name: 'HENLEY' },
  ],
};

export const LOOK_FIELDS = Object.keys(LOOKS);

// Picks the valid look overrides out of a profile / challenge payload.
export function pickLook(src) {
  const out = {};
  if (!src) return out;
  for (const k of LOOK_FIELDS) {
    const v = src[k];
    if (v && LOOKS[k].some(o => o.id === v)) out[k] = v;
  }
  return out;
}

export const DEFAULT_BASE_ID = 'b-neo';

// Builds a fighter definition for a user profile (custom colors/special/photo).
export function buildCustomFighter(profile) {
  const base = getFighter(profile.baseId || DEFAULT_BASE_ID);
  return {
    ...base,
    ...pickLook(profile),        // explicit choices beat the base character
    id: 'custom',
    name: (profile.name || 'YOU').toUpperCase(),
    title: 'CHALLENGER',
    company: (profile.company || 'STEALTH STARTUP').toUpperCase(),
    tagline: 'Player-founded. Player-funded.',
    special: profile.special || base.special,
    photo: profile.photo || null,
    stats: { ...PLAYER_STATS },   // look is cosmetic; every player hits the same

    // skin/hair come from the uploaded photo when available, so hands + head
    // coloring match the person instead of the generic base founder
    c: {
      ...base.c,
      skin: profile.skin || base.c.skin,
      hair: profile.hair || base.c.hair,
      suit: profile.c1 || base.c.suit,
      suit2: shade(profile.c1 || base.c.suit, -28),
      accent: profile.c2 || base.c.accent,
    },
  };
}

// Ghost fighter for an incoming challenge. `ch` carries the link payload
// (n/co/f/sp/pts) and, when the challenger's cloud profile was fetched,
// their real photo + colors (photo/skin/hair/c1/c2) so the card shows THEM.
export function buildGhostFighter(ch) {
  const base = getFighter(ch.f);
  return {
    ...base,
    ...pickLook(ch),             // so a challenge card shows THEIR look
    id: 'ghost-' + base.id,
    name: (ch.n || 'RIVAL').toUpperCase(),
    company: (ch.co || 'RIVAL VENTURES').toUpperCase(),
    title: 'CHALLENGER',
    special: ch.sp && SPECIALS[ch.sp] ? ch.sp : base.special,
    photo: ch.photo || null,
    stats: { ...PLAYER_STATS },   // a ghost is another human — same footing

    c: {
      ...base.c,
      skin: ch.skin || base.c.skin,
      hair: ch.hair || base.c.hair,
      suit: ch.c1 || base.c.suit,
      suit2: shade(ch.c1 || base.c.suit, -28),
      accent: ch.c2 || base.c.accent,
    },
  };
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
