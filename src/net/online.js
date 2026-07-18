// ---------------------------------------------------------------------------
// ONLINE MULTIPLAYER — ARCHITECTURE STUB (v1 ships local + AI + link ghosts)
// ---------------------------------------------------------------------------
// The engine was built so a networked opponent is *just another controller*:
//
//   Controller contract (see engine/input.js):
//     update(fighter, game) -> writes fighter.pad {left,right,up,block,punch,kick,special,super}
//
// HumanController reads the local keyboard/touch pads. AIController synthesizes
// pads. OnlineController below replays pads received from a transport. Because
// the whole simulation is deterministic given per-frame pads (fixed physics,
// seeded arena visuals, no Math.random in the *simulation* path except AI —
// which runs on the host only), two peers stay in sync via input exchange.
//
// Planned rollout (post-v1):
//   1. Transport: WebRTC DataChannel with a tiny WebSocket signaling server
//      (or a hosted service). Challenge links already carry fighter/company
//      payloads — the same link becomes the room invite.
//   2. Sync model: delay-based lockstep first (simple, fine at <80 ms), then
//      GGPO-style rollback (Fighter/Game state is already snapshottable: it is
//      plain numbers + strings, no DOM references in the sim).
//   3. Server-authoritative leaderboard: POST match results, signed session.
// ---------------------------------------------------------------------------

/** Transport interface expected by OnlineController. */
export class MatchTransport {
  /** send(frame:number, pad:object) — deliver local inputs to the peer */
  send() { throw new Error('MatchTransport is an interface — implement send()'); }
  /** onReceive(cb(frame, pad)) — register remote input handler */
  onReceive() { throw new Error('implement onReceive()'); }
  close() {}
}

/** Drop-in Controller that replays remote pads (delay-based lockstep). */
export class OnlineController {
  constructor(transport, inputDelay = 3) {
    this.transport = transport;
    this.delay = inputDelay;
    this.buffer = new Map();          // frame -> pad
    this.frame = 0;
    this.lastPad = null;
    transport.onReceive((frame, pad) => this.buffer.set(frame, pad));
    this.isHuman = false;
  }

  update(fighter) {
    const pad = this.buffer.get(this.frame - this.delay);
    if (pad) { this.lastPad = pad; this.buffer.delete(this.frame - this.delay); }
    // Hold last known pad if a packet is late (lockstep would instead stall).
    fighter.pad = this.lastPad ? { ...this.lastPad } : fighter.pad;
    this.frame++;
  }
}
