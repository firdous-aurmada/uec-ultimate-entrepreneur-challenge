// ---------------------------------------------------------------------------
// LIVE MULTIPLAYER — Supabase Realtime rooms + delay-based lockstep.
//
// Transport: an ephemeral Realtime *broadcast* channel per room (no tables, no
// rows — nothing is stored). Presence announces who's in the room (that's how
// the inviter is notified the moment a rival joins). Both clients then run the
// same deterministic simulation at a fixed 60 Hz step and exchange only input
// bitmasks, delayed by INPUT_DELAY frames to hide network latency. A periodic
// state hash catches desyncs.
//
// The supabase-js client is loaded on demand from a CDN — offline/solo play
// never touches the network.
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://orgjgkatnxvkaleopaja.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iOm_lizIzw3kYsa1VSJn_A_ZzO6ihGG';

export const STEP = 1 / 60;          // fixed simulation timestep
export const INPUT_DELAY = 10;       // frames of input delay (~166 ms) — absorbs send pacing + latency
const SEND_MS = 60;                  // min wall-clock ms between input packets (~15/s, well under rate limits)
const WINDOW_MAX = 60;               // max frames carried per packet
const SYNC_EVERY = 120;              // frames between state-hash checks

const BITS = ['left', 'right', 'up', 'block', 'punch', 'kick', 'special', 'super'];

export function padToMask(pad) {
  let m = 0;
  for (let i = 0; i < BITS.length; i++) if (pad[BITS[i]]) m |= 1 << i;
  return m;
}

export function maskToPad(m) {
  const p = {};
  for (let i = 0; i < BITS.length; i++) p[BITS[i]] = !!(m & (1 << i));
  return p;
}

// Controller fed by the lockstep driver (implements the standard contract).
export class MaskController {
  constructor() { this.mask = 0; this.isHuman = false; }
  update(fighter) { fighter.pad = maskToPad(this.mask); }
}

// Cheap deterministic state fingerprint for desync detection.
export function hashGameState(game) {
  const f = game.fighters;
  const q = (v) => Math.round(v * 8);
  let h = 0;
  const mix = (v) => { h = ((h * 31) + (v | 0) + 7) & 0x7fffffff; };
  for (const x of [
    q(f[0].x), q(f[0].y), q(f[0].hp), q(f[0].energy),
    q(f[1].x), q(f[1].y), q(f[1].hp), q(f[1].energy),
    q(game.timer), game.roundWins[0], game.roundWins[1], game.projectiles.length,
  ]) mix(x);
  return h;
}

let sbPromise = null;
function loadClient() {
  if (!sbPromise) {
    sbPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false },
        realtime: { params: { eventsPerSecond: 25 } },
      }));
  }
  return sbPromise;
}

export function makeRoomId() {
  const raw = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Date.now().toString(36));
  return raw.slice(0, 10);
}

export class NetSession {
  /**
   * role: 'host' | 'guest' — host is fighter[0] and picks the arena.
   * me:   { n, co, pts } — display identity.
   * ev:   { onPeerJoin, onPeerLeave, onPeerPick, onStart, onQuit,
   *         onRematchWanted, onDesync }
   */
  constructor({ role, roomId, me, ev }) {
    this.role = role;
    this.roomId = roomId;
    this.me = me;
    this.ev = ev;
    this.channel = null;
    this.peer = null;
    this.myPick = null;
    this.peerPick = null;
    this.closed = false;

    // lockstep buffers
    this.localQ = new Map();
    this.remoteQ = new Map();
    this.frame = 0;          // next frame to simulate
    this.queued = 0;         // local frames queued so far
    this.lastRemoteAt = 0;
    this.lastSentEnd = INPUT_DELAY;
    this.lastSendAt = 0;
    this.peerFrame = 0;
    this.hashes = new Map(); // frame -> local hash (for desync checks)
    this.stats = { sent: 0, recv: 0, failed: 0, lastFail: null };
  }

  async connect() {
    const sb = await loadClient();
    this.channel = sb.channel('uec-room-' + this.roomId, {
      config: { broadcast: { self: false, ack: false }, presence: { key: this.role } },
    });
    this.channel
      .on('presence', { event: 'sync' }, () => this.handlePresence())
      .on('broadcast', { event: 'pick' }, ({ payload }) => {
        this.peerPick = payload;
        this.ev.onPeerPick?.(payload);
      })
      .on('broadcast', { event: 'start' }, ({ payload }) => this.ev.onStart?.(payload))
      .on('broadcast', { event: 'input' }, ({ payload }) => this.onInput(payload))
      .on('broadcast', { event: 'sync' }, ({ payload }) => this.onSync(payload))
      .on('broadcast', { event: 'quit' }, ({ payload }) => this.ev.onQuit?.(payload))
      .on('broadcast', { event: 'rematch' }, () => this.ev.onRematchWanted?.());

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 12000);
      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          await this.channel.track({ ...this.me, role: this.role });
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timeout);
          reject(new Error(status));
        }
      });
    });
  }

  handlePresence() {
    if (this.closed) return;
    const state = this.channel.presenceState();
    const other = this.role === 'host' ? 'guest' : 'host';
    const meta = state[other] && state[other][0];
    if (meta && !this.peer) {
      this.peer = meta;
      this.ev.onPeerJoin?.(meta);
    } else if (!meta && this.peer) {
      this.peer = null;
      this.ev.onPeerLeave?.();
    }
  }

  send(event, payload) {
    if (this.channel && !this.closed) {
      const p = this.channel.send({ type: 'broadcast', event, payload });
      if (p && p.then) p.then((res) => {
        if (res !== 'ok') { this.stats.failed++; this.stats.lastFail = `${event}:${res}`; }
      }).catch(() => { this.stats.failed++; });
    }
  }

  sendPick(spec) { this.myPick = spec; this.send('pick', spec); }
  sendStart(cfg) { this.send('start', cfg); }
  sendQuit(reason = 'left') { this.send('quit', { reason }); }
  sendRematch() { this.send('rematch', {}); }

  // ---------------- lockstep ----------------

  resetMatch() {
    this.localQ.clear();
    this.remoteQ.clear();
    this.hashes.clear();
    this.frame = 0;
    this.queued = 0;
    this.lastSentEnd = INPUT_DELAY;
    this.peerFrame = 0;
    for (let i = 0; i < INPUT_DELAY; i++) {
      this.localQ.set(i, 0);
      this.remoteQ.set(i, 0);
    }
    this.lastRemoteAt = performance.now();
    this.lastSendAt = 0;
  }

  queueLocal(mask) {
    this.localQ.set(INPUT_DELAY + this.queued, mask);
    this.queued++;
    this.sendWindow();
  }

  // Input packets are wall-clock paced (never floods the realtime rate limit)
  // and contiguous by construction — the window starts where the last one
  // ended (small overlap), and the cap trims its END, never its start.
  // Loss healing: keepalive packets (force=true, sent while stalled) re-anchor
  // at the frame the peer last reported, re-covering anything they missed.
  sendWindow(force = false) {
    const end = INPUT_DELAY + this.queued;           // exclusive
    if (end <= INPUT_DELAY) return;
    const now = performance.now();
    if (!force && now - this.lastSendAt < SEND_MS) return;
    let start = this.lastSentEnd - 2;
    if (force) start = Math.min(start, this.peerFrame);
    start = Math.max(INPUT_DELAY, start);
    if (start >= end) return;
    const sendEnd = Math.min(end, start + WINDOW_MAX);
    const m = [];
    for (let f = start; f < sendEnd; f++) m.push(this.localQ.get(f) ?? 0);
    this.send('input', { f: start, m, a: this.frame });
    this.stats.sent++;
    this.lastSentEnd = Math.max(this.lastSentEnd, sendEnd);
    this.lastSendAt = now;
  }

  flush() { this.sendWindow(); }

  // Stall recovery on its own clock (regular paced sends must never starve it):
  // re-anchors at the peer's last reported frame, re-covering whatever they lost.
  heal() {
    const now = performance.now();
    if (now - (this.lastHealAt || 0) < 300) return;
    this.lastHealAt = now;
    this.sendWindow(true);
  }

  get msSinceSend() { return performance.now() - this.lastSendAt; }

  onInput({ f, m, a }) {
    for (let i = 0; i < m.length; i++) this.remoteQ.set(f + i, m[i]);
    if (typeof a === 'number') this.peerFrame = Math.max(this.peerFrame, a);
    this.stats.recv++;
    this.lastRemoteAt = performance.now();
  }

  canStep() { return this.localQ.has(this.frame) && this.remoteQ.has(this.frame); }

  padsFor() { return [this.localQ.get(this.frame), this.remoteQ.get(this.frame)]; }

  advance() {
    this.localQ.delete(this.frame - 180);
    this.remoteQ.delete(this.frame - 180);
    this.frame++;
  }

  get stalledMs() { return performance.now() - this.lastRemoteAt; }

  // ---------------- desync detection ----------------

  recordHash(game) {
    if (this.frame % SYNC_EVERY !== 0 || this.frame === 0) return;
    const h = hashGameState(game);
    this.hashes.set(this.frame, h);
    this.send('sync', { f: this.frame, h });
    for (const k of this.hashes.keys()) if (k < this.frame - 1200) this.hashes.delete(k);
  }

  onSync({ f, h }) {
    const mine = this.hashes.get(f);
    if (mine !== undefined && mine !== h) this.ev.onDesync?.(f);
  }

  async close() {
    this.closed = true;
    try { await this.channel?.unsubscribe(); } catch (e) { /* already gone */ }
    this.channel = null;
  }
}
