import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampBody, applyProportions, bufferMetrics } from '../src/engine/proportions.js';
import { DEFAULT_BODY } from '../src/data/schema.js';
import { STYLIZE } from '../src/config.js';

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

// Limb gauges moved to draw time, where STYLIZE sets the arcade baseline and
// build scales it. What proportions still owes the renderer is the head size
// (its own knob) plus the two factors the draw path multiplies through.
test('proportions expose what the renderer scales limbs by', () => {
  const P = applyProportions(samplePose(), clampBody({ build: 1.2, head: 1.1, shoulders: 1.15 }));
  assert.ok(Math.abs(P.headR - STYLIZE.HEAD_R * 1.1) < 0.01, 'head is sized here');
  assert.ok(Math.abs(P.shoulderW - 1.15) < 0.01);
  assert.ok(Math.abs(P.build - 1.2) < 0.01);
});

test('a neutral body yields exactly the historical buffer dimensions', () => {
  assert.deepEqual(bufferMetrics(DEFAULT_BODY), { ox: 130, oy: 250, w: 280, h: 300 });
});

test('a bigger body grows the buffer so it cannot clip', () => {
  const m = bufferMetrics(clampBody({ height: 1.22, reach: 1.2 }));
  assert.ok(m.h > 300 && m.oy > 250 && m.w > 280);
});
