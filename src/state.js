// Persistent app state: profile, career stats, settings, tutorial flags.
// localStorage-backed with an in-memory fallback (private browsing, etc).

import { SAVE_KEY, POINTS, AI_LEVELS, rankFor } from './config.js';
import { SEED_PLAYERS } from './data/seed.js';
import { currentUser } from './auth.js';

const DEFAULTS = () => ({
  profile: null,           // { name, company, photo, baseId, c1, c2, special }
  stats: { wins: 0, losses: 0, kos: 0, streak: 0, bestStreak: 0, points: 0, matches: 0 },
  settings: { volume: 80, music: true, sfx: true },
  tutorialSeen: false,
  lastFighter: 'ava',
  lastDifficulty: 'founder',
});

let mem = null;

function read() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return { ...DEFAULTS(), ...JSON.parse(raw) };
  } catch (e) { /* storage unavailable */ }
  return mem ? { ...mem } : DEFAULTS();
}

export const Save = {
  data: read(),

  persist() {
    mem = { ...this.data };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* ok */ }
  },

  get profile() { return this.data.profile; },
  get stats() { return this.data.stats; },
  get settings() { return this.data.settings; },

  saveProfile(p) {
    this.data.profile = p;
    this.persist();
  },

  setSetting(key, val) {
    this.data.settings[key] = val;
    this.persist();
  },

  markTutorialSeen() {
    this.data.tutorialSeen = true;
    this.persist();
  },

  rememberSelection(fighterId, difficulty) {
    if (fighterId) this.data.lastFighter = fighterId;
    if (difficulty) this.data.lastDifficulty = difficulty;
    this.persist();
  },

  // Records a ranked match result. Returns a summary for the results screen.
  recordMatch({ won, koRounds, difficulty, isChallenge }) {
    const s = this.data.stats;
    const prevRank = rankFor(s.points);
    s.matches += 1;
    s.kos += koRounds;                       // KO rounds count even in losing efforts
    let gained = 0;
    if (won) {
      const mult = isChallenge ? POINTS.CHALLENGE_MULT : (AI_LEVELS[difficulty]?.mult ?? 1);
      s.wins += 1;
      s.streak += 1;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
      gained = Math.round(POINTS.WIN_BASE * mult)
        + koRounds * POINTS.KO_BONUS
        + Math.min(POINTS.STREAK_CAP, s.streak * POINTS.STREAK_BONUS);
    } else {
      s.losses += 1;
      s.streak = 0;
      gained = POINTS.LOSS;
    }
    s.points += gained;
    this.persist();
    const rank = rankFor(s.points);
    return { gained, total: s.points, rank, streak: s.streak, rankUp: rank !== prevRank && won };
  },

  resetAll() {
    this.data = DEFAULTS();
    mem = null;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ok */ }
  },

  // Seeds + local player merged, sorted by points.
  leaderboard() {
    const rows = SEED_PLAYERS.map(p => ({ ...p, you: false }));
    if (this.data.profile) {
      const s = this.data.stats;
      rows.push({
        id: 'you',
        fighter: this.data.profile.baseId || 'ava',
        name: (this.data.profile.name || 'YOU').toUpperCase(),
        company: (this.data.profile.company || 'STEALTH STARTUP').toUpperCase(),
        photo: this.data.profile.photo || null,
        custom: true,
        wins: s.wins, losses: s.losses, kos: s.kos, streak: s.streak, points: s.points,
        you: true,
      });
    }
    return rows.sort((a, b) => b.points - a.points);
  },
};

// ---------------- Challenge links ----------------

function b64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  const b = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (b.length % 4)) % 4);
  return decodeURIComponent(escape(atob(b + pad)));
}

export function buildChallengeLink() {
  const p = Save.profile;
  const payload = {
    v: 1,
    n: p?.name || 'A mystery founder',
    co: p?.company || 'Stealth Startup',
    f: p?.baseId || Save.data.lastFighter || 'b-neo',
    sp: p?.special || null,
    pts: Save.stats.points || 0,
    u: currentUser()?.id || undefined,   // lets the recipient fetch the real photo/colors
  };
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('c', b64urlEncode(JSON.stringify(payload)));
  return url.toString();
}

export function parseChallengeFromURL() {
  try {
    const c = new URLSearchParams(location.search).get('c');
    if (!c) return null;
    const data = JSON.parse(b64urlDecode(c));
    if (!data || data.v !== 1) return null;
    return {
      n: String(data.n || 'Rival').slice(0, 24),
      co: String(data.co || 'Rival Ventures').slice(0, 28),
      f: String(data.f || 'b-neo'),
      sp: data.sp ? String(data.sp) : null,
      pts: Math.max(0, Math.min(999999, Number(data.pts) || 0)),
      u: typeof data.u === 'string' && /^[0-9a-fA-F-]{10,40}$/.test(data.u) ? data.u : null,
    };
  } catch (e) {
    return null;
  }
}
