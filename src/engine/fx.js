// Juice: particles, comic-book word popups, screen shake, hitstop, rings, flashes.

export class FXSystem {
  constructor() {
    this.particles = [];
    this.popups = [];
    this.rings = [];
    this.shakeMag = 0;
    this.hitstopT = 0;
    this.flashCol = null;
    this.flashA = 0;
  }

  update(dt) {
    this.hitstopT = Math.max(0, this.hitstopT - dt);
    this.shakeMag *= Math.pow(0.001, dt);          // fast exponential decay
    if (this.shakeMag < 0.3) this.shakeMag = 0;
    this.flashA = Math.max(0, this.flashA - dt * 3.2);

    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.g || 0) * dt;
      if (p.spin) p.rot += p.spin * dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    for (const w of this.popups) w.t += dt;
    this.popups = this.popups.filter(w => w.t < w.dur);

    for (const r of this.rings) { r.t += dt; r.r += r.vr * dt; }
    this.rings = this.rings.filter(r => r.t < r.dur);
  }

  get shakeX() { return this.shakeMag ? (Math.random() * 2 - 1) * this.shakeMag : 0; }
  get shakeY() { return this.shakeMag ? (Math.random() * 2 - 1) * this.shakeMag * 0.6 : 0; }

  shake(mag) { this.shakeMag = Math.max(this.shakeMag, mag); }
  hitstop(sec) { this.hitstopT = Math.max(this.hitstopT, sec); }
  flash(color = '#ffffff', a = 0.4) { this.flashCol = color; this.flashA = Math.max(this.flashA, a); }

  spark(x, y, color = '#ffd23f', n = 10, speed = 380) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 900,
        life: 0.25 + Math.random() * 0.3, size: 3 + Math.random() * 4, color, shape: 'spark', rot: a, spin: 8,
      });
    }
  }

  dust(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30, y: y - Math.random() * 8,
        vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 70, g: 60,
        life: 0.35 + Math.random() * 0.3, size: 4 + Math.random() * 5, color: 'rgba(210,205,190,0.5)', shape: 'circle',
      });
    }
  }

  flames(x, y, n = 14, dir = 1) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + Math.random() * 60 * dir, y: y - Math.random() * 90,
        vx: dir * (60 + Math.random() * 220), vy: -120 - Math.random() * 200, g: -160,
        life: 0.3 + Math.random() * 0.35, size: 6 + Math.random() * 9,
        color: ['#ffd23f', '#ff9d1a', '#ff3d2e'][i % 3], shape: 'flame',
      });
    }
  }

  coins(x, y, n = 8) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 50, y: y - Math.random() * 30,
        vx: (Math.random() - 0.5) * 260, vy: -220 - Math.random() * 260, g: 1000,
        life: 0.55 + Math.random() * 0.4, size: 5 + Math.random() * 3, color: '#ffd23f', shape: 'coin', rot: 0, spin: 10,
      });
    }
  }

  papers(x, y, n = 8) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x, y: y + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 320, vy: -80 - Math.random() * 200, g: 500,
        life: 0.5 + Math.random() * 0.4, size: 7 + Math.random() * 5, color: '#eef1ff', shape: 'paper', rot: Math.random() * 6, spin: 6,
      });
    }
  }

  sparkles(x, y, n = 3) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 70, y: y - Math.random() * 140,
        vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 60, g: 0,
        life: 0.4 + Math.random() * 0.4, size: 2 + Math.random() * 3,
        color: `hsl(${Math.floor(Math.random() * 360)}, 95%, 70%)`, shape: 'star', rot: 0, spin: 4,
      });
    }
  }

  ring(x, y, color = '#ffd23f', vr = 700, width = 6, dur = 0.35) {
    this.rings.push({ x, y, r: 10, vr, t: 0, dur, color, width });
  }

  popup(x, y, text, color = '#ffd23f') {
    // keep long labels (mystery-drop names) on screen even in the corners
    const margin = 40 + text.length * 8;
    this.popups.push({
      x: Math.max(margin, Math.min(960 - margin, x + (Math.random() - 0.5) * 30)),
      y: y - 20 - Math.random() * 30,
      text, color, t: 0, dur: 0.6, rot: (Math.random() - 0.5) * 0.5,
    });
  }

  draw(ctx) {
    for (const r of this.rings) {
      const k = r.t / r.dur;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const p of this.particles) {
      const k = Math.max(0, p.life / (p.maxLife || 0.5));
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle' || p.shape === 'flame') {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.shape === 'flame' ? k : 1), 0, 7); ctx.fill();
      } else if (p.shape === 'coin') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.scale(Math.abs(Math.sin(p.rot * 2)) * 0.7 + 0.3, 1);
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, 7); ctx.fill();
        ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      } else if (p.shape === 'paper') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        ctx.restore();
      } else if (p.shape === 'star') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -1, p.size * 2, 2);
        ctx.fillRect(-1, -p.size, 2, p.size * 2);
        ctx.restore();
      } else { // spark
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size / 3, p.size * 2, p.size / 1.5);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    // comic word popups
    for (const w of this.popups) {
      const k = w.t / w.dur;
      const scale = k < 0.25 ? 0.4 + (k / 0.25) * 0.8 : 1.2 - k * 0.2;
      ctx.save();
      ctx.translate(w.x, w.y - k * 34);
      ctx.rotate(w.rot);
      ctx.scale(scale, scale);
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = '900 italic 34px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#05070f'; ctx.lineWidth = 7;
      ctx.strokeText(w.text, 0, 0);
      ctx.fillStyle = w.color;
      ctx.fillText(w.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawOverlay(ctx, W, H) {
    if (this.flashA > 0 && this.flashCol) {
      ctx.globalAlpha = Math.min(0.85, this.flashA);
      ctx.fillStyle = this.flashCol;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }
}
