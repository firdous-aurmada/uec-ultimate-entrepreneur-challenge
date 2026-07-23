// First-fight onboarding: five quick cards, then straight into the action.

import { Save } from '../state.js';
import { audio } from '../engine/audio.js';
import { isTouchDevice } from '../engine/input.js';

const SLIDES = [
  {
    emoji: '🥊',
    title: 'WELCOME, FOUNDER',
    body: () => isTouchDevice()
      ? 'Win <b>2 of 3 rounds</b> — drain their health bar or lead when time runs out. Use the on-screen pads: <b>◀ ▶</b> to move, <b>▲</b> to jump.'
      : 'Win <b>2 of 3 rounds</b> — drain their health bar or lead when time runs out. Move with <b>← →</b> (or A/D), jump with <b>↑</b> (or W).',
  },
  {
    emoji: '👊',
    title: 'THREE STRIKES',
    body: () => isTouchDevice()
      ? 'Three basic attacks, weakest to strongest: <b>🖐 Slap</b> (fastest), <b>👊 Punch</b>, <b>🦶 Kick</b> (hardest). Slap starts a combo, kick ends one.'
      : 'Three basic attacks, weakest to strongest: <b>H</b> = <b>🖐 Slap</b> (fastest), <b>J</b> = <b>👊 Punch</b>, <b>K</b> = <b>🦶 Kick</b> (hardest). Slap starts a combo, kick ends one.',
  },
  {
    emoji: '🔗',
    title: 'CHAIN THEM UP',
    body: () => 'One rule: when an attack <b>lands</b>, you can cancel it into the <b>same move or a stronger one</b> — never a weaker one. So <b>🖐🖐 → 👊👊👊 → 🦶🦶 → ⚡</b> all flows, but kick can\'t go back to punch. Just climb the ladder and finish with your special.',
  },
  {
    emoji: '🛡',
    title: 'BLOCK, PARRY, PUNISH',
    body: () => isTouchDevice()
      ? 'Hold <b>🛡</b> to block. <b>Tap it the instant their hit lands</b> and you <b>PARRY</b> — they stagger, you gain energy, and the counter is free. Throws beat blocks, so jump away from those.'
      : 'Hold <b>↓</b> (or S) to block. <b>Tap it the instant their hit lands</b> and you <b>PARRY</b> — they stagger, you gain energy, and the counter is free. Throws beat blocks, so jump away from those.',
  },
  {
    emoji: '⚡',
    title: 'BUILD YOUR VALUATION',
    body: () => isTouchDevice()
      ? 'Hits fill your <b>energy meter</b>: at 25 hurl a <b>⚖️ Cease &amp; Desist</b>, at 50 fire your <b>⚡ Special</b>, at 100 go <b>🦄 UNICORN MODE</b>. <b>💸</b> steals their energy, <b>💨</b> dashes — and grab the <b>mystery briefcases</b>. They hide secret powers!'
      : 'Hits fill your <b>energy meter</b>: at 25 hurl a <b>⚖️ Cease &amp; Desist</b> (I), at 50 fire your <b>⚡ Special</b> (L), at 100 go <b>🦄 UNICORN MODE</b> (U). <b>M</b> steals energy, <b>O</b> dashes — and grab the <b>mystery briefcases</b>. They hide secret powers!',
  },
];

export function shouldShowTutorial() {
  return !Save.data.tutorialSeen;
}

export function showTutorial(onDone) {
  const root = document.getElementById('tutorial');
  const body = document.getElementById('tut-body');
  const dots = document.getElementById('tut-dots');
  const btnNext = document.getElementById('tut-next');
  const btnSkip = document.getElementById('tut-skip');
  let i = 0;

  const renderDots = () => {
    dots.innerHTML = SLIDES.map((_, d) => `<i class="${d === i ? 'on' : ''}"></i>`).join('');
  };
  const renderSlide = () => {
    const s = SLIDES[i];
    body.innerHTML = `<span class="big-emoji">${s.emoji}</span><h2>${s.title}</h2><p>${s.body()}</p>`;
    btnNext.textContent = i === SLIDES.length - 1 ? "LET'S FIGHT ➤" : 'NEXT ➤';
    renderDots();
  };

  const finish = () => {
    Save.markTutorialSeen();
    root.classList.add('hidden');
    btnNext.onclick = btnSkip.onclick = null;
    onDone();
  };

  btnNext.onclick = () => {
    audio.sfx('click');
    if (i < SLIDES.length - 1) { i++; renderSlide(); } else finish();
  };
  btnSkip.onclick = () => { audio.sfx('back'); finish(); };

  renderSlide();
  root.classList.remove('hidden');
}
