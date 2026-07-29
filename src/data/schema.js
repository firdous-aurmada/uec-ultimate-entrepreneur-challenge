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
