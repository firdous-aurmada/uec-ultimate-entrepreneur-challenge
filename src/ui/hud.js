// DOM HUD: health/energy bars, timer, round pips, portraits, announcements,
// combo counters and one-time hint toasts. Pure view — reads from Game.

import { METER, ROUND } from '../config.js';
import { drawPortrait } from '../engine/drawFighter.js';

const $ = (id) => document.getElementById(id);

class HUD {
  bind() {
    this.el = {
      name: [$('hudName1'), $('hudName2')],
      co: [$('hudCo1'), $('hudCo2')],
      face: [$('hudFace1'), $('hudFace2')],
      hp: [$('hpFill1'), $('hpFill2')],
      ghost: [$('hpGhost1'), $('hpGhost2')],
      en: [$('enFill1'), $('enFill2')],
      enTrack: [document.querySelector('.hud-p1 .en-track'), document.querySelector('.hud-p2 .en-track')],
      enSpark: [$('enSpark1'), $('enSpark2')],
      pips: [$('pips1'), $('pips2')],
      timer: $('hudTimer'),
      announce: $('announce'),
      combo: [$('combo1'), $('combo2')],
      hint: $('hintToast'),
    };
    this.announceTimer = null;
    this.hintTimer = null;
  }

  // Called once per match.
  setup(game) {
    for (let i = 0; i < 2; i++) {
      const def = game.fighters[i].def;
      this.el.name[i].textContent = def.name;
      this.el.co[i].textContent = def.company;
      drawPortrait(this.el.face[i], def);
      this.el.pips[i].innerHTML = '';
      for (let p = 0; p < ROUND.WINS_NEEDED; p++) {
        const pip = document.createElement('i');
        pip.className = 'pip';
        this.el.pips[i].appendChild(pip);
      }
      this.el.combo[i].classList.remove('show');
    }
    this.clearAnnounce(true);
    this.hideHint();
    this.snapBars(game);
  }

  snapBars(game) {
    for (let i = 0; i < 2; i++) {
      const f = game.fighters[i];
      const bars = [
        [this.el.hp[i], f.hp / f.maxHp],
        [this.el.ghost[i], f.hp / f.maxHp],
        [this.el.en[i], f.energy / METER.MAX],
      ];
      for (const [bar, v] of bars) {
        bar.style.transition = 'none';
        bar.style.transform = `scaleX(${v})`;
      }
      void this.el.hp[i].offsetWidth;                 // force reflow, then restore transitions
      for (const [bar] of bars) bar.style.transition = '';
    }
  }

  update(game) {
    for (let i = 0; i < 2; i++) {
      const f = game.fighters[i];
      const ratio = Math.max(0, f.hp / f.maxHp);
      this.el.hp[i].style.transform = `scaleX(${ratio})`;
      this.el.ghost[i].style.transform = `scaleX(${ratio})`;
      this.el.hp[i].classList.toggle('low', ratio <= 0.25 && ratio > 0);

      const en = f.energy / METER.MAX;
      this.el.en[i].style.transform = `scaleX(${en})`;
      this.el.en[i].classList.toggle('full', f.energy >= METER.MAX);
      const ready = f.energy >= METER.SPECIAL_COST;
      this.el.enTrack[i].classList.toggle('ready', ready);
      if (ready) this.el.enSpark[i].textContent = f.energy >= METER.MAX ? '🦄 MAX' : '⚡ READY';

      const pips = this.el.pips[i].children;
      for (let p = 0; p < pips.length; p++) {
        pips[p].classList.toggle('won', p < game.roundWins[i]);
      }
    }
    const sec = Math.ceil(game.timer);
    this.el.timer.textContent = sec;
    this.el.timer.classList.toggle('urgent', sec <= 10 && game.state === 'fighting');
  }

  announce(text, cls = '') {
    const a = this.el.announce;
    clearTimeout(this.announceTimer);
    a.textContent = text;
    a.className = '';
    if (cls === 'small') a.style.fontSize = 'clamp(22px, 5vw, 48px)';
    else a.style.fontSize = '';
    void a.offsetWidth;                       // restart the pop animation
    a.classList.add('show');
    if (cls && cls !== 'small') a.classList.add(cls);
  }

  clearAnnounce(instant = false) {
    const a = this.el.announce;
    clearTimeout(this.announceTimer);
    if (instant) { a.className = ''; a.textContent = ''; return; }
    a.classList.add('out');
    this.announceTimer = setTimeout(() => { a.className = ''; a.textContent = ''; }, 300);
  }

  combo(idx, n) {
    const c = this.el.combo[idx];
    c.textContent = `${n} HITS!`;
    c.classList.remove('show');
    void c.offsetWidth;
    c.classList.add('show');
  }

  denyMeter(idx) {
    this.el.enTrack[idx].animate(
      [{ filter: 'brightness(0.6) sepia(1) hue-rotate(-50deg) saturate(6)' }, { filter: 'none' }],
      { duration: 320 }
    );
  }

  hint(msg) {
    const h = this.el.hint;
    h.textContent = msg;
    h.classList.remove('hidden');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.hideHint(), 3200);
  }

  hideHint() {
    this.el.hint.classList.add('hidden');
  }
}

export const hud = new HUD();
