// Central tuning for the whole game. All gameplay numbers live here.

export const STAGE = {
  W: 960,
  H: 540,
  FLOOR: 480,          // y of the ground line (fighter feet)
  MIN_X: 70,
  MAX_X: 890,
};

export const PHYS = {
  WALK: 250,           // px/s, scaled by fighter speed stat
  AIR_DRIFT: 0.78,     // fraction of walk speed while airborne
  JUMP_V: -760,
  GRAVITY: 2100,
  KB_DECAY: 7,         // knockback velocity decay per second (exponential)
  PUSH_APART: 340,     // separation speed when bodies overlap
  BODY_W: 56,          // hurtbox width
  BODY_H: 148,         // hurtbox height standing
};

export const ROUND = {
  TIME: 60,
  BEST_OF: 3,          // first to 2
  WINS_NEEDED: 2,
  INTRO_ROUND_T: 1.0,  // "ROUND N" duration
  INTRO_FIGHT_T: 0.55, // "FIGHT!" duration
  KO_SLOWMO_T: 1.15,
  ROUND_END_T: 1.6,
  VICTORY_T: 2.3,
};

export const METER = {
  MAX: 100,
  HIT_DEAL: 12,
  HIT_TAKE: 8,
  CHIP_DEAL: 3,
  BOMB_COST: 25,
  SPECIAL_COST: 50,
  SUPER_COST: 100,
};

export const BOMB = {
  dmg: 10, vx: 380, vy: -430, g: 1150, radius: 92,
  kb: 300, kbUp: -220, stun: 0.4,
  startup: 0.16, active: 0.05, recovery: 0.3,
};

export const DASH = {
  SPEED: 1450,
  DURATION: 0.16,
  COOLDOWN: 1.6,
  CANCEL_AFTER: 0.06,   // attacks can cancel the dash after this
};

// Mystery drops: seeded briefcases with hidden one-shot powers.
export const DROPS = {
  FIRST_AT: 6,          // seconds of round time before the first drop
  INTERVAL_MIN: 8,
  INTERVAL_MAX: 15,
  FALL_SPEED: 320,
  LIFETIME: 7,          // seconds on the ground before vanishing
  PICKUP_RANGE: 46,
  BUFF_TIME: 5,
  BUFF_SPEED: 1.4,
  BUFF_DMG: 1.4,
  SHIELD_TIME: 8,
};

export const UNICORN = {
  DURATION: 6,
  DMG_MULT: 1.35,
  SPEED_MULT: 1.25,
  POP_FREEZE: 0.45,    // dramatic pause on activation
};

export const BLOCK = {
  CHIP: 0.15,          // fraction of damage taken while blocking
  PUSH: 120,           // pushback on blocked hit
};

export const ATTACKS = {
  punch: { startup: 0.07, active: 0.09, recovery: 0.16, dmg: 7,  reach: 82,  hitY: -104, kb: 190, kbUp: 0,    stun: 0.26, shake: 5,  words: ['POW!', 'JAB!', 'BAM!'] },
  kick:  { startup: 0.14, active: 0.10, recovery: 0.24, dmg: 12, reach: 104, hitY: -78,  kb: 320, kbUp: -120, stun: 0.34, shake: 8,  words: ['WHAM!', 'SMACK!', 'BOOM!'] },
};

export const AI_LEVELS = {
  intern:  { label: 'INTERN',  react: 0.42, blockProb: 0.16, aggr: 0.45, mistake: 0.30, specialProb: 0.25, mult: 1.0 },
  founder: { label: 'FOUNDER', react: 0.26, blockProb: 0.38, aggr: 0.68, mistake: 0.14, specialProb: 0.55, mult: 1.5 },
  mogul:   { label: 'MOGUL',   react: 0.14, blockProb: 0.62, aggr: 0.85, mistake: 0.05, specialProb: 0.8,  mult: 2.5 },
};

export const POINTS = {
  WIN_BASE: 20,
  KO_BONUS: 5,          // per round won by KO
  STREAK_BONUS: 3,      // × current streak, capped
  STREAK_CAP: 15,
  LOSS: 3,
  CHALLENGE_MULT: 2.0,
};

export const RANKS = [
  { min: 0,    name: 'GARAGE DREAMER' },
  { min: 60,   name: 'BOOTSTRAPPER' },
  { min: 150,  name: 'SEED STAGE' },
  { min: 300,  name: 'SERIES A' },
  { min: 550,  name: 'SERIES B' },
  { min: 900,  name: 'GROWTH STAGE' },
  { min: 1400, name: 'PRE-IPO' },
  { min: 2000, name: 'UNICORN' },
  { min: 3200, name: 'DECACORN' },
];

export function rankFor(points) {
  let r = RANKS[0];
  for (const rank of RANKS) if (points >= rank.min) r = rank;
  return r.name;
}

export const SAVE_KEY = 'uec-save-v1';

export const DEBUG = new URLSearchParams(location.search).has('debug');
