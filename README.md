# Pocket Tactics (working title)

A draft-and-deploy Pokémon tactics game: pick a Mythical champion and eight
Pokémon, deploy them with tiered Poké Balls, and assassinate the enemy champion on
a 7×10 board with randomized terrain and chest spawns. Movement is live; attacks
are declared and resolve together when the turn ends. Real Pokémon type matchups
(+1 super effective / −1 resisted). Two modes: vs. a heuristic AI rival, or two
players on one screen with live mirrored boards (plus a tabletop rotation mode).

Full design rationale and rules: [`docs/SPEC.md`](docs/SPEC.md).

## Run

```bash
npm install
npm run dev        # → http://localhost:5173
npm run build      # typecheck + production build → dist/
```

## Test

```bash
npx tsx scripts/smoke.ts   # headless engine tests + full AI-vs-AI games
```

## Structure

- `src/game/` — the headless simulation (no DOM): data, rules, actions, AI.
- `src/ui/` — React components: menu, draft, perspective-aware board, battle.
- All balance numbers live in `src/game/data.ts`.

Sprites load from the PokeAPI sprite repo (Gen 5 animated, with static and token
fallbacks); the roster is restricted to Gen 5 or earlier for that reason.
