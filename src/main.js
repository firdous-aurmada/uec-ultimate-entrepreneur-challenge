// Boot, screen router, match lifecycle, render loop, menu background.

import { STAGE, DEBUG, rankFor } from './config.js';
import { Save, parseChallengeFromURL } from './state.js';
import { FIGHTERS, getFighter, buildCustomFighter, buildGhostFighter } from './data/fighters.js';
import { randomArena } from './data/arenas.js';
import { audio, installAudioUnlock } from './engine/audio.js';
import { input, HumanController, isTouchDevice } from './engine/input.js';
import { AIController } from './engine/ai.js';
import { Game } from './engine/game.js';
import { renderGame } from './engine/render.js';
import { drawPortrait } from './engine/drawFighter.js';
import { hud } from './ui/hud.js';
import {
  initScreens, openSelect, sel, toast, updateTitleChip, showIncomingChallenge,
  showShareCard, openInvite, openModal, closeModals, renderProfile, renderLeaderboard,
} from './ui/screens.js';
import { shouldShowTutorial, showTutorial } from './ui/tutorial.js';

const $ = (id) => document.getElementById(id);

let currentGame = null;
let currentSetup = null;
let lastResult = null;
let lastRanked = null;
let splashTimer = null;

// ---------------------------------------------------------------- router

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  input.enabled = id === 'scr-fight';
  if (id !== 'scr-fight') {
    audio.stopMusic();
    $('touchControls').classList.add('hidden');
  }
}

// ---------------------------------------------------------------- match lifecycle

function startMatch(cfg) {
  if (cfg.mode === 'solo' && shouldShowTutorial()) {
    showTutorial(() => reallyStartMatch(cfg));
    return;
  }
  reallyStartMatch(cfg);
}

function reallyStartMatch(cfg) {
  clearTimeout(splashTimer);
  closeModals();
  currentSetup = cfg;
  lastResult = null;
  lastRanked = null;

  const p1Controller = new HumanController(0);
  const p2Controller = cfg.mode === 'versus'
    ? new HumanController(1)
    : new AIController(cfg.difficulty, cfg.p2Def);

  input.mode = cfg.mode === 'versus' ? 'versus' : 'solo';
  input.reset();

  currentGame = new Game({
    p1: { def: cfg.p1Def, controller: p1Controller },
    p2: { def: cfg.p2Def, controller: p2Controller },
    arena: cfg.arena,
    mode: cfg.mode,
    difficulty: cfg.difficulty,
    isChallenge: cfg.isChallenge,
    hud,
    onEnd: onMatchEnd,
  });

  hud.setup(currentGame);
  showScreen('scr-fight');

  // touch pads: solo only (2P shares one keyboard)
  const touch = isTouchDevice() || new URLSearchParams(location.search).has('touch');
  $('touchControls').classList.toggle('hidden', !(touch && cfg.mode !== 'versus'));

  // VS splash
  const vs = $('vsSplash');
  drawPortrait($('vsFace1'), cfg.p1Def);
  drawPortrait($('vsFace2'), cfg.p2Def);
  $('vsName1').textContent = cfg.p1Def.name;
  $('vsName2').textContent = cfg.p2Def.name;
  vs.classList.remove('hidden');
  currentGame.paused = true;

  const begin = () => {
    clearTimeout(splashTimer);
    vs.classList.add('hidden');
    vs.onclick = null;
    if (currentGame) {
      currentGame.paused = false;
      audio.startMusic(cfg.arena);
    }
  };
  vs.onclick = begin;
  splashTimer = setTimeout(begin, 1600);
}

function onMatchEnd(result) {
  lastResult = result;
  const ranked = result.mode === 'solo';
  if (ranked) {
    lastRanked = Save.recordMatch({
      won: result.winnerIdx === 0,
      koRounds: result.koRounds[0],
      difficulty: result.difficulty,
      isChallenge: result.isChallenge,
    });
    updateTitleChip();
  }
  renderResults();
  showScreen('scr-results');
}

function verdictText() {
  const r = lastResult;
  if (r.mode === 'versus') return r.winnerIdx === 0 ? 'P1 WINS!' : 'P2 WINS!';
  return r.winnerIdx === 0 ? 'VICTORY' : 'DEFEAT';
}

function renderResults() {
  const r = lastResult;
  const won = r.winnerIdx === 0;
  const v = $('result-verdict');
  v.textContent = verdictText();
  v.classList.toggle('lose', r.mode === 'solo' && !won);

  const wDef = r.defs[r.winnerIdx];
  const lDef = r.defs[1 - r.winnerIdx];
  drawPortrait($('resFaceW'), wDef, { face: 'happy' });
  drawPortrait($('resFaceL'), lDef, { face: 'ko' });
  $('resNameW').textContent = wDef.name;
  $('resNameL').textContent = lDef.name;
  $('result-score').textContent = `${r.score[r.winnerIdx]} – ${r.score[1 - r.winnerIdx]}`;

  const stats = [
    [`${r.koRounds[r.winnerIdx]}`, 'KO ROUNDS'],
    [`${Math.max(r.maxCombo[0], r.maxCombo[1])}`, 'BEST COMBO'],
    [currentSetup.arena.name, 'ARENA'],
  ];
  $('result-stats').innerHTML = stats
    .map(([b, l]) => `<div class="rstat"><b>${b}</b><span>${l}</span></div>`).join('');

  const pts = $('result-points');
  if (lastRanked) {
    pts.classList.remove('hidden');
    pts.innerHTML =
      `<span class="pts">+${lastRanked.gained} PTS</span> → ${lastRanked.total} total · ` +
      `<span class="rank-chip">${lastRanked.rank}</span>` +
      (lastRanked.streak > 1 ? ` · 🔥 ${lastRanked.streak} WIN STREAK` : '');
  } else {
    pts.classList.add('hidden');
  }

  $('result-cta').classList.toggle('hidden', !!Save.profile || r.mode === 'versus');
}

function quickFight() {
  const p = Save.profile;
  const p1Def = p ? buildCustomFighter(p)
    : getFighter(Save.data.lastFighter && Save.data.lastFighter !== 'custom' ? Save.data.lastFighter : 'ava');
  const pool = FIGHTERS.filter(f => f.id !== (p1Def.id === 'custom' ? p1Def.baseId : p1Def.id));
  const p2Def = pool[Math.floor(Math.random() * pool.length)];
  const difficulty = Save.data.tutorialSeen ? (Save.data.lastDifficulty || 'founder') : 'intern';
  startMatch({ mode: 'solo', p1Def, p2Def, arena: randomArena(), difficulty, isChallenge: false });
}

function quitMatch() {
  closeModals();
  currentGame = null;
  showScreen('scr-title');
}

// ---------------------------------------------------------------- pause

function togglePause() {
  if (!currentGame || currentGame.finished) return;
  if (currentGame.paused) {
    closeModals();
    currentGame.paused = false;
  } else {
    currentGame.paused = true;
    openModal('modal-pause');
  }
  audio.sfx('click');
}

// ---------------------------------------------------------------- share card

function shareCard() {
  const r = lastResult;
  const cleanUrl = location.host ? location.host + location.pathname.replace(/index\.html$/, '') : 'uec.game';
  showShareCard({
    verdict: verdictText().replace('!', ''),
    defs: r.defs,
    winnerIdx: r.winnerIdx,
    score: [r.score[r.winnerIdx], r.score[1 - r.winnerIdx]],
    kos: r.koRounds[r.winnerIdx],
    maxCombo: Math.max(r.maxCombo[0], r.maxCombo[1]),
    arenaName: currentSetup.arena.name,
    pointsLine: lastRanked ? `+${lastRanked.gained} PTS → ${lastRanked.total} · ${lastRanked.rank}` : null,
    url: cleanUrl.replace(/\/$/, ''),
  });
}

function downloadCard() {
  $('shareCanvas').toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'uec-fight-result.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('⬇ Result card downloaded.');
  }, 'image/png');
}

async function nativeShareCard() {
  const canvas = $('shareCanvas');
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const file = new File([blob], 'uec-result.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: 'UEC fight result' }).catch(() => {});
  } else if (navigator.share) {
    navigator.share({ title: 'UEC', text: 'I just fought in the Ultimate Entrepreneur Challenge 🥊', url: location.href.split('?')[0] }).catch(() => {});
  } else {
    downloadCard();
  }
}

// ---------------------------------------------------------------- menu background

const bg = { canvas: null, ctx: null, orbs: [] };

function setupBg() {
  bg.canvas = $('bgCanvas');
  bg.ctx = bg.canvas.getContext('2d');
  for (let i = 0; i < 26; i++) {
    bg.orbs.push({
      x: Math.random(), y: Math.random(),
      r: 1 + Math.random() * 2.5, s: 0.008 + Math.random() * 0.02,
      hue: [45, 330, 190, 265][i % 4], p: Math.random() * 7,
    });
  }
  const resize = () => {
    bg.canvas.width = innerWidth;
    bg.canvas.height = innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);
}

function drawBg(t) {
  const { ctx, canvas } = bg;
  const W = canvas.width, H = canvas.height;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0b0e1a');
  g.addColorStop(0.6, '#10152a');
  g.addColorStop(1, '#1a1030');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // perspective grid floor
  ctx.strokeStyle = 'rgba(123,92,255,0.10)';
  ctx.lineWidth = 1;
  const horizon = H * 0.72;
  for (let i = 0; i < 14; i++) {
    const y = horizon + Math.pow(i / 14, 1.7) * (H - horizon);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let i = -10; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 60, horizon);
    ctx.lineTo(W / 2 + i * 260, H);
    ctx.stroke();
  }
  // rising chart line
  ctx.strokeStyle = 'rgba(46,230,107,0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 30; i++) {
    const x = (i / 30) * W;
    const y = H * 0.55 - i * (H * 0.012) + Math.sin(i * 1.1 + t * 0.9) * 14;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  // floating sparks
  for (const o of bg.orbs) {
    o.y -= o.s * 0.016;
    if (o.y < -0.05) { o.y = 1.05; o.x = Math.random(); }
    const a = 0.25 + 0.2 * Math.sin(t * 2 + o.p);
    ctx.fillStyle = `hsla(${o.hue}, 90%, 65%, ${a})`;
    ctx.beginPath();
    ctx.arc(o.x * W, o.y * H, o.r, 0, 7);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- game canvas

let gctx = null;

function setupGameCanvas() {
  const canvas = $('gameCanvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = STAGE.W * dpr;
  canvas.height = STAGE.H * dpr;
  gctx = canvas.getContext('2d');
  gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ---------------------------------------------------------------- loop

let lastT = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const fightActive = document.getElementById('scr-fight').classList.contains('active');
  if (fightActive && currentGame) {
    currentGame.update(dt);
    renderGame(gctx, currentGame);
  } else {
    drawBg(now / 1000);
  }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- boot

function boot() {
  setupBg();
  setupGameCanvas();
  installAudioUnlock();
  input.init();
  hud.bind();
  input.attachTouch($('touchControls'));

  initScreens({
    showScreen,
    startMatch,
    quickFight,
    onModalClosed: () => { /* settings/invite closed — nothing to resume */ },
  });

  input.onPause = togglePause;
  $('btn-pause').onclick = togglePause;
  $('btn-resume').onclick = togglePause;
  $('btn-restart').onclick = () => { audio.sfx('fight'); reallyStartMatch(currentSetup); };
  $('btn-quit').onclick = () => { audio.sfx('back'); quitMatch(); };

  // results buttons
  $('btn-rematch').onclick = () => { audio.sfx('fight'); reallyStartMatch(currentSetup); };
  $('btn-changefighter').onclick = () => { audio.sfx('select'); openSelect(currentSetup.mode); };
  $('btn-res-menu').onclick = () => { audio.sfx('back'); showScreen('scr-title'); };
  $('btn-sharecard').onclick = shareCard;
  $('btn-res-invite').onclick = () => openInvite();
  $('btn-res-profile').onclick = () => { renderProfile(); showScreen('scr-profile'); };
  $('btn-dl-card').onclick = downloadCard;
  $('btn-share-card').onclick = nativeShareCard;

  showScreen('scr-title');

  // incoming challenge link?
  const ch = parseChallengeFromURL();
  if (ch) {
    history.replaceState(null, '', location.pathname);
    const ghostDef = buildGhostFighter(ch);
    const difficulty = ch.pts >= 1200 ? 'mogul' : ch.pts >= 300 ? 'founder' : 'intern';
    showIncomingChallenge(ghostDef, ch, () => {
      sel.ghost = { def: ghostDef, difficulty, isChallenge: true };
      openSelect('solo');
    });
  }

  requestAnimationFrame(loop);

  // auto-pause if the tab is hidden mid-fight (rAF throttling would stall it anyway)
  document.addEventListener('visibilitychange', () => {
    if (DEBUG) return;                                  // test harness drives time manually
    if (document.hidden && currentGame && !currentGame.paused && !currentGame.finished
      && currentGame.state !== 'matchEnd'
      && $('scr-fight').classList.contains('active')) {
      togglePause();
    }
  });

  if (DEBUG) {
    window.UEC = {
      get game() { return currentGame; },
      Save,
      input,
      startMatch,
      quickFight,
      showScreen,
      setHP(i, v) { currentGame.fighters[i].hp = v; },
      setEnergy(i, v) { currentGame.fighters[i].energy = v; },
      setTimer(v) { currentGame.timer = v; },
      skipSplash() { clearTimeout(splashTimer); $('vsSplash').onclick?.(); },
      // Deterministic stepper for automated tests (rAF may be throttled headless).
      step(s = 1, dt = 1 / 60) {
        const n = Math.max(1, Math.round(s / dt));
        for (let i = 0; i < n; i++) currentGame?.update(dt);
        if (currentGame) renderGame(gctx, currentGame);
      },
    };
  }
}

boot();
