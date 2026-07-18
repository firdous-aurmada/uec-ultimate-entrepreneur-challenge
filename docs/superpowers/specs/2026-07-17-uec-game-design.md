# UEC: Ultimate Entrepreneur Challenge — Design

**Date:** 2026-07-17 · **Status:** Approved by spec (user request was a complete specification; this doc records the concrete decisions made within it).

## What it is

A launch-ready browser fighting game. Founders and CEOs battle 1-v-1 in side-view, best-of-three arcade fights inspired by 1990s fighters, with an original modern identity (no Mortal Kombat assets, names, or characters). Playable as a guest within seconds; optional founder profiles, photo avatars, challenge links, leaderboard.

## Stack decision

**Vanilla ES modules + HTML5 Canvas + Web Audio. Zero dependencies, no build step.**

- Rationale: instant load (< 100 KB), trivially deployable anywhere as static files, fully owned original assets (all art and sound are procedural — drawn/synthesized in code), clean module boundaries for maintainability.
- Alternatives considered: React/Vite (adds build complexity with no benefit to a canvas game), Phaser (heavyweight dependency, less control over feel). Rejected.
- Persistence: `localStorage` (guest-friendly, no account required). Online multiplayer ships later behind a documented `Controller`/transport interface (see `src/net/online.js`).

## Core fight

- Fixed 960×540 logical stage, DPR-aware canvas, letterboxed responsive scaling. Left vs right fighters, auto-facing.
- Physics: walk 250 px/s (× fighter speed), jump −760 px/s, gravity 2100 px/s², stage-clamped, body push-apart.
- Controls (solo accepts both schemes; 2P splits them):
  - P1: A/D move, W jump, S block (hold), C punch, V kick, B special, G Unicorn
  - P2: ←/→ move, ↑ jump, ↓ block (hold), J punch, K kick, L special, U Unicorn
  - Esc/P pause. Mobile: multi-touch on-screen pads (◀ ▶ ▲ 🛡 | 👊 🦶 ⚡ 🦄).
- Combat: punch (fast/7 dmg), kick (slow/12 dmg), block reduces to 15% chip, hitstun + knockback + combo counter, corner clamp.
- Meter: gain on dealing (+12) and taking (+8) damage. Special = 50 energy. **Unicorn Mode** = 100 (6 s buff: +35% damage, +25% speed, no chip taken, rainbow aura + horn).
- Rounds: best-of-3 (first to 2), 60 s timer, KO or time-out (higher HP wins; exact tie replays the round). K.O. gets hitstop + slow-mo.
- Feel: hitstop, screen shake, hitsparks, comic-book word popups (POW!/BAM!), speed lines, dust, announcer cards (ROUND 1 / FIGHT! / K.O.!), procedural SFX + generative synthwave music per arena, volume/music/SFX controls.

## Roster (fictional) — signature specials

| Fighter | Company | Special | Behavior |
|---|---|---|---|
| Ava Sterling "The Visionary" | Nimbus Labs | **Pitch Deck Strike** | 3 slide projectiles |
| Max Vega "The Burner" | Rocketly | **Burn Rate Blast** | point-blank inferno, big damage/knockback |
| Kai Nakamura "The Pivot" | Loopwise | **Pivot Punch** | teleport behind opponent + strike |
| Zara Okafor "The Growth Hacker" | Hypervine | **Growth Hack** | viral multi-hit rush |
| Eleanor Voss "The Shark" | Apex Capital | **Funding Round** | gold rains on opponent; refunds energy on hit |
| Dex Kruger "The Raider" | OmniCorp Holdings | **Hostile Takeover** | unblockable command grab; jump to escape |

All fighters share **Growth Hack**-style stat variation (speed/power/HP) and the universal **Unicorn Mode** super. Custom profile fighters pick a base style, colors, any special, and use the uploaded photo as the fighter's face (circle-framed head).

## Arenas (6, animated, procedural)

The Boardroom · Demo Day · The Startup Garage · The Stock Exchange · The Unicorn Club · The VC Summit. Each has animated elements (tickers, spotlights, crowd, sparkles) and data-driven billboard slots (future sponsorship hook).

## App structure & flow

Screens (DOM overlays over canvas): Title → Fighter Select (fighter + arena + AI difficulty) → VS splash → Fight (canvas + HUD + touch pads) → Results (stats, points, rematch/change fighter/menu/share card) · Profile · Challenge-a-Founder · Leaderboard · How to Play. Modals: pause, settings, invite link, incoming challenge, share card. First-fight onboarding: 3-card overlay + in-match one-time hints.

- **Modes:** Guest quick fight (vs AI), ranked vs AI (Intern/Founder/Mogul), local 2P (same keyboard, unranked), challenge-ghost fights (AI plays the challenger's fighter, ranked).
- **Points:** win = 20 × difficulty mult (1 / 1.5 / 2.5; challenges 2.0) + 5 per KO round + streak bonus (3 × streak, cap 15); loss = +3. Rank titles from Garage Dreamer → Decacorn.
- **Leaderboard:** 10 seeded fictional founders + local player, sorted by points, player highlighted.
- **Challenge links:** `?c=<base64url JSON>` (name, company, fighter, points) — serverless friend invites; opening one shows an accept modal → fight their AI ghost.
- **Share:** post-match 1200×630 result card rendered to PNG (download + Web Share API).

## Module map

`index.html` + `styles.css` · `src/config.js` (all tuning) · `src/state.js` (save/stats/leaderboard) · `src/data/{fighters,arenas,seed}.js` · `src/engine/{game,fighter,ai,input,fx,render,drawFighter,audio}.js` · `src/ui/{hud,screens,resultCard,tutorial}.js` · `src/net/online.js` (future-multiplayer interface stub) · `src/main.js` (boot/router/loop).

## Testing

Per the user's explicit E2E checklist: drive the real UI in a browser (guest match, profile + photo upload, every control and all 7 specials, full rounds, win/lose/timeout, stats, leaderboard, invite link, rematch, mobile layout, sound toggles), fix all findings before delivery. Debug hooks (`?debug=1` → `window.UEC`) exist to make KO/timeout paths reachable deterministically in tests.

## Deliberate scope cuts (v1)

No accounts/server (localStorage), online multiplayer interface-only, no crouch attacks/dashes (keeps controls learnable), static seeded leaderboard records, photo not embedded in challenge links (URL size).
