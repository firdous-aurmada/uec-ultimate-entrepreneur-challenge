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
