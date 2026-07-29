import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY, BUDGET } from '../src/config.js';
import { budgetCost, budgetBand } from '../src/data/schema.js';
import { STYLES } from '../src/config.js';

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
