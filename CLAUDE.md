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

**Economy**: `POKE_CAP` 10, income 1/turn stepping up at `INCOME_BREAKS`
(round 6 → 2, round 16 → 3), capped by `INCOME_CAP` 3. Great/Ultra Balls only
via trading (3→G, 6→U). Second-player compensation is `TUNING.startPokeB` = 3.

**Synergies** unlock at 3 unique same-type fielded (5 for tier 2), except
Normal/Payday at 2 and 4. Champion counts; duplicates never do.

**The AI** (`ai.ts`) has three difficulty tiers (`easy | normal | hard`,
surfaced as Relaxed / Trainer / Champion). It evaluates positions with
`evaluate()` — dominated by champion health, since that's the win condition —
avoids enemy threat tiles, uses items and aimed summons, and measures special
damage by actually simulating the action (`simulateAction`) rather than
consulting a table. `aiStep(state, difficulty)` and `aiDraft(difficulty)`.

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

Known open problems (see FINDINGS.md): games still lean long, three Great-tier
cards barely get deployed, and the champion win-rate spread is wide.

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
