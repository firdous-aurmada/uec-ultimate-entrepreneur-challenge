# UEC — the math

Every number here is the real one, read out of the source. Tuning lives in
[`src/config.js`](../src/config.js); the roster lives in
[`src/data/fighters.js`](../src/data/fighters.js). Change those, not the docs,
and then update this file.

The game runs a **fixed 60 Hz simulation**. Durations below are in seconds;
the frame column is `seconds × 60`.

---

## 1. The three stats

| Stat | What it actually does |
|---|---|
| **SPEED** | Multiplies walk speed. Base walk is `250 px/s`, so speed `1.10` = `275 px/s`. Also scales air drift (`0.78 ×` walk). |
| **POWER** | Multiplies every point of damage you deal — basics, specials, projectiles and chip alike. |
| **HP** | Your health pool. Rounds are won by emptying the other bar or leading when the 60 s clock expires. |

### Are they the same for everyone? — **Yes, for players. Always.**

```js
// src/config.js
export const PLAYER_STATS = { speed: 1.0, power: 1.0, hp: 100 };
```

Every human fights on exactly this line: **1.00 speed, 1.00 power, 100 HP**.
Your base character, your colours and your photo are **pure cosmetics** — they
decide how you look, never how hard you hit. That is enforced in one place:

```js
// src/data/fighters.js — buildCustomFighter() and buildGhostFighter()
stats: { ...PLAYER_STATS },
```

Before this, a player inherited the stats of whichever silhouette they clicked,
which spread across `0.90–1.18` speed, `0.90–1.20` power and `94–110` HP. That
meant a cosmetic choice was worth up to **a 33 % power gap** — and ranked points
were measuring the wardrobe, not the player.

**The varied stats still exist, but only ever on AI opponents**, so the roster
still feels distinct to fight:

| Rival | SPD | PWR | HP | Signature special |
|---|---|---|---|---|
| Lizbeth Holmez | 1.00 | 1.00 | 100 | 🔄 Pivot Punch |
| Adam Weumann | 0.95 | 1.20 | 95 | 🔥 Burn Rate Blast |
| Steve Nojobs | 1.15 | 0.90 | 95 | 📊 Pitch Deck Strike |
| Kim Koindashian | 1.10 | 0.95 | 95 | 📈 Growth Hack |
| Cathie Woodz | 0.90 | 1.05 | 105 | 💰 Funding Round |
| Carl Icahnt | 0.85 | 1.25 | 110 | 🦈 Hostile Takeover |
| Elo Ma *(cameo)* | 1.05 | 1.15 | 100 | 🔄 Pivot Punch |
| Jeff Bozo *(cameo)* | 0.90 | 1.20 | 108 | 🦈 Hostile Takeover |
| Scam Alt *(cameo)* | 1.10 | 0.90 | 96 | 📊 Pitch Deck Strike |

### Do stats grow as you rank up? — **No. Deliberately.**

There is no stat growth, no unlock, no gear. A `DECACORN` and a first-day
`GARAGE DREAMER` bring **identical tools** to the ring. Progression is
**reputation, not power** — otherwise the ladder would compound: the people
winning most would hit hardest, and new players could never catch up.

What *does* change with the fight: Unicorn Mode, mystery-crate buffs, and the
AI difficulty you chose. All temporary, all symmetrical.

---

## 2. Damage

The single formula every hit goes through:

```
dealt = max(1, round( base × POWER × unicorn × crateBuff × comboScaling ))
```

| Term | Value |
|---|---|
| `base` | the move's damage from the table below |
| `POWER` | your power stat — **always 1.00 for a player** |
| `unicorn` | `1.35` while Unicorn Mode is active, else `1.00` |
| `crateBuff` | `1.40` while a 💪 damage crate is running, else `1.00` |
| `comboScaling` | see §3 — depends on how deep the *victim* already is in the chain |

Blocked hits instead take **chip**:

```
chip = max(1, round( base × POWER × 0.15 ))     // 0 while the blocker is in Unicorn
```

Chip **can never KO** — it always leaves at least 1 HP.

### Basic attacks

| Move | Key | Startup | Active | Recovery | Dmg | Reach | Knockback | Hitstun |
|---|---|---|---|---|---|---|---|---|
| 🖐 **Slap** | H / X | 0.04 s (2.4 f) | 0.06 s | 0.12 s | **4** | 78 px | 70 | 0.20 s |
| 👊 **Punch** | J / C | 0.05 s (3 f) | 0.06 s | 0.11 s | **7** | 84 px | 110 | 0.24 s |
| 🦶 **Kick** | K / V | 0.10 s (6 f) | 0.08 s | 0.17 s | **12** | 106 px | 320 | 0.32 s |

The trade is deliberate: slap is **2.5× faster to start** than kick but does
**a third** the damage. Fast moves open, slow moves close.

### Specials (50 energy)

| Special | Type | Damage | Notes |
|---|---|---|---|
| 📊 Pitch Deck Strike | projectile | `8 × 3` = **24** | 3 slides, 0.14 s apart, 560 px/s |
| 🔥 Burn Rate Blast | AoE | **22** | 150 px reach, slow 0.30 s startup |
| 🔄 Pivot Punch | teleport | **16** | reappears behind you |
| 📈 Growth Hack | rush | `5 × 4` = **20** | locks on and chases |
| 💰 Funding Round | rain | `7 × 3` = **21** | refunds **8 energy** on hit |
| 🦈 Hostile Takeover | grab | **20** | **unblockable** — jump it. Beats parry. |

### Universal moves

| Move | Cost | Effect |
|---|---|---|
| ⚖️ Cease & Desist | 25 energy | **10** damage, 92 px blast radius, arcing throw |
| 💸 Acqui-Hire | free, 3.5 s cooldown | **no damage** — siphons **15 energy** from them to you |
| 💨 Dash | free, 1.6 s cooldown | 1450 px/s for 0.16 s; attacks cancel it after 0.06 s |
| 🦄 Unicorn Mode | 100 energy | 6 s of `×1.35` damage, `×1.25` speed, **immune to chip** |

---

## 3. Combos — the magic series

One rule: **when an attack lands, you may cancel it into the same move (up to
its cap) or any stronger move. Never a weaker one.**

```
RANK:  🖐 slap (0)  <  👊 punch (1)  <  🦶 kick (2)
CAP:   slap ×2        punch ×3         kick ×2
```

So the longest pure-basics route is **7 hits**, then a finisher:

```
🖐🖐 → 👊👊👊 → 🦶🦶 → ⚡ special / ⚖️ C&D / 🦄 Unicorn
```

Kick cannot drop back to punch. Whiffs cancel nothing — miss and you eat the
full recovery, which is what keeps mashing punishable.

### Damage scaling

Each hit the victim takes in one chain makes the *next* one weaker:

```js
SCALING = [1, 0.85, 0.7, 0.6, 0.5, 0.45, 0.4]   // indexed by victim's chain depth, capped at 6
```

**Worked example — the full 8-hit route:**

| # | Move | Base | × scaling | Dealt |
|---|---|---|---|---|
| 1 | 🖐 Slap | 4 | × 1.00 | **4** |
| 2 | 🖐 Slap | 4 | × 0.85 | **3** |
| 3 | 👊 Punch | 7 | × 0.70 | **5** |
| 4 | 👊 Punch | 7 | × 0.60 | **4** |
| 5 | 👊 Punch | 7 | × 0.50 | **4** |
| 6 | 🦶 Kick | 12 | × 0.45 | **5** |
| 7 | 🦶 Kick | 12 | × 0.40 | **5** |
| 8 | 🔄 Pivot Punch | 16 | × 0.40 | **6** |
| | | | **total** | **36** |

That's **36 % of a 100 HP bar from one opening** — strong, but note the raw
un-scaled sum would have been **69**. Scaling nearly halves a long chain, and
is the whole reason one combo can't take a round.

Chained light hits also shove less (`× 0.55` knockback) so the string stays in
range instead of launching them out of it.

Milestones pop on-screen at **3 → COMBO!**, **5 → SYNERGY!**, **7 → DISRUPTED!**,
**10 → ACQUIRED!** (10+ needs crates or a reset).

---

## 4. Energy

| | |
|---|---|
| Max | **100** |
| Hit dealt | **+12** |
| Hit taken | **+8** |
| Chip dealt | **+3** |
| Parry | **+10** |
| Funding Round refund | **+8** |

Taking damage builds meter too, so losing a round still arms your comeback.

**Parry:** tap block within **0.12 s** of impact — you take **zero** damage,
they stagger for **0.5 s**, and you bank 10 energy. Grabs beat parries; parries
beat everything else.

---

## 5. Points and progression

There are **two separate ladders**, and this trips people up:

| | **Local** ladder | **Global** ladder |
|---|---|---|
| Earned from | solo fights vs AI | **verified live PvP only** |
| Stored in | your browser (`localStorage`) | the `profiles` table |
| Who can see it | just you | everyone |
| Can it be faked | it's your own device, so yes | **no** — see below |

Beating the AI will never move the global board. That's intentional: a public
ladder that counts offline wins is a ladder that counts nothing.

### Local points (vs AI)

```
win  = round(20 × mult) + 5 × koRounds + min(15, streak × 3)
loss = 3
```

`streak` is your **new** streak, counting the win you just took — so your first
win pays a 3-point streak bonus, and it caps out at 15 on your fifth in a row.
Worked: a **Champion** win with **both** rounds by KO on your first win is
`round(20 × 2.5) + 2 × 5 + min(15, 1 × 3)` = **63**.

`mult` comes from the difficulty you picked — this is why **Champion is worth
2.5× a Rookie win**:

| AI level | Internal key | `mult` | Base win |
|---|---|---|---|
| **ROOKIE** | `intern` | 1.0 | 20 |
| **CONTENDER** | `founder` | 1.5 | 30 |
| **CHAMPION** | `mogul` | 2.5 | **50** |
| *accepted challenge link* | — | 2.0 | 40 |

### Global points (live PvP)

Awarded server-side by the `report_match()` function:

```
winner = 40 + 5 × koRounds + min(15, (streak + 1) × 3)
loser  = 3
```

**Both players must independently report mirror-image results for the same
room** before anything is written. A single-sided report returns `pending` and
changes nothing. Stat columns aren't writable by clients at all — only that
function can touch them, under an advisory lock so a match can't double-apply.
Losing is still worth 3, so playing is never worse than not playing.

### The rank ladder

| Points | Rank |
|---|---|
| 0 | GARAGE DREAMER |
| 60 | BOOTSTRAPPER |
| 150 | SEED STAGE |
| 300 | SERIES A |
| 550 | SERIES B |
| 900 | GROWTH STAGE |
| 1400 | PRE-IPO |
| 2000 | UNICORN |
| 3200 | DECACORN |

**Bottom to top, concretely.** A live win with one KO round, taken as your
**third straight win** (streak was 2 going in), pays `40 + 5 + 9 = 54`. At
roughly that rate:

| Rank | Points | ≈ live wins |
|---|---|---|
| BOOTSTRAPPER | 60 | 2 |
| SEED STAGE | 150 | 3 |
| SERIES A | 300 | 6 |
| SERIES B | 550 | 11 |
| GROWTH STAGE | 900 | 17 |
| PRE-IPO | 1400 | 26 |
| UNICORN | 2000 | 38 |
| DECACORN | 3200 | 60 |

The streak bonus caps at **15** (a 5-win streak), so streaks are worth chasing
but can't run away with the ladder. Rank is **cosmetic** — it changes the badge
on your card, never your stats.

---

## 6. Round and match structure

| | |
|---|---|
| Rounds | best of 3 — **first to 2** |
| Round clock | 60 s |
| Timeout | higher HP percentage wins the round |
| Stage | 960 × 540 logical, floor at y = 480, walls at x = 70 / 890 |
| Gravity | 2100 px/s² · jump velocity −760 |

### Mystery crates

Briefcases drop on a **seeded** schedule (both players in a live match see
identical drops): first at **5 s ± 3 s**, then every **7–12 s**, sitting for
**7 s** before vanishing. Pick-up range 46 px. Buffs run **5 s**
(`×1.4` damage or `×1.4` speed); shields run 8 s.
