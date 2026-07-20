// First-fight onboarding: three quick cards, then straight into the action.

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
    title: 'STRIKE & DEFEND',
    body: () => isTouchDevice()
      ? '<b>👊 Punch</b> is fast, <b>🦶 Kick</b> hits harder. Hold <b>🛡</b> to block — you\'ll only take chip damage. Watch out: throws can\'t be blocked!'
      : '<b>J</b> = quick punch, <b>K</b> = heavy kick. Hold <b>↓</b> (or S) to block and take only chip damage. Watch out: throws can\'t be blocked — jump away!',
  },
  {
    emoji: '⚡',
    title: 'BUILD YOUR VALUATION',
    body: () => isTouchDevice()
      ? 'Hits fill your <b>energy meter</b>: at 25 lob a <b>💣 PR Bomb</b>, at 50 fire your <b>⚡ Special</b>, at 100 go <b>🦄 UNICORN MODE</b>. <b>⚙️</b> dashes — and grab the <b>mystery briefcases</b> that drop in. They hide secret powers!'
      : 'Hits fill your <b>energy meter</b>: at 25 lob a <b>💣 PR Bomb</b> (I), at 50 fire your <b>⚡ Special</b> (L), at 100 go <b>🦄 UNICORN MODE</b> (U). Dash with <b>O</b> — and grab the <b>mystery briefcases</b> that drop in. They hide secret powers!',
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
