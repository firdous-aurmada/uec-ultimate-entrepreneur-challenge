// Match controller: best-of-3 rounds, timers, hit resolution, projectiles,
// special-move orchestration, KO/victory cinematics. Emits result via onEnd().

import { STAGE, PHYS, ROUND, METER, BLOCK, UNICORN } from '../config.js';
import { Fighter } from './fighter.js';
import { FXSystem } from './fx.js';
import { audio } from './audio.js';

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class Game {
  constructor({ p1, p2, arena, mode, difficulty, isChallenge, onEnd, hud }) {
    this.arena = arena;
    this.mode = mode;                        // 'solo' | 'versus'
    this.difficulty = difficulty;
    this.isChallenge = !!isChallenge;
    this.onEnd = onEnd;
    this.hud = hud;
    this.audio = audio;
    this.fx = new FXSystem();
    this.fighters = [new Fighter(p1.def, 0, p1.controller), new Fighter(p2.def, 1, p2.controller)];
    this.projectiles = [];
    this.afterimages = [];
    this.roundWins = [0, 0];
    this.koRounds = [0, 0];
    this.maxCombo = [0, 0];
    this.roundNum = 1;
    this.timer = ROUND.TIME;
    this.state = 'intro';
    this.stateT = 0;
    this.timescale = 1;
    this.dt = 0;
    this.t = 0;
    this.paused = false;
    this.winnerIdx = -1;
    this.roundWinner = -1;
    this.roundWasKO = false;
    this.lastTickSec = -1;
    this.hintFlags = { special: false, super: false };
    this.finished = false;
    this.introStep = -1;
  }

  other(f) { return this.fighters[0] === f ? this.fighters[1] : this.fighters[0]; }

  update(rawDt) {
    if (this.paused) return;
    this.t += rawDt;
    this.fx.update(rawDt);
    if (this.fx.hitstopT > 0) { this.hud.update(this); return; }

    const dt = rawDt * this.timescale;
    this.dt = dt;

    switch (this.state) {
      case 'intro': this.updateIntro(rawDt); break;
      case 'fighting': this.updateFighting(dt); break;
      case 'roundEnd': this.updateRoundEnd(rawDt); break;
      case 'matchEnd': this.updateMatchEnd(rawDt); break;
    }

    this.hud.update(this);
  }

  // ---------------- intro ----------------
  updateIntro(dt) {
    this.stateT += dt;
    if (this.introStep < 0) {
      this.introStep = 0;
      const label = this.roundWins[0] === 1 && this.roundWins[1] === 1 ? 'FINAL ROUND' : `ROUND ${this.roundNum}`;
      this.hud.announce(label);
      this.audio.sfx('round');
    }
    if (this.introStep === 0 && this.stateT >= ROUND.INTRO_ROUND_T) {
      this.introStep = 1;
      this.hud.announce('FIGHT!');
      this.audio.sfx('fight');
    }
    if (this.introStep === 1 && this.stateT >= ROUND.INTRO_ROUND_T + ROUND.INTRO_FIGHT_T) {
      this.hud.clearAnnounce();
      this.setState('fighting');
    }
    for (const f of this.fighters) f.update(dt, this, true);
  }

  // ---------------- fighting ----------------
  updateFighting(dt) {
    this.timer = Math.max(0, this.timer - dt);
    const sec = Math.ceil(this.timer);
    if (sec <= 10 && sec !== this.lastTickSec && sec > 0) {
      this.lastTickSec = sec;
      this.audio.sfx('timeTick');
    }

    for (const f of this.fighters) f.update(dt, this, false);
    this.pushApart();
    this.updateProjectiles(dt);
    this.resolveHits();
    this.updateAfterimages(dt);
    this.updateHints();

    // KO?
    for (let i = 0; i < 2; i++) {
      if (this.fighters[i].hp <= 0 && this.fighters[i].state !== 'ko') {
        this.doKO(1 - i, i);
        return;
      }
    }

    // time up
    if (this.timer <= 0) {
      const [a, b] = this.fighters;
      const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
      const winner = ra === rb ? -1 : (ra > rb ? 0 : 1);
      this.hud.announce('TIME UP');
      this.audio.sfx('round');
      this.endRound(winner, false);
    }
  }

  pushApart() {
    const [a, b] = this.fighters;
    if (a.state === 'ko' || b.state === 'ko') return;
    const dx = b.x - a.x;
    const minGap = PHYS.BODY_W * 0.92;
    if (Math.abs(dx) < minGap && Math.abs(a.y - b.y) < 120) {
      const push = (minGap - Math.abs(dx)) / 2;
      const dir = dx >= 0 ? 1 : -1;
      a.x -= dir * push;
      b.x += dir * push;
      a.x = Math.max(STAGE.MIN_X, Math.min(STAGE.MAX_X, a.x));
      b.x = Math.max(STAGE.MIN_X, Math.min(STAGE.MAX_X, b.x));
    }
  }

  // ---------------- hits ----------------
  resolveHits() {
    for (const att of this.fighters) {
      const hb = att.hitbox();
      if (!hb) continue;
      const a = hb.a;
      const def = this.other(att);
      if (def.state === 'ko') continue;

      if (a.kind === 'rush') {
        const sp = a.special;
        const activeT = att.stateT - a.startup;
        if (!overlap(hb, def.hurtbox())) continue;
        if (a.contactT === undefined) {
          // first contact: lock in place and extend the window to fit the full flurry
          a.contactT = activeT;
          a.lockedOn = true;
          a.active = activeT + sp.hits * sp.hitInterval + 0.04;
        }
        const idx = Math.floor((activeT - a.contactT) / sp.hitInterval);
        if (idx === a.lastRushHit || idx >= sp.hits) continue;
        a.lastRushHit = idx;
        this.strike(att, def, { ...a, dmg: sp.dmg, kb: sp.kb, kbUp: 0, stun: 0.3, shake: 5 });
        continue;
      }

      if (a.hasHit) continue;
      if (!overlap(hb, def.hurtbox())) continue;

      if (a.kind === 'grab') {
        a.hasHit = true;
        if (def.airborne) continue;                    // grabs whiff vs air
        this.doGrab(att, def, a);
        continue;
      }
      a.hasHit = true;
      this.strike(att, def, a);
    }
  }

  strike(att, def, a, fromProjectile = false) {
    const dir = Math.sign(def.x - att.x) || att.facing;
    const cx = def.x - dir * 20;
    const cy = def.y - 100 + Math.random() * 24;
    const blocked = def.state === 'block' && def.grounded;

    if (blocked) {
      let chip = Math.max(1, Math.round(a.dmg * att.dmgMult * BLOCK.CHIP));
      if (def.unicornT > 0) chip = 0;
      def.hp = Math.max(1, def.hp - chip);             // chip can't KO
      def.vx = dir * BLOCK.PUSH;
      this.giveEnergy(att, METER.CHIP_DEAL);
      this.audio.sfx('block');
      this.fx.spark(cx, cy, '#8fd8ff', 6, 240);
      this.fx.ring(cx, cy, '#8fd8ff', 350, 3, 0.22);
      this.fx.shake(2);
      return;
    }

    const dmg = Math.max(1, Math.round(a.dmg * att.dmgMult));
    def.applyHit({ dmg, kb: a.kb, kbUp: a.kbUp || 0, stun: a.stun, dir });
    this.giveEnergy(att, METER.HIT_DEAL);
    this.giveEnergy(def, METER.HIT_TAKE);

    const attIdx = this.fighters.indexOf(att);
    this.maxCombo[attIdx] = Math.max(this.maxCombo[attIdx], def.comboTaken);
    if (def.comboTaken >= 2) this.hud.combo(attIdx, def.comboTaken);

    const heavy = a.kind !== 'punch';
    this.audio.sfx(fromProjectile ? (a.sfx || 'paperHit') : heavy ? 'kickHit' : 'punchHit');
    const words = a.words || ['POW!'];
    this.fx.popup(cx, cy - 30, words[Math.floor(Math.random() * words.length)], heavy ? '#ff3d6e' : '#ffd23f');
    this.fx.spark(cx, cy, heavy ? '#ff5c39' : '#ffd23f', heavy ? 14 : 9, heavy ? 430 : 330);
    this.fx.shake(a.shake || 6);
    this.fx.hitstop(heavy ? 0.085 : 0.05);
  }

  doGrab(att, def, a) {
    const dir = Math.sign(def.x - att.x) || att.facing;
    const sp = a.special;
    const dmg = Math.max(1, Math.round(sp.dmg * att.dmgMult));
    this.audio.sfx('grab');
    this.fx.hitstop(0.3);
    this.fx.popup(def.x, def.y - 150, 'ACQUIRED!', '#ff3d6e');
    // hoisted and thrown behind the attacker — sides swap
    def.x = att.x;
    def.applyHit({ dmg, kb: -dir * sp.kb, kbUp: sp.kbUp, stun: 0.55, dir: -dir });
    this.giveEnergy(att, METER.HIT_DEAL);
    this.giveEnergy(def, METER.HIT_TAKE);
    this.audio.sfx('throwSlam');
    this.fx.shake(14);
    this.fx.spark(att.x, att.y - 110, '#ff3d6e', 16, 460);
    const attIdx = this.fighters.indexOf(att);
    this.maxCombo[attIdx] = Math.max(this.maxCombo[attIdx], def.comboTaken);
  }

  giveEnergy(f, amt) {
    const before = f.energy;
    f.energy = Math.min(METER.MAX, f.energy + amt);
    if (before < METER.MAX && f.energy >= METER.MAX) this.audio.sfx('meterFull');
  }

  // ---------------- specials plumbing ----------------
  onSpecialStart(f, sp) {
    this.fx.flash(f.def.c.accent, 0.12);
    if (sp.type === 'grab') this.audio.sfx('grab');
    if (sp.type === 'rush') this.audio.sfx('rush');
  }

  onSpecialDenied(f) {
    this.audio.sfx('back');
    this.hud.denyMeter(this.fighters.indexOf(f));
  }

  spawnSlide(owner, i) {
    this.audio.sfx('projectile');
    const sp = owner.special;
    this.projectiles.push({
      type: 'slide', owner, delay: 0,
      x: owner.x + owner.facing * 48, y: owner.y - 112 + (i - 1) * 10,
      vx: owner.facing * sp.speed, vy: 0, rot: 0,
      dmg: sp.dmg, kb: 220, kbUp: 0, stun: 0.24, dead: false,
      words: ['SLIDE!', 'NEXT SLIDE!'], sfx: 'paperHit', shake: 5,
    });
    this.fx.ring(owner.x + owner.facing * 48, owner.y - 112, owner.def.c.accent, 260, 3, 0.18);
  }

  spawnRain(owner) {
    this.audio.sfx('special');
    const opp = this.other(owner);
    const sp = owner.special;
    for (let i = 0; i < sp.count; i++) {
      this.projectiles.push({
        type: 'coin', owner, delay: i * 0.16,
        x: Math.max(STAGE.MIN_X, Math.min(STAGE.MAX_X, opp.x + (i - 1) * 52)),
        y: -40, vx: 0, vy: 660, rot: 0,
        dmg: sp.dmg, kb: 120, kbUp: 0, stun: 0.3, dead: false,
        words: ['FUNDED!', 'CHA-CHING!'], sfx: 'coin', shake: 6, refund: sp.energyRefund,
      });
    }
  }

  doTeleport(f) {
    const opp = this.other(f);
    const dir = Math.sign(opp.x - f.x) || 1;
    this.fx.dust(f.x, f.y - 40, 10);
    this.fx.ring(f.x, f.y - 90, f.def.c.accent, 420, 4, 0.3);
    f.x = Math.max(STAGE.MIN_X, Math.min(STAGE.MAX_X, opp.x + dir * 84));
    f.facing = Math.sign(opp.x - f.x) || -dir;
    this.fx.dust(f.x, f.y - 40, 10);
    this.fx.ring(f.x, f.y - 90, f.def.c.accent, 420, 4, 0.3);
    this.audio.sfx('teleport');
  }

  onBurnBlast(f) {
    this.audio.sfx('burn');
    this.fx.flames(f.x + f.facing * 30, f.y, 22, f.facing);
    this.fx.ring(f.x + f.facing * 70, f.y - 80, '#ff9d1a', 600, 7, 0.3);
    this.fx.flash('#ff9d1a', 0.18);
    this.fx.shake(8);
  }

  onUnicorn(f) {
    this.audio.sfx('unicorn');
    this.fx.hitstop(UNICORN.POP_FREEZE);
    this.fx.flash('#ffffff', 0.5);
    this.fx.ring(f.x, f.y - 80, '#ffd23f', 900, 8, 0.5);
    this.fx.sparkles(f.x, f.y, 26);
    this.fx.popup(f.x, f.y - 190, 'UNICORN MODE!', '#ff9df3');
    this.fx.shake(10);
    const opp = this.other(f);
    if (Math.abs(opp.x - f.x) < 160 && opp.state !== 'ko') {
      opp.vx = (Math.sign(opp.x - f.x) || 1) * 340;
    }
  }

  pushAfterimage(f) {
    const last = this.afterimages[this.afterimages.length - 1];
    if (last && last.owner === f && this.t - last.born < 0.03) return;
    this.afterimages.push({ owner: f, x: f.x, y: f.y, facing: f.facing, color: f.def.c.suit, life: 0.25, born: this.t });
  }

  updateAfterimages(dt) {
    for (const g of this.afterimages) g.life -= dt;
    this.afterimages = this.afterimages.filter(g => g.life > 0);
  }

  // ---------------- projectiles ----------------
  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += dt * 9;
      if (p.type === 'slide') p.y += Math.sin(this.t * 10 + p.x * 0.02) * 18 * dt;

      const def = this.other(p.owner);
      if (def.state !== 'ko' && overlap({ x: p.x - 16, y: p.y - 12, w: 32, h: 24 }, def.hurtbox())) {
        p.dead = true;
        const wasBlocked = def.state === 'block' && def.grounded;
        this.strike(p.owner, def, {
          kind: 'projectile', dmg: p.dmg, kb: p.kb, kbUp: p.kbUp, stun: p.stun,
          words: p.words, sfx: p.sfx, shake: p.shake, hasHit: false,
        }, true);
        if (p.refund && !wasBlocked) this.giveEnergy(p.owner, p.refund);
        if (p.type === 'coin') this.fx.coins(p.x, def.y - 60, 5);
        continue;
      }
      if (p.type === 'coin' && p.y >= STAGE.FLOOR) {
        p.dead = true;
        this.fx.coins(p.x, STAGE.FLOOR, 4);
        this.audio.sfx('coin');
      }
      if (p.x < -60 || p.x > STAGE.W + 60 || p.y > STAGE.H + 60) p.dead = true;
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  // ---------------- hints ----------------
  updateHints() {
    if (this.mode !== 'solo') return;
    const f = this.fighters[0];
    if (!f.controller.isHuman) return;
    if (!this.hintFlags.special && f.energy >= METER.SPECIAL_COST) {
      this.hintFlags.special = true;
      this.hud.hint(`⚡ SPECIAL READY — press L (or B) for ${f.special.name}`);
    }
    if (!this.hintFlags.super && f.energy >= METER.SUPER_COST) {
      this.hintFlags.super = true;
      this.hud.hint('🦄 FULL METER — press U (or G) for UNICORN MODE');
    }
  }

  // ---------------- round & match flow ----------------
  doKO(winnerIdx, loserIdx) {
    const loser = this.fighters[loserIdx];
    const winner = this.fighters[winnerIdx];
    const dir = Math.sign(loser.x - winner.x) || 1;
    loser.setState('ko');
    loser.vx = dir * 380;
    loser.vy = -420;
    loser.airborne = true;
    this.hud.announce('K.O.!', 'ko');
    this.audio.sfx('ko');
    this.fx.flash('#ffffff', 0.65);
    this.fx.shake(22);
    this.fx.hitstop(0.32);
    this.timescale = 0.3;
    this.endRound(winnerIdx, true);
  }

  endRound(winnerIdx, byKO) {
    this.roundWinner = winnerIdx;
    this.roundWasKO = byKO;
    if (winnerIdx >= 0) {
      this.roundWins[winnerIdx] += 1;
      if (byKO) this.koRounds[winnerIdx] += 1;
    } else {
      this.hud.announce('DRAW');
    }
    this.setState('roundEnd');
  }

  updateRoundEnd(dt) {
    this.stateT += dt;
    this.timescale = Math.min(1, this.timescale + dt * 0.9);
    for (const f of this.fighters) f.update(dt * this.timescale, this, true);

    if (this.stateT >= ROUND.KO_SLOWMO_T && !this.roundBannerDone) {
      this.roundBannerDone = true;
      this.timescale = 1;
      if (this.roundWinner >= 0) {
        const w = this.fighters[this.roundWinner];
        if (w.state !== 'ko') w.setState('victory');
        const matchOver = this.roundWins[this.roundWinner] >= ROUND.WINS_NEEDED;
        if (!matchOver) this.hud.announce(`${w.def.name} TAKES IT`, 'small');
      }
    }

    if (this.stateT >= ROUND.KO_SLOWMO_T + ROUND.ROUND_END_T) {
      this.roundBannerDone = false;
      if (this.roundWinner >= 0 && this.roundWins[this.roundWinner] >= ROUND.WINS_NEEDED) {
        this.winnerIdx = this.roundWinner;
        this.setState('matchEnd');
        const w = this.fighters[this.winnerIdx];
        w.setState('victory');
        this.hud.announce(`${w.def.name} WINS!`);
        this.audio.sfx(this.mode === 'solo' && this.winnerIdx !== 0 ? 'defeat' : 'victory');
      } else {
        this.nextRound();
      }
    }
  }

  nextRound() {
    this.roundNum += 1;
    this.timer = ROUND.TIME;
    this.lastTickSec = -1;
    this.projectiles = [];
    this.afterimages = [];
    this.fighters[0].resetForRound(0);
    this.fighters[1].resetForRound(1);
    this.hud.clearAnnounce();
    this.introStep = -1;
    this.setState('intro');
  }

  updateMatchEnd(dt) {
    this.stateT += dt;
    for (const f of this.fighters) f.update(dt, this, true);
    if (this.stateT >= ROUND.VICTORY_T) this.finish();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.audio.stopMusic();
    this.onEnd({
      mode: this.mode,
      difficulty: this.difficulty,
      isChallenge: this.isChallenge,
      winnerIdx: this.winnerIdx,
      score: [...this.roundWins],
      koRounds: [...this.koRounds],
      maxCombo: [...this.maxCombo],
      defs: [this.fighters[0].def, this.fighters[1].def],
    });
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }
}
