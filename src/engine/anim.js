// Authored keyframe animation.
//
// RENDER-ONLY. Nothing here may be read by fighter.js, game.js, hit
// resolution, or anything that crosses the wire. Live matches are
// deterministic lockstep: the instant a pose can influence the simulation,
// two peers running different animation data diverge, and it surfaces as a
// voided match that looks like a network fault. test/determinism.test.js
// pins this, including a structural check that no sim module imports us.
//
// ---------------------------------------------------------------------------
// TIMING
//
// Attack tracks are keyed in PHASE SPACE, not in seconds and not in a flat
// 0..1:
//
//     t ∈ [0,1)  startup   — the wind-up
//     t ∈ [1,2)  active    — the hitbox is out
//     t ∈ [2,3]  recovery  — the commitment you pay for
//
// This matters because startup/active/recovery differ per move, per style and
// per character. A flat 0..1 track would smear the impact across whichever
// phase happened to be longest, which is precisely how the old uniform-time
// sprite playback flattened a punch into a shove. In phase space a key at
// t=0.9 is "just before the hitbox comes out" for every move in the game.
//
// Everything else (idle, walk, block, ko…) is keyed 0..1 across the state.

// The joint set a pose is made of — the same flat shape the renderer has
// always consumed, so a track and a computed pose are interchangeable.
export const REST = {
  hipY: -66, shoulderY: -114, headX: 0, headY: -134, rot: 0, crouch: 0,
  armF: { x: 30, y: -98 }, armB: { x: 18, y: -90 },
  legF: { x: 15, y: 0 }, legB: { x: -14, y: 0 },
  bodyLean: 0, sx: 1, sy: 1,
};

const VEC_KEYS = ['armF', 'armB', 'legF', 'legB'];
const NUM_KEYS = ['hipY', 'shoulderY', 'headX', 'headY', 'rot', 'crouch', 'bodyLean', 'sx', 'sy'];

export const EASE = {
  linear:  (k) => k,
  inQuad:  (k) => k * k,
  outQuad: (k) => 1 - (1 - k) * (1 - k),
  inCubic: (k) => k * k * k,
  outCubic: (k) => 1 - Math.pow(1 - k, 3),
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  // overshoot, for the snap on impact
  outBack: (k) => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2),
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, k) => a + (b - a) * k;

// A fresh pose at rest. Callers mutate freely; REST is never handed out.
export function restPose() {
  return {
    ...REST,
    armF: { ...REST.armF }, armB: { ...REST.armB },
    legF: { ...REST.legF }, legB: { ...REST.legB },
  };
}

// Blend b into a by k, in place on a. Only joints present in b move, so a
// sparse keyframe means "leave everything else alone" rather than "snap the
// rest to zero" — which is what lets a character override two joints without
// re-authoring a whole pose.
export function blendInto(a, b, k) {
  if (!b) return a;
  for (const key of NUM_KEYS) {
    if (typeof b[key] === 'number') a[key] = lerp(a[key], b[key], k);
  }
  for (const key of VEC_KEYS) {
    const v = b[key];
    if (!v) continue;
    if (typeof v.x === 'number') a[key].x = lerp(a[key].x, v.x, k);
    if (typeof v.y === 'number') a[key].y = lerp(a[key].y, v.y, k);
  }
  return a;
}

// Where a keyframe track sits at time `t`, expressed in that track's own
// timebase. Returns a pose plus whatever flags the surrounding keys carry.
//
// Returns null for an unusable track, which is deliberate: the caller then
// falls back to the computed pose, so a malformed override degrades to the
// stock animation rather than to a T-pose.
export function samplePose(track, t, base) {
  const keys = Array.isArray(track) ? track : (track && track.keys);
  if (!Array.isArray(keys) || keys.length === 0) return null;

  const pose = base ? base : restPose();
  let lo = keys[0];
  let hi = keys[keys.length - 1];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!k || typeof k.t !== 'number') return null;      // malformed → fall back
    if (k.t <= t) { lo = k; hi = keys[i + 1] || k; }
  }

  // A held key pins its pose until the next one is reached, which is how a
  // recovery reads as a real commitment instead of drifting back to idle.
  let k = 0;
  if (hi !== lo && !lo.hold) {
    const span = hi.t - lo.t;
    k = span > 0 ? clamp01((t - lo.t) / span) : 1;
    const fn = EASE[hi.ease] || EASE[lo.ease] || EASE.linear;
    k = fn(k);
  }

  blendInto(pose, lo.joints, 1);
  if (hi !== lo && !lo.hold) blendInto(pose, hi.joints, k);

  // `smear` marks the frames worth stretching — the draw layer reads it, the
  // simulation never sees it.
  pose.smear = !!(lo.smear || (hi.smear && k > 0.35));
  if (lo.face || hi.face) pose.face = (k > 0.5 && hi.face) ? hi.face : (lo.face || hi.face);
  return pose;
}

// Adds a sampled pose into `P` as a DELTA FROM REST, rather than replacing it.
//
// This is what lets an authored loop coexist with a hand-tuned stance. Idle
// poses carry per-character silhouettes — a rushdown crouches like a sprinter,
// a brawler like a sumo — and a track that overwrote the pose would flatten all
// of that into one shape. Layering the delta means the track supplies the
// BREATHING and the stance keeps the identity.
export function addDelta(P, pose) {
  if (!P || !pose) return P;
  for (const key of NUM_KEYS) {
    if (typeof pose[key] === 'number') P[key] += pose[key] - REST[key];
  }
  for (const key of VEC_KEYS) {
    const v = pose[key];
    if (!v) continue;
    P[key].x += v.x - REST[key].x;
    P[key].y += v.y - REST[key].y;
  }
  return P;
}

// Maps an attack's real elapsed time into phase space (see the header).
export function attackPhaseT(stateT, startup, active, recovery) {
  if (stateT < startup) return startup > 0 ? clamp01(stateT / startup) : 1;
  const a = stateT - startup;
  if (a < active) return 1 + (active > 0 ? clamp01(a / active) : 1);
  const r = a - active;
  return 2 + (recovery > 0 ? clamp01(r / recovery) : 1);
}

// The track a character uses for a state: their own override, else the base
// set, else nothing (and the caller keeps its computed pose). A character can
// therefore never end up without an animation.
export function trackFor(def, state, baseTracks) {
  const over = def && def.animOverrides;
  const own = over && over[state];
  if (Array.isArray(own) || (own && Array.isArray(own.keys))) return own;
  return (baseTracks && baseTracks[state]) || null;
}

// Attacks must telegraph. An attack track with no wind-up keys reads as a
// move that simply happens, which is the single biggest difference between a
// stylised fighter and a puppet snapping between positions.
export const MIN_ANTICIPATION_KEYS = 2;

export function validateTrack(name, track, { attack = false } = {}) {
  const errors = [];
  const keys = Array.isArray(track) ? track : (track && track.keys);
  if (!Array.isArray(keys) || !keys.length) {
    errors.push(`${name}: track has no keys`);
    return errors;
  }
  let last = -Infinity;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!k || typeof k.t !== 'number' || !Number.isFinite(k.t)) {
      errors.push(`${name}[${i}]: t must be a finite number`);
      continue;
    }
    if (k.t < last) errors.push(`${name}[${i}]: keys must be ordered by t`);
    last = k.t;
    if (k.ease && !EASE[k.ease]) errors.push(`${name}[${i}]: unknown ease ${k.ease}`);
    if (k.joints && typeof k.joints !== 'object') errors.push(`${name}[${i}]: joints must be an object`);
  }
  if (attack) {
    const windUp = keys.filter(k => typeof k.t === 'number' && k.t < 1).length;
    if (windUp < MIN_ANTICIPATION_KEYS) {
      errors.push(`${name}: needs at least ${MIN_ANTICIPATION_KEYS} wind-up keys before the hitbox (t < 1), has ${windUp}`);
    }
    if (!keys.some(k => typeof k.t === 'number' && k.t >= 2)) {
      errors.push(`${name}: needs a recovery key (t >= 2)`);
    }
  }
  return errors;
}
