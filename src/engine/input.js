// Keyboard + touch → two virtual gamepads.
// Solo mode: both key schemes drive pad 0 (and touch always does).
// Versus mode: WASD-cluster = P1, arrows-cluster = P2.

function blankPad() {
  return { left: false, right: false, up: false, block: false, punch: false, kick: false, special: false, super: false, bomb: false, dash: false };
}

const P1_KEYS = {
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'block',
  KeyC: 'punch', KeyV: 'kick', KeyB: 'special', KeyG: 'super',
  KeyF: 'bomb', KeyR: 'dash',
};
const P2_KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'block',
  KeyJ: 'punch', KeyK: 'kick', KeyL: 'special', KeyU: 'super',
  KeyI: 'bomb', KeyO: 'dash',
};

export const KEY_LABELS = {
  solo: [
    ['Move', '← → / A D'], ['Jump', '↑ / W'], ['Block (hold)', '↓ / S'],
    ['Punch', 'J / C'], ['Kick', 'K / V'], ['PR Bomb 💣', 'I / F'], ['Dash ⚙️', 'O / R'],
    ['Special', 'L / B'], ['Unicorn Mode', 'U / G'], ['Pause', 'Esc'],
  ],
  p1: [
    ['Move', 'A D'], ['Jump', 'W'], ['Block', 'S'],
    ['Punch', 'C'], ['Kick', 'V'], ['Bomb', 'F'], ['Dash', 'R'], ['Special', 'B'], ['Unicorn', 'G'],
  ],
  p2: [
    ['Move', '← →'], ['Jump', '↑'], ['Block', '↓'],
    ['Punch', 'J'], ['Kick', 'K'], ['Bomb', 'I'], ['Dash', 'O'], ['Special', 'L'], ['Unicorn', 'U'],
  ],
};

class Input {
  constructor() {
    this.pads = [blankPad(), blankPad()];
    this.mode = 'solo';
    this.onPause = null;
    this.enabled = false;
  }

  init() {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.reset());
  }

  onKey(e, down) {
    if (!this.enabled) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;   // never swallow browser shortcuts (Cmd+R, Ctrl+F…)
    if (down && (e.code === 'Escape' || e.code === 'KeyP')) {
      if (this.onPause) this.onPause();
      e.preventDefault();
      return;
    }
    const inP1 = P1_KEYS[e.code];
    const inP2 = P2_KEYS[e.code];
    if (!inP1 && !inP2) return;
    e.preventDefault();
    if (this.mode === 'solo') {
      if (inP1) this.pads[0][inP1] = down;
      if (inP2) this.pads[0][inP2] = down;
    } else {
      if (inP1) this.pads[0][inP1] = down;
      if (inP2) this.pads[1][inP2] = down;
    }
  }

  reset() {
    this.pads[0] = blankPad();
    this.pads[1] = blankPad();
  }

  // Wire the on-screen touch pads (always feed pad 0).
  attachTouch(container) {
    container.querySelectorAll('[data-k]').forEach(btn => {
      const key = btn.dataset.k;
      const press = (e) => {
        e.preventDefault();
        btn.classList.add('held');
        this.pads[0][key] = true;
      };
      const release = (e) => {
        if (e) e.preventDefault();
        btn.classList.remove('held');
        this.pads[0][key] = false;
      };
      btn.addEventListener('pointerdown', (e) => {
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* capture is best-effort */ }
        press(e);
      });
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', () => release());
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }
}

export const input = new Input();

export function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

// Controller interface: anything with update(fighter, game) that flips fighter.pad flags.
// HumanController reads a live input pad; AIController (ai.js) synthesizes one;
// a future OnlineController (net/online.js) will replay remote pads. Same contract.
export class HumanController {
  constructor(padIndex) { this.padIndex = padIndex; this.isHuman = true; }
  update(fighter) {
    fighter.pad = { ...input.pads[this.padIndex] };
  }
}
