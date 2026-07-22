// Procedural fighter rendering: a posed vector rig with per-fighter outfits,
// hairstyles, faces (or an uploaded photo as the face), and comic outlines.
// Also renders the portrait busts used across the UI.

import { shade } from '../data/fighters.js';

const OUTLINE = '#0a0c16';
const FILTER_OK = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;

// dataURL → Image cache for photo faces
const photoCache = new Map();
let onPhotoReady = null;
// UI registers a callback so portraits re-render once an async photo decodes.
export function setPhotoReadyCallback(cb) { onPhotoReady = cb; }
export function getPhoto(dataUrl) {
  if (!dataUrl) return null;
  let img = photoCache.get(dataUrl);
  if (!img) {
    img = new Image();
    img.onload = () => { if (onPhotoReady) onPhotoReady(); };
    img.src = dataUrl;
    photoCache.set(dataUrl, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

// Warm the cache and resolve once the photo is decoded — call before rendering
// a one-shot canvas (e.g. the challenge card) so the photo shows on first paint.
export function ensurePhoto(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    let img = photoCache.get(dataUrl);
    if (img && img.complete) return resolve(img.naturalWidth ? img : null);
    if (!img) {
      img = new Image();
      img.onload = () => { if (onPhotoReady) onPhotoReady(); };
      img.src = dataUrl;
      photoCache.set(dataUrl, img);
    }
    img.addEventListener('load', () => resolve(img.naturalWidth ? img : null), { once: true });
    img.addEventListener('error', () => resolve(null), { once: true });
  });
}

function capsule(ctx, x1, y1, x2, y2, w, color, outline = true) {
  ctx.lineCap = 'round';
  if (outline) {
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = w + 5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function blob(ctx, drawPath, fill) {
  ctx.beginPath();
  drawPath();
  ctx.fillStyle = fill;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
}

const ease = {
  outBack: (k) => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2),
  outQuad: (k) => 1 - (1 - k) * (1 - k),
  inQuad: (k) => k * k,
};

// ---------------------------------------------------------------- pose

// Returns limb targets in local space (+x = facing direction, y up = negative, origin at feet).
function computePose(f, t) {
  const P = {
    hipY: -66, shoulderY: -114, headX: 0, headY: -134, rot: 0, crouch: 0,
    armF: { x: 30, y: -98 }, armB: { x: 18, y: -90 },
    legF: { x: 15, y: 0 }, legB: { x: -14, y: 0 },
    face: 'idle', briefcase: false, bodyLean: 0,
  };
  const bob = Math.sin(t * 4 + (f.side === 0 ? 0 : 1.7)) * 2.2;
  const st = f.state;

  if (st === 'idle') {
    P.hipY += bob * 0.5; P.headY += bob; P.armF.y += bob; P.armB.y += bob;
  } else if (st === 'walk') {
    const ph = f.walkPhase;
    P.legF = { x: 15 + Math.sin(ph) * 17, y: -Math.max(0, Math.sin(ph + 1.5)) * 9 };
    P.legB = { x: -14 + Math.sin(ph + Math.PI) * 17, y: -Math.max(0, Math.sin(ph + Math.PI + 1.5)) * 9 };
    P.armF.x += Math.sin(ph + Math.PI) * 8;
    P.armB.x += Math.sin(ph) * 8;
    P.headY += Math.abs(Math.sin(ph)) * 2;
    P.bodyLean = 0.06 * (f.movingBack ? -1 : 1);
  } else if (st === 'jump') {
    P.legF = { x: 18, y: -26 }; P.legB = { x: -6, y: -16 };
    P.armF = { x: 36, y: -120 }; P.armB = { x: -20, y: -112 };
    P.bodyLean = 0.1;
  } else if (st === 'attack') {
    const atk = f.attack;
    const total = atk.startup + atk.active + atk.recovery;
    const k = Math.min(1, f.stateT / total);
    const hitK = f.stateT < atk.startup
      ? (f.stateT / atk.startup) * -0.18                     // anticipation: coil back
      : f.stateT < atk.startup + atk.active
        ? 0.18 + 0.94 * ease.outBack(Math.min(1, (f.stateT - atk.startup) / atk.active))
        : 1 - ease.inQuad((f.stateT - atk.startup - atk.active) / atk.recovery);
    P.face = 'angry';
    if (atk.kind === 'kick') {
      const reach = (atk.reach || 100) * 0.92;
      P.legF = { x: 6 + reach * hitK, y: -70 * hitK - (f.airborne ? 20 : 0) };
      P.legB = { x: -12, y: 0 };
      P.armF = { x: -6, y: -104 }; P.armB = { x: -22, y: -88 };
      P.bodyLean = -0.22 * hitK;
      P.hipY += 4 * hitK;
    } else if (atk.kind === 'grab') {
      P.armF = { x: 20 + 46 * hitK, y: -100 };
      P.armB = { x: 16 + 44 * hitK, y: -86 };
      P.bodyLean = 0.24 * hitK;
      P.face = 'angry';
    } else if (atk.kind === 'rain' || atk.kind === 'bomb') {
      P.armF = { x: 12, y: -100 - 66 * hitK };
      P.armB = { x: -12, y: -92 };
      P.bodyLean = -0.1 * hitK;
    } else if (atk.kind === 'aoe') {
      P.armF = { x: 44 * hitK, y: -96 };
      P.armB = { x: -30 * hitK, y: -96 };
      P.bodyLean = 0.12 * hitK;
      P.hipY += 6 * hitK;
    } else if (atk.kind === 'rush') {
      const ph = t * 26;
      P.bodyLean = 0.5;
      P.legF = { x: 15 + Math.sin(ph) * 20, y: -Math.max(0, Math.sin(ph + 1.5)) * 12 };
      P.legB = { x: -14 + Math.sin(ph + Math.PI) * 20, y: -Math.max(0, Math.sin(ph + Math.PI + 1.5)) * 12 };
      P.armF = { x: 48, y: -96 }; P.armB = { x: -30, y: -80 };
    } else { // punch / projectile / teleport strike
      const reach = (atk.kind === 'punch' ? (atk.reach || 82) : 88) * 0.95;
      P.armF = { x: 22 + reach * hitK, y: -104 };
      P.armB = { x: 10 - 14 * hitK, y: -88 };
      P.bodyLean = 0.2 * hitK;
    }
  } else if (st === 'dash') {
    P.bodyLean = 0.42;
    P.legF = { x: 34, y: -6 };
    P.legB = { x: -26, y: -2 };
    P.armF = { x: 40, y: -92 };
    P.armB = { x: -34, y: -78 };
    P.face = 'angry';
  } else if (st === 'block') {
    P.crouch = 8; P.hipY += 8; P.headY += 10; P.shoulderY += 8;
    P.armF = { x: 26, y: -96 }; P.armB = { x: 24, y: -84 };
    P.legF = { x: 20, y: 0 }; P.legB = { x: -10, y: 0 };
    P.briefcase = true; P.face = 'block'; P.bodyLean = -0.06;
  } else if (st === 'hitstun') {
    const k = Math.min(1, f.stateT * 10);
    P.bodyLean = -0.3 * k;
    P.headX = -6 * k; P.headY += 4 * k;
    P.armF = { x: 4, y: -66 }; P.armB = { x: -26, y: -102 };
    P.legF = { x: 22, y: 0 }; P.legB = { x: -20, y: 0 };
    P.face = 'hurt';
  } else if (st === 'ko') {
    const k = Math.min(1, f.stateT / 0.45);
    P.rot = -1.45 * ease.outQuad(k);
    P.armF = { x: 30, y: -60 }; P.armB = { x: -30, y: -70 };
    P.legF = { x: 26, y: -4 }; P.legB = { x: -18, y: -2 };
    P.face = 'ko';
  } else if (st === 'victory') {
    const pump = Math.abs(Math.sin(t * 6));
    P.armF = { x: 20, y: -150 - pump * 14 };
    P.armB = { x: -18, y: -92 };
    P.headY -= pump * 4; P.hipY -= pump * 3;
    P.face = 'happy';
  }
  return P;
}

// ---------------------------------------------------------------- head & face

function drawFace(ctx, cx, cy, r, face, c) {
  ctx.lineCap = 'round';
  const e = r * 0.34;                       // eye offset
  ctx.strokeStyle = OUTLINE; ctx.fillStyle = OUTLINE;
  ctx.lineWidth = 2.6;
  if (face === 'ko') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * e - 4, cy - 4); ctx.lineTo(cx + s * e + 4, cy + 4);
      ctx.moveTo(cx + s * e + 4, cy - 4); ctx.lineTo(cx + s * e - 4, cy + 4);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.45, 4.5, 0, Math.PI); ctx.stroke();
  } else if (face === 'happy') {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(cx + s * e, cy - 1, 4.5, Math.PI, 0); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.34, 6, 0.15, Math.PI - 0.15); ctx.stroke();
  } else if (face === 'hurt') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * e - 4, cy - 3); ctx.lineTo(cx + s * e + 4, cy + 1);
      ctx.moveTo(cx + s * e - 4, cy + 3); ctx.lineTo(cx + s * e + 4, cy - 1);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx + 1, cy + r * 0.5, 4, Math.PI, 0); ctx.stroke();
  } else {
    // idle / angry / block — pupils + brows + mouth
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(cx + s * e + 2, cy, 2.6, 0, 7); ctx.fill();
    }
    const browDrop = face === 'angry' || face === 'block' ? 4 : 0;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * e - 5, cy - 7 + (s === 1 ? browDrop : browDrop * 0.6));
      ctx.lineTo(cx + s * e + 5, cy - 7 + (s === 1 ? 0 : browDrop));
      ctx.stroke();
    }
    ctx.beginPath();
    if (face === 'block') { ctx.moveTo(cx - 5, cy + r * 0.46); ctx.lineTo(cx + 6, cy + r * 0.46); }
    else if (face === 'angry') ctx.arc(cx + 2, cy + r * 0.52, 4, Math.PI + 0.4, -0.4);
    else ctx.arc(cx + 2, cy + r * 0.42, 5, 0.3, Math.PI * 0.75);
    ctx.stroke();
  }
}

function drawHair(ctx, cx, cy, r, def, t) {
  const c = def.c;
  const style = def.hairStyle;
  ctx.lineJoin = 'round';
  if (style === 'ponytail') {
    blob(ctx, () => {
      ctx.arc(cx, cy - r * 0.24, r * 1.02, Math.PI * 0.95, Math.PI * 2.05);
    }, c.hair);
    const sway = Math.sin(t * 5) * 4;
    blob(ctx, () => {
      ctx.moveTo(cx - r * 0.8, cy - r * 0.55);
      ctx.quadraticCurveTo(cx - r * 2.1, cy - r * 0.2 + sway, cx - r * 1.55, cy + r * 0.9 + sway);
      ctx.quadraticCurveTo(cx - r * 1.15, cy + r * 0.55, cx - r * 0.92, cy + r * 0.05);
    }, c.hair);
  } else if (style === 'cap') {
    blob(ctx, () => { ctx.arc(cx, cy - r * 0.3, r * 1.0, Math.PI, 0); }, c.suit2);
    blob(ctx, () => {
      ctx.moveTo(cx - r * 0.95, cy - r * 0.28);
      ctx.lineTo(cx - r * 1.7, cy - r * 0.1);
      ctx.lineTo(cx - r * 1.66, cy + r * 0.12);
      ctx.lineTo(cx - r * 0.95, cy - r * 0.02);
    }, c.suit2);
    ctx.fillStyle = c.accent;
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.62, r * 0.2, 0, 7); ctx.fill();
  } else if (style === 'neat') {
    blob(ctx, () => {
      ctx.arc(cx, cy - r * 0.3, r * 1.0, Math.PI * 0.92, Math.PI * 2.02);
      ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 0.1, cx + r * 0.7, cy - r * 0.35);
    }, c.hair);
  } else if (style === 'puffs') {
    blob(ctx, () => { ctx.arc(cx - r * 0.62, cy - r * 0.95, r * 0.52, 0, 7); }, c.hair);
    blob(ctx, () => { ctx.arc(cx + r * 0.62, cy - r * 0.95, r * 0.52, 0, 7); }, c.hair);
    blob(ctx, () => { ctx.arc(cx, cy - r * 0.35, r * 0.98, Math.PI, 0); }, c.hair);
  } else if (style === 'bob') {
    // crown sweep — stays above the brow line
    blob(ctx, () => { ctx.arc(cx, cy - r * 0.28, r * 1.02, Math.PI * 0.96, Math.PI * 2.04); }, c.hair);
    // outer curtains framing the face (eyes/mouth stay clear)
    for (const sgn of [-1, 1]) {
      blob(ctx, () => {
        ctx.moveTo(cx + sgn * r * 0.66, cy - r * 0.72);
        ctx.quadraticCurveTo(cx + sgn * r * 1.22, cy - r * 0.25, cx + sgn * r * 0.98, cy + r * 0.6);
        ctx.lineTo(cx + sgn * r * 0.72, cy + r * 0.42);
        ctx.quadraticCurveTo(cx + sgn * r * 0.92, cy - r * 0.15, cx + sgn * r * 0.55, cy - r * 0.55);
        ctx.closePath();
      }, c.hair);
    }
  } else if (style === 'slick') {
    blob(ctx, () => {
      ctx.moveTo(cx + r * 0.95, cy - r * 0.4);
      ctx.quadraticCurveTo(cx + r * 0.4, cy - r * 1.28, cx - r * 0.6, cy - r * 1.05);
      ctx.quadraticCurveTo(cx - r * 1.25, cy - r * 0.8, cx - r * 0.95, cy - r * 0.1);
      ctx.quadraticCurveTo(cx - r * 0.3, cy - r * 0.72, cx + r * 0.55, cy - r * 0.62);
    }, c.hair);
  } else if (style === 'short') {
    // close-crop: low flat cap hugging the skull
    blob(ctx, () => {
      ctx.arc(cx, cy - r * 0.18, r * 0.99, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath();
    }, c.hair);
  } else if (style === 'curly') {
    // fluffy mop: overlapping puffs across the crown
    for (const [ox, oy, s] of [[-0.62, -0.62, 0.46], [-0.2, -0.86, 0.5], [0.28, -0.84, 0.48], [0.66, -0.58, 0.42], [0, -0.62, 0.55]]) {
      blob(ctx, () => { ctx.arc(cx + r * ox, cy + r * oy, r * s, 0, 7); }, c.hair);
    }
  } else if (style === 'bald') {
    // proudly bald: just a shine
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx - r * 0.25, cy - r * 0.45, r * 0.42, Math.PI * 1.15, Math.PI * 1.6);
    ctx.stroke();
  }
}

function drawAccessory(ctx, cx, cy, r, def) {
  const c = def.c;
  const a = def.accessory;
  if (a === 'visor') {
    // translucent AR visor — eyes stay visible through the tint
    ctx.fillStyle = 'rgba(41,217,255,0.32)';
    ctx.strokeStyle = 'rgba(41,217,255,0.95)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cx - r * 0.58, cy - r * 0.24, r * 1.16, r * 0.44, r * 0.17);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx - r * 0.4, cy - r * 0.12); ctx.lineTo(cx - r * 0.02, cy - r * 0.12); ctx.stroke();
  } else if (a === 'glasses') {
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    for (const s of [0.12, 0.78]) {
      ctx.beginPath(); ctx.roundRect(cx - r * 0.28 + r * s, cy - r * 0.18, r * 0.42, r * 0.36, 3); ctx.fill(); ctx.stroke();
    }
  } else if (a === 'shades') {
    // two slim tinted lenses — brows above, eyes faintly visible through
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
    ctx.fillStyle = 'rgba(16,18,28,0.58)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(cx + s * r * 0.36 - r * 0.27, cy - r * 0.16, r * 0.54, r * 0.34, r * 0.13);
      ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(cx - r * 0.1, cy - r * 0.04); ctx.lineTo(cx + r * 0.1, cy - r * 0.04); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + r * 0.63, cy - r * 0.06); ctx.lineTo(cx + r * 0.94, cy - r * 0.14); ctx.stroke();
  } else if (a === 'stubble') {
    ctx.fillStyle = 'rgba(30,30,40,0.25)';
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.5, r * 0.55, 0, Math.PI); ctx.fill();
  } else if (a === 'earrings') {
    ctx.fillStyle = c.accent;
    ctx.beginPath(); ctx.arc(cx - r * 0.92, cy + r * 0.35, 3.4, 0, 7); ctx.fill();
  } else if (a === 'brooch') {
    // drawn on torso elsewhere; nothing on the head
  }
}

// Draws head at (cx, cy) with radius r. Photo face replaces skin/face/hair.
function drawHead(ctx, def, cx, cy, r, face, t, unicorn) {
  const photo = def.photo ? getPhoto(def.photo) : null;
  if (photo) {
    ctx.save();
    ctx.imageSmoothingQuality = 'high';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.closePath(); ctx.clip();
    ctx.drawImage(photo, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    // founder headband
    ctx.strokeStyle = def.c.accent; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, r + 0.5, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
  } else {
    blob(ctx, () => { ctx.arc(cx, cy, r, 0, 7); }, def.c.skin);
    drawFace(ctx, cx, cy, r, face, def.c);
    drawHair(ctx, cx, cy, r, def, t);
    drawAccessory(ctx, cx, cy, r, def);
  }
  if (unicorn) {
    // golden horn
    ctx.save();
    ctx.translate(cx + r * 0.15, cy - r * 0.92);
    ctx.rotate(0.18);
    blob(ctx, () => {
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(0, -r * 1.05); ctx.closePath();
    }, '#ffd23f');
    ctx.restore();
  }
}

// ---------------------------------------------------------------- body

function drawTorso(ctx, def, P) {
  const c = def.c;
  const w = 24;
  const topY = P.shoulderY, botY = P.hipY;
  blob(ctx, () => {
    ctx.moveTo(-w + 3, botY + 8);
    ctx.quadraticCurveTo(-w - 4, (topY + botY) / 2, -w + 2, topY + 2);
    ctx.quadraticCurveTo(0, topY - 10, w + 2, topY + 4);
    ctx.quadraticCurveTo(w + 7, (topY + botY) / 2, w - 2, botY + 8);
    ctx.closePath();
  }, c.suit);
  if (def.outfit === 'blazer' || def.outfit === 'suit' || def.outfit === 'pinstripe') {
    // shirt V + lapels
    blob(ctx, () => {
      ctx.moveTo(-7, topY + 2); ctx.lineTo(0, topY + 22); ctx.lineTo(7, topY + 2); ctx.closePath();
    }, '#f4f6ff');
    if (def.outfit === 'pinstripe') {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath(); ctx.moveTo(i * 7, topY + 2); ctx.lineTo(i * 7, botY + 4); ctx.stroke();
      }
      // tie
      blob(ctx, () => {
        ctx.moveTo(-3, topY + 14); ctx.lineTo(3, topY + 14); ctx.lineTo(1, topY + 38); ctx.lineTo(-1, topY + 38); ctx.closePath();
      }, c.accent);
    }
    ctx.strokeStyle = c.suit2; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-8, topY + 2); ctx.lineTo(-2, topY + 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, topY + 2); ctx.lineTo(2, topY + 16); ctx.stroke();
  } else if (def.outfit === 'hoodie') {
    // hood behind neck + pocket + strings
    blob(ctx, () => { ctx.arc(-14, topY + 6, 11, Math.PI * 0.6, Math.PI * 1.9); }, c.suit2);
    ctx.strokeStyle = c.accent; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-4, topY + 8); ctx.lineTo(-4, topY + 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, topY + 8); ctx.lineTo(4, topY + 22); ctx.stroke();
    ctx.strokeStyle = c.suit2; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-14, botY - 2); ctx.quadraticCurveTo(0, botY + 8, 14, botY - 2); ctx.stroke();
  } else if (def.outfit === 'turtleneck') {
    blob(ctx, () => { ctx.roundRect(-11, topY - 6, 22, 10, 3); }, c.suit2);
  } else if (def.outfit === 'tee') {
    // plain crew-neck tee with a tiny rocket doodle
    ctx.strokeStyle = c.suit2; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, topY + 3, 8, 0.25, Math.PI - 0.25); ctx.stroke();
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.moveTo(0, topY + 16); ctx.lineTo(4, topY + 26); ctx.lineTo(0, topY + 36); ctx.lineTo(-4, topY + 26);
    ctx.closePath(); ctx.fill();
  } else if (def.outfit === 'vest') {
    // shirt + puffer vest panels
    blob(ctx, () => {
      ctx.moveTo(-7, topY + 2); ctx.lineTo(0, topY + 18); ctx.lineTo(7, topY + 2); ctx.closePath();
    }, '#e8ecf4');
    ctx.strokeStyle = c.suit2; ctx.lineWidth = 4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 9, topY + 2);
      ctx.quadraticCurveTo(s * 15, (topY + botY) / 2, s * 11, botY + 4);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(-16, topY + 14 + i * 12); ctx.lineTo(-9, topY + 14 + i * 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(9, topY + 14 + i * 12); ctx.lineTo(16, topY + 14 + i * 12); ctx.stroke();
    }
  } else if (def.outfit === 'henley') {
    // crew neck + button placket
    ctx.strokeStyle = c.suit2; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, topY + 3, 8, 0.25, Math.PI - 0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, topY + 10); ctx.lineTo(0, topY + 26); ctx.stroke();
    ctx.fillStyle = c.suit2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(3, topY + 13 + i * 6, 1.6, 0, 7); ctx.fill();
    }
  } else if (def.outfit === 'bomber') {
    ctx.strokeStyle = c.accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-w + 3, botY + 4); ctx.lineTo(w - 2, botY + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, topY + 4); ctx.lineTo(0, botY + 4); ctx.stroke();
  }
  if (def.accessory === 'brooch') {
    ctx.fillStyle = c.accent;
    ctx.beginPath(); ctx.arc(10, topY + 10, 3.6, 0, 7); ctx.fill();
  }
}

function drawBriefcase(ctx, x, y, accent) {
  blob(ctx, () => { ctx.roundRect(x - 20, y - 16, 40, 32, 5); }, '#6b4a2b');
  ctx.fillStyle = accent;
  ctx.fillRect(x - 20, y - 4, 40, 6);
  blob(ctx, () => { ctx.roundRect(x - 8, y - 22, 16, 8, 3); }, '#57391f');
}

// Main world-space fighter draw. f: Fighter instance.
export function drawFighter(ctx, f, t) {
  const def = f.def;
  const P = computePose(f, t);
  ctx.save();
  ctx.translate(f.x, f.y);

  // unicorn aura behind body
  if (f.unicornT > 0) {
    const hue = (t * 260) % 360;
    const g = ctx.createRadialGradient(0, -74, 8, 0, -74, 108);
    g.addColorStop(0, `hsla(${hue}, 95%, 65%, 0.5)`);
    g.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -74, 108, 0, 7); ctx.fill();
  }

  ctx.scale(f.facing, 1);
  if (P.rot) {
    ctx.translate(0, 0);
    ctx.rotate(P.rot);
  }
  if (f.flashT > 0 && FILTER_OK) ctx.filter = 'brightness(2.2) saturate(0.4)';

  const c = def.c;
  const hitJitter = f.state === 'hitstun' ? (Math.random() - 0.5) * 3 : 0;
  ctx.translate(hitJitter, 0);

  // back arm, back leg
  capsule(ctx, -10, P.shoulderY + 8, P.armB.x, P.armB.y, 13, c.suit2);
  blob(ctx, () => { ctx.arc(P.armB.x, P.armB.y, 8.5, 0, 7); }, c.skin);
  capsule(ctx, -8, P.hipY, P.legB.x, P.legB.y - 6, 15, c.pants);
  blob(ctx, () => { ctx.roundRect(P.legB.x - 9, P.legB.y - 9, 26, 10, 5); }, c.shoe);

  // torso (with lean)
  ctx.save();
  if (P.bodyLean) {
    ctx.translate(0, P.hipY);
    ctx.rotate(P.bodyLean * 0.6);
    ctx.translate(0, -P.hipY);
  }
  drawTorso(ctx, def, P);
  // head
  drawHead(ctx, def, P.headX + (P.bodyLean * 26), P.headY, 22, P.face, t, f.unicornT > 0);
  ctx.restore();

  // motion smear behind the striking limb (sells the speed)
  if (f.state === 'attack' && f.attack && (f.attack.kind === 'punch' || f.attack.kind === 'kick')) {
    const a2 = f.attack;
    if (f.stateT >= a2.startup && f.stateT <= a2.startup + a2.active + 0.03) {
      const isKick = a2.kind === 'kick';
      const ox = isKick ? 8 : 10;
      const oy = isKick ? P.hipY : P.shoulderY + 8;
      const tx = isKick ? P.legF.x : P.armF.x;
      const ty = isKick ? P.legF.y - 6 : P.armF.y;
      const rad = Math.hypot(tx - ox, ty - oy);
      const ang = Math.atan2(ty - oy, tx - ox);
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.arc(ox, oy, rad, ang - 0.85, ang + 0.06);
      ctx.arc(ox, oy, rad * 0.45, ang + 0.06, ang - 0.85, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // front leg, front arm
  capsule(ctx, 8, P.hipY, P.legF.x, P.legF.y - 6, 15, c.pants);
  blob(ctx, () => { ctx.roundRect(P.legF.x - 7, P.legF.y - 9, 26, 10, 5); }, c.shoe);
  capsule(ctx, 10, P.shoulderY + 8, P.armF.x, P.armF.y, 13, c.suit);
  blob(ctx, () => { ctx.arc(P.armF.x, P.armF.y, 9, 0, 7); }, c.skin);

  if (P.briefcase) drawBriefcase(ctx, 34, -92, c.accent);

  ctx.filter = 'none';
  ctx.restore();
}

// ---------------------------------------------------------------- portraits

// Bust portrait onto a square canvas 2d context (UI panels, HUD, cards).
export function drawPortrait(canvas, def, opts = {}) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const k = S / 100;
  ctx.clearRect(0, 0, S, S);
  // backdrop — lifted so dark suits still read against dark UI
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, shade(def.c.suit, 34));
  g.addColorStop(1, '#1a2138');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(0, 0, S, S, 12 * k); ctx.fill();
  // burst rays
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, S, S, 12 * k); ctx.clip();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 9; i++) {
    ctx.save();
    ctx.translate(S / 2, S * 0.62);
    ctx.rotate((i / 9) * Math.PI * 2 + 0.3);
    ctx.fillRect(-4 * k, 0, 8 * k, S);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // shoulders
  blob(ctx, () => {
    ctx.moveTo(S * 0.1, S * 1.05);
    ctx.quadraticCurveTo(S * 0.12, S * 0.68, S * 0.5, S * 0.66);
    ctx.quadraticCurveTo(S * 0.88, S * 0.68, S * 0.9, S * 1.05);
    ctx.closePath();
  }, def.c.suit);
  if (def.outfit === 'blazer' || def.outfit === 'suit' || def.outfit === 'pinstripe') {
    blob(ctx, () => {
      ctx.moveTo(S * 0.42, S * 0.67); ctx.lineTo(S * 0.5, S * 0.85); ctx.lineTo(S * 0.58, S * 0.67); ctx.closePath();
    }, '#f4f6ff');
  }
  ctx.save();
  ctx.translate(0, 0);
  const headR = S * 0.24;
  const scale = headR / 22;
  ctx.translate(S / 2, S * 0.42);
  ctx.scale(scale, scale);
  ctx.translate(0, 0);
  drawHead(ctx, def, 0, 0, 22, opts.face || 'idle', opts.t || 1, !!opts.unicorn);
  ctx.restore();
  ctx.restore();
  // frame
  ctx.strokeStyle = 'rgba(5,7,15,0.9)'; ctx.lineWidth = 3 * k;
  ctx.beginPath(); ctx.roundRect(1.5 * k, 1.5 * k, S - 3 * k, S - 3 * k, 11 * k); ctx.stroke();
}
