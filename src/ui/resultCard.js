// Shareable post-match result card (1200×630 PNG — social-card sized).

import { drawPortrait } from '../engine/drawFighter.js';

// A "?" mystery bust (used when the challenger's fighter isn't known yet, e.g. a live room).
function drawMysteryBust(canvas) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#2a3358'); g.addColorStop(1, '#10152a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(0, 0, S, S, S * 0.12); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.font = `900 italic ${S * 0.52}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('?', S / 2, S * 0.56);
  ctx.strokeStyle = 'rgba(5,7,15,0.9)'; ctx.lineWidth = S * 0.03;
  ctx.beginPath(); ctx.roundRect(2, 2, S - 4, S - 4, S * 0.11); ctx.stroke();
}

// Head-to-head challenge card: challenger VS you, "CHALLENGE" up top.
// Each side = { def (fighter def, or null for mystery), name, sub }.
export function renderChallengeCard(canvas, left, right) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0b0e1a'); g.addColorStop(0.5, '#1a1030'); g.addColorStop(1, '#241238');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // burst rays behind the VS
  ctx.save();
  ctx.translate(W / 2, H * 0.54);
  ctx.globalAlpha = 0.08; ctx.fillStyle = '#ffd23f';
  for (let i = 0; i < 14; i++) { ctx.rotate(Math.PI / 7); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-46, 760); ctx.lineTo(46, 760); ctx.closePath(); ctx.fill(); }
  ctx.restore();

  // corner accent stripes
  ctx.save(); ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ff3d6e'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(130, 0); ctx.lineTo(44, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(W, H); ctx.lineTo(W - 130, H); ctx.lineTo(W - 44, 0); ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

  // header
  ctx.font = '900 italic 46px system-ui';
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#05070f'; ctx.lineWidth = 9;
  ctx.strokeText('⚔  CHALLENGE', W / 2, 72);
  ctx.fillStyle = '#ffd23f'; ctx.fillText('⚔  CHALLENGE', W / 2, 72);
  ctx.font = '800 18px system-ui'; ctx.fillStyle = '#29d9ff';
  ctx.fillText('YOU HAVE BEEN CALLED OUT', W / 2, 100);

  const S = 210, y = 140;
  const drawSide = (side, cx) => {
    const c = document.createElement('canvas');
    c.width = c.height = S * 2;                 // 2× for crispness
    if (side.def) drawPortrait(c, side.def, { face: 'angry' });
    else drawMysteryBust(c);
    // gold frame
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.roundRect(cx - S / 2 - 6, y - 6, S + 12, S + 12, 30); ctx.stroke();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, cx - S / 2, y, S, S);
    ctx.font = '900 italic 30px system-ui'; ctx.fillStyle = '#f0f3ff';
    ctx.fillText(side.name, cx, y + S + 44);
    if (side.sub) { ctx.font = '800 17px system-ui'; ctx.fillStyle = '#8b93b8'; ctx.fillText(side.sub, cx, y + S + 72); }
  };
  drawSide(left, W * 0.26);
  drawSide(right, W * 0.74);

  // VS
  ctx.save();
  ctx.translate(W / 2, y + S * 0.52);
  ctx.rotate(-0.05);
  ctx.font = '900 italic 92px system-ui'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#05070f'; ctx.lineWidth = 16; ctx.strokeText('VS', 0, 30);
  ctx.strokeStyle = '#ff3d6e'; ctx.lineWidth = 6; ctx.strokeText('VS', 0, 30);
  ctx.fillStyle = '#ffd23f'; ctx.fillText('VS', 0, 30);
  ctx.restore();
}

export function renderResultCard(canvas, data) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // backdrop
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0b0e1a');
  g.addColorStop(0.55, '#161d33');
  g.addColorStop(1, '#241238');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // burst rays from center
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#ffd23f';
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-70, 900); ctx.lineTo(70, 900); ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // diagonal accent stripes
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ff3d6e';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(180, 0); ctx.lineTo(60, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.moveTo(W, H); ctx.lineTo(W - 180, H); ctx.lineTo(W - 60, 0); ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // header
  ctx.font = '900 italic 44px system-ui';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('UEC', W / 2, 66);
  ctx.font = '900 20px system-ui';
  ctx.fillStyle = '#29d9ff';
  ctx.fillText('U L T I M A T E   E N T R E P R E N E U R   C H A L L E N G E', W / 2, 96);

  // verdict
  ctx.save();
  ctx.translate(W / 2, 200);
  ctx.rotate(-0.03);
  ctx.font = '900 italic 116px system-ui';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#05070f';
  ctx.lineWidth = 22;
  ctx.strokeText(data.verdict, 0, 0);
  ctx.strokeStyle = '#ff3d6e';
  ctx.lineWidth = 10;
  ctx.strokeText(data.verdict, 0, 0);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(data.verdict, 0, 0);
  ctx.restore();

  // portraits — winner large + gold ring, loser small and dimmed
  const face = (def, size) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    drawPortrait(c, def, { face: 'idle' });
    return c;
  };
  const [d1, d2] = data.defs;
  const w1 = data.winnerIdx === 0;

  const drawSide = (def, cx, y, s, won) => {
    if (won) {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.roundRect(cx - s / 2 - 8, y - 8, s + 16, s + 16, 34); ctx.stroke();
    }
    ctx.save();
    if (!won) ctx.globalAlpha = 0.6;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(face(def, s * 2), cx - s / 2, y, s, s);
    ctx.restore();
    ctx.font = '900 italic 28px system-ui';
    ctx.fillStyle = won ? '#f0f3ff' : '#8b93b8';
    ctx.fillText(def.name, cx, y + s + 38);
    ctx.font = '800 18px system-ui';
    ctx.fillStyle = won ? '#29d9ff' : '#5d6484';
    ctx.fillText(def.company, cx, y + s + 64);
  };
  drawSide(d1, 280, w1 ? 250 : 272, w1 ? 210 : 165, w1);
  drawSide(d2, W - 280, w1 ? 272 : 250, w1 ? 165 : 210, !w1);

  // score
  ctx.font = '900 italic 92px system-ui';
  ctx.strokeStyle = '#05070f';
  ctx.lineWidth = 14;
  ctx.strokeText(`${data.score[0]} – ${data.score[1]}`, W / 2, 392);
  ctx.fillStyle = '#29d9ff';
  ctx.fillText(`${data.score[0]} – ${data.score[1]}`, W / 2, 392);

  // stat chips band
  const chips = [];
  if (data.kos > 0) chips.push(`${data.kos} KO${data.kos > 1 ? 's' : ''}`);
  if (data.maxCombo >= 2) chips.push(`${data.maxCombo}-HIT COMBO`);
  if (data.arenaName) chips.push(data.arenaName);
  ctx.font = '800 21px system-ui';
  const chipY = 548;
  const widths = chips.map(c => ctx.measureText(c).width + 40);
  const totalW = widths.reduce((a, b) => a + b + 12, -12);
  let cx0 = W / 2 - totalW / 2;
  chips.forEach((c, i) => {
    ctx.fillStyle = 'rgba(5,7,15,0.72)';
    ctx.beginPath(); ctx.roundRect(cx0, chipY - 25, widths[i], 38, 19); ctx.fill();
    ctx.strokeStyle = '#2a3358'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#f0f3ff';
    ctx.fillText(c, cx0 + widths[i] / 2, chipY + 1);
    cx0 += widths[i] + 12;
  });

  if (data.pointsLine) {
    ctx.font = '900 24px system-ui';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(data.pointsLine, W / 2, 586);
  }

  // footer
  ctx.font = '800 19px system-ui';
  ctx.fillStyle = data.pointsLine ? '#6a7194' : '#8b93b8';
  ctx.fillText(`⚔  Think you can do better?  Fight at ${data.url}`, W / 2, 614);
}
