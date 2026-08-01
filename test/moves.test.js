import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPE_SHAPES, ARCHETYPE_TICKS, shapeAttack } from '../src/engine/moves.js';
import { ARCHETYPES } from '../src/data/schema.js';

test('every schema archetype has an implementation', () => {
  for (const a of ARCHETYPES) {
    assert.ok(ARCHETYPE_SHAPES[a], `missing implementation for ${a}`);
  }
});

test('projectile active window covers the full volley', () => {
  const sp = { type: 'projectile', count: 3, interval: 0.14, dmg: 8 };
  const a = shapeAttack({ kind: 'projectile', special: sp, active: 0.1 }, sp);
  assert.ok(Math.abs(a.active - (0.05 + 3 * 0.14)) < 1e-9);
});

test('aoe strikes tall and low', () => {
  const sp = { type: 'aoe', dmg: 22 };
  const a = shapeAttack({ kind: 'aoe', special: sp }, sp);
  assert.equal(a.hitY, -80);
});

test('rush active window is its declared duration', () => {
  const sp = { type: 'rush', duration: 0.5, dmg: 5 };
  const a = shapeAttack({ kind: 'rush', special: sp, active: 0.1 }, sp);
  assert.equal(a.active, 0.5);
  assert.equal(a.reach, 70);
});

test('shaping never invents a word list', () => {
  for (const type of ARCHETYPES) {
    const a = shapeAttack({ kind: type, special: { type } }, { type });
    assert.ok(Array.isArray(a.words) && a.words.length, `${type} needs words`);
  }
});

// ---------------------------------------------------------------- counter / trap

test('counter is a stance, not a strike — its active window is the counter window', () => {
  const sp = { type: 'counter', window: 0.22, dmg: 14, kb: 300 };
  const a = shapeAttack({ kind: 'counter', special: sp, active: 0.1 }, sp);
  assert.equal(a.counterWindow, 0.22);
  assert.equal(a.active, 0.22);
  assert.equal(a.noHitbox, true, 'a counter must not swing a hitbox of its own');
});

test('counter falls back to a sane window when unauthored', () => {
  const a = shapeAttack({ kind: 'counter', special: { type: 'counter' } }, { type: 'counter' });
  assert.ok(a.counterWindow > 0, 'an unauthored counter still has a window');
});

test('trap does no damage itself — the placed hazard does', () => {
  const sp = { type: 'trap', lifetime: 6, radius: 70, dmg: 10, armTime: 0.35 };
  const a = shapeAttack({ kind: 'trap', special: sp }, sp);
  assert.equal(a.noHitbox, true);
});

test('archetypes that place or absorb never swing a hitbox', () => {
  // hitbox() is skipped for these, so a stray reach value can never connect
  for (const type of ['counter', 'trap']) {
    const a = shapeAttack({ kind: type, special: { type } }, { type });
    assert.equal(a.noHitbox, true, `${type} must be hitbox-free`);
  }
});

test('every archetype with per-frame behaviour is dispatchable, and the rest are not', () => {
  // strike/grab/counter are resolved on contact, so they deliberately have no tick
  for (const type of ['projectile', 'rain', 'teleport', 'rush', 'aoe', 'trap']) {
    assert.equal(typeof ARCHETYPE_TICKS[type], 'function', `${type} needs a tick`);
  }
  for (const type of ['strike', 'grab', 'counter']) {
    assert.equal(ARCHETYPE_TICKS[type], undefined, `${type} must not have a tick`);
  }
});

test('a trap fires once and asks the game to place it', () => {
  const sp = { type: 'trap', radius: 70, dmg: 10 };
  const a = shapeAttack({ kind: 'trap', special: sp }, sp);
  let placed = 0;
  const game = { spawnTrap: () => placed++ };
  ARCHETYPE_TICKS.trap({}, a, sp, 1 / 60, game, 0);
  ARCHETYPE_TICKS.trap({}, a, sp, 1 / 60, game, 0.1);
  assert.equal(placed, 1, 'placing must not repeat every frame');
});
