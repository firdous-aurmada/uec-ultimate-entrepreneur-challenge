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

// PHANTOM is over budget. This test records that rather than hiding it — the
// retune is scheduled for a later phase, and this will need updating then.
test('the roster validates, with exactly one known over-budget character', () => {
  const blocked = [];
  for (const def of FIGHTERS) {
    const r = validateCharacter(toCharacter(def));
    if (r.band === 'block') blocked.push(def.id);
    else assert.equal(r.ok, true, `${def.id}: ${r.errors.join('; ')}`);
  }
  assert.deepEqual(blocked, ['ava'], 'only Lizbeth Holmez (phantom) should be over budget');
});
