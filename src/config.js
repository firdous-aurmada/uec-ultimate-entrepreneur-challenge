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
  FIRST_AT: 5,          // seconds of fight time before a round's first drop
  FIRST_JITTER: 3,
  INTERVAL_MIN: 7,      // between drops within the same round
  INTERVAL_MAX: 12,
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

// Chain combos: attacks cancel into the next tier ON HIT (whiffs stay punishable).
// punch ×3 → kick → special / bomb / Unicorn. Later hits deal scaled damage.
export const COMBO = {
  MAX_JABS: 3,                          // punches per string
  SCALING: [1, 0.85, 0.7, 0.6, 0.5],   // damage mult by victim's current chain depth
  JAB_CHAIN_KB: 0.55,                  // chained jabs shove less, so strings stay in range
  MILESTONES: { 3: 'COMBO!', 5: 'SYNERGY!', 7: 'DISRUPTED!' },
};

export const ATTACKS = {
  punch: { startup: 0.05, active: 0.06, recovery: 0.11, dmg: 7,  reach: 84,  hitY: -104, kb: 110, kbUp: 0,    stun: 0.24, shake: 6,  words: ['POW!', 'JAB!', 'BAM!'] },
  kick:  { startup: 0.10, active: 0.08, recovery: 0.17, dmg: 12, reach: 106, hitY: -78,  kb: 320, kbUp: -120, stun: 0.32, shake: 9,  words: ['WHAM!', 'SMACK!', 'BOOM!'] },
};

// 💸 Acqui-Hire: close-range talent raid that siphons the rival's energy.
export const STEAL = {
  AMOUNT: 15, COOLDOWN: 3.5,
  startup: 0.12, active: 0.08, recovery: 0.3, reach: 92, stun: 0.18,
};

// Perfectly timed block (tap block just before impact) = parry.
export const PARRY = { WINDOW: 0.12, STAGGER: 0.5, ENERGY: 10 };

// Internal keys stay intern/founder/mogul (used everywhere); label is the
// display name shown to players.
export const AI_LEVELS = {
  intern:  { label: 'ROOKIE',    react: 0.42, blockProb: 0.16, aggr: 0.45, mistake: 0.30, specialProb: 0.25, chain: 0.2,  mult: 1.0 },
  founder: { label: 'CONTENDER', react: 0.26, blockProb: 0.38, aggr: 0.68, mistake: 0.14, specialProb: 0.55, chain: 0.5,  mult: 1.5 },
  mogul:   { label: 'CHAMPION',  react: 0.14, blockProb: 0.62, aggr: 0.85, mistake: 0.05, specialProb: 0.8,  chain: 0.85, mult: 2.5 },
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
