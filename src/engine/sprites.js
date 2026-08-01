// Sprite-atlas fighter rendering.
//
// Atlases are baked offline from a rigged 3D model (see lab/) and shipped as
// plain PNGs — the game never touches a GLB and gains no 3D dependency.
// Each state is one horizontal strip; the manifest carries frame counts and
// the feet anchor, so a sprite is positioned by the fighter's ground point
// exactly like the procedural renderer was.

const SETS = new Map();          // id -> { manifest, images, ready }

export function loadSpriteSet(id, base) {
  if (SETS.has(id)) return SETS.get(id);
  const set = { id, base, manifest: null, images: {}, ready: false, failed: false };
  SETS.set(id, set);
  fetch(`${base}/manifest.json`)
    .then(r => { if (!r.ok) throw new Error(`manifest ${r.status}`); return r.json(); })
    .then(mf => {
      set.manifest = mf;
      const names = Object.keys(mf.states);
      let pending = names.length;
      for (const name of names) {
        const img = new Image();
        img.onload = () => { if (--pending === 0) set.ready = true; };
        img.onerror = () => { set.failed = true; };
        img.src = `${base}/${mf.states[name].file}`;
        set.images[name] = img;
      }
    })
    .catch(() => { set.failed = true; });
  return set;
}

export function spriteSet(id) { return SETS.get(id) || null; }

// ---------------------------------------------------------------- state map
// Fighter state -> atlas state. Attacks map by their `kind` so a character
// with a signature move falls back to the nearest basic rather than vanishing.
const ATTACK_STATE = {
  slap: 'slap', punch: 'punch', kick: 'kick', launch: 'launch',
  // specials and universal moves borrow the closest matching swing
  aoe: 'kick', grab: 'launch', teleport: 'punch', rush: 'punch',
  projectile: 'slap', rain: 'slap', bomb: 'slap', steal: 'punch',
};

// Returns { state, frame } for a fighter at animation time t, or null when
// the set has no usable state for it.
export function pickFrame(set, f, t) {
  const mf = set.manifest;
  if (!mf) return null;
  const has = (s) => !!mf.states[s];
  const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
  // Frames were chosen by equal motion, not equal time, so dividing progress
  // into n equal slices would replay a punch at a constant speed and flatten
  // its snap. `times` carries each frame's real normalised moment in the clip;
  // hold a frame until the next one's time is reached.
  const pick = (state, prog, loop) => {
    const st = mf.states[state];
    const n = st.frames;
    const p = loop ? ((prog % 1) + 1) % 1 : clamp01(prog);
    let i;
    if (st.times && st.times.length === n) {
      i = n - 1;
      for (let k = 1; k < n; k++) {
        if (p < st.times[k]) { i = k - 1; break; }
      }
    } else {
      i = Math.min(n - 1, Math.floor(p * n));   // older atlases without timings
    }
    return { state, frame: i < 0 ? 0 : i };
  };

  switch (f.state) {
    case 'attack': {
      const a = f.attack;
      if (!a) break;
      const want = ATTACK_STATE[a.kind] || 'punch';
      const state = has(want) ? want : 'punch';
      if (!has(state)) break;
      const total = (a.startup || 0) + (a.active || 0) + (a.recovery || 0);
      return pick(state, total > 0 ? f.stateT / total : 0, false);
    }
    case 'hitstun': {
      // a launched opponent tumbles; a grounded one just recoils
      if (f.airborne && has('launched')) {
        return pick('launched', f.stateT / Math.max(0.35, f.stunT || 0.4), false);
      }
      const state = (f.stunT || 0) <= 0.24 && has('hitlight') ? 'hitlight' : 'hitstun';
      if (!has(state)) break;
      return pick(state, f.stateT / Math.max(0.2, f.stunT || 0.3), false);
    }
    case 'ko':
    case 'victory': {
      if (f.state === 'ko' && has('ko')) return pick('ko', f.stateT / 1.1, false);
      if (has('idle')) return pick('idle', t * 0.9, true);
      break;
    }
    case 'block':
      if (has('block')) return pick('block', f.stateT / 0.12, false);
      break;
    case 'crouch':
      if (has('crouch')) return pick('crouch', t * 1.6, true);
      break;
    case 'jump':
    case 'dash': {
      if (f.state === 'jump' && has('jump')) {
        // read the arc: rising -> early frames, falling -> late
        const v = Math.max(-1, Math.min(1, (f.vy || 0) / 760));
        return pick('jump', (v + 1) / 2, false);
      }
      if (has('walk')) return pick('walk', (f.walkPhase || t * 6) / (Math.PI * 2), true);
      break;
    }
    case 'walk':
      if (has('walk')) return pick('walk', (f.walkPhase || 0) / (Math.PI * 2), true);
      break;
  }
  if (has('idle')) return pick('idle', t * 0.85, true);
  return null;
}

// Draws the fighter sprite in world space. Assumes ctx is already translated
// to the fighter position and flipped for facing, matching drawFighter.
// `scaleY`/`scaleX` let per-character body proportions stretch the sprite.
export function drawSprite(ctx, set, f, t, opts = {}) {
  if (!set || !set.ready || !set.manifest) return false;
  const picked = pickFrame(set, f, t);
  if (!picked) return false;
  const img = set.images[picked.state];
  if (!img || !img.complete || !img.naturalWidth) return false;

  const mf = set.manifest;
  const { frameWidth: fw, frameHeight: fh, anchor } = mf;
  const { scaleX = 1, scaleY = 1, height = 180 } = opts;
  // The bake is 1.7 world-units tall at a known pixel height; scale so the
  // fighter occupies `height` px, then apply the character's body knobs.
  const k = height / fh;
  const dw = fw * k * scaleX, dh = fh * k * scaleY;
  const ax = anchor.x * k * scaleX, ay = anchor.y * k * scaleY;

  ctx.drawImage(img, picked.frame * fw, 0, fw, fh, -ax, -ay, dw, dh);
  return true;
}
