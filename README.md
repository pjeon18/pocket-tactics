# Pocket Tactics

**Play: https://pjeon18.github.io/pocket-tactics/**

A draft-and-deploy Pokémon tactics game: draft a Mythical champion and a team of
Pokémon, deploy them with tiered Poké Balls, and assassinate the enemy champion on
a 7×10 board of seasonal grass, dirt roads, and tree cover. Movement is live;
attacks are declared and resolve together when the turn ends. Real type matchups
(+3 super effective / −2 resisted), TFT-style type synergies, crits/misses, field
item drops, and per-card redeploy cooldowns.

**Three ways to play:**
- **Vs. the Rival** — a heuristic AI opponent.
- **Two players, one screen** — live mirrored boards, plus a tabletop rotation mode.
- **Private online rooms** — share a code, connect peer-to-peer over WebRTC
  (Trystero); no server, no accounts. The host runs the authoritative engine.

Draft styles: **Classic** (pick your whole team up front) or **Blitz** (buy from a
5-card shop that restocks every turn — nothing is kept).

Full design rationale and rules: [`docs/SPEC.md`](docs/SPEC.md). Every unit, item,
and drop rate: [`docs/BALANCE.md`](docs/BALANCE.md) (auto-generated from the data).

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
