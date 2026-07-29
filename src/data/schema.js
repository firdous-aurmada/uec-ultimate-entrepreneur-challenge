// The character format, its validator, and the power budget.
//
// Shared by the game's load path and the Incubator authoring tool, so a
// character that validates here is playable there and vice versa.

import { BODY, BUDGET } from '../config.js';

export const SCHEMA_VERSION = 1;

// Cost in budget points. Positive = net advantage, negative = net handicap.
// Zero is the balanced baseline.
export function budgetCost(fighting, body) {
  const W = BUDGET.W;
  const f = fighting, b = body;
  const sum =
      W.dmg      * (f.dmg      - 1)
    + W.hp       * (f.hp       - 1)
    + W.speed    * (f.speed    - 1)
    + W.reach    * (f.reach    - 1)
    + W.startup  * (1 - f.startup)
    + W.recovery * (1 - f.recovery)
    + W.bodyReach * (b.reach - 1)
    + W.hurtbox   * (b.height * b.build - 1);
  return sum * 100;
}

export function budgetBand(cost) {
  const m = Math.abs(cost);
  if (m <= BUDGET.WARN) return 'clean';
  if (m <= BUDGET.BLOCK) return 'warn';
  return 'block';
}

export const DEFAULT_BODY = { height: 1, build: 1, reach: 1, stride: 1, shoulders: 1, head: 1 };

// `aoe` is a live special type (Burn Rate Blast) and stays its own archetype
// for P1, because P1 must preserve behaviour exactly. Folding it into `strike`
// is a later consolidation. `counter` and `trap` arrive with the authoring UI.
export const ARCHETYPES = ['strike', 'projectile', 'aoe', 'rush', 'grab', 'teleport', 'rain'];
export const STANCES = ['ready', 'coiled', 'heavy', 'poised', 'loose', 'flair'];
export const PREF_RANGES = ['close', 'mid', 'far'];

const TEXT_CAPS = { name: 22, title: 24, company: 20, tagline: 64, rap: 40 };
const FIGHTING_KEYS = ['startup', 'dmg', 'reach', 'recovery', 'speed', 'hp'];

// Returns { ok, errors[], warnings[], cost, band }.
// `ok` is false for anything that must not reach the game; warn-band
// characters are ok:true with a warning attached.
export function validateCharacter(ch) {
  const errors = [];
  const warnings = [];

  if (!ch || typeof ch !== 'object') {
    return { ok: false, errors: ['character is not an object'], warnings, cost: 0, band: 'block' };
  }
  if (ch.schema !== SCHEMA_VERSION) {
    errors.push(`unknown schema version ${ch.schema} (expected ${SCHEMA_VERSION})`);
  }
  if (typeof ch.id !== 'string' || !/^[a-z0-9-]{2,24}$/.test(ch.id)) {
    errors.push(`id ${JSON.stringify(ch.id)} must match [a-z0-9-]{2,24}`);
  }

  const idn = ch.identity || {};
  for (const [key, cap] of Object.entries(TEXT_CAPS)) {
    const v = idn[key];
    if (typeof v !== 'string' || !v.length) errors.push(`identity.${key} is required`);
    else if (v.length > cap) errors.push(`identity.${key} exceeds ${cap} chars`);
  }

  const body = { ...DEFAULT_BODY, ...(ch.body || {}) };
  for (const [key, [lo, hi]] of Object.entries(BODY)) {
    const v = body[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`body.${key} must be a number`);
    else if (v < lo || v > hi) errors.push(`body.${key} ${v} outside [${lo}, ${hi}]`);
  }

  const look = ch.look || {};
  if (look.stance !== undefined && !STANCES.includes(look.stance)) {
    errors.push(`look.stance ${JSON.stringify(look.stance)} is not a known stance`);
  }

  const fighting = ch.fighting || {};
  for (const key of FIGHTING_KEYS) {
    const v = fighting[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
      errors.push(`fighting.${key} must be a positive number`);
    }
  }

  const moves = fighting.moves || {};
  if (!moves.special || !ARCHETYPES.includes(moves.special.archetype)) {
    errors.push(`fighting.moves.special.archetype must be one of ${ARCHETYPES.join(', ')}`);
  }
  if (moves.signature) {
    if (!ARCHETYPES.includes(moves.signature.archetype)) {
      errors.push('fighting.moves.signature.archetype is not a known archetype');
    }
    if (!['slap', 'punch', 'kick', 'launch'].includes(moves.signature.replaces)) {
      errors.push('fighting.moves.signature.replaces must name a basic attack');
    }
  }

  const ai = ch.ai || {};
  if (!PREF_RANGES.includes(ai.prefRange)) errors.push('ai.prefRange must be close, mid or far');
  for (const key of ['aggr', 'jump']) {
    const v = ai[key];
    if (typeof v !== 'number' || v < 0 || v > 1) errors.push(`ai.${key} must be between 0 and 1`);
  }

  // Budget only means something once the numbers it reads are well-formed.
  let cost = 0, band = 'clean';
  const numbersOk = FIGHTING_KEYS.every(k => typeof fighting[k] === 'number')
    && Object.keys(BODY).every(k => typeof body[k] === 'number');
  if (numbersOk) {
    cost = budgetCost(fighting, body);
    band = budgetBand(cost);
    if (band === 'block') errors.push(`power budget ${cost.toFixed(1)} exceeds ±${BUDGET.BLOCK}`);
    else if (band === 'warn') warnings.push(`power budget ${cost.toFixed(1)} is outside ±${BUDGET.WARN}`);
  }

  return { ok: errors.length === 0, errors, warnings, cost, band };
}
