# Pocket Tactics — Master Handoff

The single catch-up doc: what the game is, every decision made, the numbers, and
the working style. For live per-Pokémon numbers see the auto-generated
[`BALANCE.md`](BALANCE.md) (`npx tsx scripts/balance-sheet.ts`). This doc is the
*why* and the *shape*; BALANCE.md is the *what*.

---

## 0. What it is & where it lives

A turn-based **Pokémon tactics game** for Paul Jeon (GitHub `pjeon18`), evolved
from a retired "Pocket Lanes" lane-auto-battler brainstorm. You draft a Mythical
**champion** + a team, deploy onto a grid, and **assassinate the enemy champion**.

- **Live:** https://pjeon18.github.io/pocket-tactics/ — auto-deploys on push to
  `main` (`.github/workflows/deploy.yml`, `BASE_PATH=/pocket-tactics/`).
- **Repo:** https://github.com/pjeon18/pocket-tactics (public). On the portfolio
  (`pjeon18/pauljeon` repo, `src/content/site.ts` card + `pocket-tactics.jpg`).
- **Source:** `assets/pocket-tactics/`. Dev port **5202**. Stack: **Vite + React 18
  + TypeScript**, hand-rolled CSS (no Tailwind), Trystero (WebRTC) for online.
- **Working title** — Paul knows a rename is open.

Push only when Paul asks; keychain token (`pjeon18`, repo+workflow scopes) makes
`git push` + the Pages API just work. Commits co-authored by the Claude model.

---

## 1. Core loop & the non-negotiable rules

Draft → deploy from your back two rows → **move live**, **declare attacks** (they
resolve together at End Turn with a telegraph) → KO the enemy champion. Rules that
are load-bearing and must not be broken:

1. **Champion-move lock:** if your champion moves, nothing else may move that turn,
   and vice-versa. Enforced in `rules.ts` (`canMoveNow`), not the UI.
2. **Deferred combat:** attacks are *declared* during your turn (telegraphed with
   lines/rings) and all land at End Turn via `resolveStep`. Movement is immediate.
3. **Move cap 3/turn** for non-champions; **free undo** until you declare an attack.
4. **Small-integer stats** (`HP_INFLATE = 3` on top of raw statlines; HP ~6–17,
   ATK 1–5). Never reintroduce big HP pools.
5. **Field cap 7** — you can never have more than 7 non-champion Pokémon out. This
   is the primary anti-clump lever (Paul's 13-Pokémon-wall problem).
6. **Simulation is headless** — nothing in `src/game/` touches the DOM.
7. **Gen ≤ 5 only** (dex ≤ 649) — the animated sprite set stops there.

---

## 2. The numbers (current, `src/game/data.ts`)

**Board:** 7 cols × 10 rows. Deploy zones = each side's back 2 rows. Terrain =
one mirrored 2-tile **tree** domino (impassable, blocks line of fire).

**Economy (deliberately slow — the anti-flood design):**
- Income **1 Poké Ball/turn, +1 every 5 rounds, capped at 2/turn** (`INCOME_CAP`).
- `POKE_CAP 8`. Great/Ultra Balls come **only from trading**: 3 Poké → 1 Great
  (cap 2), 6 Poké → 1 Ultra (cap 1). Trade buttons in the HUD.
- **Kill bounty:** every KO pays the killer **+1 Poké Ball** (`KILL_BOUNTY`) —
  rewards trading up and killing over turtling.
- Start: A opens with 2 Poké, B with 3 (second-player comp). Fatigue from round 20
  (both champions lose 1 HP/round so games must end).

**Deploy costs are multi-ball** (e.g. Snorlax = 1 Ultra + 2 Poké). Only weak
unevolved basics cost a single Poké Ball. **Cards are a permanent deck** —
deploying never consumes a card; it starts a **redeploy cooldown** (basics ~3
turns, up to ~8 for Ultra-tier). **Deploy time:** Poké-tier basics act the turn
they land; Great/Ultra-tier are `summoned` (wait one turn).

**Combat:**
- Real single-type chart, **+3 super effective / −2 resisted** (floor 1). Damage
  floats show "Super effective!" / "Not very effective…" subtext.
- **Normal attacks only** roll dice: `MISS_CHANCE 0.05`, `CRIT_CHANCE 0.10`,
  `CRIT_BONUS +2`. Specials never miss or crit.
- Stun = **blocks movement only** (a stunned unit can still attack in place).
- Most Pokémon **MOV 1**; only fast-natured ones get 2–3. Attacks fire in 8
  directions; allies + terrain block the ray.

**Movement doctrine + field cap together are the fix for turn-length/wall spam.**
Paul explicitly liked: field cap, economy cooling, kill bounty, anti-clump texture,
and *more incentive to invest in stronger Pokémon* (open question if fully solved).

---

## 3. Roster, champions, roles

**~60 Pokémon + 5 Mythical champions** (all Gen ≤ 5). Four **roles**: Tank
(high HP, MOV 1, fast charge), Dealer (frail, high burst, slow charge), Specialist
(long range, board-warping specials, slowest charge), Generalist (flexible/utility).

**Champions** (~8–9 HP, MOV 1, all obey the champion-move lock; ability on a
charge meter):
- **Mew** — Genesis: redeploy a fainted ally free.
- **Celebi** — Healing Wish: heal all your units 2.
- **Jirachi** — Doom Desire: once/game, 5 dmg in a 5-tile cross within 4.
- **Victini** — V-Create: your whole team +2 ATK/+2 MOV this turn.
- **Manaphy** — Surf: hits **every** Pokémon on the field for 3 (friend + foe).

Every "plain N damage" special was given a distinct identity (instant Extreme
Speed, risky High Jump Kick, multi-hit Rock Blast, Power Whip *pull*, Flame Charge
permanent self-buff, Night Daze KO-refund, phasing Shadow Balls, conditional
finishers). The live truth is the Effect column in BALANCE.md.

---

## 4. Type synergies (TFT-style)

Unlocks at **3 UNIQUE same-type Pokémon** (tier 1) and **5** (tier 2). **Champion
counts; duplicates do NOT** (spamming one cheap body can't cheat it — Paul's
explicit ask). Numeric bonuses double at tier 2. Twelve defined:

Blaze(fire +ATK), Torrent(water +MOV), Static(electric +crit%),
Mindlink(psychic +range), Photosynthesis(grass end-turn regen), Guts(normal +ATK
under half HP), Focus(fighting +special dmg), Bulwark(steel −dmg taken),
Frostbite(ice +dmg to stunned), Sturdy(rock crit-immunity), Ambush(dark +dmg to
full-HP), Swarm(bug double normal attack). Logic in `rules.ts`
(`synergyTier`, `tierOf`, `hasSynergy`); descriptions + `desc2` in `data.ts`.

---

## 5. Modes, draft styles, timer

- **Vs. Rival (AI):** heuristic opponent (`ai.ts`), single panel.
- **Two players, one screen:** live mirrored boards + a tabletop rotation mode.
- **Online private rooms:** WebRTC via **Trystero 0.25** (`src/net.ts`,
  `OnlineSetup.tsx`/`OnlineGame`). No server/accounts — share a room code. **Host
  = A runs the authoritative engine and broadcasts state; guest = B sends action
  intents.** All Battle actions funnel through a `run()` dispatch. NOTE: Trystero
  0.25 `makeAction` returns `{send, onMessage}`, NOT a tuple — this bit us once.
  Verified two-page handshake works. Online = classic-draft only.

**Draft styles:** **Classic** (pick champion + 10 up front) or **Blitz** (pick
champion only; a 5-card shop restocks every turn, you **deploy straight from the
shop and keep nothing**). Draft screen sorts by cost/atk/hp/range/**type** and
filters by role/ball-tier; **hold** a card for the full detail modal (pattern
diagrams via `PatternGrid`).

**Turn clock:** **60s/turn** (`TURN_SECONDS`, `?tt=<seconds>` URL override),
HUD countdown pulsing red under 10s, **auto-ends the turn at zero**. UI-layer
only — each client times the seat it controls (`controlsCurrent`), so it works in
all three modes. (Added after a 16-min/10-round 2P game.)

**Off-turn inspection:** click any Pokémon while it's NOT your turn → read-only
info card + threat range. (The old "Danger zone" button was removed for this.)

---

## 6. Items & field drops

A field Poké Ball spawns **every 4 rounds** (max 2), static (no bob). Walk a
Pokémon onto it for a weighted `DROPS` roll. Consumables: Potion(3)/Super(5)/Max
(full), Revive. Held (1 per Pokémon): Assault Vest(+2 HP), Life Orb(+1 all dmg),
Choice Scarf(+2 MOV), Choice Specs(+3 range) — Choice items + Power Herb are very
rare. Also Lum Berry (cure stun), and Great/Ultra Ball drops convert to currency.
Exact odds live in the Compendium (menu) and BALANCE.md.

---

## 7. UI / art / feel

Dark page, **white game surfaces**. **Inter** font, heavy weights ("game, not
book"). Square type-bordered draft cards. Board: **real overworld tiles** cut from
Paul's season sheets (`tiles-src/` → `scripts/crop-tiles.mjs`), 4 grass + 4 road
variants chosen per-cell by position hash (no tiled look), jagged grass-fringe road
edges, **trees** (not water) as obstacles, **4 seasonal palettes** random per
battle (`?season=` to pin). One board-wide `.grid-overlay` = perfectly aligned
gridlines that strengthen only when a unit is selected. **Move overlay is
translucent blue**, special amber, danger red (all see-through).

Juice: ball-open deploy animation, impact-shake on damage, attack lunge, KO
faint+cry, turn banner, **pixel-art red damage numbers**, WebGL cloud-shader mat
behind the board (from Paul's portfolio Sky shader), click-to-load Spotify corner
(PokéMAPs pattern), WebAudio sfx + PokeAPI cries with a volume slider. Champion
corner HUD cards (HP/KOs/deaths/balls); enemy deck shown as **hidden-until-deployed**
(`revealed`). Menu has How-to-play + Type-synergies side by side + a full
**Compendium** (every stat/ability/drop rate).

**Design taste (standing rule, `design-taste-no-ai-generic`):** editorial/
commercial sophistication, semantic-only color, no corny copy, no AI-generic UI.

---

## 8. Architecture & testing

`src/game/` headless engine: `types.ts`, `data.ts` (ALL tuning — one-stop),
`rules.ts` (movement/targeting/synergy), `actions.ts` (pure state transitions:
deploy/move/attack/plan/resolveStep/finishTurn/useItem/tradeBalls; `clone()` bumps
`tick`), `ai.ts`. `src/ui/` React: `Battle.tsx` (the big one — dispatch, timer,
online), `BoardView.tsx`, `Draft.tsx`, `ModeSelect.tsx`, `OnlineSetup.tsx`,
`Sprite/PatternGrid/Wave/SkyMat/sounds`.

**Base-path gotcha:** public assets MUST go through `import.meta.env.BASE_URL`
(tiles set inline in BoardView) — absolute `/tiles/...` breaks under the Pages
subpath. **Test:** `npx tsx scripts/smoke.ts` (rules, specials, synergy tiers, +
full AI-vs-AI games — currently all green). `npm run build` typechecks. Verify
visual changes in the browser (Playwright capture via `scripts/shot.mjs`).

---

## 9. History of decisions (why things are the way they are)

Paul iterates by **playing, then sending numbered feedback lists**. Major arcs:
genre shift from lanes → tactics; deferred combat + telegraph; small-int stats +
HP inflation; real type chart (later widened to +3/−2); crits/misses; TFT
synergies (later tiered + unique-only); permanent decks + cooldowns; slow
trade-up economy; 60-Pokémon roster with cheap basics; Blitz shop mode; seasonal
tiles + trees; online rooms; **the anti-wall pass** (field cap 7, income cap,
kill bounty) after a 13-Pokémon-stall game; turn clock + off-turn inspection.

---

## 10. Open / deferred

- **Balance from real playtests** — is "invest in stronger Pokémon" incentive
  strong enough, or does field cap alone solve the clump? Watch stun (many
  sources), and whether games still run long (lever: fatigue from round 12 vs 20).
- **A real name** (still "working title").
- **Smarter AI** (never moves its champion; simple heuristics).
- **Second synergy-tier tuning** just shipped — validate it feels good.
- Online: verified handshake + two-page test, but stress-test on two real devices.
