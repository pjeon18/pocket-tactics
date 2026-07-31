# Balance telemetry — baseline findings

**Run:** 10,000 seeded AI-vs-AI games against the live rules engine · seed 1 · 62 Pokémon · 256s
**Artifacts:** `docs/telemetry/baseline.json` (raw) · `docs/telemetry/baseline.html` (dashboard)
**Reproduce:** `npm run telemetry`

Every match is seeded, so any rules change can be re-run against the identical
population of games and diffed. That is the point of the harness: it replaces
"this felt bad in one playthrough" with a measurement.

---

## Read this caveat first

These games are played by the **current AI**, which is weak and does not use
items, blink, revive, or most specials, and drafts close to randomly. So every
number below measures *the system as the current AI plays it*, not the system at
its skill ceiling.

That confound matters most for the cost/win findings, and least for the
structural findings (game length, board saturation, champion pacing), which are
properties of the rules regardless of who is driving. **Fixing the AI and
re-running is a prerequisite to trusting the unit-level numbers.** Where a
finding is confounded, it is flagged below.

---

## What's healthy

**First-player win rate: 50.7%** (n=10,000). Effectively perfect. The
second-player compensation (`START_POKE_B = 2` vs A's 1) is correctly tuned —
this was a real risk and it is not a problem. Leave it alone.

**Snowball index: 58.1%.** The side that scores the first KO wins 58% of the
time. Above the 50% no-signal line, but well short of runaway — first blood
tilts a game without deciding it. Comebacks remain possible. This is a
defensible number; no comeback mechanic is needed yet.

**Tier balance in aggregate:** mean win rate by tier is Poké 50.1% / Great
50.2% / Ultra 50.0%. The three-tier cost structure is, on average, fair.

---

## Problem 1 — the game does not end itself (highest priority)

**57.9% of games run past round 20**, where the engine begins forcing chip
damage on both champions. Median length 21 rounds, p90 28, max 40.

The champion-HP curve shows why this is structural, not cosmetic:

| Round | 1 | 6 | 10 | 15 | 20 | 25 | 30 |
|---|---|---|---|---|---|---|---|
| Avg champion HP | 100% | 96% | 89% | 85% | **76%** | 44% | 33% |

Champions lose only ~15% of their health across the first *fifteen* rounds. The
win condition is barely approached under its own power; then fatigue switches on
at round 20 and the curve falls off a cliff. **In the majority of games, the
timeout mechanic is what kills the champion — not the players.** Fatigue was
added as a safety net and has quietly become the primary win condition.

The cause is visible in the board-population curve: average units fielded per
side climbs to **6.0 by round 20 and 6.7 by round 30, against a FIELD_CAP of 7**.
Both sides saturate to the cap and the board gridlocks — bodies screen the
champion, and with 13 KOs per game the losses are replaced as fast as they're
taken. The anti-wall work (FIELD_CAP, income cap, kill bounty) reduced the
symptom without removing it.

**Directions to test** (each is a one-number change the harness can A/B):
lower FIELD_CAP; raise redeploy cooldowns further; make champions harder to
screen (a flanking/backline rule); scale kill bounty; start fatigue earlier;
or add an objective that rewards pushing rather than turtling.

## Problem 2 — three cards are dead weight

Drafted, then essentially never played:

| Card | Cost | Deploy rate |
|---|---|---|
| Primeape | 4 (1 Great) | **0.8%** |
| Scyther | 4 (1 Great) | **1.0%** |
| Gigalith | 4 (1 Great) | **1.1%** |

A card that reaches the field ~1% of the time is a dead slot in the draft. All
three sit at the same price point, which points at an affordability cliff at the
first Great Ball rather than three separately bad cards.

*Partly confounded:* a smarter AI would buy Great Balls more decisively. Re-check
after the AI work — but the fact that a whole price point is skipped is a signal
worth keeping.

## Problem 3 — premium investment is not rewarded

**Cost → win correlation: −0.124.** Slightly *negative*: across the roster,
paying more for a Pokémon correlates with winning marginally less. The design
intent ("incentive to invest all the way") is not being realised.

The top of the win-rate table is dominated by cheap bodies — Croagunk (cost 1)
61.5%, Lillipup (1) 58.5%, Kirlia (2) 58.4%, Onix (2) 55.5% — while Krookodile
(6) sits at 45.4%.

*Heavily confounded.* Because tier means are balanced (~50% each), the negative
correlation is driven largely by the AI drafting expensive cards it then cannot
afford to deploy, which wastes draft slots. This is at least as much an AI
problem as a balance problem. **Re-measure after the AI overhaul before touching
any costs.**

## Problem 4 — champion spread is 24 points

| Champion | Win rate | n |
|---|---|---|
| Celebi | 60.6% | 4,049 |
| Victini | 58.2% | 3,903 |
| Manaphy | 48.9% | 4,045 |
| Mew | 45.7% | 3,979 |
| Jirachi | **36.8%** | 4,024 |

Jirachi is 24 points behind Celebi. At n≈4,000 each this is far outside noise.
Celebi's repeatable 3-HP heal compounds in exactly the long, grindy games the
data says are the norm — the champion imbalance and the stall problem are the
same problem seen from two angles, so fix the stall first and re-measure before
nerfing Celebi directly.

## Neutral — summons are well balanced

Win rates 48.9%–51.4% across all four, with cast rates of 0.17–0.23 per draft.
No outliers. (Kyogre and Groudon post-date this run and are not yet measured.)

---

## Recommended order of operations

1. **AI overhaul** — it is the confound blocking trust in problems 2 and 3, and
   it is the biggest single-player experience lever regardless.
2. **Re-run the harness** against the fixed AI to get a trustworthy baseline.
3. **Attack the stall** (problem 1) with A/B'd rule changes; it is the deepest
   structural issue and it also drives problem 4.
4. **Then** revisit unit costs, dead cards, and champion tuning with clean data.

The RNG rework (multiplicative crit/type scaling) can be A/B'd through the same
harness at any point — it is independent of the above.
