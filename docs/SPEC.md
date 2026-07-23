# Pocket Tactics — Design & Build Spec (v3)

**Working title.** This supersedes the "Pocket Lanes" spec entirely. v2 was a lane
auto-battler; v3 is a **draft-and-deploy tactics game** — Fire Emblem / chess with a
Clash-Royale-style deployment economy. There are no lanes anymore.

The one-sentence pitch: *draft eight Pokémon, protect your Mythical champion, and
assassinate the other one.*

---

## 1. Core model

| Concept | Value |
|---|---|
| Board | 7 columns × 10 rows, with mirrored terrain + chests (see §1b) |
| Deploy zones | each player's back 2 rows |
| Stat scale | small integers — HP 4–14, ATK 1–5 (readable "this hit KOs" math) |
| Win | knock out the enemy champion (fatigue from round 20 guarantees an ending) |
| Turn structure | full alternating turns (Player A phase → Player B phase) |

### A unit's turn — movement is live, damage is deferred
Movement happens **immediately** (it changes what you can attack). Attacks are
**declared** during the turn — shown as telegraph lines — and all land together
when the turn ends, played back one by one. Declared attacks can be cancelled any
time before End Turn; a declared attack whose target already fainted fizzles
(overkill risk is part of the planning game — a banked special survives a fizzle).

- **Move cap: up to 3 non-champion moves per turn** (`MOVE_CAP`). Attacks are
  uncapped — movement is the buildup, attacking is the payoff.
- **Undo:** a moved unit can return to its origin tile free (mis-press insurance)
  until it declares an attack or opens a chest. Undo refunds the move.
- **The champion rule:** if the champion moves, no other unit may move that turn —
  and once any other unit has moved, the champion may not.
- Instant-vs-deferred rule of thumb: **damage defers, support is instant** (heals,
  V-Create, Mew's revive apply immediately so they affect this turn).

### Attacking
Attacks project along the **8 directions** (orthogonal + diagonal) out to `RNG`
tiles. The first unit **or rock** on a ray blocks it — allies and terrain
body-block lines of fire. Exceptions are explicit special-move properties
(`ignoreBlock`, range overrides).

### Type chart (real matchups)
Every Pokémon has its real (primary) type; 14 types are present. The real Pokémon
effectiveness chart applies, simplified to single types: **super effective = +1
damage, resisted/immune = −1, floor 1**, on every damage source. Damage floats show
`!` on super-effective hits. This is the draft's strategic layer.

### Charge & specials
Every unit gains +1 charge pip at the end of its owner's turn. At full charge its
signature special becomes available — use it now or bank it. Tanks charge in 2
turns, Generalists 3, Dealers 4, Specialists 5. Specials reset charge to 0. Stun
and knockback never affect champions.

### Status
- **Summoned:** a freshly deployed unit can't move or act until next turn.
- **Stunned:** skips its next turn entirely; clears at the end of that turn.
- **Buffs** (V-Create, X Attack): last until the end of the owner's turn — they DO
  apply to that turn's deferred attacks.

## 1b. Variance (Paul's chosen RNG layers)

- **Terrain:** each game generates 2 mirrored pairs of rocks in the middle rows
  (180°-rotational symmetry, so the map is fair). Rocks block movement and lines
  of fire — chokepoints and flanks differ every game.
- **Field Poké Balls:** from round 2, a Poké Ball may spawn on a random empty
  mid-board tile (60%/round, max 2). Move onto it to open — it drops an **item**
  into your inventory: Potion (heal 3), Revive (return a fainted Pokémon), or an
  attachable held item — Assault Vest (+2 max HP) or Life Orb (+1 to all damage
  dealt). Items are free to use on your turn; one held item per Pokémon. Pickups
  can't be undone. Rendered with the real item sprites.
- **Crits & misses — normal attacks only:** 5% miss, 10% crit (+2 dmg). Specials
  never roll. (Paul explicitly chose this small dice layer in iteration 3.)
- **Fatigue:** from round 20 both champions lose 1 HP per round — stalling is a
  losing strategy and every game ends.

## 1c. Type synergies (TFT-style)

Fielding **3 Pokémon of one type** (your champion counts) activates that type's
synergy for those Pokémon: Fire *Blaze* +1 ATK · Water *Torrent* +1 MOV ·
Electric *Static* 2× crit chance · Psychic *Mindlink* +1 range · Grass
*Photosynthesis* heal 1/turn · Normal *Guts* +1 ATK below half HP · Fighting
*Focus* +1 special damage · Steel *Bulwark* take 1 less damage. The tracker in
the battle HUD shows progress (e.g. FIRE 2/3). Champions' types make champion
choice part of the synergy plan.

---

## 2. Economy — slow income, trading up, permanent decks (iteration 4)

- **Income:** 1 Poké Ball per turn, **+1 more per turn every 5 rounds** (rounds
  6–10 pay 2/turn, 11–15 pay 3/turn, …). Cap 8. A opens with 2, B with 3.
- **Great/Ultra Balls come ONLY from trading:** buttons in the HUD swap
  **3 Poké → 1 Great** and **6 Poké → 1 Ultra** (caps 2 / 1). Free action.
- **Mixed costs:** a Pokémon may cost several balls of several tiers (e.g.
  Snorlax = 1 Ultra + 2 Poké; Gallade = 1 Great + 2 Poké). Only weak unevolved
  basics cost a single Poké Ball.
- **Cards are never consumed.** Your drafted 8 are a permanent deck; deploying a
  card starts a **redeploy cooldown** (basics 1 turn, mid picks 2, Great-tier
  3–4, Ultra-tier 5), shown as a countdown on the bench card. Duplicates on the
  field are legal if you can pay twice.

---

## 3. Roles

Roles carry stat identity; the real type chart (§1) carries matchup strategy. The
invented Assault/Tech/Guard triangle from the lane era stays dead.

| Role | Profile | Charge |
|---|---|---|
| Tank | 9–14 HP, ATK 2–3, RNG 1, MOV 1 | 2 |
| Dealer | 4–8 HP, ATK 3–5, MOV 2–3 | 4 |
| Specialist | 5–6 HP, RNG 2–3, MOV 1, board-warping specials | 5 |
| Generalist | 4–9 HP, mid everything, utility specials | 3 |

Roster: **38 Pokémon**, all Gen 5 or earlier (the animated-sprite constraint),
with cheap unevolved basics (Sunkern, Starly, Croagunk, Pikachu, Abra, Ferroseed
at 1 Poké Ball, deliberately weak specials) below the pricier evolved picks.
**Movement doctrine (iteration 4): most Pokémon move 1 tile; only the
fast-natured (Scyther, Weavile, Starly, Arcanine at 3; a dozen others at 2)
move farther.** HP is inflated +3 across the board (`HP_INFLATE`) to fix the
attack/HP ratio. Stats and specials live in `src/game/data.ts`.

---

## 4. Champions — the four Mythicals

~8–9 HP, ATK 1–2, MOV 1, all bound by the champion movement rule. Abilities use the
same charge-pip system as specials, with per-champion charge speeds:

| Champion | Charge | Ability |
|---|---|---|
| Celebi | 4 | **Healing Wish** — heal all your units 2 |
| Victini | 5 | **V-Create** — all your units +2 ATK / +2 MOV this turn |
| Mew | 6 | **Genesis** — redeploy one fainted ally to your deploy rows, free |
| Jirachi | 6, once/game | **Doom Desire** — 5 dmg in a 5-tile cross, anywhere within 4 tiles |

---

## 5. Draft

Before battle each player picks **1 champion + 8 roster Pokémon**. AI opponent
auto-drafts a curve (1 ultra / ~3 great / rest poké). In local mode, Player 1
drafts, a pass-the-screen interstitial, then Player 2.

---

## 6. Modes

- **Vs. Rival (AI):** single panel, player = A. The AI plays greedy heuristics:
  deploy best affordable near the threat column → fire clearly-good abilities →
  best move+attack activation per step (damage, KO bonus, ×2.2 champion weighting,
  advance-toward-champion). AI never moves its champion. Steps play at ~620 ms so
  turns are readable. Deliberately beatable; smarter AI is roadmap.
- **Two players, one screen:** both panels rendered **simultaneously and mirrored**
  — each panel draws the board from its owner's perspective (180° coordinate flip)
  with its own bench, economy, and End Turn. Only the active player's panel accepts
  input; the other dims. **Tabletop mode** additionally CSS-rotates Player 2's
  panel 180° for face-to-face play on a flat device. Local 2P is the intended
  substitute for the AI's current skill level.

---

## 7. UX rules

- Tap your unit → green move tiles + red rings on attackable enemies; tap a tile to
  move (stays selected), tap an enemy to **declare** an attack. Declared attacks
  draw dashed telegraph lines (red normal, amber special) and can be cancelled.
  A moved unit shows its origin tile outlined — tap it (or "Undo move") to return.
- Charged unit → amber "Use <special>" button; enemy-target specials enter amber
  targeting; tile/ally/revive specials highlight their legal targets; AOE specials
  confirm on press.
- **Tap an enemy → its full threat range** (move ∪ attack) paints red.
- **Pattern diagrams** (the UI's signature): every Pokémon has chess-manual-style
  7×7 glyphs — green move diamond, red attack-ray dots, amber special shape —
  shown in the draft detail popup and the in-battle info card (`PatternGrid.tsx`).
- Draft: one filterable grid (role / ball tier / sort by cost·ATK·HP), cards tinted
  by type color; clicking any card opens the full detail popup with stats,
  special text, and both diagrams.
- Floating damage/heal numbers (`!` = super effective); HP as a number chip; charge
  pips under each unit; moves-left pips in the panel head; spent/summoned/stunned
  units dim.
- Sprites: Gen 5 animated (back sprites for your own side), falling back to static,
  then a type-colored token.

Visual language (iteration 3, per Paul): **dark page, white game surfaces** — the
board/panels are bright cards floating on near-black `#15181D`. Game-feel
typography: **M PLUS Rounded 1c everywhere, heavy weights (700–900), big sizes**
— "this is a game, not a book." Color is semantic: type colors, green = movement,
red = threat + the primary End Turn button, amber = special/charge/active-turn.
Draft cards are **square (no radius) with thick 4px type-colored borders**.
Real sprites for Poké Balls and items (PokeAPI `items/` sprites). Battle layout
(solo): bench rail on the LEFT (cheapest at bottom) · board center · right panel
with turn/time/moves/ball HUD, synergy tracker, unit info card, inventory,
battle stats (captured pieces chess-style, losses, top damage dealers), End Turn.
Transitions: draft → battle plays a three-ball "1·2·3·GO" intro; units pop on
deploy; field balls bob.

---

## 8. Architecture

Vite + React 18 + TypeScript, hand-rolled CSS tokens (no Tailwind — fewer deps).
The simulation is **headless** — `src/game/*` never touches the DOM:

```
src/game/  types.ts  data.ts (roster/champions/tuning)  rules.ts (movement,
           targeting, threat)  actions.ts (deploy/move/attack/abilities/endTurn —
           pure: state in, new state out)  ai.ts (draft + aiStep)
src/ui/    Sprite  ModeSelect  Draft  BoardView (perspective-aware)  Battle
scripts/smoke.ts — headless rules/specials/abilities tests + full AI-vs-AI games
```

Run tests: `npx tsx scripts/smoke.ts`.

---

## 9. Balance notes

AI-vs-AI games finish in 13–31 rounds with both sides winning. Open questions: is
stun (4 sources) too oppressive; do Specialists survive to a 5-pip special; is the
+1/−1 type swing enough to steer drafting; Hydro Pump is enemies-only (full
friendly-fire is the spicier variant — revisit); Blaziken's Blaze Kick lost its
"move again" rider in the deferred-combat change and needs a new twist.

## 10. Roadmap (deliberately deferred)

1. Smarter AI — champion self-preservation, focus fire, special timing, lookahead.
2. Buyable items (chests exist; buying with Poké Balls doesn't yet).
3. Roster growth toward 40 + draft bans/alternating picks in local mode.
4. Online or BroadcastChannel two-tab play.
5. A real name. "Pocket Tactics" is a placeholder — there are no lanes left.
