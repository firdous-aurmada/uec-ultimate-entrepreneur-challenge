# UEC — Ultimate Entrepreneur Challenge 🥊

![UEC — Ultimate Entrepreneur Challenge](og-image.jpg)

**Founders fight. Valuations fall.** A launch-ready browser arcade fighter where entrepreneurs battle 1-v-1 with Pitch Deck Strikes, Hostile Takeovers and full-meter **UNICORN MODE** — inspired by the pacing of 1990s arcade fighters, built with a fully original cast, art, and sound.

Playable in seconds: no account, no install, no build step. **100% vanilla JavaScript + Canvas + Web Audio — zero dependencies, zero asset files.** Every sprite is drawn and every sound is synthesized in code, so there is nothing to license and nothing to download.

---

## Quick start

Any static file server works. From this folder:

```bash
# option A (nothing to install)
python3 -m http.server 4173

# option B (dev server with no-cache headers — best while editing)
python3 dev-server.py 4173

# option C (Node)
npx serve -l 4173 .
```

Open **http://localhost:4173** → hit **⚡ QUICK FIGHT**. You're in a match in ~5 seconds.

> ES modules require http(s) — opening `index.html` via `file://` won't work.

## Deploy (any static host)

The whole game is static files. Drop the folder on any of:

- **Vercel** — `npx vercel deploy` (or import the folder in the dashboard; no build command, output dir = `.`)
- **Netlify** — drag-and-drop the folder into the dashboard
- **GitHub Pages** — push and enable Pages
- **Cloudflare Pages** — direct upload

No environment variables, no server, no database.

---

## How to play

Win **2 of 3 rounds** (60 s each): empty your rival's health bar or lead when the bell rings. Landing and taking hits charges your **energy meter** — spend 50 on your Special, or bank a full 100 for **UNICORN MODE** (6 s: +35 % damage, +25 % speed, no chip damage, extremely fabulous).

**Block** cuts damage to 15 % chip (chip can never KO). **Hostile Takeover can't be blocked — jump it.**

| Action | Solo | 2P — left player | 2P — right player | Touch |
|---|---|---|---|---|
| Move | ← → or A D | A D | ← → | ◀ ▶ |
| Jump | ↑ or W | W | ↑ | ▲ |
| Block (hold) | ↓ or S | S | ↓ | 🛡 |
| Punch | J or C | C | J | 👊 |
| Kick | K or V | V | K | 🦶 |
| Special | L or B | B | L | ⚡ |
| Unicorn Mode | U or G | G | U | 🦄 |
| Pause | Esc / P | | | ⏸ |

Touch pads appear automatically on phones/tablets (or force them with `?touch=1`).

## The roster (all fictional)

| Fighter | Company | Signature special |
|---|---|---|
| **Ava Sterling** · The Visionary | Nimbus Labs | 📊 **Pitch Deck Strike** — volley of 3 slide projectiles |
| **Max Vega** · The Burner | Rocketly | 🔥 **Burn Rate Blast** — point-blank inferno, huge damage |
| **Kai Nakamura** · The Pivot | Loopwise | 🔄 **Pivot Punch** — teleports behind you, fist first |
| **Zara Okafor** · The Growth Hacker | Hypervine | 📈 **Growth Hack** — viral rush that locks in a 4-hit flurry |
| **Eleanor Voss** · The Shark | Apex Capital | 💰 **Funding Round** — gold rains down and refunds her energy |
| **Dex Kruger** · The Raider | OmniCorp Holdings | 🦈 **Hostile Takeover** — unblockable command grab |

| Unicorn Mode in The Unicorn Club | Pitch Deck Strike on The Stock Exchange |
|---|---|
| ![Unicorn Mode brawl](shots/unicorn-brawl.jpg) | ![Pitch Deck Strike volley](shots/pitch-deck.jpg) |

Everyone shares 🦄 **Unicorn Mode** at full meter. Fighters have distinct speed/power/HP stats and AI personalities (aggression, jumpiness, preferred range) across three difficulties: **Intern / Founder / Mogul**.

**Arenas (6, all animated):** The Boardroom · Demo Day · The Startup Garage · The Stock Exchange · The Unicorn Club · The VC Summit — with live tickers, sweeping spotlights, bouncing crowds, disco floors, and data-driven billboard slots (see *Sponsorships* below).

## Feature checklist

- ⚡ **Guest play** — no signup; first fight includes a 3-card tutorial + in-match hints
- 👤 **Founder profiles** — name, company, **photo upload → becomes your fighter's face**, base style, custom suit/accent colors, choice of any signature special
- 🤖 **Vs AI** (3 difficulties) · 👥 **local 2-player** (one keyboard) · 🔗 **challenge-a-friend links** (serverless: the link carries your fighter; friends battle your AI ghost)
- ⚔️ **Challenges screen** — call out any of 10 seeded rival founders at their skill tier
- 🏆 **Leaderboard** — seeded season + you, with W-L, KOs, streaks and rank titles (Garage Dreamer → Decacorn)
- 📈 **Ranked points** — win = 20 × difficulty (×1/×1.5/×2.5, challenges ×2) + 5/KO round + streak bonus; a loss still pays +3
- 📸 **Shareable result cards** — 1200×630 PNG (download or native share)
- 🔊 **Sound controls** — master volume, music & SFX toggles, one-tap mute; all audio synthesized live
- 📱 **Mobile-ready** — responsive layouts + multi-touch pads; auto-pause when the tab hides
- 🔁 **Rematch / change fighter / restart** flows everywhere you'd expect

## Project layout

```
index.html            all screens & modals (DOM shell)
styles.css            visual system (arcade gold/pink/cyan on deep navy)
dev-server.py         no-cache static server for development
src/
  config.js           every gameplay number: physics, frame data, meter, points, ranks
  state.js            localStorage save: profile, stats, settings + challenge-link codec
  main.js             boot, screen router, match lifecycle, render loop, debug hooks
  data/fighters.js    roster definitions + specials metadata + custom/ghost builders
  data/arenas.js      six procedural animated arenas + sponsor billboard slots
  data/seed.js        seeded leaderboard entries
  engine/game.js      match controller: rounds, timer, hit resolution, KO cinematics
  engine/fighter.js   fighter entity: state machine, physics, attacks, specials
  engine/ai.js        AI controller (difficulty × per-fighter personality)
  engine/input.js     keyboard + multi-touch → virtual gamepads; Controller contract
  engine/drawFighter.js  procedural character rig, outfits, faces, photo heads, portraits
  engine/render.js    frame compositor (arena → shadows → fighters → projectiles → FX)
  engine/fx.js        particles, comic word popups, shake, hitstop, rings, flashes
  engine/audio.js     Web Audio SFX recipes + generative per-arena music loop
  ui/hud.js           health/energy bars, timer, pips, announcements, combos, hints
  ui/screens.js       select / profile / challenges / leaderboard / help / modals
  ui/resultCard.js    social result-card renderer
  ui/tutorial.js      first-fight onboarding
  net/online.js       future-multiplayer interface (see below)
```

**Seed data** lives in [src/data/seed.js](src/data/seed.js) (leaderboard) and [src/data/fighters.js](src/data/fighters.js) (roster). Adding a fighter = one object (identity, palette, stats, `special` id, AI personality). Adding an arena = one draw function + one entry in [src/data/arenas.js](src/data/arenas.js).

**Debug/test harness:** open with `?debug=1` to expose `window.UEC` (deterministic `step(seconds)`, `setHP`, `setEnergy`, `setTimer`, pad access) — the whole E2E suite runs through it. `?touch=1` forces touch pads on desktop.

## Built for scaling — prepared but not enabled in v1

- **Online multiplayer.** Every participant is a `Controller` that writes a gamepad each frame — human, AI, and (future) network peers are interchangeable. [src/net/online.js](src/net/online.js) ships a documented `MatchTransport` interface + `OnlineController` (delay-based lockstep, rollback-ready since game state is plain data). Challenge links already carry the identity payload a room invite needs. v1 ships the serverless version: friends fight your **AI ghost**.
- **Global leaderboard.** Rendering/sorting/rank logic is done; it reads one local array today. Swapping in a `fetch` keeps the UI untouched. Labeled "local season" in the UI.
- **Tournaments & seasons.** Match results flow through one `recordMatch()` chokepoint — brackets and season resets hook there.
- **Sponsorships.** Arena billboards rotate through a data array (`SPONSORS` in arenas.js) — real partners are a one-line swap.
- **Cosmetics.** Fighters are palette-driven (`c` object) with parameterized outfits/hair/accessories — skins are data, not art files.
- **More fighters/abilities.** Specials are typed behaviors (`projectile / aoe / teleport / rush / rain / grab`) — new abilities reuse or extend the type system in one place.

## Testing

Tested end-to-end in-browser (desktop + portrait/landscape mobile viewports): guest match, tutorial, profile + photo upload, every control on keyboard (both 2P schemes) and touch, all 6 signature specials + Unicorn Mode, KO/timeout/draw rounds, win & loss stat recording with exact point math, leaderboard placement, challenge-link round trip (generate → open → accept → fight ghost), rematch/restart/quit, pause, sound toggles, reset-all, and a zero-console-error sweep. Bugs found in testing (rush pass-through, base64url padding, card layout collisions, touch capture fragility, and more) were fixed before delivery.

## Legal / originality

All characters, names, companies, art, and audio are original and generated procedurally in code. No Mortal Kombat or other franchise characters, artwork, names, sounds, or assets are used. Inspiration is limited to the general conventions of the classic side-view arcade fighter.

---

Built with ❤️ and an unreasonable quantity of screen shake.
