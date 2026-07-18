// Canvas compositor for the fight: arena → shadows → afterimages → fighters
// → projectiles → particles/popups → full-screen flashes.

import { STAGE } from '../config.js';
import { drawFighter } from './drawFighter.js';

const { W, H, FLOOR } = STAGE;

function drawShadow(ctx, f) {
  const airK = Math.max(0, Math.min(1, (FLOOR - f.y) / 260));
  const s = 1 - airK * 0.45;
  ctx.fillStyle = `rgba(0,0,0,${0.32 * (1 - airK * 0.5)})`;
  ctx.beginPath();
  ctx.ellipse(f.x, FLOOR + 10, 44 * s, 9 * s, 0, 0, 7);
  ctx.fill();
}

function drawAfterimage(ctx, g) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, g.life / 0.25) * 0.4;
  ctx.translate(g.x, g.y);
  ctx.scale(g.facing, 1);
  ctx.fillStyle = g.color;
  ctx.beginPath(); ctx.ellipse(0, -90, 24, 44, 0.1, 0, 7); ctx.fill();     // torso blur
  ctx.beginPath(); ctx.arc(2, -134, 20, 0, 7); ctx.fill();                 // head blur
  ctx.beginPath(); ctx.ellipse(-2, -30, 16, 32, -0.1, 0, 7); ctx.fill();   // legs blur
  ctx.restore();
}

function drawProjectile(ctx, p, t) {
  if (p.delay > 0) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.type === 'slide') {
    ctx.rotate(Math.sin(t * 9 + p.x * 0.05) * 0.18);
    // glow
    ctx.fillStyle = 'rgba(41,217,255,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 20, 0, 0, 7); ctx.fill();
    // the slide
    ctx.fillStyle = '#f4f6ff';
    ctx.strokeStyle = '#0a0c16';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-18, -13, 36, 26, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#29d9ff';
    ctx.fillRect(-14, -9, 28, 4);
    ctx.strokeStyle = '#ff3d6e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, 8); ctx.lineTo(-6, 2); ctx.lineTo(1, 6); ctx.lineTo(12, -4);
    ctx.stroke();
  } else { // coin
    const squish = Math.abs(Math.sin(p.rot)) * 0.65 + 0.35;
    ctx.scale(squish, 1);
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#0a0c16';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c99e0a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.stroke();
    ctx.fillStyle = '#8a6d00';
    ctx.font = '900 14px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);
  }
  ctx.restore();
}

export function renderGame(ctx, game) {
  const t = game.t;
  ctx.save();
  ctx.translate(game.fx.shakeX, game.fx.shakeY);

  game.arena.draw(ctx, t);

  for (const f of game.fighters) drawShadow(ctx, f);
  for (const g of game.afterimages) drawAfterimage(ctx, g);

  // draw the fighter in hitstun/ko behind the attacker for cleaner overlaps
  const order = [...game.fighters].sort((a, b) => {
    const w = (f) => (f.state === 'attack' ? 2 : f.state === 'hitstun' || f.state === 'ko' ? 0 : 1);
    return w(a) - w(b);
  });
  for (const f of order) drawFighter(ctx, f, t);

  for (const p of game.projectiles) drawProjectile(ctx, p, t);

  game.fx.draw(ctx);
  ctx.restore();

  game.fx.drawOverlay(ctx, W, H);
}
