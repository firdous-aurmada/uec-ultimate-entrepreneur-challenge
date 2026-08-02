// Base animation tracks — the stock set every character falls back to.
//
// RENDER-ONLY (see engine/anim.js). Attack tracks are keyed in phase space:
// 0–1 wind-up, 1–2 hitbox out, 2–3 recovery.
//
// The shape every attack follows is the classic arcade beat:
//
//   ANTICIPATION  coil back and down, squash, weight onto the back foot
//   IMPACT        explode through in one frame, stretch, overshoot, smear
//   RECOVERY      hold the extension so the commitment reads, then settle
//
// The old computed poses eased smoothly from wind-up to strike, which made
// every attack read as a push. The snap is the whole point: nearly all of the
// travel happens between t=0.95 and t=1.15, and then the pose is HELD.

// Reach the arm/leg extension is authored against. The renderer scales the
// extension by the move's real reach, so a zoner visibly out-ranges a
// grappler with the same track.
export const NOMINAL_REACH = { slap: 78, punch: 84, kick: 106, launch: 74 };

export const BASE_TRACKS = {
  // ---------------------------------------------------------------- idle
  // Breathing, not swaying. Two beats: settle down, drift up.
  // Values restate REST, so they move with it — see the note on REST in
  // engine/anim.js for why the stance sits low and wide.
  idle: [
    { t: 0,    joints: { hipY: -60, shoulderY: -110, headY: -128, armF: { x: 33, y: -101 }, armB: { x: 13, y: -99 } } },
    { t: 0.5,  joints: { hipY: -57, shoulderY: -108, headY: -125, armF: { x: 32, y: -98 }, armB: { x: 12, y: -96 } }, ease: 'inOutCubic' },
    { t: 1,    joints: { hipY: -60, shoulderY: -110, headY: -128, armF: { x: 33, y: -101 }, armB: { x: 13, y: -99 } }, ease: 'inOutCubic' },
  ],

  // ---------------------------------------------------------------- punch
  punch: [
    { t: 0,    joints: { armF: { x: 26, y: -100 }, armB: { x: 14, y: -88 }, bodyLean: 0, sx: 1, sy: 1 } },
    // coil: fist withdraws past the shoulder, weight sinks onto the back foot
    { t: 0.55, joints: { armF: { x: 4, y: -104 }, armB: { x: 20, y: -86 }, bodyLean: -0.16, hipY: -60, headX: -4, sx: 1.06, sy: 0.94, legB: { x: -18, y: 0 } }, ease: 'outCubic' },
    { t: 0.95, joints: { armF: { x: -6, y: -106 }, bodyLean: -0.22, hipY: -58, headX: -6, sx: 1.08, sy: 0.92 }, ease: 'outQuad' },
    // impact: everything travels here, in one frame
    { t: 1.15, joints: { armF: { x: 106, y: -104 }, armB: { x: -6, y: -84 }, bodyLean: 0.30, hipY: -70, headX: 4, sx: 0.94, sy: 1.07 }, ease: 'outBack', smear: true },
    { t: 2,    joints: { armF: { x: 100, y: -104 }, bodyLean: 0.26, hipY: -68 }, hold: true },
    { t: 2.4,  joints: { armF: { x: 44, y: -100 }, armB: { x: 6, y: -88 }, bodyLean: 0.10, hipY: -66, headX: 1, sx: 1, sy: 1 }, ease: 'outQuad' },
    { t: 3,    joints: { armF: { x: 30, y: -98 }, armB: { x: 18, y: -90 }, bodyLean: 0 }, ease: 'inOutCubic' },
  ],

  // ---------------------------------------------------------------- kick
  // Bigger body commitment: the whole torso counter-rotates against the leg.
  kick: [
    { t: 0,    joints: { legF: { x: 15, y: 0 }, legB: { x: -14, y: 0 }, armF: { x: 20, y: -100 }, bodyLean: 0 } },
    { t: 0.5,  joints: { legF: { x: 2, y: -22 }, legB: { x: -20, y: 0 }, armF: { x: 26, y: -108 }, armB: { x: -6, y: -84 }, bodyLean: -0.14, hipY: -60, sx: 1.07, sy: 0.93 }, ease: 'outCubic' },
    { t: 0.95, joints: { legF: { x: -6, y: -30 }, bodyLean: -0.20, hipY: -58, sx: 1.09, sy: 0.91 }, ease: 'outQuad' },
    // The counter-lean is what sells a kick's weight, but HELD at full depth it
    // reads as falling over backwards rather than committing to a kick — so the
    // hold sits shallower than the impact frame.
    { t: 1.15, joints: { legF: { x: 104, y: -74 }, legB: { x: -20, y: 0 }, armF: { x: -12, y: -104 }, armB: { x: -26, y: -86 }, bodyLean: -0.18, hipY: -72, sx: 0.93, sy: 1.08 }, ease: 'outBack', smear: true },
    { t: 2,    joints: { legF: { x: 96, y: -68 }, bodyLean: -0.11, hipY: -70 }, hold: true },
    { t: 2.3,  joints: { legF: { x: 40, y: -18 }, armF: { x: 6, y: -102 }, bodyLean: -0.02, hipY: -66, sx: 1, sy: 1 }, ease: 'outQuad' },
    { t: 3,    joints: { legF: { x: 15, y: 0 }, legB: { x: -14, y: 0 }, armF: { x: 30, y: -98 }, armB: { x: 18, y: -90 }, bodyLean: 0 }, ease: 'inOutCubic' },
  ],

  // ---------------------------------------------------------------- slap
  // Cocked high, whips down and across. Fast in, fast out — it is a taunt.
  slap: [
    { t: 0,    joints: { armF: { x: 22, y: -102 }, bodyLean: 0 } },
    { t: 0.6,  joints: { armF: { x: 2, y: -136 }, armB: { x: 14, y: -86 }, bodyLean: -0.14, headX: -3, sx: 1.04, sy: 0.96 }, ease: 'outCubic' },
    { t: 0.95, joints: { armF: { x: -8, y: -142 }, bodyLean: -0.18 }, ease: 'outQuad' },
    { t: 1.15, joints: { armF: { x: 92, y: -96 }, armB: { x: -20, y: -84 }, bodyLean: 0.30, headX: 5, sx: 0.95, sy: 1.05 }, ease: 'outBack', smear: true },
    { t: 2,    joints: { armF: { x: 86, y: -94 }, bodyLean: 0.26 }, hold: true },
    { t: 2.5,  joints: { armF: { x: 40, y: -98 }, bodyLean: 0.08, headX: 1, sx: 1, sy: 1 }, ease: 'outQuad' },
    { t: 3,    joints: { armF: { x: 30, y: -98 }, armB: { x: 18, y: -90 }, bodyLean: 0 }, ease: 'inOutCubic' },
  ],

  // ---------------------------------------------------------------- launch
  // Rising uppercut: sink hard, then drive the whole body up off the back foot.
  launch: [
    { t: 0,    joints: { armF: { x: 22, y: -100 }, bodyLean: 0 } },
    { t: 0.55, joints: { armF: { x: 14, y: -82 }, armB: { x: 8, y: -84 }, hipY: -52, shoulderY: -102, headY: -122, bodyLean: 0.10, sx: 1.09, sy: 0.90 }, ease: 'outCubic' },
    { t: 0.95, joints: { armF: { x: 10, y: -74 }, hipY: -48, shoulderY: -98, headY: -118, sx: 1.12, sy: 0.88 }, ease: 'outQuad' },
    // Rising off the back foot, not curling up: the hip climbs less than the
    // shoulders and head, or the torso compresses and he reads as hunched.
    { t: 1.15, joints: { armF: { x: 44, y: -196 }, armB: { x: -20, y: -78 }, legF: { x: 14, y: -22 }, hipY: -82, shoulderY: -142, headY: -168, bodyLean: -0.12, sx: 0.90, sy: 1.12 }, ease: 'outBack', smear: true },
    { t: 2,    joints: { armF: { x: 40, y: -188 }, hipY: -78, shoulderY: -138, headY: -164 }, hold: true },
    { t: 2.35, joints: { armF: { x: 30, y: -128 }, legF: { x: 15, y: 0 }, hipY: -70, shoulderY: -120, headY: -140, bodyLean: 0, sx: 1, sy: 1 }, ease: 'outQuad' },
    { t: 3,    joints: { armF: { x: 30, y: -98 }, armB: { x: 18, y: -90 }, hipY: -66, shoulderY: -114, headY: -134, bodyLean: 0 }, ease: 'inOutCubic' },
  ],
};

// Which base track an attack uses. Archetypes that have no track of their own
// borrow the nearest basic rather than falling back to no animation at all.
export const ATTACK_TRACK = {
  slap: 'slap', punch: 'punch', kick: 'kick', launch: 'launch',
  grab: 'punch', teleport: 'punch', rush: 'punch', steal: 'punch',
  aoe: 'kick', trap: 'kick',
  projectile: 'slap', rain: 'slap', bomb: 'slap', counter: 'slap',
};
