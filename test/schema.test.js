import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY, BUDGET, ATTACKS } from '../src/config.js';
import { budgetCost, budgetBand, commandCost } from '../src/data/schema.js';
import { STYLES } from '../src/config.js';
import {
  validateCharacter, DEFAULT_BODY, SCHEMA_VERSION,
  ARCHETYPES, COMMAND_SLOTS, slotButton,
} from '../src/data/schema.js';

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
    schema: SCHEMA_VERSION,
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

// ---------------------------------------------------------------- v2: command normals

test('schema v2 carries the full nine-archetype vocabulary', () => {
  assert.equal(SCHEMA_VERSION, 2);
  for (const a of ['strike', 'aoe', 'projectile', 'rush', 'grab', 'teleport', 'rain', 'counter', 'trap']) {
    assert.ok(ARCHETYPES.includes(a), `${a} must be an archetype`);
  }
});

test('every command slot names a real basic attack', () => {
  assert.deepEqual([...COMMAND_SLOTS].sort(), ['fwd+kick', 'fwd+launch', 'fwd+punch', 'fwd+slap']);
  for (const slot of COMMAND_SLOTS) {
    assert.ok(ATTACKS[slotButton(slot)], `${slot} must map onto an ATTACKS entry`);
  }
});

// A command normal is priced against the neutral basic it shares a button with,
// so "costs nothing" means "is that basic, on a direction".
const cmd = (over = {}) => ({
  slot: 'fwd+punch', archetype: 'strike', displayName: 'TEST NORMAL',
  frameData: { ...ATTACKS.punch },
  ...over,
});

test('a command normal identical to its base costs nothing', () => {
  assert.ok(Math.abs(commandCost(cmd())) < 0.001);
});

test('a richer archetype costs more than a plain strike', () => {
  const plain = commandCost(cmd({ archetype: 'strike' }));
  for (const a of ['counter', 'projectile', 'grab']) {
    assert.ok(commandCost(cmd({ archetype: a })) > plain, `${a} should cost more than strike`);
  }
});

test('adding launch to a basic that does not launch is charged for', () => {
  const flat = commandCost(cmd());
  const launcher = commandCost(cmd({ frameData: { ...ATTACKS.punch, kbUp: -380 } }));
  assert.ok(launcher > flat + 2, `launcher ${launcher} should carry a real premium over ${flat}`);
});

test('a launching basic is not charged twice for launching', () => {
  // ATTACKS.launch already launches, so keeping that property is free
  const asIs = commandCost(cmd({ slot: 'fwd+launch', frameData: { ...ATTACKS.launch } }));
  assert.ok(Math.abs(asIs) < 0.001);
});

// The two tuning targets named in the plan. These pin the constants: if the
// weights drift, these fail before any character does.
test('balanced style plus two modest command normals stays clean', () => {
  const c = validChar();
  c.commandNormals = [
    // slower but stronger — a compensating trade, not an upgrade
    cmd({ slot: 'fwd+punch', frameData: { ...ATTACKS.punch, dmg: ATTACKS.punch.dmg * 1.1, startup: ATTACKS.punch.startup * 1.15 } }),
    cmd({ slot: 'fwd+kick', frameData: { ...ATTACKS.kick, reach: ATTACKS.kick.reach * 1.1, recovery: ATTACKS.kick.recovery * 1.15 } }),
  ];
  const r = validateCharacter(c);
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.equal(r.band, 'clean', `expected clean, got ${r.band} at ${r.cost.toFixed(1)}`);
});

test('a launcher plus a projectile on fast frames pushes into warn', () => {
  const c = validChar();
  c.commandNormals = [
    cmd({
      slot: 'fwd+punch', archetype: 'strike',
      frameData: { ...ATTACKS.punch, kbUp: -380, startup: ATTACKS.punch.startup * 0.85, dmg: ATTACKS.punch.dmg * 1.1 },
    }),
    cmd({
      slot: 'fwd+kick', archetype: 'projectile',
      frameData: { ...ATTACKS.kick, startup: ATTACKS.kick.startup * 0.9 },
    }),
  ];
  const r = validateCharacter(c);
  assert.equal(r.band, 'warn', `expected warn, got ${r.band} at ${r.cost.toFixed(1)}`);
  assert.equal(r.ok, true);
});

test('command normals count toward the budget and can block export on their own', () => {
  const c = validChar();
  c.commandNormals = [
    cmd({ slot: 'fwd+punch', archetype: 'grab', frameData: { ...ATTACKS.punch, dmg: ATTACKS.punch.dmg * 1.6, reach: ATTACKS.punch.reach * 1.4 } }),
    cmd({ slot: 'fwd+kick', archetype: 'rain', frameData: { ...ATTACKS.kick, startup: ATTACKS.kick.startup * 0.6 } }),
    cmd({ slot: 'fwd+launch', archetype: 'teleport', frameData: { ...ATTACKS.launch, dmg: ATTACKS.launch.dmg * 1.5 } }),
  ];
  const r = validateCharacter(c);
  assert.equal(r.ok, false);
  assert.equal(r.band, 'block');
});

test('a character with no command normals is still valid', () => {
  const r = validateCharacter(validChar());
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test('command normals are capped at three slots', () => {
  const c = validChar();
  c.commandNormals = [
    cmd({ slot: 'fwd+slap', frameData: { ...ATTACKS.slap } }),
    cmd({ slot: 'fwd+punch' }),
    cmd({ slot: 'fwd+kick', frameData: { ...ATTACKS.kick } }),
    cmd({ slot: 'fwd+launch', frameData: { ...ATTACKS.launch } }),
  ];
  const r = validateCharacter(c);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /at most 3/i);
});

test('a duplicate slot is rejected — one move per input', () => {
  const c = validChar();
  c.commandNormals = [cmd(), cmd({ displayName: 'OTHER' })];
  const r = validateCharacter(c);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /duplicate/i);
});

test('an unknown slot or archetype is rejected', () => {
  for (const over of [{ slot: 'back+punch' }, { slot: 'down+kick' }, { archetype: 'nonsense' }]) {
    const c = validChar();
    c.commandNormals = [cmd(over)];
    assert.equal(validateCharacter(c).ok, false, `${JSON.stringify(over)} should fail`);
  }
});

// This is the anti-cheat line: frame data arrives over the wire in a challenge
// link, so ratios are clamped against the base rather than merely priced.
test('frame data far outside its clamp is rejected, not just charged for', () => {
  const c = validChar();
  c.commandNormals = [cmd({ frameData: { ...ATTACKS.punch, dmg: 400, startup: 0.001 } })];
  const r = validateCharacter(c);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /frameData/);
});

test('a command normal missing its display name is rejected', () => {
  const c = validChar();
  c.commandNormals = [cmd({ displayName: '' })];
  assert.equal(validateCharacter(c).ok, false);
});
