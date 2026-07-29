import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY, BUDGET } from '../src/config.js';
import { budgetCost, budgetBand } from '../src/data/schema.js';
import { STYLES } from '../src/config.js';
import { validateCharacter, DEFAULT_BODY } from '../src/data/schema.js';

test('every body knob has a [min, max] range bracketing 1.0', () => {
  const knobs = ['height', 'build', 'reach', 'stride', 'shoulders', 'head'];
  assert.deepEqual(Object.keys(BODY).sort(), [...knobs].sort());
  for (const k of knobs) {
    const [lo, hi] = BODY[k];
    assert.ok(lo < 1 && hi > 1, `${k} range must bracket 1.0, got [${lo}, ${hi}]`);
  }
});

test('budget exposes weights and the warn/block thresholds', () => {
  assert.equal(BUDGET.WARN, 8);
  assert.equal(BUDGET.BLOCK, 15);
  assert.equal(BUDGET.W.speed, 1.2);
  assert.equal(BUDGET.W.startup, 0.7);
});

const NEUTRAL_BODY = { height: 1, build: 1, reach: 1, stride: 1, shoulders: 1, head: 1 };

test('budget reproduces the spec table for every shipped style', () => {
  const expected = {
    grappler: -4.6, brawler: -3.8, balanced: 0.0, zoner: 4.7, rushdown: 7.0,
    showman: 8.2, technical: 8.6, trickster: 12.2, glass: 14.2, phantom: 16.8,
  };
  for (const [id, want] of Object.entries(expected)) {
    const got = budgetCost(STYLES[id], NEUTRAL_BODY);
    assert.ok(Math.abs(got - want) < 0.05,
      `${id}: expected ${want}, got ${got.toFixed(2)}`);
  }
});

test('bands classify per the spec thresholds', () => {
  assert.equal(budgetBand(0), 'clean');
  assert.equal(budgetBand(-7.9), 'clean');
  assert.equal(budgetBand(8.1), 'warn');
  assert.equal(budgetBand(-14.2), 'warn');
  assert.equal(budgetBand(16.8), 'block');
});

test('PHANTOM is blocked — it holds advantage on four axes, pays on two', () => {
  assert.equal(budgetBand(budgetCost(STYLES.phantom, NEUTRAL_BODY)), 'block');
});

test('a bigger body refunds budget, because it is easier to hit', () => {
  const big = { ...NEUTRAL_BODY, height: 1.2, build: 1.2 };
  assert.ok(budgetCost(STYLES.balanced, big) < budgetCost(STYLES.balanced, NEUTRAL_BODY));
});

function validChar(over = {}) {
  return {
    schema: 1,
    id: 'test-fighter',
    identity: { name: 'TEST', title: 'THE TEST', company: 'TESTCO', tagline: 'x', rap: 'y' },
    body: { ...DEFAULT_BODY },
    look: { stance: 'ready' },
    fighting: {
      preset: 'balanced',
      startup: 1, dmg: 1, reach: 1, recovery: 1, speed: 1, hp: 1,
      moves: { special: { archetype: 'strike', dmg: 10 }, signature: null },
    },
    ai: { aggr: 0.5, jump: 0.3, prefRange: 'mid' },
    ...over,
  };
}

test('a well-formed character validates clean', () => {
  const r = validateCharacter(validChar());
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
  assert.equal(r.band, 'clean');
});

test('an unknown schema version is rejected', () => {
  const r = validateCharacter(validChar({ schema: 99 }));
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /schema version/i);
});

test('a malformed id is rejected', () => {
  for (const id of ['', 'A', 'has space', 'Uppercase', 'x'.repeat(25)]) {
    assert.equal(validateCharacter(validChar({ id })).ok, false, `id ${JSON.stringify(id)} should fail`);
  }
});

test('an out-of-range body knob is rejected, not silently clamped', () => {
  const r = validateCharacter(validChar({ body: { ...DEFAULT_BODY, height: 5 } }));
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /height/);
});

test('an unknown move archetype is rejected', () => {
  const c = validChar();
  c.fighting.moves.special = { archetype: 'nonsense' };
  assert.equal(validateCharacter(c).ok, false);
});

test('an over-budget character is blocked but still reports its cost', () => {
  const c = validChar();
  Object.assign(c.fighting, { dmg: 1.5, speed: 1.2, hp: 1.2 });
  const r = validateCharacter(c);
  assert.equal(r.ok, false);
  assert.equal(r.band, 'block');
  assert.ok(r.cost > 15);
});

test('a warn-band character validates ok but carries a warning', () => {
  const c = validChar();
  Object.assign(c.fighting, { dmg: 1.12 });
  const r = validateCharacter(c);
  assert.equal(r.ok, true);
  assert.equal(r.band, 'warn');
  assert.equal(r.warnings.length, 1);
});

test('identity text over its length cap is rejected', () => {
  const c = validChar();
  c.identity.name = 'X'.repeat(30);
  assert.equal(validateCharacter(c).ok, false);
});
