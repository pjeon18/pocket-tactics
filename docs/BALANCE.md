# Pocket Tactics — Balance Master Sheet

_Generated from `src/game/data.ts` by `scripts/balance-sheet.ts` — do not edit the tables by hand._

**Roster: 60 Pokémon + 5 champions.** Cost letters: P = Poké Ball, G = Great Ball, U = Ultra Ball. Equiv = total value in Poké Balls (G=3, U=6).

## Every Pokémon

| Pokémon | Role | Type | Cost | Equiv | CD | HP | ATK | RNG | MOV | Charge | Special | Effect |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Abra | generalist | Psychic | 1P | 1 | 4 | 6 | 1 | 2 | 1 | 2 | Teleport | Right away: hop to any empty tile within 3 |
| Croagunk | dealer | Fighting | 1P | 1 | 3 | 7 | 2 | 1 | 1 | 3 | Sucker Punch | 4 dmg, +2 against targets still at full HP |
| Ferroseed | tank | Steel | 1P | 1 | 3 | 9 | 1 | 1 | 1 | 2 | Iron Defense | Restore 2 HP to itself, right away |
| Lillipup | generalist | Normal | 1P | 1 | 3 | 6 | 2 | 1 | 2 | 2 | Pickup | Scrounges up a Poké Ball, right away |
| Poochyena | dealer | Dark | 1P | 1 | 3 | 6 | 2 | 1 | 2 | 3 | Roar | 2 dmg and shoves the target back 2 tiles |
| Squirtle | tank | Water | 1P | 1 | 3 | 9 | 1 | 1 | 1 | 2 | Withdraw | Restore 2 HP to itself, right away |
| Starly | dealer | Normal | 1P | 1 | 3 | 6 | 2 | 1 | 3 | 3 | Fly-by | 3 dmg, then Starly darts 2 tiles back |
| Sunkern | generalist | Grass | 1P | 1 | 3 | 6 | 1 | 1 | 1 | 2 | Ingrain | Restore 2 HP to itself, right away |
| Vulpix | generalist | Fire | 1P | 1 | 3 | 6 | 2 | 2 | 1 | 2 | Ember | 2 dmg, and the flame licks the tile behind for 1 |
| Audino | generalist | Normal | 2P | 2 | 4 | 11 | 1 | 1 | 1 | 3 | Refresh | Restore 3 HP to an ally within 2 tiles, right away |
| Grotle | tank | Grass | 2P | 2 | 4 | 13 | 2 | 1 | 1 | 2 | Synthesis | Restore 4 HP to itself, right away |
| Kirlia | generalist | Psychic | 2P | 2 | 4 | 8 | 2 | 2 | 1 | 3 | Heal Pulse | Restore 4 HP to an ally within 2 tiles, right away |
| Metapod | tank | Bug | 2P | 2 | 4 | 16 | 1 | 1 | 1 | 2 | Harden | Restore 4 HP to itself, right away — it does nothing else, magnificently |
| Onix | tank | Rock | 2P | 2 | 4 | 12 | 2 | 1 | 1 | 2 | Bind | 2 dmg and the target is stunned — it can’t move next turn |
| Pikachu | generalist | Electric | 2P | 2 | 3 | 7 | 2 | 2 | 2 | 3 | Thunder Wave | 1 dmg and the target is stunned — it can’t move next turn |
| Ponyta | dealer | Fire | 2P | 2 | 4 | 8 | 3 | 1 | 3 | 3 | Flame Charge | 3 dmg, and Ponyta permanently gains +1 movement |
| Haunter | dealer | Ghost | 3P | 3 | 4 | 7 | 3 | 2 | 2 | 4 | Shadow Ball | 4 dmg that phases straight through blockers |
| Hitmonlee | dealer | Fighting | 3P | 3 | 4 | 8 | 3 | 1 | 1 | 4 | High Jump Kick | 8 dmg — but 25% chance to crash, miss, and take 2 itself |
| Jynx | specialist | Ice | 3P | 3 | 4 | 8 | 2 | 2 | 1 | 4 | Lovely Kiss | 2 dmg and the target is stunned — it can’t move next turn |
| Magneton | specialist | Electric | 3P | 3 | 4 | 8 | 2 | 3 | 1 | 5 | Zap Cannon | 4 dmg and the target is stunned — it can’t move next turn |
| Porygon2 | specialist | Normal | 3P | 3 | 4 | 9 | 3 | 2 | 1 | 5 | Tri Attack | 3 dmg, piercing on to enemies up to 2 tiles behind the target |
| Quagsire | tank | Water | 3P | 3 | 4 | 13 | 2 | 1 | 1 | 2 | Muddy Water | 3 dmg and washes the target back a tile |
| Accelgor | dealer | Bug | 1G+1P | 4 | 6 | 8 | 4 | 1 | 3 | 4 | U-turn | 4 dmg, then Accelgor slips 2 tiles back |
| Beartic | tank | Ice | 1G+1P | 4 | 6 | 14 | 3 | 1 | 1 | 2 | Icicle Crash | 4 dmg, +2 if the target is stunned |
| Bronzong | tank | Steel | 1G+1P | 4 | 6 | 14 | 2 | 1 | 1 | 2 | Hypnosis | 1 dmg at range 2 and the target is stunned — it can’t move next turn |
| Carracosta | tank | Water | 1G+1P | 4 | 6 | 14 | 3 | 1 | 1 | 2 | Shell Smash | Right away: +2 ATK and +2 movement this turn |
| Chansey | generalist | Normal | 1G+1P | 4 | 6 | 13 | 1 | 1 | 1 | 3 | Soft-Boiled | Restore 5 HP to an ally within 2 tiles, right away |
| Espeon | specialist | Psychic | 1G+1P | 4 | 6 | 9 | 3 | 2 | 1 | 5 | Psyshock | 4 dmg and hurls the target back 2 tiles |
| Ferrothorn | tank | Steel | 1G+1P | 4 | 6 | 15 | 2 | 1 | 1 | 2 | Power Whip | 4 dmg and drags the target adjacent to Ferrothorn |
| Gigalith | tank | Rock | 4P | 4 | 4 | 14 | 2 | 1 | 1 | 2 | Rock Slide | 3 dmg, plus 2 to every enemy beside the target |
| Golem | tank | Rock | 1G+1P | 4 | 6 | 15 | 3 | 1 | 1 | 2 | Rock Blast | 2 dmg, hitting 2–4 times |
| Houndoom | dealer | Dark | 1G+1P | 4 | 6 | 9 | 4 | 2 | 2 | 4 | Dark Pulse | 4 dmg, piercing on for 3 into the tile behind |
| Lucario | generalist | Fighting | 1G+1P | 4 | 6 | 10 | 3 | 2 | 2 | 3 | Aura Sphere | 4 dmg to any enemy within 3 tiles — never blocked |
| Luxray | dealer | Electric | 1G+1P | 4 | 6 | 9 | 4 | 1 | 2 | 4 | Wild Charge | 6 dmg, but Luxray takes 1 recoil |
| Magmortar | specialist | Fire | 1G+1P | 4 | 6 | 9 | 3 | 3 | 1 | 5 | Lava Plume | 3 dmg, plus 2 to every enemy beside the target |
| Primeape | dealer | Fighting | 4P | 4 | 4 | 9 | 4 | 1 | 2 | 4 | Karate Chop | A furious 6 dmg blow |
| Rotom-Mow | specialist | Grass | 1G+1P | 4 | 6 | 9 | 3 | 2 | 1 | 5 | Razor Leaf | 3 dmg, plus 2 to every enemy beside the target |
| Rotom-Wash | specialist | Water | 1G+1P | 4 | 6 | 9 | 3 | 2 | 1 | 5 | Hydro Pump | 3 dmg to EVERY enemy in the target’s column |
| Scyther | dealer | Bug | 4P | 4 | 4 | 8 | 4 | 1 | 3 | 4 | X-Scissor | Slashes twice for 3 dmg each |
| Umbreon | tank | Dark | 1G+1P | 4 | 6 | 14 | 2 | 1 | 1 | 2 | Snarl | 3 dmg, and Umbreon heals itself 2 |
| Weavile | dealer | Ice | 1G+1P | 4 | 6 | 8 | 4 | 1 | 3 | 4 | Ice Shard | 4 dmg, then Weavile retreats 2 tiles |
| Arcanine | dealer | Fire | 1G+2P | 5 | 7 | 10 | 4 | 1 | 3 | 4 | Extreme Speed | 4 dmg that lands INSTANTLY when declared |
| Chandelure | specialist | Fire | 1G+2P | 5 | 6 | 9 | 3 | 3 | 1 | 5 | Heat Wave | 3 dmg to every enemy within 2 tiles of Chandelure |
| Escavalier | tank | Bug | 1G+2P | 5 | 6 | 14 | 3 | 1 | 1 | 5 | Megahorn | 5 dmg, lancing through the two tiles behind for 3 — its NORMAL attacks skewer the unit behind, too |
| Gallade | dealer | Fighting | 1G+2P | 5 | 6 | 9 | 4 | 1 | 2 | 4 | Psycho Cut | 4 dmg, cutting through to whatever hides behind for 3 |
| Lapras | tank | Water | 1G+2P | 5 | 7 | 15 | 2 | 2 | 1 | 2 | Surf | 3 dmg, plus 2 to every enemy beside the target |
| Steelix | tank | Steel | 1G+2P | 5 | 6 | 15 | 3 | 1 | 1 | 2 | Iron Tail | 4 dmg and knocks the target back a tile |
| Zoroark | dealer | Dark | 1G+2P | 5 | 6 | 9 | 4 | 1 | 3 | 4 | Night Daze | 5 dmg — a KO refunds the full charge |
| Blaziken | generalist | Fire | 1G+3P | 6 | 6 | 11 | 3 | 1 | 2 | 3 | Blaze Kick | 4 dmg, a guaranteed CRIT against full-HP targets |
| Krookodile | generalist | Dark | 1G+3P | 6 | 6 | 12 | 3 | 1 | 1 | 3 | Crunch | 4 dmg, +3 if the target is below half HP |
| Alakazam | specialist | Psychic | 1U+2P | 8 | 8 | 8 | 4 | 3 | 1 | 5 | Psychic | 5 dmg and hurls the target back 2 tiles |
| Dragonite | generalist | Dragon | 1U+2P | 8 | 8 | 12 | 4 | 1 | 2 | 3 | Hyper Beam | 5 dmg to the first enemy in a straight line, any distance |
| Gengar | dealer | Ghost | 1U+2P | 8 | 8 | 9 | 5 | 2 | 3 | 4 | Shadow Ball | 5 dmg through blockers, +2 against full-HP targets |
| Machamp | dealer | Fighting | 1U+2P | 8 | 8 | 12 | 5 | 1 | 2 | 4 | Cross Chop | 6 dmg and knocks the target back a tile |
| Rhyperior | tank | Rock | 1U+2P | 8 | 8 | 17 | 4 | 1 | 1 | 2 | Rock Wrecker | 6 dmg and knocks the target back a tile |
| Serperior | dealer | Grass | 1U+2P | 8 | 8 | 11 | 4 | 2 | 2 | 4 | Leaf Storm | A regal tempest: 5 dmg, plus 2 to every enemy beside the target |
| Snorlax | tank | Normal | 1U+2P | 8 | 8 | 17 | 3 | 1 | 1 | 2 | Body Slam | 5 dmg and the target is stunned — it can’t move next turn |
| Tangrowth | tank | Grass | 1U+2P | 8 | 8 | 16 | 3 | 2 | 1 | 2 | Giga Drain | 4 dmg, and Tangrowth drinks 2 HP back |
| Garchomp | dealer | Dragon | 1U+3P | 9 | 8 | 11 | 5 | 1 | 2 | 4 | Earthquake | 4 dmg to every enemy in the 8 tiles around Garchomp |
| Gyarados | dealer | Water | 1U+3P | 9 | 8 | 13 | 5 | 1 | 2 | 4 | Dragon Rage | 5 dmg and hurls the target back 2 tiles |

## Champions

| Champion | Type | HP | ATK | RNG | MOV | Charge | Ability | Effect |
|---|---|---|---|---|---|---|---|---|
| Mew | Psychic | 12 | 2 | 1 | 1 | 6 | Genesis | Bring one of your fainted Pokémon back onto your deploy rows, free |
| Celebi | Grass | 11 | 1 | 1 | 1 | 4 | Healing Wish | Restore 2 HP to every one of your Pokémon, right away |
| Jirachi | Steel | 11 | 1 | 2 | 1 | 6 (once) | Doom Desire | Once per game: a meteor deals 5 dmg in a cross of 5 tiles, anywhere within 4 tiles |
| Victini | Fire | 12 | 2 | 1 | 1 | 5 | V-Create | This turn, every one of your Pokémon gets +2 attack and +2 movement, right away |
| Manaphy | Water | 12 | 1 | 2 | 1 | 6 | Surf | A tidal wave hits EVERY other Pokémon on the field for 3 — friend and foe alike |

## Distributions

### By type (synergy threshold is 3 — champion types add to the count in play)

| Type | Roster count | Synergy defined |
|---|---|---|
| Water | 6 | ✓ Torrent |
| Normal | 6 | ✓ Guts |
| Fighting | 6 | ✓ Focus |
| Fire | 6 | ✓ Blaze |
| Grass | 5 | ✓ Photosynthesis |
| Dark | 5 | ✓ Ambush |
| Rock | 4 | ✓ Sturdy |
| Steel | 4 | ✓ Bulwark |
| Bug | 4 | ✓ Swarm |
| Psychic | 4 | ✓ Mindlink |
| Ice | 3 | ✓ Frostbite |
| Electric | 3 | ✓ Static |
| Ghost | 2 | — |
| Dragon | 2 | — |

### By role

| Role | Count |
|---|---|
| dealer | 20 |
| tank | 19 |
| generalist | 12 |
| specialist | 9 |

### Cost curve (equiv Poké Balls)

| Equiv cost | Count | Who |
|---|---|---|
| 1 | 9 | Ferroseed, Squirtle, Starly, Croagunk, Poochyena, Vulpix, Lillipup, Sunkern, Abra |
| 2 | 7 | Onix, Grotle, Metapod, Ponyta, Pikachu, Kirlia, Audino |
| 3 | 6 | Quagsire, Haunter, Hitmonlee, Magneton, Porygon2, Jynx |
| 4 | 19 | Gigalith, Ferrothorn, Carracosta, Beartic, Bronzong, Golem, Umbreon, Accelgor, Scyther, Luxray, Weavile, Houndoom, Primeape, Rotom-Mow, Rotom-Wash, Espeon, Magmortar, Chansey, Lucario |
| 5 | 7 | Steelix, Lapras, Escavalier, Gallade, Arcanine, Zoroark, Chandelure |
| 6 | 2 | Blaziken, Krookodile |
| 8 | 8 | Rhyperior, Snorlax, Gengar, Machamp, Tangrowth, Serperior, Alakazam, Dragonite |
| 9 | 2 | Gyarados, Garchomp |

### Movement

| MOV | Count |
|---|---|
| 1 | 37 |
| 2 | 15 |
| 3 | 8 |

### Range

| RNG | Count |
|---|---|
| 1 | 40 |
| 2 | 16 |
| 3 | 4 |

### Special-effect census

- **Stun sources (7):** Onix, Beartic, Bronzong, Snorlax, Magneton, Jynx, Pikachu
- **Healers/self-healers (8):** Grotle, Ferroseed, Squirtle, Metapod, Sunkern, Kirlia, Audino, Chansey
- **Targeting kinds:** enemy ×47 · self ×7 · ally ×3 · aoe ×2 · blink ×1

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
| Potion | 16 | 16.2% |
| Super Potion | 10 | 10.1% |
| Max Potion | 5 | 5.1% |
| Revive | 10 | 10.1% |
| Assault Vest | 12 | 12.1% |
| Life Orb | 12 | 12.1% |
| Great Ball (currency) | 15 | 15.2% |
| Ultra Ball (currency) | 7 | 7.1% |
| Lum Berry | 6 | 6.1% |
| Choice Scarf | 2 | 2.0% |
| Choice Specs | 2 | 2.0% |
| Power Herb | 2 | 2.0% |

One field Poké Ball spawns every 4 rounds (max 2 on the board). Deploy time: Poké-tier basics act the turn they land; Great/Ultra-tier need a turn to arrive.

## Signature specials — status

The iteration-9 pass implemented every proposed upgrade; the Effect column above is the live truth. Distinct identities now include: instant resolution (Extreme Speed), risk attacks (High Jump Kick), multi-hit (Rock Blast), pulls (Power Whip), permanent self-buffs (Flame Charge), KO refunds (Night Daze), phasing (both Shadow Balls), and conditional finishers/openers (Crunch, Sucker Punch, Blaze Kick, Icicle Crash, Gengar).
