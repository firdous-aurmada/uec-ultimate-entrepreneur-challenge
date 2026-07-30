import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPE_SHAPES, shapeAttack } from '../src/engine/moves.js';
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
