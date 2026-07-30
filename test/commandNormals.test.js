// Command-normal input resolution.
//
// Resolution lives inside the simulation, downstream of the Controller
// contract, so these tests drive a Fighter's pad directly — which is exactly
// what a keyboard, a touch pad, the AI and a network peer all reduce to.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Fighter } from '../src/engine/fighter.js';
import { ATTACKS, COMBO } from '../src/config.js';

const GAME = { audio: { sfx() {} } };

const ELBOW = {
  slot: 'fwd+punch', archetype: 'strike', displayName: 'BOARDROOM ELBOW',
  tags: ['launcher'],
  frameData: { ...ATTACKS.punch, dmg: 9, reach: 96, kbUp: -360 },
};
const SEIZURE = {
  slot: 'fwd+kick', archetype: 'grab', displayName: 'ASSET SEIZURE',
  tags: ['command-grab'],
  frameData: { ...ATTACKS.kick, dmg: 14, reach: 88 },
};

function mk(commandNormals = [], style = 'balanced') {
  const f = new Fighter(
    { id: 't', style, special: 'pitchdeck', c: {}, commandNormals },
    0,
    { update() {} },
  );
  f.facing = 1;
  return f;
}

// pad state as it would arrive on the frame a button goes down
function hold(f, { left = false, right = false } = {}) {
  f.pad = { ...f.pad, left, right };
}

test('with no command normals, forward+punch is just punch', () => {
  const f = mk();
  hold(f, { right: true });
  assert.equal(f.resolveBasic('punch'), 'punch');
});

test('holding forward at press selects the command normal', () => {
  const f = mk([ELBOW]);
  hold(f, { right: true });
  assert.equal(f.resolveBasic('punch'), ELBOW);
});

test('neutral — no direction held — gives the plain basic', () => {
  const f = mk([ELBOW]);
  hold(f, {});
  assert.equal(f.resolveBasic('punch'), 'punch');
});

test('holding back gives the plain basic — back+X is not bound in v1', () => {
  const f = mk([ELBOW]);
  hold(f, { left: true });
  assert.equal(f.resolveBasic('punch'), 'punch');
});

test('forward means toward the opponent, not rightward', () => {
  const f = mk([ELBOW]);
  f.facing = -1;
  hold(f, { left: true });
  assert.equal(f.resolveBasic('punch'), ELBOW, 'facing left, forward is left');
  hold(f, { right: true });
  assert.equal(f.resolveBasic('punch'), 'punch', 'facing left, right is backward');
});

test('a slot the character has not authored falls through to its basic', () => {
  const f = mk([ELBOW]);
  hold(f, { right: true });
  assert.equal(f.resolveBasic('kick'), 'kick');
  assert.equal(f.resolveBasic('slap'), 'slap');
});

test('both directions held at once counts as neutral', () => {
  const f = mk([ELBOW]);
  hold(f, { left: true, right: true });
  assert.equal(f.resolveBasic('punch'), 'punch');
});

// ---------------------------------------------------------------- the attack

test('a command normal uses its own frame data, still scaled by style', () => {
  const f = mk([ELBOW], 'brawler');   // dmg 1.18, reach 1.04
  f.startAttack(ELBOW, GAME);
  assert.ok(Math.abs(f.attack.dmg - 9 * 1.18) < 1e-9);
  assert.ok(Math.abs(f.attack.reach - 96 * 1.04) < 1e-9);
});

test('a strike command normal keeps its basic kind, so existing FX still apply', () => {
  const f = mk([ELBOW]);
  f.startAttack(ELBOW, GAME);
  assert.equal(f.attack.kind, 'punch');
  assert.equal(f.attack.button, 'punch');
});

test('a non-strike command normal carries its archetype as kind', () => {
  const f = mk([SEIZURE]);
  f.startAttack(SEIZURE, GAME);
  assert.equal(f.attack.kind, 'grab', 'so the engine grab branch runs');
  assert.equal(f.attack.button, 'kick', 'but it still chains as a kick');
});

test('a command normal announces itself on impact', () => {
  const f = mk([ELBOW]);
  f.startAttack(ELBOW, GAME);
  assert.deepEqual(f.attack.words, ['BOARDROOM ELBOW']);
});

test('sparse frame data inherits the rest from the basic it replaces', () => {
  const sparse = { slot: 'fwd+slap', archetype: 'strike', displayName: 'JAB', frameData: { dmg: 6 } };
  const f = mk([sparse]);
  f.startAttack(sparse, GAME);
  assert.equal(f.attack.hitY, ATTACKS.slap.hitY, 'presentation comes from the base move');
  assert.equal(f.attack.active, ATTACKS.slap.active);
  assert.ok(Math.abs(f.attack.dmg - 6) < 1e-9, 'and the authored value wins');
});

test('archetype params reach the attack so per-frame implementations work', () => {
  const f = mk([SEIZURE]);
  f.startAttack(SEIZURE, GAME);
  assert.equal(f.attack.special.type, 'grab');
});

// ---------------------------------------------------------------- the buffer
//
// The failure this guards against is silent: store the bare button and the
// command normal collapses back to its neutral basic the moment it is used
// inside a combo — which is the only place it earns its keep.

test('the chain buffer stores the resolved move, not the button', () => {
  const f = mk([ELBOW]);
  hold(f, { right: true });
  f.pad.punch = true;
  f.prevPad = { ...f.pad, punch: false };
  const a = { buffered: null };
  f.bufferChainInput(a);
  assert.equal(a.buffered, ELBOW);
});

test('the chain buffer stores a plain button when no direction was held', () => {
  const f = mk([ELBOW]);
  hold(f, {});
  f.pad.punch = true;
  f.prevPad = { ...f.pad, punch: false };
  const a = { buffered: null };
  f.bufferChainInput(a);
  assert.equal(a.buffered, 'punch');
});

test('a direction released before the cancel fires cannot rewrite the buffer', () => {
  const f = mk([ELBOW]);
  hold(f, { right: true });
  f.pad.punch = true;
  f.prevPad = { ...f.pad, punch: false };
  const a = { buffered: null };
  f.bufferChainInput(a);
  // player lets go of forward while the current attack is still recovering
  hold(f, {});
  f.bufferChainInput(a);
  assert.equal(a.buffered, ELBOW, 'what was pressed is what comes out');
});

test('non-basic finishers are buffered as plain keys', () => {
  const f = mk([ELBOW]);
  hold(f, { right: true });
  f.pad.special = true;
  f.prevPad = { ...f.pad, special: false };
  const a = { buffered: null };
  f.bufferChainInput(a);
  assert.equal(a.buffered, 'special');
});

test('a command normal chains on its basic button, under the one shared rule', () => {
  // no ladder: whatever the archetype, it cancels like the basic it sits on
  const f = mk([SEIZURE]);
  f.startAttack(SEIZURE, GAME);
  assert.ok(COMBO.BASICS.includes(f.attack.button),
    'a grab-archetype command normal must still read as a chainable basic');
});

// ---------------------------------------------------------------- absorb/place

test('counter and trap command normals swing no hitbox', () => {
  for (const archetype of ['counter', 'trap']) {
    const cn = {
      slot: 'fwd+launch', archetype, displayName: archetype.toUpperCase(),
      frameData: { ...ATTACKS.launch },
    };
    const f = mk([cn]);
    f.startAttack(cn, GAME);
    f.stateT = f.attack.startup + 0.01;      // squarely inside the active window
    assert.equal(f.hitbox(), null, `${archetype} must not connect on its own`);
  }
});

test('the counter window opens after startup and closes with it', () => {
  const cn = {
    slot: 'fwd+launch', archetype: 'counter', displayName: 'OBJECTION',
    frameData: { ...ATTACKS.launch }, params: { window: 0.2, dmg: 14, kb: 300 },
  };
  const f = mk([cn]);
  f.startAttack(cn, GAME);
  f.stateT = 0;
  assert.equal(f.counterActive(), null, 'not yet — still in startup');
  f.stateT = f.attack.startup + 0.1;
  assert.ok(f.counterActive(), 'open');
  f.stateT = f.attack.startup + 0.5;
  assert.equal(f.counterActive(), null, 'closed');
});

test('a fighter not holding a counter never reports one', () => {
  const f = mk([ELBOW]);
  f.startAttack(ELBOW, GAME);
  f.stateT = f.attack.startup + 0.01;
  assert.equal(f.counterActive(), null);
});
