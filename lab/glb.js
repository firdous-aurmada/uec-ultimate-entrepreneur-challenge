// Minimal glTF/GLB reader, skinner and rig-classified rasteriser.
//
// This is asset-pipeline tooling, not shipped game code — it runs offline and
// its output is PNG atlases. The game itself stays dependency-free and never
// loads a GLB. That is why there is no three.js here: nothing in the shipping
// bundle should grow a 3D dependency just to display 2D sprites.

const COMP = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array,
  5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array,
};
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function parseGLB(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB');
  let off = 12, json = null, bin = null;
  while (off < buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    const slice = buf.slice(off + 8, off + 8 + len);
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(slice));
    if (type === 0x004E4942) bin = slice;
    off += 8 + len;
  }
  if (!json) throw new Error('GLB has no JSON chunk');
  return { json, bin };
}

export function readAccessor(json, bin, idx) {
  const acc = json.accessors[idx];
  const bv = json.bufferViews[acc.bufferView];
  const TA = COMP[acc.componentType];
  const n = NUM[acc.type];
  const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = bv.byteStride;
  if (!stride || stride === n * TA.BYTES_PER_ELEMENT) return new TA(bin, base, acc.count * n);
  const out = new TA(acc.count * n);
  const dv = new DataView(bin);
  const get = { 5126: 'getFloat32', 5123: 'getUint16', 5125: 'getUint32', 5121: 'getUint8' }[acc.componentType];
  for (let i = 0; i < acc.count; i++) {
    for (let c = 0; c < n; c++) out[i * n + c] = dv[get](base + i * stride + c * TA.BYTES_PER_ELEMENT, true);
  }
  return out;
}

// ---------------------------------------------------------------- matrices
function fromTRS(t, q, s) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const m = new Float32Array(16);
  m[0] = (1 - (yy + zz)) * s[0]; m[1] = (xy + wz) * s[0]; m[2] = (xz - wy) * s[0];
  m[4] = (xy - wz) * s[1]; m[5] = (1 - (xx + zz)) * s[1]; m[6] = (yz + wx) * s[1];
  m[8] = (xz + wy) * s[2]; m[9] = (yz - wx) * s[2]; m[10] = (1 - (xx + yy)) * s[2];
  m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; m[15] = 1;
  return m;
}
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
// Remove rotation about world Y from a quaternion, so a clip that pivots the
// body still renders side-on. Without this, half the frames show the back.
function stripYaw(q) {
  // Extract rotation about world Y. Sanity check: for a pure Y rotation by t,
  // q = (0, sin(t/2), 0, cos(t/2)) gives atan2(sin t, cos t) = t.
  const yaw = Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[2] * q[2]));
  const h = -yaw / 2, sy = Math.sin(h), cw = Math.cos(h);
  // qa * q, with qa = (0, sy, 0, cw). Expanding the Hamilton product:
  //   x = aw*bx + ay*bz    y = aw*by + ay*bw
  //   z = aw*bz - ay*bx    w = aw*bw - ay*by
  return [
    cw * q[0] + sy * q[2],
    cw * q[1] + sy * q[3],
    cw * q[2] - sy * q[0],
    cw * q[3] - sy * q[1],
  ];
}

// ---------------------------------------------------------------- model
const BONE_MAT = {
  Hips: 'suit', Spine: 'suit', Spine01: 'suit', Spine02: 'suit',
  LeftShoulder: 'suit', RightShoulder: 'suit',
  LeftArm: 'suit', RightArm: 'suit', LeftForeArm: 'suit', RightForeArm: 'suit',
  LeftHand: 'skin', RightHand: 'skin',
  neck: 'skin', Head: 'skin', head_end: 'skin', headfront: 'skin',
  LeftUpLeg: 'pants', RightUpLeg: 'pants', LeftLeg: 'pants', RightLeg: 'pants',
  LeftFoot: 'shoe', RightFoot: 'shoe', LeftToeBase: 'shoe', RightToeBase: 'shoe',
};
const HEAD_BONES = new Set(['Head', 'head_end', 'headfront']);

export const DEFAULT_PALETTE = {
  suit:  [0x3a, 0x3e, 0x4c],
  pants: [0x2c, 0x2f, 0x3a],
  shirt: [0xf4, 0xf6, 0xff],
  tie:   [0xc4, 0x2b, 0x50],
  skin:  [0xd9, 0xa0, 0x6b],
  hair:  [0xe8, 0xe2, 0xd6],
  shoe:  [0x14, 0x15, 0x1c],
};

export function loadModel(buf) {
  const { json, bin } = parseGLB(buf);
  const prim = json.meshes[0].primitives[0];
  const m = {
    json, bin,
    POS: readAccessor(json, bin, prim.attributes.POSITION),
    NRM: readAccessor(json, bin, prim.attributes.NORMAL),
    IDX: readAccessor(json, bin, prim.indices),
    JOINTS: readAccessor(json, bin, prim.attributes.JOINTS_0),
    WEIGHTS: readAccessor(json, bin, prim.attributes.WEIGHTS_0),
  };
  const skin = json.skins[0];
  m.jointNodes = skin.joints;
  m.jointNames = skin.joints.map(n => json.nodes[n].name);
  m.IBM = readAccessor(json, bin, skin.inverseBindMatrices);
  m.parentOf = new Map();
  json.nodes.forEach((nd, i) => (nd.children || []).forEach(c => m.parentOf.set(c, i)));
  m.hipsJoint = m.jointNames.indexOf('Hips');

  // animation channels
  m.anim = json.animations?.[0] || null;
  m.animName = m.anim?.name || null;
  m.channels = new Map();
  m.sampleCache = new Map();
  if (m.anim) {
    for (const ch of m.anim.channels) {
      if (!m.channels.has(ch.target.node)) m.channels.set(ch.target.node, {});
      m.channels.get(ch.target.node)[ch.target.path] = ch.sampler;
    }
    const first = chanData(m, m.anim.channels[0].sampler);
    m.duration = first.t[first.t.length - 1];
  } else {
    m.duration = 0;
  }

  classify(m);
  return m;
}

function chanData(m, sampler) {
  if (!m.sampleCache.has(sampler)) {
    m.sampleCache.set(sampler, {
      t: readAccessor(m.json, m.bin, m.anim.samplers[sampler].input),
      v: readAccessor(m.json, m.bin, m.anim.samplers[sampler].output),
    });
  }
  return m.sampleCache.get(sampler);
}

function sampleChannel(m, sampler, time, n) {
  const { t, v } = chanData(m, sampler);
  let i = 0;
  while (i < t.length - 1 && t[i + 1] < time) i++;
  const j = Math.min(i + 1, t.length - 1);
  const span = t[j] - t[i];
  const f = span > 1e-8 ? (time - t[i]) / span : 0;
  const out = new Array(n);
  if (n === 4) {
    let d = 0;
    for (let k = 0; k < 4; k++) d += v[i * 4 + k] * v[j * 4 + k];
    const sgn = d < 0 ? -1 : 1;
    let len = 0;
    for (let k = 0; k < 4; k++) {
      out[k] = v[i * 4 + k] + (v[j * 4 + k] * sgn - v[i * 4 + k]) * f;
      len += out[k] * out[k];
    }
    len = Math.sqrt(len) || 1;
    for (let k = 0; k < 4; k++) out[k] /= len;
  } else {
    for (let k = 0; k < n; k++) out[k] = v[i * n + k] + (v[j * n + k] - v[i * n + k]) * f;
  }
  return out;
}

// Per-vertex material from the dominant bone. The generated UV atlas is
// unusable (skin texels land on the torso), but the rig is semantic, so the
// skeleton tells us what every vertex is.
function classify(m) {
  const n = m.POS.length / 3;
  m.VMAT = new Array(n);
  let headTop = -1e9, headBottom = 1e9;
  for (let v = 0; v < n; v++) {
    let bj = 0, bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = m.WEIGHTS[v * 4 + k];
      if (w > bw) { bw = w; bj = m.JOINTS[v * 4 + k]; }
    }
    const name = m.jointNames[bj] || 'Spine';
    const isHead = HEAD_BONES.has(name);
    m.VMAT[v] = BONE_MAT[name] || 'suit';
    if (isHead) {
      headTop = Math.max(headTop, m.POS[v * 3 + 1]);
      headBottom = Math.min(headBottom, m.POS[v * 3 + 1]);
      m.VMAT[v] = 'skin';
    }
  }
  const hairLine = headBottom + (headTop - headBottom) * 0.62;
  for (let v = 0; v < n; v++) {
    const name = m.jointNames[dominant(m, v)];
    if (HEAD_BONES.has(name) && m.POS[v * 3 + 1] > hairLine) m.VMAT[v] = 'hair';
  }
  // open-jacket shirt + tie down the front centre of the torso
  let zMax = -1e9;
  for (let i = 2; i < m.POS.length; i += 3) zMax = Math.max(zMax, m.POS[i]);
  for (let v = 0; v < n; v++) {
    if (m.VMAT[v] !== 'suit') continue;
    const x = m.POS[v * 3], y = m.POS[v * 3 + 1], z = m.POS[v * 3 + 2];
    if (Math.abs(x) < 0.075 && z > zMax * 0.55 && y > 1.05 && y < 1.45) {
      m.VMAT[v] = Math.abs(x) < 0.032 ? 'tie' : 'shirt';
    }
  }
}
function dominant(m, v) {
  let bj = 0, bw = -1;
  for (let k = 0; k < 4; k++) {
    const w = m.WEIGHTS[v * 4 + k];
    if (w > bw) { bw = w; bj = m.JOINTS[v * 4 + k]; }
  }
  return bj;
}

// ---------------------------------------------------------------- skinning
// opts.lockYaw   — remove world-Y rotation from the Hips (stay side-on)
// opts.stripRoot — zero Hips horizontal translation (the game owns position)
// opts.anim      — retarget: take motion from ANOTHER model's animation.
//
// Retargeting matters because the cheap rigging call (8 credits) returns a
// mesh decimated from ~31k triangles to ~469 — unusable — while the expensive
// call (38) keeps full detail. Both produce the same 24 named joints in the
// same hierarchy, so we can buy motion cheaply and graft it onto the good
// mesh. Only ROTATIONS transfer: the two skeletons' bone lengths differ by a
// few percent, and rotations are proportion-independent while translations
// are not. Non-Hips joints keep their own bind translation; the Hips takes
// the source's animated delta from its own bind pose.
// opts.groundLock — shift the frame vertically so its lowest vertex sits at
// y=0. The source clips are authored for a 3D game with a ground-contact
// system: measured on the idle clip alone, the lowest vertex wanders between
// 0.04 and 0.28 world units, and walk dips to -0.12 (through the floor). That
// is what made baked sprites hover above the stage. Stripping root translation
// does NOT fix it — verified identical output with it on and off — because the
// height lives in the pose, not the root channel.
export function skinAt(m, time, opts = {}) {
  const S = skinMatrices(m, time, opts);
  const n = m.POS.length / 3;
  const P = new Float32Array(m.POS.length), N = new Float32Array(m.NRM.length);
  for (let v = 0; v < n; v++) {
    const px = m.POS[v * 3], py = m.POS[v * 3 + 1], pz = m.POS[v * 3 + 2];
    const nx = m.NRM[v * 3], ny = m.NRM[v * 3 + 1], nz = m.NRM[v * 3 + 2];
    let ox = 0, oy = 0, oz = 0, mx = 0, my = 0, mz = 0;
    for (let k = 0; k < 4; k++) {
      const w = m.WEIGHTS[v * 4 + k];
      if (w === 0) continue;
      const mm = S[m.JOINTS[v * 4 + k]];
      if (!mm) continue;
      ox += w * (mm[0] * px + mm[4] * py + mm[8] * pz + mm[12]);
      oy += w * (mm[1] * px + mm[5] * py + mm[9] * pz + mm[13]);
      oz += w * (mm[2] * px + mm[6] * py + mm[10] * pz + mm[14]);
      mx += w * (mm[0] * nx + mm[4] * ny + mm[8] * nz);
      my += w * (mm[1] * nx + mm[5] * ny + mm[9] * nz);
      mz += w * (mm[2] * nx + mm[6] * ny + mm[10] * nz);
    }
    P[v * 3] = ox; P[v * 3 + 1] = oy; P[v * 3 + 2] = oz;
    const l = Math.hypot(mx, my, mz) || 1;
    N[v * 3] = mx / l; N[v * 3 + 1] = my / l; N[v * 3 + 2] = mz / l;
  }

  // A CONSTANT vertical offset for the whole clip, never per-frame.
  //
  // Locking each frame to its own lowest vertex looked right in a still and
  // was badly wrong in motion: whenever a different foot became the lowest
  // point the entire body snapped vertically. Measured range was 40px on idle
  // and 21px on kick, against a 160px-tall character — a bounce that exists
  // nowhere in the source animation. Offsetting by one per-clip constant keeps
  // the clip's own weight shift and bob, which is the part that looks human.
  const off = opts.groundOffset || 0;
  if (off) for (let i = 1; i < P.length; i += 3) P[i] -= off;
  return { P, N };
}

// Joint world matrices at a time — used to anchor 2D detail (a face) to a bone
// so it tracks the bone's rotation instead of sliding around on the silhouette.
export function jointWorld(m, time, opts = {}) {
  return skinMatrices(m, time, opts, true);
}

// An orthonormal frame for the head, in world space, at a given time.
//
// The rig carries three head bones — Head, headfront and head_end — so the
// facing direction is given rather than guessed: headfront-Head points out of
// the face, head_end-Head points out of the crown. Features placed in this
// frame track the head as it turns and tilts, which a flat 2D overlay cannot.
// Bone basis vectors are unusable directly here: the skeleton is authored in
// centimetres and carries a ~0.01 scale, so we derive the axes from bone
// POSITIONS instead, which are scale-independent.
// Where the visual head sits relative to the Head BONE, measured from the mesh
// once and cached. The bone is at the base of the skull, not its centre —
// measured 15cm below and 16cm behind the head mass on this rig — so anchoring
// features to the bone draws them on the neck. Calibrating against the actual
// vertices makes the placement rig-independent instead of hand-tuned.
function headCalibration(m) {
  if (m._headCal) return m._headCal;
  const iH = m.jointNames.indexOf('Head');
  const iF = m.jointNames.indexOf('headfront');
  const iT = m.jointNames.indexOf('head_end');
  if (iH < 0 || iF < 0 || iT < 0) return (m._headCal = null);

  // bind-pose frame, straight from the node hierarchy
  const W = skinMatrices(m, 0, { lockYaw: false, stripRoot: false, anim: null }, true);
  const pos = (i) => [W[i][12], W[i][13], W[i][14]];
  const o = pos(iH);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const fwd = norm(sub(pos(iF), o));
  const upR = sub(pos(iT), o);
  const d = dot(upR, fwd);
  const up = norm([upR[0] - fwd[0] * d, upR[1] - fwd[1] * d, upR[2] - fwd[2] * d]);
  const right = norm(cross(up, fwd));

  // centroid + radius of the vertices actually skinned to the head bones
  const heads = new Set([iH, iF, iT].map(i => m.jointNodes[i]));
  const headJointIdx = new Set([iH, iF, iT]);
  let cx = 0, cy = 0, cz = 0, n = 0;
  const picked = [];
  for (let v = 0; v < m.POS.length / 3; v++) {
    let bj = 0, bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = m.WEIGHTS[v * 4 + k];
      if (w > bw) { bw = w; bj = m.JOINTS[v * 4 + k]; }
    }
    if (!headJointIdx.has(bj)) continue;
    cx += m.POS[v * 3]; cy += m.POS[v * 3 + 1]; cz += m.POS[v * 3 + 2];
    picked.push(v); n++;
  }
  if (!n) return (m._headCal = null);
  const c = [cx / n, cy / n, cz / n];
  let rad = 0;
  for (const v of picked) {
    rad += Math.hypot(m.POS[v * 3] - c[0], m.POS[v * 3 + 1] - c[1], m.POS[v * 3 + 2] - c[2]);
  }
  rad /= n;

  // express bone -> head-centre in the head's own axes, so it survives rotation
  const rel = sub(c, o);
  return (m._headCal = {
    local: [dot(rel, right), dot(rel, up), dot(rel, fwd)],
    radius: rad,
  });
}

export function headFrame(m, time, opts = {}) {
  const cal = headCalibration(m);
  const W = skinMatrices(m, time, opts, true);
  const idx = (n) => m.jointNames.indexOf(n);
  const iH = idx('Head'), iF = idx('headfront'), iT = idx('head_end');
  if (iH < 0 || iF < 0 || iT < 0) return null;
  const pos = (i) => [W[i][12], W[i][13], W[i][14]];
  const o = pos(iH), f0 = pos(iF), t0 = pos(iT);

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  const fwdRaw = sub(f0, o);
  const upRaw = sub(t0, o);
  const forward = norm(fwdRaw);
  // Gram-Schmidt: make up perpendicular to forward so the frame is orthonormal
  const d = dot(upRaw, forward);
  const up = norm([upRaw[0] - forward[0] * d, upRaw[1] - forward[1] * d, upRaw[2] - forward[2] * d]);
  const right = norm(cross(up, forward));
  // head radius, from the crown distance — scales features with the character
  // skinMatrices runs before skinAt's ground offset, so apply it here too or
  // the face floats away from the body.
  const off = opts.groundOffset || 0;
  // shift from the bone to the head's visual centre, using the calibrated
  // offset expressed in this frame's axes
  const L = cal ? cal.local : [0, 0, 0];
  const origin = [
    o[0] + right[0] * L[0] + up[0] * L[1] + forward[0] * L[2],
    o[1] + right[1] * L[0] + up[1] * L[1] + forward[1] * L[2] - off,
    o[2] + right[2] * L[0] + up[2] * L[1] + forward[2] * L[2],
  ];
  return {
    origin, forward, up, right,
    size: cal ? cal.radius : (Math.hypot(...upRaw) || 0.12),
    faceDist: Math.hypot(...fwdRaw),
  };
}

// The exact projection renderPose uses, so overlays land on the body.
export function projectPoint(p, opts = {}) {
  const { yaw = 30, scale = 190, originX = 0, baselineY = 0, flip = false } = opts;
  const a = yaw * Math.PI / 180, cy = Math.cos(a), sy = Math.sin(a);
  const fx = flip ? -1 : 1;
  return {
    x: originX + fx * (p[0] * cy + p[2] * sy) * scale,
    y: baselineY - p[1] * scale,
    depth: -p[0] * sy + p[2] * cy,
  };
}

// Lowest vertex across a whole clip — the constant that plants it on the floor.
export function clipGroundOffset(m, times, opts = {}) {
  let lo = Infinity;
  for (const t of times) {
    const { P } = skinAt(m, t, { ...opts, groundOffset: 0 });
    for (let i = 1; i < P.length; i += 3) if (P[i] < lo) lo = P[i];
  }
  return Number.isFinite(lo) ? lo : 0;
}

// ---------------------------------------------------------------- timing
// Joint world positions — cheap (24 joints) next to skinning 31k vertices, so
// it is what the motion analysis runs on. Note these are WORLD matrices, not
// skinning matrices: a skinning matrix is world × inverseBind, whose
// translation is not the joint's position.
function jointPositions(m, time, opts) {
  return skinMatrices(m, time, opts, true).map(mm => [mm[12], mm[13], mm[14]]);
}

// Frame times spaced by equal MOTION rather than equal time.
//
// One-shot clips (a jab, a knockdown) spend most of their length near the rest
// pose, so uniform time sampling wastes frames: the first punch bake had 7 of
// 10 frames identical. Trimming to a "motion window" barely helped, because
// the guard still drifts slightly and the window stayed at 90% of the clip.
//
// Instead, walk the cumulative motion curve and place frames at equal
// increments of distance travelled. Frames automatically cluster through the
// strike and thin out through the hold — which is also how an animator would
// key it. Works for loops too: an even cycle yields near-even spacing.
// opts.range — [from, to] as fractions of the clip, to bake from a segment.
// Needed because whole clips are rarely the right length for a game state: the
// only settled guard in the library is the tail of Block1, and shadowboxing
// (the obvious idle by name) travels 51px vertically, which reads as hopping.
export function motionTimes(m, opts = {}) {
  const { anim = null, frames = 10, probes = 96, loop = false, range = null } = opts;
  const full = (anim || m).duration;
  if (!full || frames < 2) return new Array(frames).fill(0);
  const from = range ? Math.max(0, range[0]) * full : 0;
  const to = range ? Math.min(1, range[1]) * full : full;
  const dur = to - from;
  if (dur <= 0) return new Array(frames).fill(from);

  const pos = [];
  for (let i = 0; i < probes; i++) {
    pos.push(jointPositions(m, from + (i / (probes - 1)) * dur, { lockYaw: true, stripRoot: true, anim }));
  }
  const cum = [0];
  for (let i = 1; i < probes; i++) {
    let e = 0;
    for (let j = 0; j < pos[i].length; j++) {
      const a = pos[i][j], b = pos[i - 1][j];
      e += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    }
    cum.push(cum[i - 1] + e);
  }
  const total = cum[probes - 1];
  if (total <= 1e-6) {
    return Array.from({ length: frames }, (_, i) => from + (i / frames) * dur);
  }

  const out = [];
  for (let f = 0; f < frames; f++) {
    // loops stop short of the end so frame N does not duplicate frame 0
    const target = total * (loop ? f / frames : f / (frames - 1));
    let i = 1;
    while (i < probes - 1 && cum[i] < target) i++;
    const span = cum[i] - cum[i - 1];
    const k = span > 1e-9 ? (target - cum[i - 1]) / span : 0;
    out.push(from + ((i - 1 + k) / (probes - 1)) * dur);
  }
  return out;
}

// The single hierarchy walk, shared by skinAt and the motion analysis.
// wantWorld=true returns joint world matrices; otherwise skinning matrices
// (world × inverseBind), which is what vertex deformation needs.
function skinMatrices(m, time, opts = {}, wantWorld = false) {
  const { lockYaw = true, stripRoot = true, anim = null } = opts;
  const cache = new Map();
  const hipsNode = m.jointNodes[m.hipsJoint];
  let srcByName = null, srcHipsBind = null;
  if (anim) {
    srcByName = new Map();
    anim.jointNodes.forEach((ni, j) => srcByName.set(anim.jointNames[j], ni));
    srcHipsBind = anim.json.nodes[anim.jointNodes[anim.hipsJoint]].translation || [0, 0, 0];
  }
  const local = (ni) => {
    const nd = m.json.nodes[ni];
    const bind = nd.translation || [0, 0, 0];
    let t, r, s;
    if (anim) {
      const srcNi = srcByName.get(nd.name);
      const sch = srcNi === undefined ? null : anim.channels.get(srcNi);
      r = sch?.rotation ? sampleChannel(anim, sch.rotation, time, 4) : (nd.rotation || [0, 0, 0, 1]);
      s = nd.scale || [1, 1, 1];
      if (ni === hipsNode && sch?.translation) {
        const st = sampleChannel(anim, sch.translation, time, 3);
        t = [bind[0] + (st[0] - srcHipsBind[0]), bind[1] + (st[1] - srcHipsBind[1]), bind[2] + (st[2] - srcHipsBind[2])];
      } else t = bind;
    } else {
      const ch = m.channels.get(ni);
      t = ch?.translation ? sampleChannel(m, ch.translation, time, 3) : bind;
      r = ch?.rotation ? sampleChannel(m, ch.rotation, time, 4) : (nd.rotation || [0, 0, 0, 1]);
      s = ch?.scale ? sampleChannel(m, ch.scale, time, 3) : (nd.scale || [1, 1, 1]);
    }
    if (ni === hipsNode) {
      // Strip ALL root translation, including Y. Keeping the vertical bob
      // lifted the fighter off the floor — measured 17px of float on an idle
      // frame. The game owns position on every axis: it moves the fighter for
      // jumps and pins them to STAGE.FLOOR otherwise, so any root motion baked
      // into the sprite is double-counted.
      if (stripRoot) t = bind;
      if (lockYaw) r = stripYaw(r);
    }
    return fromTRS(t, r, s);
  };
  const world = (ni) => {
    if (cache.has(ni)) return cache.get(ni);
    const p = m.parentOf.get(ni);
    const w = p === undefined ? local(ni) : mul(world(p), local(ni));
    cache.set(ni, w);
    return w;
  };
  return m.jointNodes.map((ni, j) => {
    const w = world(ni);
    if (wantWorld) return w;
    const ibm = new Float32Array(m.IBM.buffer, m.IBM.byteOffset + j * 64, 16);
    return mul(w, ibm);
  });
}

// ---------------------------------------------------------------- render
// Renders into an ImageData with a WORLD-anchored projection: the rig origin
// maps to (originX, baselineY) every time, so frames never jitter in size or
// position between poses. Returns {img, bounds} where bounds is the ink extent.
export function renderPose(W, H, m, P, N, opts = {}) {
  const {
    yaw = 30, scale = 190, originX = W / 2, baselineY = H - 8,
    palette = DEFAULT_PALETTE, ink = true, flip = false,
  } = opts;
  const img = new ImageData(W, H);
  const px = img.data;
  const zbuf = new Float32Array(W * H).fill(-Infinity);
  const cov = new Uint8Array(W * H);
  const a = yaw * Math.PI / 180, cy = Math.cos(a), sy = Math.sin(a);
  const fx = flip ? -1 : 1;

  const L = [0.55, 0.62, 0.56];
  const Lm = Math.hypot(...L); L[0] /= Lm; L[1] /= Lm; L[2] /= Lm;

  const n = P.length / 3;
  const sx_ = new Float32Array(n), sy_ = new Float32Array(n), sz_ = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    sx_[v] = originX + fx * (x * cy + z * sy) * scale;
    sy_[v] = baselineY - y * scale;
    sz_[v] = -x * sy + z * cy;
  }

  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let t = 0; t < m.IDX.length / 3; t++) {
    const i0 = m.IDX[t * 3], i1 = m.IDX[t * 3 + 1], i2 = m.IDX[t * 3 + 2];
    const ax = sx_[i0], ay = sy_[i0], bx = sx_[i1], by = sy_[i1], cx2 = sx_[i2], cy2 = sy_[i2];
    const area = (bx - ax) * (cy2 - ay) - (cx2 - ax) * (by - ay);
    if (area === 0) continue;
    const inv = 1 / area;
    const nx = (N[i0 * 3] + N[i1 * 3] + N[i2 * 3]) / 3;
    const ny = (N[i0 * 3 + 1] + N[i1 * 3 + 1] + N[i2 * 3 + 1]) / 3;
    const nz = (N[i0 * 3 + 2] + N[i1 * 3 + 2] + N[i2 * 3 + 2]) / 3;
    const rnx = (nx * cy + nz * sy) * fx, rnz = -nx * sy + nz * cy;
    const lam = Math.max(0, rnx * L[0] + ny * L[1] + rnz * L[2]);
    const shade = lam > 0.74 ? 1.18 : lam > 0.40 ? 0.96 : 0.66;
    const mat = m.VMAT[i0] === m.VMAT[i1] ? m.VMAT[i0]
              : m.VMAT[i0] === m.VMAT[i2] ? m.VMAT[i0]
              : m.VMAT[i1] === m.VMAT[i2] ? m.VMAT[i1] : m.VMAT[i0];
    const base = palette[mat] || palette.suit;
    const cr = base[0] * shade, cg = base[1] * shade, cb = base[2] * shade;

    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx2)));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx2)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy2)));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy2)));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const w0 = ((bx - x) * (cy2 - y) - (cx2 - x) * (by - y)) * inv;
        const w1 = ((cx2 - x) * (ay - y) - (ax - x) * (cy2 - y)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.0001 || w1 < -0.0001 || w2 < -0.0001) continue;
        const z = w0 * sz_[i0] + w1 * sz_[i1] + w2 * sz_[i2];
        const pi = y * W + x;
        if (z <= zbuf[pi]) continue;
        zbuf[pi] = z;
        cov[pi] = 1;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        const o = pi * 4;
        px[o] = cr > 255 ? 255 : cr;
        px[o + 1] = cg > 255 ? 255 : cg;
        px[o + 2] = cb > 255 ? 255 : cb;
        px[o + 3] = 255;
      }
    }
  }

  if (ink) {
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const pi = y * W + x;
      if (!cov[pi]) continue;
      if (cov[pi - 1] && cov[pi + 1] && cov[pi - W] && cov[pi + W]) continue;
      const o = pi * 4;
      px[o] = 10; px[o + 1] = 12; px[o + 2] = 22; px[o + 3] = 255;
    }
  }
  return { img, bounds: maxX < 0 ? null : { minX, minY, maxX, maxY } };
}
