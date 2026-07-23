# CLAUDE.md — Pocket Tactics

Working context for this project. Read `docs/SPEC.md` before changing rules or
balance — it is the source of truth and supersedes the old "Pocket Lanes" spec
(`~/Downloads/pocket-lanes-spec.md` / `pocket-lanes-v2.jsx`, which describe the
retired lane auto-battler design).

## What this is
A **tactics game**, not a lane game: 7×10 board with mirrored terrain rocks and
chest spawns, draft 1 Mythical champion + 8 of 24 Pokémon, deploy with tiered
balls (Poké/Great/Ultra), movement is live but **damage is deferred** — attacks
are declared (telegraphed) and all resolve at End Turn. Real single-type Pokémon
matchups (+1/−1). KO the enemy champion to win; champion fatigue from round 20.
Two modes: vs AI, and local 2P with simultaneous mirrored panels + tabletop
rotation.

## Non-negotiable rules (flag before "fixing")
- **Damage defers, support is instant.** Attacks/AOE/Jirachi plan via
  `planAttack`/`planArea` and fire in `resolveStep`; heals/buffs/revive are
  instant via `useAbility`. Don't collapse the two paths.
- **Move cap**: 3 non-champion moves per turn (`MOVE_CAP`), attacks uncapped.
- **Undo is free** until an attack is declared or a chest is opened.
- **Champion movement lock**: champion moves ⇒ nothing else moves that turn, and
  vice versa. Enforced in `rules.ts:canMoveNow`, not the UI.
- **Variance layers are Paul's picks**: terrain, field-ball item drops, and a
  small hit-roll on NORMAL attacks only (5% miss / 10% crit +2). Specials never
  roll. Don't add more dice without asking.
- **Type synergies**: 3 same-type fielded (champion counts) = that type's buff
  (`SYNERGIES` in data.ts, helpers in rules.ts). Keep buffs computed, not stored.
- **Items are free actions**; one held item per Pokémon; `useItem` in actions.ts.
- **Small-integer stats** (HP 6–17 after `HP_INFLATE`, ATK 1–5).
- **Economy (iteration 4)**: 1 ball/turn +1 per 5 rounds; Great/Ultra ONLY via
  the trade buttons (3→Great, 6→Ultra); mixed multi-ball costs; **cards are a
  permanent deck with redeploy cooldowns** — never consume bench cards.
- **Most Pokémon move 1 tile** — only fast-natured ones get MOV 2–3.
- **Champions immune to stun & knockback.**
- **Roster is Gen ≤ 5 only** (dex ≤ 649) — the animated sprite set stops there.
- **UI direction (iteration 3)**: dark page, WHITE game surfaces, M PLUS Rounded
  1c at heavy weights ("game, not book"), square thick-type-bordered draft cards,
  real ball/item sprites, semantic color. Don't quietly revert any of these.
- Simulation stays **headless** — nothing in `src/game/` may touch the DOM.
- Moving is optional; never auto-act the player's units.

## Layout
- `src/game/data.ts` — every tuning number, roster, champions. Balance passes
  happen here only.
- `src/game/actions.ts` — pure state transitions (clone → mutate → return).
  Specials resolve in `resolveEnemySpecial` / `useAbility`.
- `src/game/ai.ts` — draft + `aiStep` (one action per call; null = end turn).
- `src/ui/BoardView.tsx` — perspective-aware rendering (Player B sees the board
  rotated 180° via coordinate flip, not CSS).
- `scripts/smoke.ts` — run `npx tsx scripts/smoke.ts` after any engine change.

## Verify before done
`npm run build` (includes tsc), `npx tsx scripts/smoke.ts`, and check both modes in
the browser. Dev server port 5202 via the assets/.claude/launch.json entry.

## Iteration 10 addenda (2026-07-23, same day)
Field art finalized from Paul's new Desktop sheets (seasons.png etc., sources
kept in `public/tiles/`): 4 organic grass variants + 4 road variants chosen per
cell by position hash (NO tiled repetition), dirt deploy roads with jagged
grass-fringe edge tiles (composited in `scripts/crop-tiles.mjs`-style sharp
work), and **water obstacles replaced by trees** (transparent tree sprite on a
grass cell, canopy overhangs). **Blitz reworked: you never keep a card** — shop
cards deploy STRAIGHT to the field (pay at deploy, card leaves the shop, full
shop rerolls every turn); no bench exists in blitz; `buyCard` removed.

## Iteration 9 addenda (2026-07-23, same day)
Real Gen-5/3 overworld tiles: grass field, sand deploy paths, water obstacles —
cropped from Paul's tile sheets into `public/tiles/` via `scripts/crop-tiles.mjs`
(sharp devDep). Gridlines strengthen only while commanding. Enemy intel rail is a
single-column list (revealed cards clickable → info). Info panel is FIXED at
208px (`.actionbar`) so selection never shifts layout; clicking any card (bench /
shop / revealed enemy) shows a SpeciesInfo datasheet. Synergy trackers moved:
enemy's on the left rail, yours under the board; full `SynergyLegend` on the
menu + draft. Big YOUR-MOVE pill removed (small status line instead). **Deploy
time**: Poké-tier basics act immediately; Great/Ultra-tier keep summoning
sickness. All 18 proposed specials implemented (instant Extreme Speed via
`meta.instant`, HJK risk-miss, Rock Blast multi-hit, Power Whip pull, Flame
Charge permanent +1 MOV, Night Daze charge refund, phasing Shadow Balls, etc.) —
BALANCE.md now also carries Items + drop-rate tables and is the living master
doc. **Blitz draft mode** (`shopMode`): champion-only pre-pick, empty deck, a
5-card shop rerolls each turn (price band grows with round), buying adds to the
deck, deploys are free; AI buys greedily. Menu has the Classic/Blitz toggle.

## Iteration 8 addenda (2026-07-23, same day)
Volume slider (master gain in `sounds.ts`). Combined HP|ATK stat chip on tiles.
PokeSprite pixel icons for all balls/items. New items: Super/Max Potion moved in
iter 7; now Choice Scarf (+2 MOV), Choice Specs (+3 RNG), Power Herb (instant
charge), Lum Berry (cure stun) — choice items/herb VERY rare in `DROPS`.
60-Pokémon roster: bugs Metapod/Escavalier/Accelgor with **Swarm** synergy
(bug normal attacks strike twice), Primeape, Tangrowth, Serperior, Rotom-Mow.
**Manaphy** is the 5th champion — Surf hits EVERY other unit (friendly fire).
Pikachu P2, Magneton P3, Krookodile/Blaziken +2 cost +1 HP. **DRAFT_SIZE 10.**
Cooldowns lengthened ~2×: basics 3, mid 4, great 6, ultra 8. Grass-field board
(pixel SVG texture) with WATER dominoes as terrain; gridlines strengthen only
while commanding (`board-selecting`). Pixel damage floats (Press Start 2P, all
damage red). Solo layout: enemy intel rail LEFT (champion HUD card + deck hidden
as "?" until first deploy → `PlayerState.revealed`), your champion HUD + bench
grid RIGHT. ActionBar shows the selected sprite. Premium button styling.

## Iteration 7 addenda (2026-07-23, same day)
Sky-shader mat behind the field (`src/ui/SkyMat.tsx` — the portfolio site's
volumetric cloud shader, time-of-day palettes, `?sky=noon|sunset|night` to pin,
gradient fallback); click-to-load Spotify corner (PokéMAPs pattern, same
playlist). Field drops: static (no bob), spawn every 4 rounds (`CHEST_EVERY`),
weighted `DROPS` table incl. Great/Ultra Ball (instant currency), Super Potion
(5), Max Potion (full). Lillipup added (Pickup: +2 Poké Balls, instant).
Terrain now spawns as touching DOMINOES (one 2-tile cluster + its mirror).
**`docs/BALANCE.md`** is the master sheet — regenerate with
`npx tsx scripts/balance-sheet.ts` after any data change; its "Proposed cooler
specials" section holds the approved-pending brainstorm. Online 2P: agreed
approach is WebRTC + room codes (PeerJS/Trystero, serverless) — not built yet.

## Iteration 6 addenda (2026-07-23, same day)
Type mods are now **+3 super effective / −2 resisted** (`TYPE_STRONG_BONUS`) —
matchups dominate, deliberately. B's compensation is back to +1 Poké Ball.
52-Pokémon roster (added Vulpix, Ponyta, Squirtle, Golem, Rhyperior, Gyarados,
Gengar, Machamp, Poochyena, Umbreon, Houndoom, Zoroark) with two new synergies:
**Rock · Sturdy** (can't be crit) and **Dark · Ambush** (+1 vs full-HP targets).
2P waiting panel no longer dims. Board sits on a dark mat with a 5px black
perimeter and a visible midline; on-tile chips smaller, charge pips in a white
pill.

## Known state (2026-07-23, fifth iteration)
Everything from iterations 1–4 plus: **stun now blocks movement only (stunned
Pokémon can still attack)**; escalating champion fatigue (healers can't stall);
B's compensation = a free Great Ball; 40-Pokémon roster (Audino/Chansey healers);
movement nerfs (croagunk/hitmonlee/krookodile/espeon → MOV 1); Abra cooldown 2;
draft sort by range. Juice layer: sounds (PokeAPI cries + WebAudio sfx, mute in
toolbar), attack lunge (`state.acting`), faint drop-and-fade ghosts, turn-banner
sweep, danger-zone toggle, per-attack log lines (latest bold), end-of-game
summary card. Look: **Inter everywhere**, pure-white tiles, solid-black terrain
tiles, team-blue/red unit tiles + always-gold champion tiles, giant STUN tag,
chunky saturated trade buttons, bold outlined damage floats. Not built: AI
item/blink usage, AI synergy drafting, smarter AI, repo + Pages deploy (ask
Paul). Next session should be playtesting/tuning, not new systems.
