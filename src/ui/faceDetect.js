// Automatic face detection for uploaded photos — fully on-device.
// Fast path: the native FaceDetector API (rare). Reliable path: the vendored
// pico.js detector + its facefinder cascade (assets/facefinder.bin), which
// works in every modern browser. Returns {cx, cy, size} in image pixels, or
// null when no face is confidently found (the crop modal then falls back to
// a center frame and the player adjusts by hand).

import { picoLib as pico } from '../vendor/pico.js';

const QUALITY_MIN = 10;      // clustered pico detections below this are noise
let classifyFn = null;
let cascadeFailed = false;

async function loadCascade() {
  if (classifyFn || cascadeFailed) return classifyFn;
  try {
    const res = await fetch('assets/facefinder.bin');
    if (!res.ok) throw new Error('cascade http ' + res.status);
    const bytes = new Int8Array(await res.arrayBuffer());
    classifyFn = pico.unpack_cascade(bytes);
  } catch (e) {
    cascadeFailed = true;    // offline etc — manual framing still works
  }
  return classifyFn;
}

function nativeDetect(img) {
  if (!('FaceDetector' in window)) return Promise.resolve(null);
  return new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 })
    .detect(img)
    .then((faces) => {
      if (!faces.length) return null;
      const f = faces.reduce((a, b) => (b.boundingBox.width > a.boundingBox.width ? b : a)).boundingBox;
      return { cx: f.x + f.width / 2, cy: f.y + f.height / 2, size: Math.max(f.width, f.height) };
    })
    .catch(() => null);
}

function picoDetect(img, classify) {
  // downscale for speed; detection coords map back through `scale`
  const maxSide = 640;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = (2 * rgba[i * 4] + 7 * rgba[i * 4 + 1] + rgba[i * 4 + 2]) / 10;
  }
  const image = { pixels: gray, nrows: h, ncols: w, ldim: w };
  const params = {
    shiftfactor: 0.1,
    minsize: Math.max(24, Math.round(Math.min(w, h) * 0.12)),
    maxsize: Math.min(w, h) * 1.2,
    scalefactor: 1.1,
  };
  let dets = pico.run_cascade(image, classify, params);
  dets = pico.cluster_detections(dets, 0.2);
  dets = dets.filter((d) => d[3] >= QUALITY_MIN);
  if (!dets.length) return null;
  const best = dets.reduce((a, b) => (b[3] > a[3] ? b : a));
  // pico detections are [row, col, size, quality]
  return { cx: best[1] / scale, cy: best[0] / scale, size: best[2] / scale };
}

export async function detectFace(img) {
  const native = await nativeDetect(img);
  if (native) return native;
  const classify = await loadCascade();
  if (!classify) return null;
  try {
    return picoDetect(img, classify);
  } catch (e) {
    return null;
  }
}
