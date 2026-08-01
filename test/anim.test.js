// Keyframe sampling, phase-space timing, and the anticipation rule.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REST, EASE, restPose, blendInto, samplePose, attackPhaseT, trackFor,
  validateTrack, MIN_ANTICIPATION_KEYS,
} from '../src/engine/anim.js';
import { BASE_TRACKS, ATTACK_TRACK, NOMINAL_REACH } from '../src/data/tracks.js';

test('restPose hands out a fresh object every time', () => {
  const a = restPose(), b = restPose();
  a.armF.x = 999; a.hipY = 999;
  assert.notEqual(b.armF.x, 999, 'poses must not share limb objects');
  assert.equal(REST.armF.x, 30, 'REST itself must never be mutated');
  assert.equal(b.hipY, REST.hipY);
});

test('a sparse keyframe moves only the joints it names', () => {
  const p = restPose();
  blendInto(p, { hipY: 0 }, 1);
  assert.equal(p.hipY, 0);
  assert.equal(p.armF.x, REST.armF.x, 'unnamed joints must be left alone');
  assert.equal(p.sx, 1);
});

test('a keyframe can move one axis of a limb without the other', () => {
  const p = restPose();
  blendInto(p, { armF: { y: -200 } }, 1);
  assert.equal(p.armF.y, -200);
  assert.equal(p.armF.x, REST.armF.x);
});

test('blending is proportional', () => {
  const p = restPose();
  blendInto(p, { hipY: REST.hipY + 100 }, 0.25);
  assert.ok(Math.abs(p.hipY - (REST.hipY + 25)) < 1e-9);
});

// ---------------------------------------------------------------- phase space

test('attack time maps into phase space regardless of frame data', () => {
  // a slow move and a fast one sit at the same phase at the same moment
  const slow = attackPhaseT(0.10, 0.20, 0.10, 0.40);   // halfway through startup
  const fast = attackPhaseT(0.02, 0.04, 0.02, 0.08);   // halfway through startup
  assert.ok(Math.abs(slow - fast) < 1e-9, 'phase space must be frame-data independent');
  assert.ok(Math.abs(slow - 0.5) < 1e-9);
});

test('phase boundaries land exactly on 1 and 2', () => {
  assert.equal(attackPhaseT(0, 0.05, 0.06, 0.11), 0);
  assert.equal(attackPhaseT(0.05, 0.05, 0.06, 0.11), 1, 'hitbox comes out at t=1');
  assert.equal(attackPhaseT(0.11, 0.05, 0.06, 0.11), 2, 'recovery starts at t=2');
  assert.equal(attackPhaseT(0.22, 0.05, 0.06, 0.11), 3);
});

test('a zero-length phase does not divide by zero', () => {
  for (const t of [attackPhaseT(0, 0, 0.06, 0.11), attackPhaseT(0.06, 0, 0, 0.1)]) {
    assert.ok(Number.isFinite(t), `phase ${t} must be finite`);
  }
});

// ---------------------------------------------------------------- sampling

const TRACK = [
  { t: 0, joints: { hipY: 0 } },
  { t: 1, joints: { hipY: 100 } },
  { t: 2, joints: { hipY: 200 }, hold: true },
  { t: 3, joints: { hipY: 300 } },
];

test('sampling interpolates between the surrounding keys', () => {
  assert.ok(Math.abs(samplePose(TRACK, 0.5).hipY - 50) < 1e-9);
  assert.ok(Math.abs(samplePose(TRACK, 1.25).hipY - 125) < 1e-9);
});

test('a held key pins its pose until the next one', () => {
  // t=2 holds, so 2.0 through 2.99 all read as the held pose, not a drift to 300
  assert.equal(samplePose(TRACK, 2.0).hipY, 200);
  assert.equal(samplePose(TRACK, 2.5).hipY, 200, 'hold must not interpolate');
  assert.equal(samplePose(TRACK, 2.99).hipY, 200);
});

test('sampling clamps outside the track rather than extrapolating', () => {
  assert.equal(samplePose(TRACK, -5).hipY, 0);
  assert.equal(samplePose(TRACK, 99).hipY, 300);
});

test('an unusable track samples to null so the caller can fall back', () => {
  for (const bad of [null, undefined, [], {}, 'nope', { keys: [] }, [{ joints: {} }]]) {
    assert.equal(samplePose(bad, 0.5), null, `${JSON.stringify(bad)} should be unusable`);
  }
});

test('smear is carried on the pose, for the draw layer only', () => {
  const t = [{ t: 0, joints: {} }, { t: 1, joints: {}, smear: true }];
  assert.equal(samplePose(t, 0.1).smear, false);
  assert.equal(samplePose(t, 0.9).smear, true);
});

test('every easing function starts at 0 and ends at 1', () => {
  for (const [name, fn] of Object.entries(EASE)) {
    assert.ok(Math.abs(fn(0)) < 1e-9, `${name}(0) should be 0`);
    assert.ok(Math.abs(fn(1) - 1) < 1e-9, `${name}(1) should be 1`);
  }
});

test('outBack overshoots — that is the point of it', () => {
  const peak = Math.max(...Array.from({ length: 50 }, (_, i) => EASE.outBack(i / 49)));
  assert.ok(peak > 1.05, `expected overshoot, peaked at ${peak}`);
});

// ---------------------------------------------------------------- fallback

test('a character with no overrides gets the base track', () => {
  assert.equal(trackFor({}, 'punch', BASE_TRACKS), BASE_TRACKS.punch);
});

test('an override wins for its own state only', () => {
  const mine = [{ t: 0, joints: {} }, { t: 1, joints: {} }];
  const def = { animOverrides: { punch: mine } };
  assert.equal(trackFor(def, 'punch', BASE_TRACKS), mine);
  assert.equal(trackFor(def, 'kick', BASE_TRACKS), BASE_TRACKS.kick, 'other states keep the base');
});

test('a malformed override falls through to the base — never to nothing', () => {
  for (const junk of [null, 'nope', 42, {}, { keys: 'no' }]) {
    const got = trackFor({ animOverrides: { punch: junk } }, 'punch', BASE_TRACKS);
    assert.equal(got, BASE_TRACKS.punch, `${JSON.stringify(junk)} should fall back`);
  }
});

test('an unknown state yields no track rather than a wrong one', () => {
  assert.equal(trackFor({}, 'nonsense-state', BASE_TRACKS), null);
});

// ---------------------------------------------------------------- the rule

test('every shipped attack track telegraphs before it hits', () => {
  for (const name of ['punch', 'kick', 'slap', 'launch']) {
    const errors = validateTrack(name, BASE_TRACKS[name], { attack: true });
    assert.deepEqual(errors, [], errors.join('; '));
  }
});

test('an attack with no wind-up is rejected', () => {
  const noWindUp = [{ t: 1, joints: {} }, { t: 2, joints: {} }, { t: 3, joints: {} }];
  const errors = validateTrack('bad', noWindUp, { attack: true });
  assert.ok(errors.some(e => /wind-up/.test(e)), errors.join('; '));
});

test('an attack with no recovery is rejected', () => {
  const noRecovery = [{ t: 0, joints: {} }, { t: 0.5, joints: {} }, { t: 1.2, joints: {} }];
  assert.ok(validateTrack('bad', noRecovery, { attack: true }).some(e => /recovery/.test(e)));
});

test('out-of-order keys and unknown easings are rejected', () => {
  assert.ok(validateTrack('x', [{ t: 1, joints: {} }, { t: 0, joints: {} }]).some(e => /ordered/.test(e)));
  assert.ok(validateTrack('x', [{ t: 0, joints: {}, ease: 'bogus' }]).some(e => /unknown ease/.test(e)));
});

test('the idle loop returns to where it started', () => {
  const a = samplePose(BASE_TRACKS.idle, 0);
  const b = samplePose(BASE_TRACKS.idle, 1);
  assert.equal(a.hipY, b.hipY, 'a loop that does not close will pop every cycle');
  assert.equal(a.armF.y, b.armF.y);
});

// The snap is the whole reason for phase space: a punch that eases smoothly
// from wind-up to strike reads as a shove.
test('an attack travels almost entirely across the impact frame', () => {
  const at = (t) => samplePose(BASE_TRACKS.punch, t).armF.x;
  const coiled = at(0.95);
  const extended = at(1.15);
  const total = Math.abs(extended - coiled);
  const duringWindUp = Math.abs(at(0.95) - at(0.55));
  assert.ok(total > 90, `impact should cover real distance, covered ${total.toFixed(0)}`);
  assert.ok(duringWindUp < total * 0.25,
    `wind-up drifted ${duringWindUp.toFixed(0)} of ${total.toFixed(0)} — the strike must be the snap`);
});

test('the extension is held through the active window, not eased away', () => {
  const atHit = samplePose(BASE_TRACKS.punch, 1.15).armF.x;
  const atEnd = samplePose(BASE_TRACKS.punch, 1.95).armF.x;
  assert.ok(Math.abs(atHit - atEnd) < 12, 'the arm must stay out while the hitbox is out');
});

test('every attack archetype maps onto a real track', () => {
  for (const [kind, name] of Object.entries(ATTACK_TRACK)) {
    assert.ok(BASE_TRACKS[name], `${kind} maps to missing track ${name}`);
  }
});

test('every nominal reach names a real basic', () => {
  for (const k of Object.keys(NOMINAL_REACH)) assert.ok(BASE_TRACKS[k], `${k} has no track`);
});

// ---------------------------------------------------------------- authoring gate

import { validateCharacter, SCHEMA_VERSION, DEFAULT_BODY } from '../src/data/schema.js';

const charWith = (animOverrides) => ({
  schema: SCHEMA_VERSION, id: 'anim-test',
  identity: { name: 'T', title: 'T', company: 'T', tagline: 'x', rap: 'y' },
  body: { ...DEFAULT_BODY }, look: { stance: 'ready' },
  fighting: {
    preset: 'balanced', startup: 1, dmg: 1, reach: 1, recovery: 1, speed: 1, hp: 1,
    moves: { special: { archetype: 'strike' }, signature: null },
  },
  ai: { aggr: 0.5, jump: 0.3, prefRange: 'mid' },
  animOverrides,
});

test('a good animation override validates without complaint', () => {
  const r = validateCharacter(charWith({ punch: [{ t: 0, joints: {} }, { t: 1, joints: {} }] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings, []);
});

// A broken pose must not cost a character its playability. The renderer already
// falls back to the base track, so refusing to load over an animation typo
// would be a worse failure than the typo.
test('a broken animation override warns but never blocks the character', () => {
  for (const bad of [{ punch: [] }, { punch: 'nope' }, { punch: [{ t: 1 }, { t: 0 }] }, { punch: [{ joints: {} }] }]) {
    const r = validateCharacter(charWith(bad));
    assert.equal(r.ok, true, `${JSON.stringify(bad)} must still load`);
    assert.ok(r.warnings.length > 0, `${JSON.stringify(bad)} should warn`);
  }
});

test('animation overrides do not move the power budget', () => {
  const withAnim = validateCharacter(charWith({ punch: [{ t: 0, joints: { hipY: -999 } }, { t: 1, joints: {} }] }));
  const without = validateCharacter(charWith(undefined));
  assert.equal(withAnim.cost, without.cost, 'a pose is not a stat');
});
