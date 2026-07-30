// Draws a face onto a baked fighter frame.
//
// Features are positioned in the HEAD BONE's own coordinate frame and then
// projected, so they follow the head as it turns, tilts and ducks. A flat 2D
// overlay cannot do that — it slides off the moment the character looks away.
//
// Everything is expressed as a fraction of head size, so it scales with the
// character and survives a change of bake resolution.
import { headFrame, projectPoint } from './glb.js';

export const DEFAULT_FACE = {
  skin:   '#d9a06b',
  shade:  'rgba(10,12,22,0.55)',
  ink:    '#0a0c16',
  shades: '#14161f',      // wraparound sunglasses
  glint:  'rgba(255,240,210,0.55)',
  hair:   '#e8e2d6',
  wearsShades: true,
};

// How far the head is turned away from the camera, 0 = facing us, 1 = away.
// Used to fade features out rather than draw eyes on the back of a skull.
function awayness(frame, yaw) {
  const a = yaw * Math.PI / 180;
  // camera looks along +depth; the projected forward's depth component tells
  // us whether the face points toward or away from the viewer
  const d = -frame.forward[0] * Math.sin(a) + frame.forward[2] * Math.cos(a);
  return d;    // >0 face toward camera-ish, <0 turned away
}

export function drawFace(cx, model, time, opts = {}) {
  const { proj, style = DEFAULT_FACE, skinOpts = {} } = opts;
  const f = headFrame(model, time, skinOpts);
  if (!f) return false;

  const facing = awayness(f, proj.yaw ?? 30);
  if (facing <= 0.02) return false;            // head turned away — draw nothing
  const fade = Math.min(1, facing / 0.45);     // ease features in as he turns to us

  const S = f.size;
  // Place a feature ON THE HEAD SPHERE, given how far across (u) and up (v) the
  // face it sits, both as fractions of head radius. The forward component is
  // whatever puts the point on the surface. A flat plane of features poked out
  // past the silhouette whenever the head turned toward the camera; wrapping
  // them onto the sphere can't, by construction.
  const at = (u, v, push = 1) => {
    const r2 = Math.max(0, 1 - u * u - v * v);
    const fw = Math.sqrt(r2) * push;
    return projectPoint([
      f.origin[0] + (f.right[0] * u + f.up[0] * v + f.forward[0] * fw) * S,
      f.origin[1] + (f.right[1] * u + f.up[1] * v + f.forward[1] * fw) * S,
      f.origin[2] + (f.right[2] * u + f.up[2] * v + f.forward[2] * fw) * S,
    ], proj);
  };

  // screen-space head radius, for line weights
  const a = at(0, 0, 0), b = at(0, 1, 0);
  const R = Math.hypot(b.x - a.x, b.y - a.y) || 10;
  if (R < 6) return false;                     // too small to read; skip

  cx.save();
  cx.globalAlpha = fade;
  cx.lineCap = 'round';
  cx.lineJoin = 'round';

  // A band across the face, drawn as a strip of points wrapped on the sphere
  // so it curves with the head instead of cutting a straight chord through it.
  const band = (from, to, v, steps = 7) => {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      pts.push(at(from + (to - from) * (i / steps), v));
    }
    return pts;
  };
  const stroke = (pts, col, w) => {
    cx.beginPath();
    pts.forEach((p, i) => (i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)));
    cx.strokeStyle = col; cx.lineWidth = Math.max(1, w); cx.stroke();
  };

  if (style.wearsShades) {
    const top = band(-0.66, 0.66, 0.20);
    const bot = band(0.62, -0.62, -0.06);
    cx.beginPath();
    top.forEach((p, i) => (i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)));
    bot.forEach(p => cx.lineTo(p.x, p.y));
    cx.closePath();
    cx.fillStyle = style.shades;
    cx.strokeStyle = style.ink;
    cx.lineWidth = Math.max(1, R * 0.07);
    cx.fill(); cx.stroke();
    stroke(band(-0.30, 0.22, 0.09, 4), style.glint, R * 0.06);
  } else {
    for (const s of [-1, 1]) {
      const e = at(s * 0.36, 0.06);
      cx.beginPath();
      cx.ellipse(e.x, e.y, R * 0.09, R * 0.12, 0, 0, 7);
      cx.fillStyle = style.ink; cx.fill();
    }
    stroke(band(-0.56, 0.56, 0.26), style.ink, R * 0.09);
  }

  // brow ridge — reads as a scowl and gives the skull some structure
  stroke(band(-0.60, 0.60, 0.34), style.shade, R * 0.07);
  // hard flat mouth, set low
  stroke(band(-0.28, 0.30, -0.44, 4), style.shade, R * 0.065);

  cx.restore();
  return true;
}
