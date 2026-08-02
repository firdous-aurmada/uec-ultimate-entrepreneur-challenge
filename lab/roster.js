// Roster contact sheet: every fighter, same pose, same stage, at two zooms —
// a face crop and a full body. Used to judge character-design changes against
// the whole cast at once rather than against whichever fighter happened to be
// on screen.
//
//   import { sheet } from '/lab/roster.js';
//   await sheet('/lab/roster-before.png', 'BEFORE');

const IDS = ['ava', 'max', 'kai', 'zara', 'eleanor', 'dex'];

export async function sheet(path, label = '') {
  const R = await import('/src/engine/render.js');
  const { Save } = await import('/src/state.js');
  const { getArena } = await import('/src/data/arenas.js');
  const { getFighter } = await import('/src/data/fighters.js');
  Save.data.tutorialSeen = true;

  const cv = document.getElementById('gameCanvas');
  const ctx = cv.getContext('2d');
  const load = (u) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = u; });
  const frames = [];

  for (const id of IDS) {
    UEC.startMatch({ mode: 'solo', p1Def: getFighter(id), p2Def: getFighter('dex'),
                     arena: getArena('boardroom'), difficulty: 'contender', isChallenge: false });
    for (let i = 0; i < 60 && (UEC.game?.fighters?.length ?? 0) < 2; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const g = UEC.game, [a, b] = g.fighters;
    g.state = 'fighting'; g.paused = false;
    a.state = b.state = 'idle'; a.attack = b.attack = null; a.hitstunT = 0;
    a.x = 300; b.x = 900; a.y = b.y = 480; a.vy = b.vy = 0;   // rival parked off-crop
    g.fx.particles.length = 0; g.fx.popups.length = 0; g.fx.shakeMag = 0;
    g.projectiles.length = 0; g.drops.length = 0;
    // Freeze on the same idle beat for every fighter, or the breathing phase
    // alone changes the pose and the comparison is worthless.
    g.t = 0;
    for (let i = 0; i < 30; i++) R.renderGame(ctx, g);
    frames.push([getFighter(id).name.split(' ')[0], await load(cv.toDataURL('image/png'))]);
  }

  // two rows: face crop on top, full body beneath
  const FW = 190, FH = 150, BW = 190, BH = 300, PAD = 8, LAB = 16;
  const out = document.createElement('canvas');
  out.width = PAD + IDS.length * (FW + PAD);
  out.height = PAD + LAB + FH + PAD + BH + PAD + 22;
  const cx = out.getContext('2d');
  cx.fillStyle = '#0b0e1a'; cx.fillRect(0, 0, out.width, out.height);
  cx.fillStyle = '#ffd23f'; cx.font = '700 14px system-ui';
  cx.fillText(label, PAD, 16);

  frames.forEach(([name, im], i) => {
    const x = PAD + i * (FW + PAD);
    cx.fillStyle = '#9fb0d9'; cx.font = '600 11px system-ui';
    cx.fillText(name, x, 22 + LAB - 2);
    // face: tight around the head of the left-hand fighter
    cx.drawImage(im, im.width * 0.276, im.height * 0.533, im.width * 0.068, im.height * 0.118,
                 x, 22 + LAB, FW, FH);
    // body: whole figure
    cx.drawImage(im, im.width * 0.20, im.height * 0.33, im.width * 0.19, im.height * 0.60,
                 x, 22 + LAB + FH + PAD, BW, BH);
  });

  const blob = await new Promise((r) => out.toBlob(r, 'image/png'));
  const res = await fetch(path, { method: 'PUT', body: blob });
  return `${path} → ${res.status}`;
}
