// All menu screens + modals: fighter select, profile (photo upload → avatar),
// challenges & invite links, leaderboard, help, settings/pause, share card.

import { FIGHTERS, SPECIALS, UNICORN_META, getFighter, buildCustomFighter } from '../data/fighters.js';
import { ARENAS, getArena, randomArena } from '../data/arenas.js';
import { Save, buildChallengeLink } from '../state.js';
import { rankFor } from '../config.js';
import { drawPortrait } from '../engine/drawFighter.js';
import { audio } from '../engine/audio.js';
import { KEY_LABELS } from '../engine/input.js';
import { renderResultCard } from './resultCard.js';

const $ = (id) => document.getElementById(id);
let A = null;   // actions provided by main.js

// ---------------------------------------------------------------- selection state

export const sel = {
  mode: 'solo',
  phase: 0,
  p1: 'ava',
  p2: null,
  arena: 'random',
  difficulty: 'founder',
  ghost: null,          // { def, difficulty } for accepted challenges / rival fights
};

function tileDefs() {
  const list = FIGHTERS.map(f => ({ id: f.id, def: f, badge: null }));
  if (Save.profile) list.push({ id: 'custom', def: buildCustomFighter(Save.profile), badge: 'YOU' });
  list.push({ id: 'random', def: null, badge: null });
  return list;
}

function resolveDef(id) {
  if (id === 'custom') return buildCustomFighter(Save.profile);
  if (id === 'random') {
    const pool = FIGHTERS.map(f => f.id);
    return getFighter(pool[Math.floor(Math.random() * pool.length)]);
  }
  return getFighter(id);
}

function drawRandomTile(canvas) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#2a3358'); g.addColorStop(1, '#10152a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(0, 0, S, S, S * 0.12); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.font = `900 italic ${S * 0.5}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('?', S / 2, S * 0.56);
}

export function openSelect(mode) {
  sel.mode = mode;
  sel.phase = 0;
  sel.p2 = null;
  if (!sel.ghost) sel.difficulty = Save.data.lastDifficulty || 'founder';
  if (Save.profile && sel.p1 === 'ava' && Save.data.lastFighter) sel.p1 = Save.data.lastFighter;
  renderSelect();
  A.showScreen('scr-select');
}

function selectTitle() {
  if (sel.mode === 'versus') return sel.phase === 0 ? 'P1 — CHOOSE YOUR FIGHTER' : 'P2 — CHOOSE YOUR FIGHTER';
  if (sel.ghost) return `FACE ${sel.ghost.def.name}!`;
  return 'CHOOSE YOUR FIGHTER';
}

function renderSelect() {
  $('select-title').textContent = selectTitle();
  $('difficulty-row').style.display = (sel.mode === 'versus' || sel.ghost) ? 'none' : '';

  const grid = $('fighter-grid');
  grid.innerHTML = '';
  for (const t of tileDefs()) {
    const tile = document.createElement('div');
    tile.className = 'f-tile';
    if (t.id === sel.p1 && !(sel.mode === 'versus' && sel.phase === 1)) tile.classList.add('sel');
    if (sel.mode === 'versus') {
      if (t.id === sel.p1) tile.classList.add('sel');
      if (t.id === sel.p2) tile.classList.add('sel2');
    }
    const c = document.createElement('canvas');
    c.width = c.height = 120;
    if (t.def) drawPortrait(c, t.def); else drawRandomTile(c);
    tile.appendChild(c);
    const name = document.createElement('div');
    name.className = 'f-name';
    name.textContent = t.def ? t.def.name.split(' ')[0] : 'RANDOM';
    tile.appendChild(name);
    if (t.badge) {
      const b = document.createElement('div');
      b.className = 'f-badge';
      b.textContent = t.badge;
      tile.appendChild(b);
    }
    tile.onclick = () => {
      audio.sfx('select');
      if (sel.mode === 'versus' && sel.phase === 1) sel.p2 = t.id;
      else sel.p1 = t.id;
      if (sel.mode === 'versus' && sel.phase === 0) sel.phase = 1;
      renderSelect();
    };
    grid.appendChild(tile);
  }

  // arena strip
  const strip = $('arena-strip');
  strip.innerHTML = '';
  const arenas = [{ id: 'random', name: 'RANDOM' }, ...ARENAS];
  for (const a of arenas) {
    const b = document.createElement('button');
    b.className = 'a-tile' + (sel.arena === a.id ? ' sel' : '');
    b.textContent = a.name;
    b.onclick = () => { audio.sfx('click'); sel.arena = a.id; renderSelect(); };
    strip.appendChild(b);
  }

  // difficulty seg
  document.querySelectorAll('#difficulty-seg button').forEach(b => {
    b.classList.toggle('on', b.dataset.diff === sel.difficulty);
    b.onclick = () => { audio.sfx('click'); sel.difficulty = b.dataset.diff; renderSelect(); };
  });

  renderPreview();

  const ready = sel.mode !== 'versus' || (sel.p1 && sel.p2);
  $('btn-fight').disabled = !ready;
  $('btn-fight').textContent = sel.mode === 'versus' && sel.phase === 1 && !sel.p2 ? 'P2 — PICK…' : 'FIGHT ➤';
}

function renderPreview() {
  const focusId = (sel.mode === 'versus' && sel.phase === 1) ? (sel.p2 || sel.p1) : sel.p1;
  const isRandom = focusId === 'random';
  const def = isRandom ? null : resolveDef(focusId);
  const pv = $('preview-portrait');
  if (def) drawPortrait(pv, def); else drawRandomTile(pv);
  $('pv-name').textContent = def ? def.name : 'RANDOM';
  $('pv-title').textContent = def ? def.title : 'ROLL THE DICE';
  $('pv-co').textContent = def ? def.company : 'Could be anyone…';
  const stats = def ? def.stats : { speed: 1, power: 1, hp: 100 };
  $('stat-spd').style.width = `${Math.round(((stats.speed - 0.8) / 0.45) * 100)}%`;
  $('stat-pwr').style.width = `${Math.round(((stats.power - 0.8) / 0.5) * 100)}%`;
  $('stat-hp').style.width = `${Math.round(((stats.hp - 88) / 26) * 100)}%`;
  const sp = def ? SPECIALS[def.special] : null;
  $('pv-sp-name').textContent = sp ? `${sp.icon} ${sp.name}` : '🎲 MYSTERY SPECIAL';
  $('pv-sp-desc').textContent = sp ? sp.desc : 'Fighter and special revealed at the bell.';
}

function onFight() {
  audio.sfx('fight');
  const p1Def = resolveDef(sel.p1);
  let p2Def, difficulty = sel.difficulty, isChallenge = false;

  if (sel.mode === 'versus') {
    p2Def = resolveDef(sel.p2);
  } else if (sel.ghost) {
    p2Def = sel.ghost.def;
    difficulty = sel.ghost.difficulty;
    isChallenge = !!sel.ghost.isChallenge;
    sel.ghost = null;
  } else {
    const pool = FIGHTERS.filter(f => f.id !== (p1Def.id === 'custom' ? null : p1Def.id));
    p2Def = pool[Math.floor(Math.random() * pool.length)];
  }

  const arena = sel.arena === 'random' ? randomArena() : getArena(sel.arena);
  Save.rememberSelection(sel.p1 === 'custom' ? 'custom' : (sel.p1 === 'random' ? null : sel.p1), sel.mode === 'solo' ? difficulty : null);
  A.startMatch({ mode: sel.mode, p1Def, p2Def, arena, difficulty, isChallenge });
}

// ---------------------------------------------------------------- profile

let draft = null;

function newDraft() {
  return Save.profile ? { ...Save.profile } : {
    name: '', company: '', photo: null, baseId: 'ava',
    c1: '#5865f2', c2: '#ffd23f', special: 'pitchdeck',
  };
}

export function renderProfile() {
  draft = newDraft();
  $('inp-name').value = draft.name || '';
  $('inp-company').value = draft.company || '';
  $('inp-c1').value = draft.c1 || '#5865f2';
  $('inp-c2').value = draft.c2 || '#ffd23f';

  const spSel = $('inp-special');
  spSel.innerHTML = '';
  for (const sp of Object.values(SPECIALS)) {
    const o = document.createElement('option');
    o.value = sp.id;
    o.textContent = `${sp.icon} ${sp.name}`;
    spSel.appendChild(o);
  }
  spSel.value = draft.special || 'pitchdeck';
  $('special-desc').textContent = SPECIALS[spSel.value].desc;

  renderStyleGrid();
  renderAvatarPreview();
  renderCareer();
}

function renderStyleGrid() {
  const grid = $('style-grid');
  grid.innerHTML = '';
  for (const f of FIGHTERS) {
    const tile = document.createElement('div');
    tile.className = 'f-tile' + (draft.baseId === f.id ? ' sel' : '');
    const c = document.createElement('canvas');
    c.width = c.height = 90;
    drawPortrait(c, { ...f, photo: draft.photo, c: { ...f.c, suit: draft.c1, accent: draft.c2 } });
    tile.appendChild(c);
    const n = document.createElement('div');
    n.className = 'f-name';
    n.textContent = f.name.split(' ')[0];
    tile.appendChild(n);
    tile.onclick = () => { audio.sfx('click'); draft.baseId = f.id; renderStyleGrid(); renderAvatarPreview(); };
    grid.appendChild(tile);
  }
}

function renderAvatarPreview() {
  drawPortrait($('avatarPreview'), buildCustomFighter(draft));
}

function renderCareer() {
  const s = Save.stats;
  const rows = [
    [s.wins, 'WINS'], [s.losses, 'LOSSES'], [s.kos, 'KOs'],
    [s.streak, 'STREAK'], [s.bestStreak, 'BEST STREAK'], [s.points, 'POINTS'],
  ];
  $('profile-stats').innerHTML =
    rows.map(([v, l]) => `<div class="rstat"><b>${v}</b><span>${l}</span></div>`).join('') +
    `<div class="rstat"><b style="font-size:13px">${rankFor(s.points)}</b><span>RANK</span></div>`;
}

// Photo → square 200px JPEG dataURL (small enough for localStorage).
function processPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const S = 200;
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const ctx = c.getContext('2d');
        const scale = Math.max(S / img.width, S / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function wireProfile() {
  $('inp-name').oninput = (e) => { draft.name = e.target.value; };
  $('inp-company').oninput = (e) => { draft.company = e.target.value; };
  $('inp-c1').oninput = (e) => { draft.c1 = e.target.value; renderStyleGrid(); renderAvatarPreview(); };
  $('inp-c2').oninput = (e) => { draft.c2 = e.target.value; renderStyleGrid(); renderAvatarPreview(); };
  $('inp-special').onchange = (e) => {
    draft.special = e.target.value;
    $('special-desc').textContent = SPECIALS[draft.special].desc;
  };
  $('photoInput').onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      draft.photo = await processPhoto(file);
      renderAvatarPreview();
      renderStyleGrid();
      toast('📷 Photo locked in — looking dangerous.');
      audio.sfx('select');
    } catch (err) {
      toast('Could not read that image — try another file.');
    }
    e.target.value = '';
  };
  $('btn-photo-clear').onclick = () => {
    draft.photo = null;
    renderAvatarPreview();
    renderStyleGrid();
    audio.sfx('back');
  };
  $('btn-save-profile').onclick = () => {
    if (!draft.name.trim()) { toast('Give your founder a name first!'); $('inp-name').focus(); return; }
    Save.saveProfile({ ...draft, name: draft.name.trim(), company: draft.company.trim() });
    updateTitleChip();
    audio.sfx('victory');
    toast('💾 Profile saved. The ladder awaits.');
  };
  $('btn-invite').onclick = () => openInvite();
  $('btn-reset').onclick = () => {
    openConfirm('RESET EVERYTHING?', 'Profile, record, points — all gone. This cannot be undone.', () => {
      Save.resetAll();
      location.reload();
    });
  };
}

// ---------------------------------------------------------------- leaderboard

export function renderLeaderboard() {
  const list = $('lb-list');
  list.innerHTML = '';
  const rows = Save.leaderboard();
  rows.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (r.you ? ' you' : '');
    const c = document.createElement('canvas');
    c.width = c.height = 80;
    const def = r.custom && Save.profile ? buildCustomFighter(Save.profile) : getFighter(r.fighter);
    drawPortrait(c, def);
    row.innerHTML = `<div class="lb-rank">${i + 1}</div>`;
    row.appendChild(c);
    row.insertAdjacentHTML('beforeend', `
      <div class="lb-main">
        <div class="lb-name">${r.name}${r.you ? ' ◂ YOU' : ''}</div>
        <div class="lb-co">${r.company} · ${rankFor(r.points)}</div>
      </div>
      <div class="lb-cell">${r.wins}-${r.losses}<span>W-L</span></div>
      <div class="lb-cell">${r.kos}<span>KO</span></div>
      <div class="lb-cell">${r.streak}<span>STRK</span></div>
      <div class="lb-pts">${r.points}</div>`);
    list.appendChild(row);
  });
}

// ---------------------------------------------------------------- challenges

function tierFor(points) {
  return points >= 1500 ? 'mogul' : points >= 500 ? 'founder' : 'intern';
}

export function renderChallenges() {
  const list = $('rival-list');
  list.innerHTML = '';
  for (const r of Save.leaderboard().filter(r => !r.you)) {
    const row = document.createElement('div');
    row.className = 'rival';
    const c = document.createElement('canvas');
    c.width = c.height = 80;
    drawPortrait(c, getFighter(r.fighter));
    row.appendChild(c);
    row.insertAdjacentHTML('beforeend', `
      <div class="rival-info">
        <div class="rival-name">${r.name}</div>
        <div class="rival-sub">${r.company} · ${tierFor(r.points).toUpperCase()} AI</div>
      </div>
      <div class="rival-pts">${r.points}<span>PTS</span></div>`);
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-primary';
    btn.textContent = 'FIGHT';
    btn.onclick = () => {
      audio.sfx('select');
      const base = getFighter(r.fighter);
      sel.ghost = {
        def: { ...base, name: r.name, company: r.company, title: 'RIVAL' },
        difficulty: tierFor(r.points),
        isChallenge: false,
      };
      openSelect('solo');
    };
    row.appendChild(btn);
    list.appendChild(row);
  }
}

// ---------------------------------------------------------------- help

export function renderHelp() {
  const keys = (rows) => rows.map(([label, k]) =>
    `<div class="keyrow"><span class="klabel">${label}</span>${
      k.split(' / ').map(x => `<span class="kbd">${x}</span>`).join('')
    }</div>`).join('');
  $('keys-solo').innerHTML = keys(KEY_LABELS.solo);
  $('keys-p1').innerHTML = '<h4>PLAYER 1</h4>' + keys(KEY_LABELS.p1);
  $('keys-p2').innerHTML = '<h4>PLAYER 2</h4>' + keys(KEY_LABELS.p2);

  const list = $('ability-list');
  list.innerHTML = '';
  for (const f of FIGHTERS) {
    const sp = SPECIALS[f.special];
    const row = document.createElement('div');
    row.className = 'ability';
    const c = document.createElement('canvas');
    c.width = c.height = 80;
    drawPortrait(c, f);
    row.appendChild(c);
    row.insertAdjacentHTML('beforeend', `
      <div>
        <div class="ab-name">${sp.icon} ${sp.name}</div>
        <div class="ab-owner">${f.name} · ${f.company}</div>
        <div class="ab-desc">${sp.desc}</div>
      </div>`);
    list.appendChild(row);
  }
  const uni = document.createElement('div');
  uni.className = 'ability';
  uni.innerHTML = `
    <div style="font-size:34px;width:44px;text-align:center">🦄</div>
    <div>
      <div class="ab-name">${UNICORN_META.name} — EVERYONE</div>
      <div class="ab-owner">FULL METER SUPER</div>
      <div class="ab-desc">${UNICORN_META.desc}</div>
    </div>`;
  list.appendChild(uni);
}

// ---------------------------------------------------------------- modals

export function openModal(id) {
  $('modal-root').classList.remove('hidden');
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

export function closeModals() {
  $('modal-root').classList.add('hidden');
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

export function isModalOpen(id) {
  return !$(id).classList.contains('hidden') && !$('modal-root').classList.contains('hidden');
}

let confirmCb = null;
function openConfirm(title, text, cb) {
  $('confirmTitle').textContent = title;
  $('confirmText').textContent = text;
  confirmCb = cb;
  openModal('modal-confirm');
}

export function openInvite() {
  const link = buildChallengeLink();
  $('inviteLink').value = link;
  $('btn-nativeshare').style.display = navigator.share ? '' : 'none';
  openModal('modal-invite');
  audio.sfx('select');
}

export function showIncomingChallenge(ghostDef, ch, onAccept) {
  drawPortrait($('incomingFace'), ghostDef);
  $('incomingText').innerHTML =
    `<b>${ghostDef.name}</b> of <b>${ghostDef.company}</b> (${ch.pts} pts · ${rankFor(ch.pts)}) ` +
    `has called you out.<br>Settle it in the arena.`;
  $('btn-accept').onclick = () => { audio.sfx('fight'); closeModals(); onAccept(); };
  openModal('modal-incoming');
}

export function showShareCard(cardData) {
  renderResultCard($('shareCanvas'), cardData);
  openModal('modal-card');
  audio.sfx('select');
}

async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    if (input) {
      input.focus(); input.select();
      try { return document.execCommand('copy'); } catch (e2) { return false; }
    }
    return false;
  }
}

// ---------------------------------------------------------------- sound

export function syncSoundUI() {
  const s = Save.settings;
  const muted = !s.sfx && !s.music;
  $('btn-sound').textContent = muted ? '🔇' : '🔊';
  $('setVol').value = s.volume;
  $('pauseVol').value = s.volume;
  $('setMusic').textContent = `MUSIC: ${s.music ? 'ON' : 'OFF'}`;
  $('pauseMusic').textContent = `MUSIC: ${s.music ? 'ON' : 'OFF'}`;
  $('setSfx').textContent = `SFX: ${s.sfx ? 'ON' : 'OFF'}`;
  $('pauseSfx').textContent = `SFX: ${s.sfx ? 'ON' : 'OFF'}`;
  audio.applySettings();
}

function wireSound() {
  const setVol = (v) => { Save.setSetting('volume', +v); syncSoundUI(); };
  $('setVol').oninput = (e) => setVol(e.target.value);
  $('pauseVol').oninput = (e) => setVol(e.target.value);
  const flip = (key) => { Save.setSetting(key, !Save.settings[key]); syncSoundUI(); audio.sfx('click'); };
  $('setMusic').onclick = () => flip('music');
  $('pauseMusic').onclick = () => flip('music');
  $('setSfx').onclick = () => flip('sfx');
  $('pauseSfx').onclick = () => flip('sfx');
  $('btn-sound').onclick = () => {
    const anyOn = Save.settings.sfx || Save.settings.music;
    Save.setSetting('sfx', !anyOn);
    Save.setSetting('music', !anyOn);
    syncSoundUI();
    audio.sfx('click');
  };
  $('btn-settings').onclick = () => { audio.sfx('click'); openModal('modal-settings'); };
}

// ---------------------------------------------------------------- misc

let toastTimer = null;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2400);
}

export function updateTitleChip() {
  const p = Save.profile;
  const chip = $('title-profile-chip');
  if (p) {
    chip.classList.remove('hidden');
    $('chipName').textContent = p.name || 'FOUNDER';
    $('chipRank').textContent = `${Save.stats.points} PTS · ${rankFor(Save.stats.points)}`;
    drawPortrait($('chipFace'), buildCustomFighter(p));
    $('btn-profile').textContent = '👤 MY PROFILE';
  } else {
    chip.classList.add('hidden');
    $('btn-profile').textContent = '👤 CREATE PROFILE';
  }
}

// ---------------------------------------------------------------- init

export function initScreens(actions) {
  A = actions;

  // title nav
  $('btn-quick').onclick = () => { audio.sfx('fight'); A.quickFight(); };
  $('btn-arcade').onclick = () => { audio.sfx('select'); sel.ghost = null; openSelect('solo'); };
  $('btn-2p').onclick = () => { audio.sfx('select'); sel.ghost = null; openSelect('versus'); };
  $('btn-challenges').onclick = () => { audio.sfx('select'); renderChallenges(); A.showScreen('scr-challenge'); };
  $('btn-leaderboard').onclick = () => { audio.sfx('select'); renderLeaderboard(); A.showScreen('scr-leaderboard'); };
  $('btn-profile').onclick = () => { audio.sfx('select'); renderProfile(); A.showScreen('scr-profile'); };
  $('btn-help').onclick = () => { audio.sfx('select'); renderHelp(); A.showScreen('scr-help'); };
  $('title-profile-chip').onclick = () => { audio.sfx('select'); renderProfile(); A.showScreen('scr-profile'); };

  // back buttons
  document.querySelectorAll('[data-back]').forEach(b => {
    b.onclick = () => { audio.sfx('back'); sel.ghost = null; A.showScreen('scr-title'); };
  });

  // select
  $('btn-fight').onclick = onFight;

  // challenge invite
  $('btn-ch-invite').onclick = () => openInvite();

  // profile
  wireProfile();

  // sound + settings
  wireSound();
  syncSoundUI();

  // modal chrome
  document.querySelectorAll('[data-close]').forEach(b => {
    b.onclick = () => { audio.sfx('back'); closeModals(); A.onModalClosed?.(); };
  });
  document.querySelector('.modal-backdrop').onclick = () => {
    if (isModalOpen('modal-pause')) return;     // pause requires explicit resume
    closeModals();
    A.onModalClosed?.();
  };
  $('btn-confirm-yes').onclick = () => { const cb = confirmCb; confirmCb = null; closeModals(); cb?.(); };

  // invite modal
  $('btn-copylink').onclick = async () => {
    const ok = await copyText($('inviteLink').value, $('inviteLink'));
    toast(ok ? '🔗 Link copied — go start a rivalry.' : 'Link selected — press Ctrl/Cmd+C to copy.');
    audio.sfx('click');
  };
  $('btn-nativeshare').onclick = () => {
    navigator.share?.({
      title: 'UEC — Ultimate Entrepreneur Challenge',
      text: 'I challenge you to a founder fight. Winner takes the valuation. 🥊',
      url: $('inviteLink').value,
    }).catch(() => {});
  };

  updateTitleChip();
}
