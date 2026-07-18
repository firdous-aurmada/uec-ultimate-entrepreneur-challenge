// Fighter entity: physics, state machine, attacks and specials.
// Hit *detection/resolution* lives in game.js; fighters own their own state.

import { STAGE, PHYS, ATTACKS, METER, UNICORN } from '../config.js';
import { SPECIALS } from '../data/fighters.js';

function blankPad() {
  return { left: false, right: false, up: false, block: false, punch: false, kick: false, special: false, super: false };
}

export class Fighter {
  constructor(def, side, controller) {
    this.def = def;
    this.side = side;                       // 0 = left start, 1 = right start
    this.controller = controller;
    this.maxHp = def.stats.hp;
    this.hp = this.maxHp;
    this.energy = 0;
    this.x = side === 0 ? 300 : 660;
    this.y = STAGE.FLOOR;
    this.vx = 0;                            // knockback velocity (decays)
    this.vy = 0;
    this.moveVx = 0;                        // walk intent this frame
    this.facing = side === 0 ? 1 : -1;
    this.state = 'idle';
    this.stateT = 0;
    this.stunT = 0;
    this.attack = null;
    this.pad = blankPad();
    this.prevPad = blankPad();
    this.walkPhase = 0;
    this.airborne = false;
    this.airAttackUsed = false;
    this.flashT = 0;
    this.unicornT = 0;
    this.movingBack = false;
    this.comboTaken = 0;                    // hits in the current stun chain (victim-side)
    this.comboDropT = 0;
    this.special = SPECIALS[def.special] || SPECIALS.pitchdeck;
  }

  resetForRound(side) {
    this.hp = this.maxHp;
    this.x = side === 0 ? 300 : 660;
    this.y = STAGE.FLOOR;
    this.vx = this.vy = 0;
    this.facing = side === 0 ? 1 : -1;
    this.state = 'idle';
    this.stateT = 0;
    this.attack = null;
    this.airborne = false;
    this.unicornT = 0;
    this.flashT = 0;
    this.comboTaken = 0;
    this.pad = blankPad();
    this.prevPad = blankPad();
  }

  get grounded() { return !this.airborne; }
  get alive() { return this.hp > 0; }
  get speedMult() { return this.def.stats.speed * (this.unicornT > 0 ? UNICORN.SPEED_MULT : 1); }
  get dmgMult() { return this.def.stats.power * (this.unicornT > 0 ? UNICORN.DMG_MULT : 1); }
  get actionable() {
    return this.state === 'idle' || this.state === 'walk' || this.state === 'jump' || this.state === 'block';
  }

  pressed(k) { return this.pad[k] && !this.prevPad[k]; }

  hurtbox() {
    const h = this.airborne ? 120 : PHYS.BODY_H;
    const w = PHYS.BODY_W;
    return { x: this.x - w / 2, y: this.y - h, w, h };
  }

  // Active hit window → world-space hitbox rect (or null).
  hitbox() {
    const a = this.attack;
    if (!a) return null;
    if (this.stateT < a.startup || this.stateT > a.startup + a.active) return null;
    if (a.kind === 'projectile' || a.kind === 'rain') return null;   // damage via projectiles
    const reach = a.reach || 82;
    const x0 = this.x + (this.facing > 0 ? 14 : -14 - reach);
    const yC = this.y + (a.hitY || -95);
    const tall = a.kind === 'aoe' ? 150 : 74;
    return { x: x0, y: yC - tall / 2, w: reach, h: tall, a };
  }

  update(dt, game, locked = false) {
    if (locked) this.pad = blankPad();       // intros/cinematics: no inputs, physics still runs
    else this.controller.update(this, game);
    const pad = this.pad;
    const opp = game.other(this);

    // timers
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.unicornT > 0) {
      this.unicornT = Math.max(0, this.unicornT - dt);
      if (Math.random() < 12 * dt) game.fx.sparkles(this.x, this.y, 2);
    }
    if (this.comboTaken > 0 && this.state !== 'hitstun') {
      this.comboDropT -= dt;
      if (this.comboDropT <= 0) this.comboTaken = 0;
    }

    // auto-face the opponent while free and grounded
    if (this.grounded && this.state !== 'attack' && this.state !== 'ko' && this.state !== 'hitstun') {
      this.facing = opp.x >= this.x ? 1 : -1;
    }

    this.moveVx = 0;

    switch (this.state) {
      case 'ko':
      case 'victory':
        this.stateT += dt;
        break;

      case 'hitstun': {
        this.stateT += dt;
        if (this.stateT >= this.stunT && this.grounded) this.setState('idle');
        break;
      }

      case 'attack': {
        this.stateT += dt;
        this.updateAttack(dt, game);
        const a = this.attack;
        const total = a.startup + a.active + a.recovery;
        if (this.stateT >= total) {
          this.attack = null;
          this.setState(this.airborne ? 'jump' : 'idle');
        }
        break;
      }

      default: {  // idle / walk / jump / block — actionable
        if (pad.block && this.grounded) {
          this.setState('block');
        } else if (this.state === 'block' && !pad.block) {
          this.setState('idle');
        }

        if (this.state !== 'block') {
          if (this.pressed('super') && this.energy >= METER.SUPER_COST) {
            this.activateUnicorn(game);
          } else if (this.pressed('special')) {
            if (this.energy >= METER.SPECIAL_COST) this.startSpecial(game);
            else game.onSpecialDenied(this);
          } else if (this.pressed('punch') && !(this.airborne && this.airAttackUsed)) {
            this.startAttack('punch', game);
          } else if (this.pressed('kick') && !(this.airborne && this.airAttackUsed)) {
            this.startAttack('kick', game);
          } else if (pad.up && this.grounded) {
            this.vy = PHYS.JUMP_V;
            this.airborne = true;
            this.airAttackUsed = false;
            this.setState('jump');
            game.fx.dust(this.x, this.y, 4);
            game.audio.sfx('whiff');
          }

          if (this.state !== 'attack') {
            const dir = (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
            if (dir !== 0) {
              const sp = PHYS.WALK * this.speedMult * (this.airborne ? PHYS.AIR_DRIFT : 1);
              this.moveVx = dir * sp;
              this.movingBack = (dir !== this.facing);
              if (this.grounded) {
                if (this.state !== 'walk') this.setState('walk');
                this.walkPhase += dt * 11 * this.speedMult;
              }
            } else if (this.state === 'walk') {
              this.setState('idle');
            }
          }
        }
      }
    }

    // ---- physics ----
    this.x += (this.moveVx + this.vx) * dt;
    this.vx *= Math.exp(-PHYS.KB_DECAY * dt);
    if (Math.abs(this.vx) < 4) this.vx = 0;

    if (this.airborne) {
      this.y += this.vy * dt;
      this.vy += PHYS.GRAVITY * dt;
      if (this.y >= STAGE.FLOOR) {
        this.y = STAGE.FLOOR;
        this.airborne = false;
        this.vy = 0;
        game.fx.dust(this.x, this.y, 5);
        if (this.state === 'jump') this.setState('idle');
        else if (this.state === 'attack') { this.attack = null; this.setState('idle'); }
        else if (this.state === 'hitstun' && this.stateT >= this.stunT) this.setState('idle');
        else if (this.state === 'ko') this.vx *= 0.3;
      }
    }

    this.x = Math.max(STAGE.MIN_X, Math.min(STAGE.MAX_X, this.x));
    this.prevPad = { ...pad };
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  startAttack(kind, game) {
    const base = ATTACKS[kind];
    this.attack = { ...base, kind, hasHit: false };
    this.setState('attack');
    game.audio.sfx(kind === 'kick' ? 'kickWhiff' : 'whiff');
    if (this.airborne) this.airAttackUsed = true;
  }

  startSpecial(game) {
    if (this.airborne) return;                       // specials are grounded
    const sp = this.special;
    this.energy -= METER.SPECIAL_COST;
    const a = {
      kind: sp.type, special: sp, hasHit: false,
      startup: sp.startup || 0.15,
      active: sp.active || 0.1,
      recovery: sp.recovery || 0.3,
      dmg: sp.dmg, reach: sp.reach, kb: sp.kb || 260, kbUp: sp.kbUp || 0,
      stun: 0.34, shake: 9, words: ['ZAP!'],
      fired: 0, fireT: 0, rushT: 0, lastRushHit: -1, teleported: false,
    };
    // per-type shaping
    if (sp.type === 'projectile') { a.active = 0.05 + sp.count * sp.interval; a.words = ['SLIDE!', 'DECK!']; }
    if (sp.type === 'aoe')       { a.words = ['BURN!', 'TORCHED!']; a.hitY = -80; }
    if (sp.type === 'teleport')  { a.words = ['PIVOT!']; a.reach = 92; a.hitY = -95; }
    if (sp.type === 'rush')      { a.active = sp.duration; a.words = ['VIRAL!', 'GROWTH!']; a.reach = 70; a.hitY = -90; }
    if (sp.type === 'rain')      { a.words = ['FUNDED!']; }
    if (sp.type === 'grab')      { a.words = ['ACQUIRED!']; a.hitY = -95; }
    this.attack = a;
    this.setState('attack');
    game.onSpecialStart(this, sp);
  }

  updateAttack(dt, game) {
    const a = this.attack;
    const sp = a.special;
    if (!sp) return;
    const activeT = this.stateT - a.startup;

    if (sp.type === 'projectile' && activeT >= 0) {
      a.fireT -= dt;
      if (a.fired < sp.count && a.fireT <= 0) {
        game.spawnSlide(this, a.fired);
        a.fired++;
        a.fireT = sp.interval;
      }
    } else if (sp.type === 'rain' && activeT >= 0 && !a.hasFired) {
      a.hasFired = true;
      game.spawnRain(this);
    } else if (sp.type === 'teleport' && activeT >= 0 && !a.teleported) {
      a.teleported = true;
      game.doTeleport(this);
    } else if (sp.type === 'rush' && activeT >= 0 && activeT <= a.active) {
      // free flight until contact; after lock-on, chase to stay glued for the flurry
      const opp = game.other(this);
      const gap = (opp.x - this.x) * this.facing;
      if (!a.lockedOn) {
        this.x += this.facing * sp.speed * dt;
      } else if (gap > 62) {
        this.x += this.facing * Math.min(sp.speed * dt, gap - 58);
      }
      if (Math.random() < 30 * dt) game.fx.spark(this.x - this.facing * 30, this.y - 80, this.def.c.accent, 2, 160);
      game.pushAfterimage(this);
    } else if (sp.type === 'aoe' && activeT >= 0 && activeT < 0.1 && !a.fxDone) {
      a.fxDone = true;
      game.onBurnBlast(this);
    }
  }

  activateUnicorn(game) {
    this.energy -= METER.SUPER_COST;
    this.unicornT = UNICORN.DURATION;
    game.onUnicorn(this);
  }

  // Applied by game when a hit lands on this fighter.
  applyHit({ dmg, kb, kbUp, stun, dir }) {
    this.hp = Math.max(0, this.hp - dmg);
    this.vx = dir * kb;
    if (kbUp) {
      this.vy = kbUp;
      this.airborne = true;
    }
    this.stunT = stun;
    this.flashT = 0.09;
    this.attack = null;
    this.setState('hitstun');
    this.comboTaken += 1;
    this.comboDropT = 0.55;
  }
}
