# CLAUDE.md — Pocket Tactics (overhaul fork)

This is **`pocket-tactics-next`**, the overhaul fork. The shipped game lives in
`../pocket-tactics` and is deployed at pjeon18.github.io/pocket-tactics — this
fork has **no git remote on purpose**, so nothing here can reach the live site
until we deliberately give it one.

Dev server: **port 5203** (`preview_start` name `pocket-tactics-next`). The
shipped version still runs on 5202, so both can run side by side.

## What this is
A **tactics game**: 7×10 board, draft 1 Mythical champion + 8 Pokémon + 2
legendary summons, deploy with tiered balls (Poké/Great/Ultra), movement is live
but **damage is deferred** — attacks are declared and telegraphed, then all
resolve at End Turn. KO the enemy champion to win.

## Non-negotiable rules (flag before "fixing")
- **Damage defers, support is instant.** Attacks/AOE/tile specials plan via
  `planAttack`/`planArea` and fire in `resolveStep`; heals/buffs/revive are
  instant via `useAbility`. Don't collapse the two paths.
- **Move cap**: 3 non-champion moves per turn (`MOVE_CAP`); attacks uncapped.
- **Undo is free** until an attack is declared or a chest is opened.
- **Champion movement lock**: champion moves ⇒ nothing else moves that turn.
  Enforced in `rules.ts:canMoveNow`, not the UI.
- **Variance is on normal attacks only** — specials never miss or crit.
- **Stun blocks moving AND attacking** for the stunned unit's next turn.
- **No Pokémon attacks the turn it deploys** (it may still move).
- **Champions are immune to stun and knockback.**
- **Roster is Gen ≤ 5 only** (dex ≤ 649) — the animated sprite set stops there.
- Simulation stays **headless** — nothing in `src/game/` may touch the DOM.
- Moving is optional; never auto-act the player's units.

## Current systems (post-overhaul — differs from the shipped version)

**Combat maths is multiplicative** (`TUNING` in `data.ts`). Crit ×1.5 at 6%,
miss = 0 damage at 3%, super effective ×1.5, resisted ×0.5. Order inside
`dealDamage`: flat item/synergy modifiers → matchup multiplier → crit. Flat
±2/±3 modifiers are gone; they scaled badly across the game's damage range.
`typeMult()` gives the multiplier, `typeSign()` the direction for messaging.

**`TUNING` is mutable on purpose** so `scripts/sim.ts --tune=` can A/B rule
variants against an identical population of seeded games.

**The closing board** replaced champion fatigue. From `TUNING.poisonStart` (14)
the outermost row on each side turns toxic for `poisonDamage` (2) at the end of
the round boundary — BOTH sides at once, never at each player's own turn end
(per-owner timing let the second player move on a damaged opponent and was worth
several points of win rate); another row closes every `poisonStep` (5) rounds,
capped at four a side (`poisonDepth`/`isPoisoned` in data.ts, in `finishTurn`).
Champions start on the back row, so the first closure evicts them forward. This
took games reaching round 20 from 48% to 7% and the median from 19 to 15. Use
`isPoisoned` (allocation-free) in hot paths — `poisonedRows` allocates and
measurably slowed the AI's `evaluate()`.

**Economy**: `POKE_CAP` 10, income 1/turn stepping up at `INCOME_BREAKS`
(round 5 → 2, round 11 → 3), capped by `INCOME_CAP` 3. Great/Ultra Balls only
via trading (3→G, 6→U). Second-player compensation is `TUNING.startPokeB` = 3.
The breaks must stay INSIDE the median game length — at [6, 16] the third tier
fired after most games had ended and the Ultra tier was unaffordable.

**Synergies** unlock at 3 unique same-type fielded (5 for tier 2), except
Normal/Payday at 2 and 4. Champion counts; duplicates never do.

**The AI** (`ai.ts`) has three difficulty tiers (`easy | normal | hard`,
surfaced as Relaxed / Trainer / Champion). It evaluates positions with
`evaluate()` — dominated by champion health, since that's the win condition —
avoids enemy threat tiles, uses items and aimed summons, and measures special
damage by actually simulating the action (`simulateAction`) rather than
consulting a table. `aiStep(state, difficulty)` and `aiDraft(difficulty)`.

## The main menu

The menu is a **selection screen, not a launcher**. The six mode cards
(`.mode-card`, 2x3 grid) only mark a choice; the red `Start game` button is the
only thing that leaves the screen, and `start()` routes on the selected mode.
Settings appear only when they apply — draft style and turn clock for the three
battle modes, CPU difficulty for Single Player alone.

Browser suites must navigate with `startMode(page, label)` from
`scripts/menu-nav.mjs`. Selecting and starting have to be **separate evaluates**:
in one task React batches the state update and Start reads the previous mode.
The older `scripts/verify-*.mjs` one-offs predate the fork, still click the old
menu labels, and are not wired into any npm script.

## Modes (all new in this fork)

**Tutorial** — one guided battle over a fixed board with two rival pieces: a
throwaway Squirtle to learn the attack loop on, then Manaphy as the win
condition. Teaches deploy → settle → move → *declare a normal attack* → resolve
→ charge → special. Steps are DERIVED from board state (`tutorialStep`), never
a script counter, so the coach cannot desync. The scenario is `deterministic`.

**Puzzles** (`src/game/puzzles.ts`) — six hand-authored deterministic boards,
"KO the champion in N turns", inert rival. Each teaches one rule by making it
the solution. **Every puzzle is machine-verified**: `npm run puzzles` proves a
winning line exists at par AND that none exists a turn sooner.

**Campaign** (`src/game/campaign.ts`) — six trainers with fixed decks and
climbing difficulty. You draft only from cards you own; beating a trainer hands
you their whole deck. **All 62 cards are reachable** across nine trainers, and
`npm run campaign` asserts it. Save lives in `pt-campaign`.

## Verification — prefer running a script to eyeballing

```bash
npm run verify      # everything below, in order
npm run menu        # menu selects vs commits, and routes each mode
npm run check       # build + engine + puzzles + campaign
npm run a11y        # contrast audit across 8 real screens
npm run puzzles     # puzzle solvability + par tightness
npm run tutorial    # plays the tutorial to completion
```

These exist because eyeballing kept missing things. The a11y auditor caught 93
real contrast failures; the puzzle verifier caught three broken boards and two
bugs in itself. **When something looks wrong, check whether a tool can prove it
before hand-tuning.**

## Balance telemetry — use it instead of guessing

```bash
npm run telemetry                      # 10k games + regenerate the dashboard
npx tsx scripts/sim.ts 2000 --vs=hard:easy
npx tsx scripts/sim.ts 1000 --tune=critMult:2.0
```

`scripts/sim.ts` runs seeded, reproducible AI-vs-AI games and writes
`docs/telemetry/<tag>.json`; `scripts/dashboard.ts` renders it to a
self-contained HTML dashboard. **Any balance change should be A/B'd through
this** — same seeds, different rules, diff the output.
`docs/FINDINGS.md` holds the standing analysis and its caveats.

Standing numbers (run `final`, 6k games): first-player 50.5%, champion spread
5.6 pts, median 14 rounds, 3.7% reach round 20, no dead cards, cost buckets all
within 46-51%. **Game length, dead cards, champion spread and premium
reachability are all FIXED** — do not re-litigate them without re-running the
harness.

Note on cost→win correlation: near-zero is CORRECT. Expensive cards winning more
games would be pay-to-win. The metric that mattered was premium *deploy* rate
(~16% → ~24% after moving INCOME_BREAKS inside the shorter game).

## Layout
- `src/game/data.ts` — every tuning number, roster, champions, summons. Balance
  changes happen here only.
- `src/game/actions.ts` — pure state transitions (clone → mutate → return).
- `src/game/rules.ts` — legality and derived stats (movement, targeting, synergy).
- `src/game/ai.ts` — draft + `aiStep`; one action per call, null = end turn.
- `src/game/tutorial.ts` — the guided tutorial's fixed scenario.
- `src/ui/BoardView.tsx` — perspective-aware rendering (B sees the board flipped
  by coordinate transform, not CSS).
- `scripts/smoke.ts` — headless engine tests; run after **any** engine change.

## Verify before done
`npm run build` (includes tsc), `npx tsx scripts/smoke.ts`, and check it in the
browser. For anything touching balance or the AI, run the telemetry harness and
compare against the previous tag.
