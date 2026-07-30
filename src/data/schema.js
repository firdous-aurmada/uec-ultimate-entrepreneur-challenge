// The character format, its validator, and the power budget.
//
// Shared by the game's load path and the Incubator authoring tool, so a
// character that validates here is playable there and vice versa.

import { BODY, BUDGET, ATTACKS } from '../config.js';

export const SCHEMA_VERSION = 2;

// ---------------------------------------------------------------- command normals
//
// The universal grammar is identical for everyone: same movement, same block,
// same four basics, same three universal moves. A character's vocabulary is
// 2–3 command normals layered on those basics — holding a direction at the
// moment you press the button selects the variant.
//
// v1 is forward-only. `back+X` is deliberately held back: block is its own
// button today, so back is free, but committing to it before the animation
// work lands would freeze a layout we may still want to change. `down+X`
// needs its own pass on how it interacts with the crouch stance.
export const COMMAND_SLOTS = ['fwd+slap', 'fwd+punch', 'fwd+kick', 'fwd+launch'];

// The basic a slot overrides — also the move its cost is measured against.
export function slotButton(slot) {
  return typeof slot === 'string' ? slot.split('+')[1] : undefined;
}

// Combo verbs. These drive AI preference and the move card's wording; they
// carry no frame data of their own, so a wrong tag is a mislabel, not a bug.
export const MOVE_TAGS = [
  'launcher', 'overhead', 'low', 'gapCloser', 'ranged', 'command-grab',
  'counter', 'trap', 'safe', 'punish',
];

const CMD_FRAME_KEYS = ['startup', 'active', 'recovery', 'dmg', 'reach'];

// What one command normal costs, priced against the neutral basic it replaces.
// Zero means "this is that basic, on a direction" — which is exactly free.
export function commandCost(cmd) {
  const C = BUDGET.CMD, W = BUDGET.W;
  const base = ATTACKS[slotButton(cmd?.slot)];
  if (!base) return 0;
  const fd = cmd.frameData || {};
  const r = (k) => (typeof fd[k] === 'number' && base[k] ? fd[k] / base[k] : 1);

  let cost = C.ARCHETYPE[cmd.archetype] ?? 0;
  // Launching is priced as a capability, not a number: it only counts when the
  // base move could not already do it.
  if ((fd.kbUp || 0) < 0 && !(base.kbUp < 0)) cost += C.LAUNCHER;

  const deltas =
      W.dmg      * (r('dmg')   - 1)
    + W.reach    * (r('reach') - 1)
    + W.startup  * (1 - r('startup'))
    + W.recovery * (1 - r('recovery'));
  return cost + C.SCALE * deltas * 100;
}

// Cost in budget points. Positive = net advantage, negative = net handicap.
// Zero is the balanced baseline. Command normals are optional so the shipped
// styles keep pricing exactly as they did before they existed.
export function budgetCost(fighting, body, commandNormals = []) {
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
  const cmds = (commandNormals || []).reduce((t, c) => t + commandCost(c), 0);
  return sum * 100 + cmds;
}

export function budgetBand(cost) {
  const m = Math.abs(cost);
  if (m <= BUDGET.WARN) return 'clean';
  if (m <= BUDGET.BLOCK) return 'warn';
  return 'block';
}

export const DEFAULT_BODY = { height: 1, build: 1, reach: 1, stride: 1, shoulders: 1, head: 1 };

// `aoe` is a live special type (Burn Rate Blast) and stays its own archetype
// rather than folding into `strike`, because the shipped behaviour must be
// preserved exactly. `counter` and `trap` are the two new fight patterns —
// they exist so the roster can hold characters that differ in kind, not
// merely in degree.
export const ARCHETYPES = [
  'strike', 'projectile', 'aoe', 'rush', 'grab', 'teleport', 'rain', 'counter', 'trap',
];
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

  // ---- command normals ----
  // Optional: a character with none plays the universal grammar and nothing
  // else, which is a valid character, not a broken one.
  const cmds = ch.commandNormals;
  let cmdsOk = true;
  if (cmds !== undefined && cmds !== null) {
    if (!Array.isArray(cmds)) {
      errors.push('commandNormals must be an array');
      cmdsOk = false;
    } else {
      if (cmds.length > BUDGET.CMD.MAX_SLOTS) {
        errors.push(`commandNormals holds ${cmds.length} moves; at most ${BUDGET.CMD.MAX_SLOTS} are allowed`);
      }
      const seen = new Set();
      cmds.forEach((cn, i) => {
        const at = `commandNormals[${i}]`;
        if (!cn || typeof cn !== 'object') { errors.push(`${at} is not an object`); cmdsOk = false; return; }
        if (!COMMAND_SLOTS.includes(cn.slot)) {
          errors.push(`${at}.slot ${JSON.stringify(cn.slot)} must be one of ${COMMAND_SLOTS.join(', ')}`);
          cmdsOk = false;
        } else if (seen.has(cn.slot)) {
          errors.push(`${at}.slot ${cn.slot} is a duplicate — one move per input`);
        } else {
          seen.add(cn.slot);
        }
        if (!ARCHETYPES.includes(cn.archetype)) {
          errors.push(`${at}.archetype ${JSON.stringify(cn.archetype)} is not a known archetype`);
          cmdsOk = false;
        }
        if (typeof cn.displayName !== 'string' || !cn.displayName.length) {
          errors.push(`${at}.displayName is required`);
        } else if (cn.displayName.length > 24) {
          errors.push(`${at}.displayName exceeds 24 chars`);
        }
        if (Array.isArray(cn.tags)) {
          for (const t of cn.tags) {
            if (!MOVE_TAGS.includes(t)) errors.push(`${at}.tags contains unknown tag ${JSON.stringify(t)}`);
          }
        } else if (cn.tags !== undefined) {
          errors.push(`${at}.tags must be an array`);
        }

        // Frame data is clamped as a ratio of the basic it overrides. This is
        // the anti-cheat line: these numbers arrive over the wire in a
        // challenge link, so an out-of-range value is rejected outright rather
        // than merely priced into the budget.
        const base = ATTACKS[slotButton(cn.slot)];
        const fd = cn.frameData;
        if (!fd || typeof fd !== 'object') {
          errors.push(`${at}.frameData is required`);
          cmdsOk = false;
        } else if (base) {
          for (const key of CMD_FRAME_KEYS) {
            const v = fd[key];
            if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
              errors.push(`${at}.frameData.${key} must be a positive number`);
              cmdsOk = false;
              continue;
            }
            const [lo, hi] = BUDGET.CMD.CLAMP[key];
            const ratio = v / base[key];
            if (ratio < lo || ratio > hi) {
              errors.push(`${at}.frameData.${key} is ${ratio.toFixed(2)}× its base, outside [${lo}, ${hi}]`);
            }
          }
        }
      });
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
    cost = budgetCost(fighting, body, cmdsOk && Array.isArray(cmds) ? cmds : []);
    band = budgetBand(cost);
    if (band === 'block') errors.push(`power budget ${cost.toFixed(1)} exceeds ±${BUDGET.BLOCK}`);
    else if (band === 'warn') warnings.push(`power budget ${cost.toFixed(1)} is outside ±${BUDGET.WARN}`);
  }

  return { ok: errors.length === 0, errors, warnings, cost, band };
}
