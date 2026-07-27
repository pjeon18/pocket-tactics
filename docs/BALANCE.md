# Pocket Tactics — Balance Master Sheet

_Generated from `src/game/data.ts` by `scripts/balance-sheet.ts` — do not edit the tables by hand._

**Roster: 62 Pokémon + 5 champions.** Cost letters: P = Poké Ball, G = Great Ball, U = Ultra Ball. Equiv = total value in Poké Balls (G=3, U=6).

## Every Pokémon

| Pokémon | Role | Type | Cost | Equiv | CD | HP | ATK | RNG | MOV | Charge | Special | Effect |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Abra | generalist | Psychic | 1P | 1 | 7 | 5 | 1 | 3 | 1 | 2 | Teleport | Right away: hop to any empty tile within 3 |
| Croagunk | dealer | Fighting | 1P | 1 | 6 | 7 | 2 | 1 | 1 | 3 | Sucker Punch | 4 dmg, +2 against targets still at full HP |
| Ferroseed | tank | Steel | 1P | 1 | 6 | 9 | 1 | 1 | 1 | 2 | Iron Defense | Restore 2 HP to itself, right away |
| Lillipup | generalist | Normal | 1P | 1 | 6 | 6 | 2 | 1 | 2 | 2 | Pickup | Scrounges up a Poké Ball, right away |
| Poochyena | dealer | Dark | 1P | 1 | 6 | 6 | 2 | 1 | 2 | 3 | Roar | 2 dmg and shoves the target back 2 tiles |
| Squirtle | tank | Water | 1P | 1 | 6 | 9 | 1 | 1 | 1 | 2 | Withdraw | Restore 2 HP to itself, right away |
| Sunkern | generalist | Grass | 1P | 1 | 6 | 6 | 1 | 1 | 1 | 2 | Ingrain | Restore 2 HP to itself, right away |
| Vulpix | generalist | Fire | 1P | 1 | 6 | 6 | 2 | 2 | 1 | 2 | Ember | 2 dmg, and the flame licks the tile behind for 1 |
| Audino | generalist | Normal | 2P | 2 | 7 | 11 | 1 | 1 | 1 | 3 | Refresh | Restore 3 HP to an ally within 2 tiles, right away |
| Grotle | tank | Grass | 2P | 2 | 7 | 13 | 2 | 1 | 1 | 2 | Synthesis | Restore 4 HP to itself, right away |
| Kirlia | generalist | Psychic | 2P | 2 | 7 | 8 | 2 | 3 | 1 | 3 | Heal Pulse | Restore 4 HP to an ally within 2 tiles, right away |
| Metapod | tank | Bug | 2P | 2 | 7 | 16 | 1 | 1 | 1 | 2 | Harden | Restore 4 HP to itself, right away — it does nothing else, magnificently |
| Onix | tank | Rock | 2P | 2 | 7 | 12 | 2 | 1 | 1 | 4 | Bind | 2 dmg and the target is stunned — it can’t move next turn |
| Pikachu | generalist | Electric | 2P | 2 | 6 | 7 | 2 | 2 | 2 | 3 | Thunder Wave | 1 dmg and the target is stunned — it can’t move next turn |
| Starly | dealer | Normal | 2P | 2 | 6 | 6 | 2 | 1 | 3 | 3 | Fly-by | 3 dmg, then Starly darts 2 tiles back |
| Haunter | dealer | Ghost | 3P | 3 | 7 | 7 | 3 | 2 | 2 | 4 | Shadow Ball | 4 dmg that phases straight through blockers |
| Hitmonlee | dealer | Fighting | 3P | 3 | 7 | 8 | 3 | 1 | 1 | 4 | High Jump Kick | 8 dmg — but 25% chance to crash, miss, and take 2 itself |
| Jynx | specialist | Ice | 3P | 3 | 7 | 7 | 3 | 3 | 1 | 4 | Lovely Kiss | 2 dmg and the target is stunned — it can’t move next turn |
| Magneton | specialist | Electric | 3P | 3 | 7 | 8 | 2 | 3 | 1 | 5 | Zap Cannon | 4 dmg and the target is stunned — it can’t move next turn |
| Ponyta | dealer | Fire | 3P | 3 | 7 | 8 | 3 | 1 | 3 | 3 | Flame Charge | 3 dmg, and Ponyta permanently gains +1 movement |
| Porygon2 | specialist | Normal | 3P | 3 | 7 | 9 | 3 | 2 | 1 | 5 | Tri Attack | 3 dmg, piercing on to enemies up to 2 tiles behind the target |
| Quagsire | tank | Water | 3P | 3 | 7 | 13 | 2 | 1 | 1 | 2 | Muddy Water | 3 dmg and washes the target back a tile |
| Accelgor | dealer | Bug | 1G+1P | 4 | 6 | 8 | 4 | 1 | 3 | 4 | U-turn | 4 dmg, then Accelgor slips 2 tiles back |
| Beartic | tank | Ice | 1G+1P | 4 | 6 | 14 | 3 | 1 | 1 | 2 | Icicle Crash | 4 dmg, +2 if the target is stunned |
| Bronzong | tank | Steel | 1G+1P | 4 | 6 | 14 | 2 | 1 | 1 | 2 | Hypnosis | 1 dmg at range 2 and the target is stunned — it can’t move next turn |
| Carracosta | tank | Water | 1G+1P | 4 | 6 | 14 | 3 | 1 | 1 | 2 | Shell Smash | Right away: +2 ATK and +2 movement this turn |
| Chansey | generalist | Normal | 1G+1P | 4 | 6 | 17 | 1 | 1 | 1 | 3 | Soft-Boiled | Restore 5 HP to an ally within 2 tiles, right away |
| Espeon | specialist | Psychic | 1G+1P | 4 | 6 | 9 | 3 | 3 | 1 | 4 | Psyshock | 4 dmg and hurls the target back 2 tiles |
| Ferrothorn | tank | Steel | 1G+1P | 4 | 6 | 15 | 2 | 1 | 1 | 2 | Power Whip | 4 dmg and drags the target adjacent to Ferrothorn |
| Gigalith | tank | Rock | 4P | 4 | 6 | 14 | 2 | 1 | 1 | 2 | Rock Slide | 3 dmg, plus 2 to every enemy beside the target |
| Golem | tank | Rock | 1G+1P | 4 | 6 | 15 | 3 | 1 | 1 | 2 | Rock Blast | 2 dmg, hitting 2–4 times |
| Houndoom | dealer | Dark | 1G+1P | 4 | 6 | 9 | 4 | 2 | 2 | 4 | Dark Pulse | 4 dmg, piercing on for 3 into the tile behind |
| Lucario | generalist | Fighting | 1G+1P | 4 | 6 | 10 | 3 | 2 | 3 | 3 | Aura Sphere | 4 dmg to any enemy within 3 tiles — never blocked |
| Luxray | dealer | Electric | 1G+1P | 4 | 6 | 9 | 4 | 1 | 2 | 4 | Wild Charge | 6 dmg, but Luxray takes 1 recoil |
| Magmortar | specialist | Fire | 1G+1P | 4 | 6 | 10 | 3 | 3 | 1 | 4 | Lava Plume | 3 dmg, plus 2 to every enemy beside the target |
| Primeape | dealer | Fighting | 4P | 4 | 4 | 9 | 4 | 1 | 2 | 4 | Karate Chop | A furious 6 dmg blow |
| Rotom-Mow | specialist | Grass | 1G+1P | 4 | 6 | 9 | 3 | 2 | 1 | 5 | Razor Leaf | 3 dmg, plus 2 to every enemy beside the target |
| Rotom-Wash | specialist | Water | 1G+1P | 4 | 6 | 9 | 3 | 2 | 1 | 5 | Hydro Pump | 3 dmg to EVERY enemy in the target’s column |
| Scyther | dealer | Bug | 4P | 4 | 4 | 8 | 4 | 1 | 3 | 4 | X-Scissor | Slashes twice for 3 dmg each |
| Umbreon | tank | Dark | 1G+1P | 4 | 6 | 14 | 2 | 1 | 1 | 2 | Snarl | 3 dmg, and Umbreon heals itself 2 |
| Weavile | dealer | Ice | 1G+1P | 4 | 6 | 8 | 4 | 1 | 3 | 4 | Ice Shard | 4 dmg, then Weavile retreats 2 tiles |
| Arcanine | dealer | Fire | 1G+2P | 5 | 7 | 11 | 4 | 1 | 3 | 4 | Extreme Speed | 4 dmg that lands INSTANTLY when declared |
| Chandelure | specialist | Fire | 1G+2P | 5 | 6 | 10 | 3 | 3 | 1 | 4 | Heat Wave | 3 dmg to every enemy within 2 tiles of Chandelure |
| Drifblim | tank | Ghost | 1G+2P | 5 | 6 | 13 | 2 | 3 | 1 | 3 | Ominous Wind | 4 dmg at range that phases through blockers, and Drifblim heals itself 2 |
| Escavalier | tank | Bug | 1G+2P | 5 | 6 | 14 | 3 | 1 | 1 | 4 | Megahorn | 5 dmg, lancing through the two tiles behind for 3 — its NORMAL attacks skewer the unit behind, too |
| Gallade | dealer | Fighting | 1G+2P | 5 | 6 | 10 | 4 | 1 | 2 | 4 | Psycho Cut | 4 dmg, cutting through to whatever hides behind for 3 |
| Lapras | tank | Water | 1G+2P | 5 | 7 | 15 | 2 | 2 | 1 | 2 | Surf | 3 dmg, plus 2 to every enemy beside the target |
| Zoroark | dealer | Dark | 1G+2P | 5 | 6 | 10 | 4 | 1 | 3 | 4 | Night Daze | 5 dmg — a KO refunds the full charge |
| Blaziken | generalist | Fire | 1G+3P | 6 | 6 | 12 | 3 | 1 | 3 | 3 | Blaze Kick | 4 dmg, a guaranteed CRIT against full-HP targets |
| Krookodile | generalist | Dark | 1G+3P | 6 | 6 | 12 | 3 | 1 | 1 | 3 | Crunch | Crunch — 5 dmg, +5 more if the target is below half HP |
| Steelix | tank | Steel | 1U | 6 | 8 | 17 | 3 | 1 | 1 | 2 | Iron Tail | 4 dmg and knocks the target back a tile |
| Alakazam | specialist | Psychic | 1U+2P | 8 | 8 | 9 | 4 | 3 | 1 | 3 | Psychic | 6 dmg and hurls the target back 2 tiles |
| Dragonite | generalist | Dragon | 1U+2P | 8 | 8 | 15 | 4 | 2 | 2 | 3 | Hyper Beam | 6 dmg to the first enemy in a straight line, any distance |
| Gengar | dealer | Ghost | 1U+2P | 8 | 8 | 10 | 5 | 2 | 3 | 3 | Shadow Ball | Shadow Ball — 6 dmg through blockers, +4 against a full-HP target |
| Machamp | dealer | Fighting | 1U+2P | 8 | 8 | 14 | 5 | 1 | 2 | 3 | Cross Chop | 6 dmg and knocks the target back a tile |
| Mamoswine | dealer | Ice | 1U+2P | 8 | 8 | 14 | 6 | 1 | 1 | 3 | Icicle Spear | Strikes 1–4 times for 4 each — 100% / 75% / 50% / 25% per hit |
| Rhyperior | tank | Rock | 1U+2P | 8 | 8 | 17 | 4 | 1 | 1 | 2 | Rock Wrecker | 6 dmg and knocks the target back a tile |
| Serperior | dealer | Grass | 1U+2P | 8 | 8 | 12 | 4 | 2 | 2 | 3 | Leaf Storm | A regal tempest: 6 dmg, plus 2 to every enemy beside the target |
| Snorlax | tank | Normal | 1U+2P | 8 | 8 | 20 | 3 | 1 | 1 | 2 | Body Slam | 5 dmg and the target is stunned — it can’t move next turn |
| Tangrowth | tank | Grass | 1U+2P | 8 | 8 | 18 | 3 | 2 | 1 | 2 | Giga Drain | 6 dmg, and Tangrowth drinks 2 HP back |
| Garchomp | dealer | Dragon | 1U+3P | 9 | 8 | 13 | 6 | 1 | 2 | 3 | Earthquake | 6 dmg to every enemy in the 8 tiles around Garchomp |
| Gyarados | dealer | Water | 1U+3P | 9 | 8 | 13 | 5 | 1 | 2 | 3 | Dragon Rage | 6 dmg and hurls the target back 2 tiles |

## Champions

| Champion | Type | HP | ATK | RNG | MOV | Charge | Ability | Effect |
|---|---|---|---|---|---|---|---|---|
| Mew | Psychic | 12 | 2 | 1 | 1 | 6 | Genesis | Bring one of your fainted Pokémon back onto your deploy rows, free |
| Celebi | Grass | 11 | 1 | 1 | 1 | 4 | Healing Wish | Restore 3 HP to every one of your Pokémon, right away |
| Jirachi | Steel | 11 | 1 | 2 | 1 | 5 | Doom Desire | A meteor deals 5 dmg in a cross of 5 tiles, anywhere within 5 tiles |
| Victini | Fire | 12 | 2 | 1 | 1 | 5 | V-Create | This turn, every one of your Pokémon gets +2 attack and +2 movement, right away |
| Manaphy | Water | 12 | 1 | 2 | 1 | 6 | Surf | A tidal wave hits every Pokémon outside her own back two rows for 4 — friend and foe alike |

## Legendary summons

Drafted 2 per player (classic and blitz). One-shot battlefield effects cast for Poké Balls — never fielded, once per game each.

| Summon | Cost | Effect |
|---|---|---|
| Ho-Oh | 6P | Sacred Fire — every Pokémon you have fielded gains +3 max HP, right away |
| Lugia | 6P | Aeroblast — next turn your opponent can neither move nor deploy |
| Dialga | 6P | Roar of Time — every one of your Pokémon gets its special fully charged |
| Palkia | 6P | Spacial Rend — all of your Pokémon have 5 movement this turn |
| Kyogre | 4P | Origin Pulse — mark a 3×3 whirlpool; at the end of the round it hits everything still inside for 4 (water). Opponents can flee it on their turn. |
| Groudon | 4P | Precipice Blades — choose a row; at the end of your turn it erupts for 6 to everyone standing on it. |

## Distributions

### By type (unique species only — champion types add to the count in play)

| Type | Roster count | Synergy defined | Tiers at |
|---|---|---|---|
| Water | 6 | ✓ Torrent | 3 / 5 |
| Normal | 6 | ✓ Payday | 2 / 4 |
| Fighting | 6 | ✓ Focus | 3 / 5 |
| Fire | 6 | ✓ Blaze | 3 / 5 |
| Grass | 5 | ✓ Photosynthesis | 3 / 5 |
| Dark | 5 | ✓ Ambush | 3 / 5 |
| Rock | 4 | ✓ Sturdy | 3 / 5 |
| Steel | 4 | ✓ Bulwark | 3 / 5 |
| Ice | 4 | ✓ Frostbite | 3 / 5 |
| Bug | 4 | ✓ Swarm | 3 / 5 |
| Psychic | 4 | ✓ Mindlink | 3 / 5 |
| Ghost | 3 | — | — |
| Electric | 3 | ✓ Static | 3 / 5 |
| Dragon | 2 | — | — |

### By role

| Role | Count |
|---|---|
| dealer | 21 |
| tank | 20 |
| generalist | 12 |
| specialist | 9 |

### Cost curve (equiv Poké Balls)

| Equiv cost | Count | Who |
|---|---|---|
| 1 | 8 | Ferroseed, Squirtle, Croagunk, Poochyena, Vulpix, Lillipup, Sunkern, Abra |
| 2 | 7 | Onix, Grotle, Metapod, Starly, Pikachu, Kirlia, Audino |
| 3 | 7 | Quagsire, Haunter, Hitmonlee, Ponyta, Magneton, Porygon2, Jynx |
| 4 | 19 | Gigalith, Ferrothorn, Carracosta, Beartic, Bronzong, Golem, Umbreon, Accelgor, Scyther, Luxray, Weavile, Houndoom, Primeape, Rotom-Mow, Rotom-Wash, Espeon, Magmortar, Chansey, Lucario |
| 5 | 7 | Lapras, Escavalier, Drifblim, Gallade, Arcanine, Zoroark, Chandelure |
| 6 | 3 | Steelix, Blaziken, Krookodile |
| 8 | 9 | Rhyperior, Snorlax, Gengar, Machamp, Tangrowth, Serperior, Mamoswine, Alakazam, Dragonite |
| 9 | 2 | Gyarados, Garchomp |

### Movement

| MOV | Count |
|---|---|
| 1 | 39 |
| 2 | 13 |
| 3 | 10 |

### Range

| RNG | Count |
|---|---|
| 1 | 40 |
| 2 | 13 |
| 3 | 9 |

### Special-effect census

- **Stun sources (7):** Onix, Beartic, Bronzong, Snorlax, Magneton, Jynx, Pikachu
- **Healers/self-healers (8):** Grotle, Ferroseed, Squirtle, Metapod, Sunkern, Kirlia, Audino, Chansey
- **Targeting kinds:** enemy ×49 · self ×7 · ally ×3 · aoe ×2 · blink ×1

## Items

| Item | Effect | Kind |
|---|---|---|
| Potion | Restore 3 HP to one of your Pokémon | consumable |
| Super Potion | Restore 5 HP to one of your Pokémon | consumable |
| Max Potion | Fully restore one of your Pokémon | consumable |
| Revive | Return a fainted Pokémon to your deploy rows | consumable |
| Assault Vest | Attach: +2 max HP | held (one per Pokémon) |
| Life Orb | Attach: all damage this Pokémon deals +1 | held (one per Pokémon) |
| Choice Scarf | Attach: +2 movement | held (one per Pokémon) |
| Choice Specs | Attach: +3 range | held (one per Pokémon) |
| Power Herb | Instantly fills a Pokémon’s special charge | consumable |
| Lum Berry | Cures a stunned Pokémon | consumable |

## Field Poké Ball drop rates

| Drop | Weight | Chance |
|---|---|---|
| Potion | 10 | 9.6% |
| Super Potion | 10 | 9.6% |
| Max Potion | 7 | 6.7% |
| Revive | 10 | 9.6% |
| Assault Vest | 12 | 11.5% |
| Life Orb | 12 | 11.5% |
| Great Ball (currency) | 15 | 14.4% |
| Ultra Ball (currency) | 10 | 9.6% |
| Lum Berry | 6 | 5.8% |
| Choice Scarf | 4 | 3.8% |
| Choice Specs | 4 | 3.8% |
| Power Herb | 4 | 3.8% |

One field Poké Ball spawns every 3 rounds (max 2 on the board). No Pokémon attacks the turn it lands, but it may move.

## Signature specials — status

The iteration-9 pass implemented every proposed upgrade; the Effect column above is the live truth. Distinct identities now include: instant resolution (Extreme Speed), risk attacks (High Jump Kick), multi-hit (Rock Blast), pulls (Power Whip), permanent self-buffs (Flame Charge), KO refunds (Night Daze), phasing (both Shadow Balls), and conditional finishers/openers (Crunch, Sucker Punch, Blaze Kick, Icicle Crash, Gengar).
