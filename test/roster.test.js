import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIGHTERS, BASE_CHARACTERS, toCharacter } from '../src/data/fighters.js';
import { validateCharacter, SCHEMA_VERSION } from '../src/data/schema.js';

test('every shipped fighter converts to a current-schema character', () => {
  for (const def of FIGHTERS) {
    const ch = toCharacter(def);
    assert.equal(ch.schema, SCHEMA_VERSION, `${def.id} wrong schema version`);
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

// PHANTOM used to be the one blocked character, flagged when the budget
// formula was first written and left standing as a known debt. It was fixed by
// silhouette rather than by stats: "slight AND untouchable" is the compounding
// pattern the budget exists to catch, so giving Lizbeth an ordinary frame to
// hit is what pays for her speed. Nothing in STYLES changed.
test('every shipped fighter is inside the power budget', () => {
  const blocked = [];
  for (const def of FIGHTERS) {
    const r = validateCharacter(toCharacter(def));
    if (r.band === 'block') blocked.push(`${def.id} (${r.cost.toFixed(1)})`);
    else assert.equal(r.ok, true, `${def.id}: ${r.errors.join('; ')}`);
  }
  assert.deepEqual(blocked, [], 'no character may ship over budget');
});

// The silhouette test, as data. Two fighters that differ only in colour are
// two fighters the player cannot tell apart at 196px.
test('no two fighters share a silhouette', () => {
  const seen = new Map();
  for (const def of FIGHTERS) {
    const b = toCharacter(def).body;
    const key = ['height', 'build', 'reach', 'stride', 'shoulders', 'head']
      .map(k => b[k].toFixed(2)).join('/');
    assert.ok(!seen.has(key), `${def.id} and ${seen.get(key)} have identical proportions`);
    seen.set(key, def.id);
  }
});

test('every fighter differs from neutral — nobody ships as the default body', () => {
  for (const def of FIGHTERS) {
    const b = toCharacter(def).body;
    const off = Object.values(b).some(v => Math.abs(v - 1) > 0.02);
    assert.ok(off, `${def.id} still has the stock proportions`);
  }
});

// Characters authored in the Incubator. The tool refuses to export a blocked
// character, so anything in here must still validate — this catches a hand-edit
// after the fact, or a schema change that invalidates work already done.
test('every authored character still validates', async () => {
  let mod;
  try {
    mod = await import('../src/data/authored.js');
  } catch (e) {
    return;                       // nobody has exported yet; nothing to check
  }
  const list = mod.AUTHORED || [];
  assert.ok(Array.isArray(list), 'AUTHORED must be an array');
  for (const def of list) {
    const r = validateCharacter(toCharacter(def));
    assert.equal(r.ok, true, `${def.id}: ${r.errors.join('; ')}`);
    assert.notEqual(r.band, 'block', `${def.id} is over budget at ${r.cost.toFixed(1)}`);
  }
});

test('authored characters do not collide with the shipped roster', async () => {
  let mod;
  try { mod = await import('../src/data/authored.js'); } catch (e) { return; }
  const shipped = new Set(FIGHTERS.map(f => f.id));
  for (const def of (mod.AUTHORED || [])) {
    assert.equal(shipped.has(def.id), false, `${def.id} already exists in the roster`);
  }
});
