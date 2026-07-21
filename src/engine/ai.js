// AI opponent: periodic decision ticks (rate = difficulty reaction speed),
// personality-flavored per fighter (aggression / jumpiness / preferred range).

import { AI_LEVELS, METER, STAGE } from '../config.js';

export class AIController {
  constructor(levelKey, def) {
    this.levelKey = levelKey;
    this.level = AI_LEVELS[levelKey] || AI_LEVELS.founder;
    this.persona = def.ai || { aggr: 0.6, jump: 0.3, prefRange: 'mid' };
    this.decideT = 0.4;
    this.dir = 0;
    this.blockT = 0;
    this.pulse = {};           // one-frame button presses
    this.isHuman = false;
  }

  update(f, game) {
    const opp = game.other(f);
    const pad = { left: false, right: false, up: false, block: false, punch: false, kick: false, special: false, super: false };

    // apply queued pulses (single frame)
    for (const k of Object.keys(this.pulse)) { pad[k] = true; }
    this.pulse = {};

    this.blockT -= game.dt;
    if (this.blockT > 0) pad.block = true;

    // chain reflex: the instant a strike connects, decide once whether to
    // continue the string (punch → punch → kick → special)
    const atk = f.attack;
    if (f.state === 'attack' && atk && atk.hasHit && !atk.aiChainDecided
      && (atk.kind === 'punch' || atk.kind === 'kick')) {
      atk.aiChainDecided = true;
      if (Math.random() < (this.level.chain ?? 0.4)) {
        if (atk.kind === 'punch') {
          if ((atk.jabs || 1) < 3) this.pulse.punch = true;
          else this.pulse.kick = true;
        } else if (f.energy >= METER.SPECIAL_COST) {
          this.pulse.special = true;
        } else if (f.energy >= METER.SUPER_COST) {
          this.pulse.super = true;
        }
      }
    }

    if (this.dir === 1) pad.right = true;
    else if (this.dir === -1) pad.left = true;

    this.decideT -= game.dt;
    if (this.decideT <= 0 && f.actionable) {
      this.decideT = this.level.react * (0.75 + Math.random() * 0.7);
      this.decide(f, opp, game);
    }

    f.pad = pad;
  }

  decide(f, opp, game) {
    const L = this.level, P = this.persona;
    const dist = Math.abs(opp.x - f.x);
    const toward = Math.sign(opp.x - f.x) || 1;

    // random hesitation (harder AIs hesitate less)
    if (Math.random() < L.mistake) { this.dir = 0; return; }

    // --- threat response ---
    const oppAttacking = opp.state === 'attack' && opp.attack && !opp.attack.hasHit;
    const oppGrabbing = oppAttacking && opp.attack.kind === 'grab';
    const projThreat = game.projectiles.some(p =>
      p.owner !== f && Math.sign(f.x - p.x) === Math.sign(p.vx || 1) && Math.abs(p.x - f.x) < 300 && !p.delay);
    if (oppGrabbing && dist < 190 && Math.random() < L.blockProb + 0.15) {
      this.pulse.up = true;                      // grabs must be jumped
      this.dir = 0;
      return;
    }
    if ((oppAttacking && dist < 220) || projThreat) {
      if (Math.random() < L.blockProb) {
        this.blockT = 0.28 + Math.random() * 0.3;
        this.dir = 0;
        return;
      }
      if (Math.random() < P.jump * 0.6) {
        this.pulse.up = true;
        this.dir = toward;
        return;
      }
    }

    // --- race to a mystery drop if one is up for grabs ---
    const drop = game.drops.find(d => d.landed);
    if (drop && Math.random() < 0.5 && Math.abs(drop.x - f.x) < 320) {
      this.dir = Math.sign(drop.x - f.x) || 0;
      if (Math.abs(drop.x - f.x) > 200 && f.dashCD <= 0 && Math.random() < 0.4) this.pulse.dash = true;
      return;
    }

    // --- supers & specials ---
    if (f.energy >= METER.SUPER_COST && (f.hp < f.maxHp * 0.5 || Math.random() < 0.25)) {
      this.pulse.super = true;
      return;
    }
    // PR bomb: lob one from range
    if (f.energy >= METER.BOMB_COST && f.energy < METER.SPECIAL_COST && dist > 260 && Math.random() < 0.3) {
      this.pulse.bomb = true;
      this.dir = 0;
      return;
    }
    if (f.energy >= METER.SPECIAL_COST && Math.random() < L.specialProb) {
      const sp = f.special.type;
      const fits =
        (sp === 'projectile' && dist > 240) ||
        (sp === 'rain' && dist > 180) ||
        (sp === 'aoe' && dist < 170) ||
        (sp === 'grab' && dist < 130 && opp.grounded) ||
        (sp === 'rush' && dist > 150 && dist < 460) ||
        (sp === 'teleport' && dist > 200);
      if (fits) {
        this.pulse.special = true;
        this.dir = 0;
        return;
      }
    }

    // --- melee range ---
    if (dist < 128) {
      if (opp.energy >= 25 && f.stealCD <= 0 && Math.random() < L.aggr * 0.3) {
        this.pulse.steal = true;
        this.dir = 0;
        return;
      }
      const r = Math.random();
      if (r < L.aggr * 0.55) this.pulse.punch = true;
      else if (r < L.aggr) this.pulse.kick = true;
      else if (r < L.aggr + 0.18) { this.blockT = 0.25; this.dir = 0; return; }
      else this.dir = -toward;                   // create space
      this.dir = 0;
      return;
    }

    // --- neutral: approach, space, or jump in ---
    const wantRange = P.prefRange === 'far' ? 330 : P.prefRange === 'mid' ? 210 : 110;
    if (dist > wantRange + 60) {
      this.dir = toward;
      if (f.dashCD <= 0 && dist > 280 && Math.random() < L.aggr * 0.3) this.pulse.dash = true;
      else if (Math.random() < P.jump * 0.35) this.pulse.up = true;
    } else if (dist < wantRange - 70 && Math.random() > L.aggr) {
      // too close for a zoner's comfort — back off unless cornered
      const backX = f.x - toward * 60;
      this.dir = (backX > STAGE.MIN_X + 30 && backX < STAGE.MAX_X - 30) ? -toward : toward;
    } else if (Math.random() < L.aggr) {
      this.dir = toward;
    } else {
      this.dir = 0;
    }
  }
}
