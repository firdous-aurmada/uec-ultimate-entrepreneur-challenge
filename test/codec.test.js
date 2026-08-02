// Challenge-link codec.
//
// A link carries a whole fighter in a URL, so every field here is
// attacker-controlled. These tests care about two things: that a character
// survives the round trip intact, and that a hand-edited one does not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CODEC_VERSION, challengePayload, decodeChallenge, encodeChallengePayload,
} from '../src/state.js';
import { ATTACKS } from '../src/config.js';

// A launcher that pays for itself: it opens combo routes a plain punch cannot,
// and buys that with slower startup. Priced at ~+4.9, which is clean.
const ELBOW = {
  slot: 'fwd+punch', archetype: 'strike', displayName: 'BOARDROOM ELBOW',
  frameData: {
    ...ATTACKS.punch,
    dmg: 8, reach: 90, kbUp: -360,
    startup: ATTACKS.punch.startup * 1.2,
  },
};

const PROFILE = {
  name: 'FIRDOUS', company: 'AURMADA', baseId: 'b-neo', special: 'pitchdeck',
  style: 'balanced',
  body: { height: 1.05, build: 1, reach: 1, stride: 1, shoulders: 1, head: 1 },
  commandNormals: [ELBOW],
};

const trip = (profile, over = {}) =>
  decodeChallenge(encodeChallengePayload({ ...challengePayload({ profile, points: 240 }), ...over }));

test('a v2 link round-trips identity, style, proportions and command normals', () => {
  const got = trip(PROFILE);
  assert.ok(got, 'should decode');
  assert.equal(got.n, 'FIRDOUS');
  assert.equal(got.co, 'AURMADA');
  assert.equal(got.style, 'balanced');
  assert.equal(got.pts, 240);
  assert.ok(Math.abs(got.body.height - 1.05) < 1e-6);
  assert.equal(got.commandNormals.length, 1);
  assert.equal(got.commandNormals[0].slot, 'fwd+punch');
  assert.equal(got.commandNormals[0].archetype, 'strike');
  assert.equal(got.commandNormals[0].displayName, 'BOARDROOM ELBOW');
  assert.ok(Math.abs(got.commandNormals[0].frameData.dmg - 8) < 1e-6);
  assert.equal(got.commandNormals[0].frameData.kbUp, -360);
});

test('the payload is versioned', () => {
  assert.equal(challengePayload({ profile: PROFILE }).v, CODEC_VERSION);
});

test('a character with no command normals round-trips as an empty vocabulary', () => {
  const got = trip({ name: 'PLAIN', company: 'CO', baseId: 'b-neo' });
  assert.ok(got);
  assert.deepEqual(got.commandNormals, []);
  assert.equal(got.style, 'balanced');
});

// v1 links are already out in the world in shared posts and DMs. They must
// keep working — they simply describe a fighter with no vocabulary.
test('a v1 link still decodes', () => {
  const v1 = encodeChallengePayload({
    v: 1, n: 'OLD RIVAL', co: 'LEGACY LTD', f: 'b-hack', sp: 'growthhack', pts: 99,
  });
  const got = decodeChallenge(v1);
  assert.ok(got, 'v1 must not be rejected');
  assert.equal(got.n, 'OLD RIVAL');
  assert.equal(got.f, 'b-hack');
  assert.equal(got.pts, 99);
  assert.deepEqual(got.commandNormals, []);
});

test('an unknown codec version is refused', () => {
  assert.equal(decodeChallenge(encodeChallengePayload({ v: 99, n: 'X' })), null);
});

test('garbage decodes to nothing rather than throwing', () => {
  for (const junk of ['', 'not-base64!!', 'YWJj', '%%%']) {
    assert.equal(decodeChallenge(junk), null, `${JSON.stringify(junk)} should be refused`);
  }
});

// The point of the whole exercise.
test('a hand-edited link with inflated damage is rejected', () => {
  const cheat = challengePayload({ profile: PROFILE });
  cheat.cn[0].f[3] = 400;                        // frameData.dmg
  assert.equal(decodeChallenge(encodeChallengePayload(cheat)), null);
});

test('a hand-edited link with impossible startup is rejected', () => {
  const cheat = challengePayload({ profile: PROFILE });
  cheat.cn[0].f[0] = 0.0001;                     // frameData.startup
  assert.equal(decodeChallenge(encodeChallengePayload(cheat)), null);
});

test('a hand-edited link with out-of-range proportions is rejected', () => {
  const cheat = challengePayload({ profile: PROFILE });
  cheat.bd[0] = 4;                               // body.height
  assert.equal(decodeChallenge(encodeChallengePayload(cheat)), null);
});

test('a link stuffed with more command normals than allowed is rejected', () => {
  const cheat = challengePayload({
    profile: {
      ...PROFILE,
      commandNormals: [
        { ...ELBOW, slot: 'fwd+slap', frameData: { ...ATTACKS.slap } },
        { ...ELBOW, slot: 'fwd+punch' },
        { ...ELBOW, slot: 'fwd+kick', frameData: { ...ATTACKS.kick } },
        { ...ELBOW, slot: 'fwd+launch', frameData: { ...ATTACKS.launch } },
      ],
    },
  });
  assert.equal(decodeChallenge(encodeChallengePayload(cheat)), null);
});

test('a bogus slot or archetype index is rejected, not silently coerced', () => {
  for (const mutate of [(p) => { p.cn[0].s = 99; }, (p) => { p.cn[0].a = 99; }]) {
    const cheat = challengePayload({ profile: PROFILE });
    mutate(cheat);
    assert.equal(decodeChallenge(encodeChallengePayload(cheat)), null);
  }
});

// The obvious exploit is a small, fast, hard-to-hit fighter: shrinking the
// body removes the hurtbox refund that pays for an aggressive style, so the
// cost goes UP. (A LARGER body legitimately refunds enough to bring even
// phantom back into the clean band — that is the formula working, not a hole.)
test('an over-budget character cannot be smuggled in as a link', () => {
  const cheat = challengePayload({
    profile: {
      ...PROFILE, style: 'phantom', commandNormals: [],
      body: { height: 0.85, build: 0.9, reach: 1.15, stride: 1, shoulders: 1, head: 1 },
    },
  });
  assert.equal(decodeChallenge(encodeChallengePayload(cheat)), null);
});

test('animation is never carried in a link', () => {
  const p = challengePayload({ profile: { ...PROFILE, animOverrides: { idle: [{ t: 0 }] } } });
  assert.equal(JSON.stringify(p).includes('animOverrides'), false);
  assert.equal(JSON.stringify(p).includes('joints'), false);
});

// ---------------------------------------------------------------- netcode handshake

import { validatePeerCharacter, CHARACTER_WIRE_VERSION, SIM_VERSION } from '../src/net/online.js';
import { SCHEMA_VERSION } from '../src/data/schema.js';
import { toCharacter, FIGHTERS } from '../src/data/fighters.js';

const peerSpec = (over = {}) => ({
  wv: CHARACTER_WIRE_VERSION, sv: SCHEMA_VERSION, simv: SIM_VERSION,
  kind: 'roster', id: 'dex', ch: toCharacter(FIGHTERS.find(f => f.id === 'dex')),
  ...over,
});

test('a well-formed peer character is accepted', () => {
  assert.equal(validatePeerCharacter(peerSpec()).ok, true);
});

test('a peer on a different wire version is refused, not guessed at', () => {
  assert.equal(validatePeerCharacter(peerSpec({ wv: 99 })).ok, false);
  assert.equal(validatePeerCharacter(peerSpec({ sv: 99 })).ok, false);
});

test('a peer on a different SIMULATION is refused before the match, not mid-match', () => {
  // Two clients can agree perfectly on what a character IS and still disagree
  // on what it DOES. v2.8 made LAWYERED deal the 13 damage it had always been
  // priced at instead of 10 — an identical character payload, so wv and sv both
  // still matched. Without simv the handshake passed and the state hash voided
  // the match two seconds after the first counter, looking like a network drop.
  assert.equal(validatePeerCharacter(peerSpec({ simv: SIM_VERSION + 1 })).ok, false);
  assert.equal(validatePeerCharacter(peerSpec({ simv: SIM_VERSION - 1 })).ok, false);
});

test('a peer predating the sim-version field is refused rather than assumed current', () => {
  const { simv, ...noSimv } = peerSpec();
  assert.equal(validatePeerCharacter(noSimv).ok, false);
});

test('a peer sending no character at all is refused', () => {
  for (const spec of [null, undefined, {}, peerSpec({ ch: null })]) {
    assert.equal(validatePeerCharacter(spec).ok, false);
  }
});

test('a peer sending an over-budget character is refused with a reason', () => {
  const spec = peerSpec();
  spec.ch = { ...spec.ch, fighting: { ...spec.ch.fighting, dmg: 1.6, speed: 1.3, hp: 1.3 } };
  const r = validatePeerCharacter(spec);
  assert.equal(r.ok, false);
  assert.match(r.reason, /rejected/i);
});

test('a peer sending inflated command-normal frame data is refused', () => {
  const spec = peerSpec();
  spec.ch = {
    ...spec.ch,
    commandNormals: [{
      slot: 'fwd+punch', archetype: 'strike', displayName: 'CHEAT',
      frameData: { startup: 0.001, active: 0.06, recovery: 0.11, dmg: 500, reach: 400 },
    }],
  };
  assert.equal(validatePeerCharacter(spec).ok, false);
});

test('validation never throws on hostile input', () => {
  for (const junk of [0, '', [], { ch: 'nope' }, { wv: CHARACTER_WIRE_VERSION, sv: SCHEMA_VERSION, ch: [] }]) {
    assert.doesNotThrow(() => validatePeerCharacter(junk));
  }
});
