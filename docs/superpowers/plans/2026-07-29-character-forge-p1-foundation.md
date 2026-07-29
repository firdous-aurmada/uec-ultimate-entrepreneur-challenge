# Character Forge — P1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the engine read body proportions and moves from a validated character schema, with all nine shipped characters migrated and gameplay provably unchanged.

**Architecture:** A new `src/data/schema.js` owns the character format, its validator, and the power-budget formula. `src/engine/proportions.js` post-processes the pose object that `computePose()` already returns — with every knob at 1.0 it returns the same object reference, so pixel-identity is structural rather than merely tested. `src/engine/moves.js` extracts the six special archetypes currently branched inline in `game.js`/`fighter.js`. A browser golden-image harness hashes rendered fighters to catch visual regressions.

**Tech Stack:** Vanilla ES modules, zero dependencies, no build step. Logic tests run on Node's built-in test runner (`node --test`, Node 23, `"type": "module"` already set). Canvas tests run in a browser harness page because a Node canvas would require a native dependency, which this project does not allow.

---

## Deviations from the spec

Three, all found while reading the code the plan targets. The spec should be amended to match.

**1. Seven archetypes in P1, not eight.** The spec (§4) lists eight including `counter` and `trap`, and folds `aoe` into `strike`. But `aoe` is a live special type (Burn Rate Blast) and P1 must preserve behaviour exactly, so it stays its own archetype — giving `strike`, `projectile`, `aoe`, `rush`, `grab`, `teleport`, `rain`. `counter` and `trap` move to the front of P2: nothing can author them until the Incubator exists, so building them now means shipping speculative code verified through a harness instead of real play.

**2. `game.js` needs no changes.** Spec §6 lists it as modified for "special dispatch". Its only `sp.type` branches (`game.js:382-383`) are audio cues. All real dispatch lives in `fighter.js:383-388` and `:407-434`. Task 8 targets `fighter.js` instead.

**3. The netcode work in spec §8 is not needed yet.** The spec says the character definition should feed the state hash. Reading `hashGameState` (`src/net/online.js:55`), it fingerprints derived state — positions, HP, energy, timer — not definitions. Peers holding different character data would diverge on the first hit and the existing detector would catch it downstream. So no change is needed while the roster is identical on both peers, which it is throughout P1. This becomes real in P3 when characters actually vary, and is deferred there.

## File structure

**Create:**
- `test/schema.test.js` — validator and budget tests
- `test/proportions.test.js` — clamping and pose-transform tests
- `test/golden/index.html` — browser golden-image harness
- `test/golden/hash.js` — FNV-1a pixel hashing, shared by harness and baseline
- `test/golden/baseline.json` — committed hashes (generated in Task 6)
- `src/data/schema.js` — schema constants, validator, power budget
- `src/engine/proportions.js` — body clamping and pose proportioning
- `src/engine/moves.js` — the six archetype implementations

**Modify:**
- `package.json` — add the `test` script
- `src/config.js` — `BODY` bounds, `BUDGET` weights
- `src/engine/fighter.js:101-106` — hurtbox from body; `:383-388`, `:407-434` — archetype dispatch
- `src/engine/drawFighter.js:718-728` — buffer sizing; `:769-870` — proportion post-pass
- `src/data/fighters.js` — migrate roster to schema v1

`src/engine/game.js` is deliberately untouched — see deviation 2.

---

### Task 1: Test runner scaffolding

**Files:**
- Modify: `package.json`
- Test: `test/smoke.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/smoke.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION } from '../src/config.js';

test('config is importable from the test runner', () => {
  assert.match(VERSION, /^v\d+\.\d+/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `npm error Missing script: "test"`

- [ ] **Step 3: Add the test script**

In `package.json`, add to `"scripts"`:

```json
    "test": "node --test test/"
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — `# pass 1`

If this fails on the `config.js` import, the cause is `DEBUG` at `src/config.js:217` reading `location.search`, which does not exist in Node. Fix it in `src/config.js`:

```js
export const DEBUG = typeof location !== 'undefined'
  && new URLSearchParams(location.search).has('debug');
```

- [ ] **Step 5: Commit**

```bash
git add package.json test/smoke.test.js src/config.js
git commit -m "test: add node --test runner scaffolding"
```

---

### Task 2: Body bounds and budget weights

**Files:**
- Modify: `src/config.js`
- Test: `test/schema.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/schema.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY, BUDGET } from '../src/config.js';

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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `BODY` and `BUDGET` are undefined

- [ ] **Step 3: Add the constants**

Append to `src/config.js`:

```js
// ---------------------------------------------------------------------------
// BODY PROPORTIONS
//
// Bounded knobs, all defaulting to 1.0. Clamped rather than free so hurtbox
// and camera maths stay predictable and balance stays reasonable. Widening a
// range later is safe; the clamp is the only thing enforcing it.
// ---------------------------------------------------------------------------
export const BODY = {
  height:    [0.82, 1.22],   // overall scale
  build:     [0.85, 1.25],   // torso + limb thickness
  reach:     [0.88, 1.20],   // arm length; feeds effective move reach
  stride:    [0.88, 1.18],   // leg length
  shoulders: [0.85, 1.25],
  head:      [0.90, 1.12],
};

// ---------------------------------------------------------------------------
// POWER BUDGET
//
// v2.3 shipped Carl Icahnt at +58% damage AND +10% HP because nothing stopped
// style multipliers from compounding. This makes that class of error
// structurally impossible instead of something review has to catch.
//
// speed is weighted above 1.0 because movement advantage compounds with
// everything else. startup/recovery sit below 1.0 to avoid double-counting
// frame advantage. hurtbox is a REFUND — a bigger body is easier to hit, so
// size is partly self-balancing.
// ---------------------------------------------------------------------------
export const BUDGET = {
  W: {
    dmg: 1.0, hp: 1.0, speed: 1.2, reach: 1.0,
    startup: 0.7, recovery: 0.5,
    bodyReach: 0.8, hurtbox: -0.6,
  },
  WARN: 8,     // |cost| above this warns
  BLOCK: 15,   // |cost| above this blocks export
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — `# pass 3`

- [ ] **Step 5: Commit**

```bash
git add src/config.js test/schema.test.js
git commit -m "feat: add body proportion bounds and power budget weights"
```

---

### Task 3: The power budget formula

The formula must reproduce the spec §3 table exactly. That table is the regression test — it encodes the judgement that PHANTOM is overtuned.

**Files:**
- Create: `src/data/schema.js`
- Test: `test/schema.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/schema.test.js`:

```js
import { budgetCost, budgetBand } from '../src/data/schema.js';
import { STYLES } from '../src/config.js';

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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../src/data/schema.js`

- [ ] **Step 3: Write the implementation**

Create `src/data/schema.js`:

```js
// The character format, its validator, and the power budget.
//
// Shared by the game's load path and the Incubator authoring tool, so a
// character that validates here is playable there and vice versa.

import { BODY, BUDGET } from '../config.js';

export const SCHEMA_VERSION = 1;

// Cost in budget points. Positive = net advantage, negative = net handicap.
// Zero is the balanced baseline. See docs/superpowers/specs for the rationale
// behind each weight.
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — `# pass 7`

If any style is off by more than 0.05, the weights in `BUDGET.W` are wrong, not the expected table. The table was computed from those exact weights; do not edit the expectations to make the test pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/schema.js test/schema.test.js
git commit -m "feat: power budget formula, locked to the shipped-roster table"
```

---

### Task 4: The character validator

**Files:**
- Modify: `src/data/schema.js`
- Test: `test/schema.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/schema.test.js`:

```js
import { validateCharacter, DEFAULT_BODY } from '../src/data/schema.js';

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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `validateCharacter` is not exported

- [ ] **Step 3: Write the implementation**

Append to `src/data/schema.js`:

```js
export const DEFAULT_BODY = { height: 1, build: 1, reach: 1, stride: 1, shoulders: 1, head: 1 };

// `aoe` is a live special type (Burn Rate Blast) and stays its own archetype
// for P1, because P1 must preserve behaviour exactly. The spec's §4 idea of
// folding it into `strike` is a P3 consolidation, not a foundation change.
export const ARCHETYPES = ['strike', 'projectile', 'aoe', 'rush', 'grab', 'teleport', 'rain'];
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
    cost = budgetCost(fighting, body);
    band = budgetBand(cost);
    if (band === 'block') errors.push(`power budget ${cost.toFixed(1)} exceeds ±${BUDGET.BLOCK}`);
    else if (band === 'warn') warnings.push(`power budget ${cost.toFixed(1)} is outside ±${BUDGET.WARN}`);
  }

  return { ok: errors.length === 0, errors, warnings, cost, band };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — `# pass 15`

- [ ] **Step 5: Commit**

```bash
git add src/data/schema.js test/schema.test.js
git commit -m "feat: character schema validator"
```

---

### Task 5: Pose proportioning

The identity guarantee lives here. With every knob at 1.0 `applyProportions` returns **the same object reference** it was given, so a neutral character cannot render differently no matter what the rest of the function does.

**Files:**
- Create: `src/engine/proportions.js`
- Test: `test/proportions.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/proportions.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampBody, applyProportions, bufferMetrics } from '../src/engine/proportions.js';
import { DEFAULT_BODY } from '../src/data/schema.js';

function samplePose() {
  return {
    hipY: -66, shoulderY: -114, headX: 0, headY: -134, rot: 0, crouch: 0,
    armF: { x: 30, y: -98 }, armB: { x: 18, y: -90 },
    legF: { x: 15, y: 0 }, legB: { x: -14, y: 0 },
    face: 'idle', briefcase: false, bodyLean: 0, sx: 1, sy: 1,
  };
}

test('clampBody fills defaults and clamps out-of-range values', () => {
  assert.deepEqual(clampBody(undefined), DEFAULT_BODY);
  assert.equal(clampBody({ height: 99 }).height, 1.22);
  assert.equal(clampBody({ height: 0.1 }).height, 0.82);
  assert.equal(clampBody({ height: 'nonsense' }).height, 1);
});

test('a neutral body returns the very same pose object', () => {
  const P = samplePose();
  assert.equal(applyProportions(P, DEFAULT_BODY), P, 'must be the identical reference');
});

test('longer arms move the hands out without moving the feet', () => {
  const P = applyProportions(samplePose(), clampBody({ reach: 1.2 }));
  assert.ok(Math.abs(P.armF.x - 36) < 0.01);
  assert.equal(P.legF.y, 0);
});

test('a taller body raises hip, shoulder and head, keeping feet at the origin', () => {
  const P = applyProportions(samplePose(), clampBody({ height: 1.2, stride: 1.1 }));
  assert.ok(P.hipY < -66, 'hip should rise');
  assert.ok(P.shoulderY < -114, 'shoulder should rise');
  assert.ok(P.headY < -134, 'head should rise');
  assert.ok(P.headY < P.shoulderY && P.shoulderY < P.hipY, 'ordering must hold');
});

test('proportions expose the derived widths the renderer needs', () => {
  const P = applyProportions(samplePose(), clampBody({ build: 1.2, head: 1.1, shoulders: 1.15 }));
  assert.ok(Math.abs(P.armW - 13 * 1.2) < 0.01);
  assert.ok(Math.abs(P.legW - 15 * 1.2) < 0.01);
  assert.ok(Math.abs(P.headR - 22 * 1.1) < 0.01);
  assert.ok(Math.abs(P.shoulderW - 1.15) < 0.01);
});

test('a neutral body yields exactly the historical buffer dimensions', () => {
  assert.deepEqual(bufferMetrics(DEFAULT_BODY), { ox: 130, oy: 250, w: 280, h: 300 });
});

test('a bigger body grows the buffer so it cannot clip', () => {
  const m = bufferMetrics(clampBody({ height: 1.22, reach: 1.2 }));
  assert.ok(m.h > 300 && m.oy > 250 && m.w > 280);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../src/engine/proportions.js`

- [ ] **Step 3: Write the implementation**

Create `src/engine/proportions.js`:

```js
// Body proportions: clamping, and the post-pass that turns a neutral pose
// from computePose() into a proportioned one.
//
// computePose already returns limb targets in local space (origin at the feet,
// +x = facing), so proportions are a transform of that object rather than an
// edit to every hardcoded offset in drawFighter.js. The neutral case returns
// the same object reference, which is what makes pixel-identity structural.

import { BODY } from '../config.js';
import { DEFAULT_BODY } from '../data/schema.js';

// Baselines the literals in drawFighter.js are written against.
const BASE_ARM_W = 13, BASE_LEG_W = 15, BASE_HEAD_R = 22;
const BASE = { BUF_OX: 130, BUF_OY: 250, BUF_W: 280, BUF_H: 300 };

export function clampBody(body) {
  const out = { ...DEFAULT_BODY };
  if (!body) return out;
  for (const key of Object.keys(DEFAULT_BODY)) {
    const v = Number(body[key]);
    if (!Number.isFinite(v)) continue;
    const [lo, hi] = BODY[key];
    out[key] = Math.min(hi, Math.max(lo, v));
  }
  return out;
}

export function isNeutral(b) {
  return b.height === 1 && b.build === 1 && b.reach === 1
    && b.stride === 1 && b.shoulders === 1 && b.head === 1;
}

// Mutates and returns P. Neutral bodies short-circuit to the same reference.
export function applyProportions(P, body) {
  if (isNeutral(body)) return P;

  const oldHip = P.hipY, oldShoulder = P.shoulderY;

  // Rebuild the vertical chain from the feet up so the character never floats:
  // legs set the hip, torso sets the shoulder, neck sets the head.
  const hip = oldHip * body.stride;
  const torso = (oldShoulder - oldHip) * body.height;
  const neck = (P.headY - oldShoulder) * body.height;
  P.hipY = hip;
  P.shoulderY = hip + torso;
  P.headY = hip + torso + neck;
  P.headX *= body.reach;

  // Arms scale outward with reach and re-anchor to the moved shoulder.
  for (const arm of [P.armF, P.armB]) {
    arm.x *= body.reach;
    arm.y = P.shoulderY + (arm.y - oldShoulder) * body.height;
  }
  // Legs scale with stride; y is foot lift, which scales the same way.
  for (const leg of [P.legF, P.legB]) {
    leg.x *= body.stride;
    leg.y *= body.stride;
  }

  P.armW = BASE_ARM_W * body.build;
  P.legW = BASE_LEG_W * body.build;
  P.headR = BASE_HEAD_R * body.head;
  P.shoulderW = body.shoulders;
  P.build = body.build;
  return P;
}

// Buffer big enough that the widest/tallest body cannot clip. Neutral bodies
// return exactly the historical dimensions, so their render is byte-identical.
export function bufferMetrics(body) {
  const sx = Math.max(1, body.reach, body.build, body.shoulders);
  const sy = Math.max(1, body.height, body.stride);
  return {
    ox: Math.ceil(BASE.BUF_OX * sx), oy: Math.ceil(BASE.BUF_OY * sy),
    w: Math.ceil(BASE.BUF_W * sx), h: Math.ceil(BASE.BUF_H * sy),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — `# pass 22`

- [ ] **Step 5: Commit**

```bash
git add src/engine/proportions.js test/proportions.test.js
git commit -m "feat: body proportion clamping and pose post-pass"
```

---

### Task 6: Golden-image harness and baseline

Built **before** any renderer change, so the baseline captures current behaviour. Runs in a browser because a Node canvas needs a native dependency.

**Files:**
- Create: `test/golden/hash.js`, `test/golden/index.html`, `test/golden/baseline.json`

- [ ] **Step 1: Write the hashing module**

Create `test/golden/hash.js`:

```js
// FNV-1a over raw RGBA bytes. Zero dependency, stable across runs, and
// sensitive enough that a single changed pixel changes the hash.
export function hashPixels(data) {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Every fighter state worth pinning. `t` is animation time; attacks also pin
// stateT so the captured frame is inside the active window.
export const CASES = [
  { state: 'idle', t: 0 },
  { state: 'idle', t: 1.37 },
  { state: 'walk', t: 0.5, walkPhase: 2.1 },
  { state: 'crouch', t: 0.5, crouching: true },
  { state: 'jump', t: 0.5, airborne: true },
  { state: 'block', t: 0.5 },
  { state: 'hitstun', t: 0.5, stateT: 0.1 },
  { state: 'ko', t: 0.5, stateT: 0.4 },
  { state: 'victory', t: 0.9, stateT: 0.6 },
  { state: 'attack', t: 0.5, kind: 'slap', stateT: 0.07 },
  { state: 'attack', t: 0.5, kind: 'punch', stateT: 0.08 },
  { state: 'attack', t: 0.5, kind: 'kick', stateT: 0.14 },
  { state: 'attack', t: 0.5, kind: 'launch', stateT: 0.11 },
];
```

- [ ] **Step 2: Write the harness page**

Create `test/golden/index.html`:

```html
<meta charset="utf-8">
<title>UEC golden images</title>
<style>
  body { background: #0b0e1a; color: #eef1ff; font: 14px ui-monospace, monospace; padding: 16px; }
  #out { white-space: pre; line-height: 1.5; }
  .ok { color: #57ff8a; } .bad { color: #ff3d6e; }
  button { font: inherit; padding: 6px 14px; margin-right: 8px; }
</style>
<button id="check">CHECK against baseline</button>
<button id="write">WRITE new baseline</button>
<div id="out">ready</div>
<canvas id="c" width="360" height="380" style="display:none"></canvas>
<script type="module">
import { FIGHTERS } from '../../src/data/fighters.js';
import { drawFighter } from '../../src/engine/drawFighter.js';
import { ATTACKS } from '../../src/config.js';
import { hashPixels, CASES } from './hash.js';

const out = document.getElementById('out');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// Three Math.random() calls sit in the render/update path — hit jitter in
// drawFighter, the unicorn sparkle and the rush spark in fighter.js. Without
// pinning, baselines never reproduce.
const realRandom = Math.random;

// computePose only reads plain fields, so a stub object is enough — no Game
// instance, no controller, no audio.
function stubFighter(def, c) {
  return {
    def, side: 0, x: 180, y: 330, facing: 1,
    state: c.state, stateT: c.stateT ?? 0, walkPhase: c.walkPhase ?? 0,
    airborne: !!c.airborne, crouching: !!c.crouching, movingBack: false,
    unicornT: 0, flashT: 0,
    attack: c.kind ? { ...ATTACKS[c.kind], kind: c.kind, hasHit: false } : null,
  };
}

function capture() {
  const result = {};
  Math.random = () => 0.5;
  try {
    for (const def of FIGHTERS) {
      for (const c of CASES) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawFighter(ctx, stubFighter(def, c), c.t);
        const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        result[`${def.id}/${c.state}${c.kind ? ':' + c.kind : ''}@${c.t}`] = hashPixels(px);
      }
    }
  } finally {
    Math.random = realRandom;
  }
  return result;
}

document.getElementById('check').onclick = async () => {
  const current = capture();
  const baseline = await fetch('./baseline.json').then(r => r.json());
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(current)])].sort();
  let bad = 0;
  const lines = keys.map(k => {
    const ok = baseline[k] === current[k];
    if (!ok) bad++;
    return `${ok ? '  ok  ' : ' FAIL '} ${k}  ${baseline[k] ?? '(new)'} → ${current[k] ?? '(gone)'}`;
  });
  out.innerHTML = `<span class="${bad ? 'bad' : 'ok'}">${bad ? bad + ' MISMATCH' : 'ALL ' + keys.length + ' MATCH'}</span>\n\n`
    + lines.filter(l => l.startsWith(' FAIL') || !bad).join('\n');
};

document.getElementById('write').onclick = async () => {
  const body = JSON.stringify(capture(), null, 2);
  const res = await fetch('./baseline.json', { method: 'PUT', body });
  out.textContent = res.ok ? 'baseline written — commit it' : 'PUT failed: run under dev-server.py';
};
</script>
```

- [ ] **Step 3: Start the dev server and capture the baseline**

```bash
python3 dev-server.py 4173
```

Open `http://localhost:4173/test/golden/index.html`, click **WRITE new baseline**.
Expected: `baseline written — commit it`, and `test/golden/baseline.json` now holds 117 entries (9 fighters × 13 cases).

- [ ] **Step 4: Verify the baseline is stable**

Click **CHECK against baseline**, then reload the page and click **CHECK** again.
Expected: `ALL 117 MATCH` both times.

If the second run differs, an unpinned nondeterminism source remains. Find it before continuing — the whole task's value depends on reproducibility. Re-check for `Math.random`, `Date.now`, and any `performance.now` in the draw path.

- [ ] **Step 5: Commit**

```bash
git add test/golden/
git commit -m "test: golden-image harness and baseline for the shipped roster"
```

---

### Task 7: Wire proportions into the renderer and hurtbox

**Files:**
- Modify: `src/engine/drawFighter.js:718-728`, `:769-870`
- Modify: `src/engine/fighter.js:101-106`
- Verify: `test/golden/index.html`

- [ ] **Step 1: Make the buffer body-aware**

In `src/engine/drawFighter.js`, replace line 718-728:

```js
const SS = 2, BUF_OX = 130, BUF_OY = 250, BUF_W = 280, BUF_H = 300;
let _buf = null, _tmp = null;
function fighterBuffer() {
  if (!_buf && typeof document !== 'undefined') {
    _buf = document.createElement('canvas');
    _buf.width = BUF_W * SS; _buf.height = BUF_H * SS;
    _tmp = document.createElement('canvas');
    _tmp.width = BUF_W * SS; _tmp.height = BUF_H * SS;
  }
  return _buf;
}
```

with:

```js
const SS = 2;
// Live metrics for the buffer currently allocated. Neutral bodies keep the
// historical 280×300 at (130, 250), so their render is byte-identical.
let BUF_OX = 130, BUF_OY = 250, BUF_W = 280, BUF_H = 300;
let _buf = null, _tmp = null;
function fighterBuffer(m) {
  if (typeof document === 'undefined') return null;
  if (!_buf) {
    _buf = document.createElement('canvas');
    _tmp = document.createElement('canvas');
  }
  // Grow only. Bodies are fixed for a match, so this stabilises on frame 1
  // and never thrashes.
  if (m.w > BUF_W || m.h > BUF_H) {
    BUF_W = Math.max(BUF_W, m.w); BUF_H = Math.max(BUF_H, m.h);
    _buf.width = BUF_W * SS; _buf.height = BUF_H * SS;
    _tmp.width = BUF_W * SS; _tmp.height = BUF_H * SS;
  } else if (_buf.width !== BUF_W * SS) {
    _buf.width = BUF_W * SS; _buf.height = BUF_H * SS;
    _tmp.width = BUF_W * SS; _tmp.height = BUF_H * SS;
  }
  BUF_OX = Math.max(BUF_OX, m.ox); BUF_OY = Math.max(BUF_OY, m.oy);
  return _buf;
}
```

- [ ] **Step 2: Apply proportions in the draw path**

At the top of `src/engine/drawFighter.js`, add to the imports:

```js
import { clampBody, applyProportions, bufferMetrics } from './proportions.js';
```

In `drawFighter` (line 769-771), replace:

```js
export function drawFighter(ctx, f, t) {
  const def = f.def;
  const P = computePose(f, t);
```

with:

```js
export function drawFighter(ctx, f, t) {
  const def = f.def;
  const body = f.body || clampBody(def.body);
  const P = applyProportions(computePose(f, t), body);
```

Replace line 789:

```js
  const buf = STYLE.shaded ? fighterBuffer() : null;
```

with:

```js
  const buf = STYLE.shaded ? fighterBuffer(bufferMetrics(body)) : null;
```

- [ ] **Step 3: Use the derived widths**

In `drawFighter`, replace the four limb-draw lines (811, 813, 851, 853) so they read the proportioned widths, falling back to the literals for neutral bodies:

```js
  // back arm, back leg
  capsule(g, -10, P.shoulderY + 8, P.armB.x, P.armB.y, P.armW ?? 13, c.suit2);
  blob(g, () => { g.arc(P.armB.x, P.armB.y, 8.5, 0, 7); }, c.skin);
  capsule(g, -8, P.hipY, P.legB.x, P.legB.y - 6, P.legW ?? 15, c.pants);
```

```js
  // front leg, front arm
  capsule(g, 8, P.hipY, P.legF.x, P.legF.y - 6, P.legW ?? 15, c.pants);
  blob(g, () => { g.roundRect(P.legF.x - 7, P.legF.y - 9, 26, 10, 5); }, c.shoe);
  capsule(g, 10, P.shoulderY + 8, P.armF.x, P.armF.y, P.armW ?? 13, c.suit);
```

And line 824, so head size follows the `head` knob:

```js
  drawHead(g, def, P.headX + (P.bodyLean * 26), P.headY, P.headR ?? 22, P.face, t, f.unicornT > 0);
```

- [ ] **Step 4: Derive the hurtbox from the body**

In `src/engine/fighter.js`, add to the imports:

```js
import { clampBody } from './proportions.js';
```

In the constructor, after `this.def = def;` (line 13), add:

```js
    this.body = clampBody(def.body);
```

Replace `hurtbox()` (lines 101-106):

```js
  hurtbox() {
    // crouching ducks you under high attacks — the reward for the stance.
    // A bigger body is a bigger target, which is what pays for its damage.
    const b = this.body;
    const full = PHYS.BODY_H * b.height;
    const h = this.airborne ? 120 * b.height : (this.crouching ? full * 0.68 : full);
    const w = PHYS.BODY_W * b.build;
    return { x: this.x - w / 2, y: this.y - h, w, h };
  }
```

- [ ] **Step 5: Verify pixel-identity**

Run: `npm test`
Expected: PASS — `# pass 22`

Then reload `http://localhost:4173/test/golden/index.html` and click **CHECK against baseline**.
Expected: `ALL 117 MATCH`

**This is the acceptance gate for the task.** Any mismatch means the refactor changed the render for a neutral body. Do not update the baseline to make it pass — find the divergence.

- [ ] **Step 6: Verify extremes do not clip**

In the browser console on the harness page:

```js
const { FIGHTERS } = await import('../../src/data/fighters.js');
const { clampBody, bufferMetrics } = await import('../../src/engine/proportions.js');
const extremes = [
  { height: 1.22, build: 1.25, reach: 1.20, stride: 1.18, shoulders: 1.25, head: 1.12 },
  { height: 0.82, build: 0.85, reach: 0.88, stride: 0.88, shoulders: 0.85, head: 0.90 },
];
extremes.map(b => bufferMetrics(clampBody(b)));
```

Expected: the max case returns `w ≥ 350, h ≥ 366`; the min case returns exactly `{ ox: 130, oy: 250, w: 280, h: 300 }` because the buffer never shrinks below baseline.

- [ ] **Step 7: Commit**

```bash
git add src/engine/drawFighter.js src/engine/fighter.js
git commit -m "feat: body proportions drive the renderer and hurtbox"
```

---

### Task 8: Extract move archetypes

Behaviour-preserving extraction of the special-type chains out of `fighter.js:383-388` and `:407-434`. Nothing about how a move behaves changes — only where the code lives.

**Files:**
- Create: `src/engine/moves.js`
- Modify: `src/engine/fighter.js:369-435`
- Test: `test/moves.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/moves.test.js`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../src/engine/moves.js`

- [ ] **Step 3: Write the implementation**

Create `src/engine/moves.js`:

```js
// Move archetypes. The engine implements these; characters compose and tune
// them. Extracted verbatim from the sp.type chains that used to live in
// fighter.js — behaviour is unchanged, only the dispatch moved.
//
// Seven for now: `strike` covers the basics, and the other six mirror the
// shipped special types one-for-one. `counter` and `trap` arrive in P2,
// alongside the authoring UI that can actually create them.

// Per-archetype shaping applied when a special starts.
export const ARCHETYPE_SHAPES = {
  strike: (a) => { a.words = ['ZAP!']; },
  projectile: (a, sp) => {
    a.active = 0.05 + sp.count * sp.interval;
    a.words = ['SLIDE!', 'DECK!'];
  },
  aoe: (a) => { a.words = ['BURN!', 'TORCHED!']; a.hitY = -80; },
  teleport: (a) => { a.words = ['PIVOT!']; a.reach = 92; a.hitY = -95; },
  rush: (a, sp) => {
    a.active = sp.duration;
    a.words = ['VIRAL!', 'GROWTH!'];
    a.reach = 70; a.hitY = -90;
  },
  rain: (a) => { a.words = ['FUNDED!']; },
  grab: (a) => { a.words = ['ACQUIRED!']; a.hitY = -95; },
};

// Applies archetype shaping to a freshly built attack object. Returns it.
export function shapeAttack(a, sp) {
  const shape = ARCHETYPE_SHAPES[sp.type] || ARCHETYPE_SHAPES.strike;
  if (!a.words) a.words = ['ZAP!'];
  shape(a, sp);
  return a;
}

// Per-frame behaviour while a special is active. Called from
// Fighter.updateAttack with the elapsed active time.
export const ARCHETYPE_TICKS = {
  projectile: (f, a, sp, dt, game) => {
    a.fireT -= dt;
    if (a.fired < sp.count && a.fireT <= 0) {
      game.spawnSlide(f, a.fired);
      a.fired++;
      a.fireT = sp.interval;
    }
  },
  rain: (f, a, sp, dt, game) => {
    if (a.hasFired) return;
    a.hasFired = true;
    game.spawnRain(f);
  },
  teleport: (f, a, sp, dt, game) => {
    if (a.teleported) return;
    a.teleported = true;
    game.doTeleport(f);
  },
  rush: (f, a, sp, dt, game, activeT) => {
    if (activeT > a.active) return;
    // free flight until contact; after lock-on, chase to stay glued
    const opp = game.other(f);
    const gap = (opp.x - f.x) * f.facing;
    if (!a.lockedOn) {
      f.x += f.facing * sp.speed * dt;
    } else if (gap > 62) {
      f.x += f.facing * Math.min(sp.speed * dt, gap - 58);
    }
    if (Math.random() < 30 * dt) game.fx.spark(f.x - f.facing * 30, f.y - 80, f.def.c.accent, 2, 160);
    game.pushAfterimage(f);
  },
  aoe: (f, a, sp, dt, game, activeT) => {
    if (a.fxDone || activeT >= 0.1) return;
    a.fxDone = true;
    game.onBurnBlast(f);
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — `# pass 27`

- [ ] **Step 5: Delegate from Fighter**

In `src/engine/fighter.js`, add to the imports:

```js
import { shapeAttack, ARCHETYPE_TICKS } from './moves.js';
```

Replace the per-type shaping block in `startSpecial` (lines 383-388):

```js
    // per-type shaping
    if (sp.type === 'projectile') { a.active = 0.05 + sp.count * sp.interval; a.words = ['SLIDE!', 'DECK!']; }
    if (sp.type === 'aoe')       { a.words = ['BURN!', 'TORCHED!']; a.hitY = -80; }
    if (sp.type === 'teleport')  { a.words = ['PIVOT!']; a.reach = 92; a.hitY = -95; }
    if (sp.type === 'rush')      { a.active = sp.duration; a.words = ['VIRAL!', 'GROWTH!']; a.reach = 70; a.hitY = -90; }
    if (sp.type === 'rain')      { a.words = ['FUNDED!']; }
    if (sp.type === 'grab')      { a.words = ['ACQUIRED!']; a.hitY = -95; }
    this.attack = a;
```

with:

```js
    this.attack = shapeAttack(a, sp);
```

Replace the tick chain in `updateAttack` (lines 407-434):

```js
    if (sp.type === 'projectile' && activeT >= 0) {
```

through the end of that `else if` chain, with:

```js
    if (activeT < 0) return;
    const tick = ARCHETYPE_TICKS[sp.type];
    if (tick) tick(this, a, sp, dt, game, activeT);
```

- [ ] **Step 6: Verify nothing changed in play**

Run: `npm test`
Expected: PASS — `# pass 27`

Then open `http://localhost:4173/?debug` and fight one full match, using each special at least once. Expected: identical behaviour — Pitch Deck fires three slides, Burn Rate flashes on contact, Pivot teleports behind, Growth Hack rushes and locks on, Funding Round rains coins, Hostile Takeover grabs.

- [ ] **Step 7: Commit**

```bash
git add src/engine/moves.js src/engine/fighter.js test/moves.test.js
git commit -m "refactor: extract the six move archetypes into moves.js"
```

---

### Task 9: Migrate the roster to schema v1

**Files:**
- Modify: `src/data/fighters.js`
- Test: `test/roster.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/roster.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIGHTERS, BASE_CHARACTERS, toCharacter } from '../src/data/fighters.js';
import { validateCharacter } from '../src/data/schema.js';

test('every shipped fighter converts to a schema v1 character', () => {
  for (const def of FIGHTERS) {
    const ch = toCharacter(def);
    assert.equal(ch.schema, 1, `${def.id} wrong schema version`);
    assert.equal(ch.id, def.id);
  }
});

test('every shipped fighter has a body, defaulting to neutral', () => {
  for (const def of [...FIGHTERS, ...BASE_CHARACTERS]) {
    const ch = toCharacter(def);
    for (const v of Object.values(ch.body)) {
      assert.ok(typeof v === 'number' && v > 0, `${def.id} has a bad body knob`);
    }
  }
});

test('ids are unique across roster and base characters', () => {
  const ids = [...FIGHTERS, ...BASE_CHARACTERS].map(f => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

// PHANTOM is over budget (spec §3). This test records that rather than hiding
// it — the retune is scheduled for P3, and this will need updating then.
test('the roster validates, with exactly one known over-budget character', () => {
  const blocked = [];
  for (const def of FIGHTERS) {
    const r = validateCharacter(toCharacter(def));
    if (r.band === 'block') blocked.push(def.id);
    else assert.equal(r.ok, true, `${def.id}: ${r.errors.join('; ')}`);
  }
  assert.deepEqual(blocked, ['ava'], 'only Lizbeth Holmez (phantom) should be over budget');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `toCharacter` is not exported

- [ ] **Step 3: Write the adapter**

Append to `src/data/fighters.js`:

```js
import { SCHEMA_VERSION, DEFAULT_BODY } from './schema.js';
import { STYLES } from '../config.js';

// Adapts a legacy roster entry to a schema v1 character. Roster entries stay
// in their current shape so the rest of the game keeps working unchanged;
// this is the seam the Incubator and the validator read through.
export function toCharacter(def) {
  const st = STYLES[def.style] || STYLES.balanced;
  const sp = SPECIALS[def.special] || SPECIALS.pitchdeck;
  return {
    schema: SCHEMA_VERSION,
    id: def.id,
    identity: {
      name: def.name,
      title: def.title || 'CHALLENGER',
      company: def.company || 'STEALTH STARTUP',
      tagline: def.tagline || 'Player-founded. Player-funded.',
      rap: def.rap || 'No convictions — yet',
    },
    body: { ...DEFAULT_BODY, ...(def.body || {}) },
    look: {
      ...def.c,
      hairStyle: def.hairStyle, outfit: def.outfit,
      headwear: def.headwear, eyewear: def.eyewear, facialHair: def.facialHair,
      stance: st.stance,
    },
    fighting: {
      preset: def.style || 'balanced',
      startup: st.startup, dmg: st.dmg, reach: st.reach,
      recovery: st.recovery, speed: st.speed, hp: st.hp,
      moves: {
        special: { archetype: sp.type, ...sp },
        signature: null,
      },
    },
    ai: {
      aggr: def.ai?.aggr ?? 0.6,
      jump: def.ai?.jump ?? 0.35,
      prefRange: def.ai?.prefRange ?? 'mid',
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — `# pass 31`

If a character other than `ava` blocks, the budget caught something the spec audit missed. Do not weaken the thresholds — record the finding, add its id to the assertion, and raise it before continuing.

- [ ] **Step 5: Verify the game still runs and golden images still match**

Reload `http://localhost:4173/` and play one round.
Expected: no console errors, gameplay unchanged.

Reload the golden harness and click **CHECK against baseline**.
Expected: `ALL 117 MATCH`

- [ ] **Step 6: Commit**

```bash
git add src/data/fighters.js test/roster.test.js
git commit -m "feat: adapt the shipped roster to schema v1"
```

---

## Acceptance for P1

- [ ] `npm test` passes with 31 tests
- [ ] Golden harness reports `ALL 117 MATCH`
- [ ] A full match plays with no console errors and no felt difference
- [ ] Frame time stays under 1.5 ms (check the `?debug` overlay; baseline is 1.2 ms)
- [ ] `validateCharacter` accepts all nine roster entries except `ava`, which is the known PHANTOM finding

Nothing visible changes. That is the point — it is what proves the schema fits the characters that already exist, before the Incubator UI is built on top of it.
