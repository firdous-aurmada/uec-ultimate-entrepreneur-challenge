import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION } from '../src/config.js';

test('config is importable from the test runner', () => {
  assert.match(VERSION, /^v\d+\.\d+/);
});
