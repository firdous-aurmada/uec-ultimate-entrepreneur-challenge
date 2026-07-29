# THE INCUBATOR — Character Building Engine

**Date:** 2026-07-29 · **Status:** Approved (design decisions confirmed in conversation)

## The problem

Characters in UEC differ in **palette and timing only**. Every fighter shares one
skeleton, one set of body proportions, four identical basic attacks, and one of six
shared specials. A "fighting style" is six scalar multipliers.

Street Fighter and Mortal Kombat characters feel distinct because they *do different
things* — Dhalsim's limbs stretch, Zangief spins you into the floor, Guile charges.
That is per-character move data plus per-character geometry. The engine has no
concept of either.

This spec covers an in-repo authoring tool ("the Incubator") and the engine changes
that make its output meaningful.

## Decisions taken

| Question | Decision |
|---|---|
| Depth of "unique fighting style" | **Moves + body** now; full pose/animation rig later (P4) |
| Move authoring surface | **Archetype + tuning** — 8 engine-implemented archetypes, authors compose and tune |
| Body variation | **Bounded proportion knobs**, clamped ~0.82–1.25 |
| Audience | **Dev tool now**, but versioned schema + real validator so a player-facing creator reuses the format |

Rejected: freeform phase timelines and script hooks (the latter would desync
deterministic lockstep netplay); unbounded silhouettes (dynamic shading-buffer sizing
plus unreasonable balance); fixed-body-richer-parts (leaves the original problem intact).

---

## 1. Location and access

- `incubator.html` at repo root, modules under `src/forge/`.
- Imports the **real** `src/engine/*` — the preview is the shipping renderer, and
  sparring uses the shipping physics and AI. No second implementation to drift.
- Not linked from the game and not in the player flow.
- Served by the existing `dev-server.py`.

**Access caveat:** the repo is static and published, so this is *unlisted*, not
private. Anyone who guesses the URL can open it. Acceptable — the tool holds no
secrets and writes only through the local dev server — but it is not access control.

## 2. Character schema (v1)

The schema is the real deliverable. Everything else is scaffolding around it.

```js
{
  schema: 1,                      // validator dispatches on this
  id: 'lizbeth',                  // [a-z0-9-]{2,24}, unique

  identity: {
    name:    'LIZBETH HOLMEZ',    // ≤ 22 chars
    title:   'THE FRAUDSTER',     // ≤ 24
    company: 'THERAMOS',          // ≤ 20
    tagline: '…',                 // ≤ 64
    rap:     'Convicted · investor fraud',   // ≤ 40
  },

  body: {                         // all default 1.0
    height:    1.0,               // 0.82 – 1.22   overall scale
    build:     1.0,               // 0.85 – 1.25   torso + limb thickness
    reach:     1.0,               // 0.88 – 1.20   arm length; feeds effective move reach
    stride:    1.0,               // 0.88 – 1.18   leg length
    shoulders: 1.0,               // 0.85 – 1.25
    head:      1.0,               // 0.90 – 1.12
  },

  look: {
    skin, hair, suit, suit2, accent, pants, shoe,     // 7 hex colours
    hairStyle, outfit, headwear, eyewear, facialHair, // enums from LOOKS
    stance: 'coiled',             // ready|coiled|heavy|poised|loose|flair
  },

  fighting: {
    preset: 'phantom',            // seeds the numbers; retained for the select-screen label
    startup: 0.86, dmg: 0.86, reach: 1.08,
    recovery: 0.82, speed: 1.10, hp: 0.92,
    moves: {
      special:   { …archetype block },        // required
      signature: null | {                     // optional
        replaces: 'slap'|'punch'|'kick'|'launch',   // which basic it overrides
        …archetype block,
      },
    },
  },

  ai: {
    aggr: 0.55,           // 0 – 1
    jump: 0.3,            // 0 – 1
    prefRange: 'far',     // 'close' | 'mid' | 'far'
  },
}
```

### Preset seeds, it does not lock

Picking BALANCED or RUSHDOWN fills the six multipliers with sane starting values;
the author then tunes freely. The export carries **final numbers plus the preset
name** — the name is a display label on the select screen, not a constraint. This
replaces today's arrangement where ten characters share six multiplier sets.

## 3. Power budget

Enforced by the validator, shown as a live meter while dragging.

```
COST = 100 × [ 1.00 × (dmg   − 1)
             + 1.00 × (hp    − 1)
             + 1.20 × (speed − 1)
             + 1.00 × (reach − 1)
             + 0.70 × (1 − startup)
             + 0.50 × (1 − recovery)
             + 0.80 × (body.reach − 1)
             − 0.60 × (body.height × body.build − 1) ]
```

Speed is weighted above 1.0 because movement advantage compounds with everything
else. Startup and recovery are weighted below 1.0 to avoid double-counting frame
advantage. The final term is a **refund**: a bigger body is a bigger hurtbox, so
size is partly self-balancing.

| Band | Result |
|---|---|
| `\|COST\| ≤ 8` | clean |
| `8 < \|COST\| ≤ 15` | warn — exports, flagged |
| `\|COST\| > 15` | blocked |

**Why this exists:** v2.3 shipped Carl Icahnt at +58% damage *and* +10% HP because
nothing prevented multipliers from compounding. A budget makes that class of error
structurally impossible instead of something review has to catch.

### Finding: the formula flags half the shipped roster

Run against all ten v2.3.1 `STYLES` entries at body 1.0:

| Style | COST | Band |
|---|---:|---|
| grappler | −4.6 | clean |
| brawler | −3.8 | clean |
| balanced | 0.0 | clean |
| zoner | +4.7 | clean |
| rushdown | +7.0 | clean |
| showman | +8.2 | warn |
| technical | +8.6 | warn |
| trickster | +12.2 | warn |
| glass (GLASS CANNON) | +14.2 | warn |
| **phantom** | **+16.8** | **blocked** |

Five clean, four warn, one blocked — so the formula discriminates rather than
condemning everything.

PHANTOM holds an advantage on **four** axes — startup, recovery, speed and reach —
and pays on only two. That is the same compounding pattern as the Carl Icahnt bug,
and I did not catch it in the v2.3.1 audit. GLASS CANNON at +14.2 matches the caveat
already raised about it being the outlier. SHOWMAN and TECHNICAL sit barely over the
clean threshold and are not a concern.

**Resolution:** retuning belongs in P3, not P1. P1's acceptance criterion is that
gameplay is unchanged, so migration records these warnings without altering any
numbers.

## 4. Move archetypes

Eight, implemented by the engine. Authors choose one and tune its parameters plus
its visual (shape, colour, trail, impact). Every authored move is playable by
construction.

| Archetype | Covers today | Parameters |
|---|---|---|
| `strike` | slap/punch/kick/launch | startup, active, recovery, dmg, reach, hitY, kb, kbUp, stun |
| `aoe` | Burn Rate Blast | startup, active, recovery, dmg, reach, kb, kbUp |
| `projectile` | Pitch Deck Strike | count, speed, interval, arc, dmg, startup, recovery, lifetime |
| `rush` | Growth Hack | hits, hitInterval, speed, duration, startup, recovery, kb |
| `grab` | Hostile Takeover | reach, dmg, startup, recovery, kb, kbUp — unblockable, jump-escapable |
| `teleport` | Pivot Punch | offset, dmg, startup, active, recovery, kb, kbUp |
| `rain` | Funding Round | count, spread, fallSpeed, dmg, startup, recovery, energyRefund |
| **`counter`** | *new* | window, dmg, startup, recovery, retaliation kb |
| **`trap`** | *new* | lifetime, radius, dmg, armTime, maxActive |

The first seven generalise everything the game already does — `aoe` is kept separate
from `strike` rather than merged, because P1 must preserve shipped behaviour exactly;
consolidating them is a P3 decision. `counter` and `trap` are new fight patterns,
added at the start of P2 alongside the UI that can author them. They exist so the
roster can hold characters that play differently in kind, not just in degree.

## 5. Authoring loop

Draft autosaves to `localStorage` on every change; a refresh never loses work.

1. **Live preview** — real `drawFighter.js` through the real cel-shade pipeline,
   updating as sliders move. The character itself, not an approximation.
2. **Spar** — spawns an actual `Game` instance, authored fighter vs chosen opponent,
   real physics and AI. Frame data is felt rather than guessed.
3. **Validate** — schema shape, field ranges, id uniqueness, power budget. Errors
   block export; warnings annotate it.
4. **Export** — writes `src/data/roster.js`.

### Export mechanics

`dev-server.py` already accepts `PUT` with path-traversal protection and a 5 MB cap,
so no new endpoint is needed. The Incubator PUTs the generated module to
`src/data/roster.js`, and falls back to a file download when the PUT fails (e.g.
opened from GitHub Pages rather than the dev server).

Output is a plain data module — `export const ROSTER = [ … ]` — so it is diffable in
git, needs no extra fetch at boot, and adds no new runtime failure mode.
`fighters.js` becomes a thin loader plus its existing helpers (`getFighter`,
`buildCustomFighter`, `buildGhostFighter`, `pickLook`, `shade`).

## 6. Engine changes (P1)

| File | Change |
|---|---|
| `src/engine/fighter.js` | Hurtbox derives from `body` (height/build) instead of global `PHYS.BODY_W/H`. Move lookup goes through the character's move table rather than the module-level `ATTACKS`. |
| `src/engine/drawFighter.js` | A proportion object threaded through the hand-tuned offsets. **The delicate change** — see §7. |
| `src/engine/drawFighter.js` (buffer) | `BUF_OX`/`BUF_OY` scale with `height` and `reach` so tall or long-armed characters do not clip the cel-shade buffer. |
| `src/engine/moves.js` *(new)* | The archetype implementations, extracted from the `sp.type` chains at `fighter.js:383-388` and `:407-434`. |
| `src/config.js` | Adds `BODY` bound constants and the power-budget weights. `PHYS.BODY_W/H` remain as the 1.0 baseline. |
| `src/data/schema.js` *(new)* | Schema definition + validator, shared by the Incubator and the game's load path. |

## 7. Risk and regression control

The material risk is `drawFighter.js`: 1,029 lines of hand-tuned offsets, all of
which become relative. A subtle break there degrades the look of nine shipped
characters in ways that are easy to miss by eye.

**Golden-image harness, built before any refactor:**

1. Render all 9 fighters × key states (idle, crouch, each attack's active frame,
   hitstun, KO, victory) to canvas at fixed DPR with animation time pinned.
2. Hash the pixel buffers; commit the hashes as the baseline.
3. After the refactor, re-render and diff. **Any character with all body knobs at
   1.0 must be pixel-identical.**

This converts "did I break the art" from a judgment call into a test. It is also
reusable for every future rendering change, which is the second reason to build it.

## 8. Netcode constraint

Live matches run deterministic lockstep, so both peers need byte-identical character
data. Therefore:

- The roster compiles into the bundle rather than being fetched at runtime.
- **No change to the state hash is needed.** `hashGameState` (`src/net/online.js:55`)
  fingerprints *derived* state — positions, HP, energy, timer — so peers holding
  different character data diverge on the first hit and the existing detector catches
  it downstream. An earlier draft of this spec claimed the definition had to feed the
  hash; reading the function shows that is unnecessary.
- **Custom characters cannot enter ranked or live play until there is a distribution
  mechanism.** That is a separate problem, deliberately out of scope here, and named
  now so it does not surprise anyone later.

## 9. Testing

| Layer | Test |
|---|---|
| Schema | Validator accepts all 9 migrated characters; rejects out-of-range, malformed, duplicate-id |
| Budget | Formula reproduces the §3 table exactly |
| Rendering | Golden-image diff — knobs at 1.0 ⇒ pixel-identical |
| Body extremes | Every knob at min and at max renders without clipping the shade buffer or escaping stage bounds |
| Moves | Each of the 8 archetypes lands a hit, respects blocking (except `grab`), and its hitbox matches its declared reach |
| Determinism | Same seed + same inputs + same roster ⇒ identical state hash across two runs |
| Perf | Frame budget stays under ~1.5 ms (currently 1.2 ms) with proportion maths in the draw path |

## 10. Phases

**P1 — Foundation.** Schema, validator, golden-image harness, engine reads body and
moves from data, all 9 characters migrated. *Acceptance: the game plays and looks
identical — golden images match, determinism test passes.* Nothing visible changes.

**P2 — The Incubator.** Opens with the two new archetypes (`counter`, `trap`), then
the authoring UI: identity, look, body sliders, move archetype editor, live budget
meter, live preview, spar, export. *Acceptance: a new character can be authored,
sparred against, exported, and loaded by the game without editing code by hand.*

**P3 — Repopulate.** Use the tool to make the roster genuinely distinct; retune the
PHANTOM and GLASS CANNON findings from §3. *Acceptance: no two characters share a
move archetype + body silhouette, and every character is clean or warn on budget.*

**P4 — Pose/animation rig.** Deferred. Per-character keyframe poses with a timeline
editor. External design input wanted here, on the scrub/copy/mirror interaction model
and on art direction for the poses themselves.

### Why P1 delivers nothing visible

Building the authoring UI on an unproven schema means discovering the schema is wrong
*after* the UI depends on it. Migrating the existing nine characters first is what
proves the format. The cost is real and is accepted deliberately.
