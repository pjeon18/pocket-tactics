import type { BallTier, ChampionSpecies, Cost, ItemKey, PType, Role, Species, Unit } from './types'

/* ---------- board & economy tuning (one-stop balance file) ---------- */
export const COLS = 7
export const ROWS = 10
export const DEPLOY_DEPTH = 2

/** Non-champion moves allowed per turn. */
export const MOVE_CAP = 3

/**
 * Economy: 1 Poké Ball per turn, +1 more per turn every 5 rounds.
 * Great/Ultra Balls come ONLY from trading (and item drops give other things).
 */
export const POKE_CAP = 8

/** Max non-champion Pokémon fielded at once — quality over quantity, no walls. */
export const FIELD_CAP = 7

/** Income growth stops here (anti-flood: late game pays 2/turn, not 4-5). */
export const INCOME_CAP = 2

/** KOing an enemy Pokémon pays out a Poké Ball — aggression is tempo. */
export const KILL_BOUNTY = 1
export const GREAT_CAP = 2
export const ULTRA_CAP = 1
export const INCOME_STEP_ROUNDS = 5
export const TRADE_GREAT_COST = 3 // 3 Poké Balls → 1 Great Ball
export const TRADE_ULTRA_COST = 6 // 6 Poké Balls → 1 Ultra Ball
export const START_POKE_A = 1 // +1 income on turn 1 → opens with 2
export const START_POKE_B = 2 // one extra Poké Ball as second-player compensation
export const START_GREAT_B = 0

export const DRAFT_SIZE = 8

/** Legendary summons: one-shot battlefield effects, never fielded. Pick 2. */
export const SUMMON_PICKS = 2
export interface SummonDef {
  key: string
  name: string
  dex: number
  /** Poké Ball cost to unleash it (once per game). */
  cost: number
  desc: string
}
export const SUMMONS: Record<string, SummonDef> = {
  hooh: { key: 'hooh', name: 'Ho-Oh', dex: 250, cost: 4, desc: 'Sacred Fire — every Pokémon you have fielded gains +3 max HP, right away' },
  lugia: { key: 'lugia', name: 'Lugia', dex: 249, cost: 4, desc: 'Aeroblast — next turn your opponent can neither move nor deploy' },
  dialga: { key: 'dialga', name: 'Dialga', dex: 483, cost: 6, desc: 'Roar of Time — every one of your Pokémon gets its special fully charged' },
  palkia: { key: 'palkia', name: 'Palkia', dex: 484, cost: 6, desc: 'Spacial Rend — all of your Pokémon have 5 movement this turn' },
}
export const SUMMON_ORDER = ['hooh', 'lugia', 'dialga', 'palkia']

/** From this round on, both champions take 1 fatigue damage per round — games must end. */
export const FATIGUE_ROUND = 20

/** Normal attacks only: a small hit-roll. Specials never miss or crit. */
export const MISS_CHANCE = 0.05
export const CRIT_CHANCE = 0.1
export const CRIT_BONUS = 2

/** Every Pokémon gains this much HP over its "true" statline (attack/HP ratio fix). */
export const HP_INFLATE = 3

/** UNIQUE same-type Pokémon on the field (champion counts, duplicates don't):
    tier 1 at 3, tier 2 at 5 — numeric bonuses double, boolean ones gain a rider. */
export const SYNERGY_THRESHOLD = 3
export const SYNERGY_TIER2 = 5
/** Normal's economy synergy comes online earlier: 2 uniques, upgraded at 4. */
export const synergyThresholds = (t: PType): [number, number] =>
  t === 'normal' ? [2, 4] : [SYNERGY_THRESHOLD, SYNERGY_TIER2]
export interface SynergyDef {
  name: string
  desc: string
  /** What tier 2 (five uniques) adds. */
  desc2: string
}
export const SYNERGIES: Partial<Record<PType, SynergyDef>> = {
  fire: { name: 'Blaze', desc: 'Your Fire Pokémon get +1 ATK', desc2: '+2 ATK' },
  water: { name: 'Torrent', desc: 'Your Water Pokémon get +1 MOV', desc2: '+2 MOV' },
  electric: { name: 'Static', desc: 'Your Electric Pokémon crit twice as often', desc2: 'crit three times as often' },
  psychic: { name: 'Mindlink', desc: 'Your Psychic Pokémon get +1 range', desc2: '+2 range' },
  grass: { name: 'Photosynthesis', desc: 'Your Grass Pokémon heal 1 at the end of your turn', desc2: 'heal 2' },
  normal: { name: 'Payday', desc: '+1 Poké Ball at the start of your turn', desc2: '+2 Poké Balls' },
  fighting: { name: 'Focus', desc: 'Your Fighting Pokémon deal +1 with specials', desc2: '+2 with specials' },
  steel: { name: 'Bulwark', desc: 'Your Steel Pokémon take 1 less damage', desc2: '2 less damage' },
  ice: { name: 'Frostbite', desc: 'Your Ice Pokémon deal +1 to stunned targets', desc2: '+2 to stunned' },
  rock: { name: 'Sturdy', desc: 'Your Rock Pokémon can never be crit', desc2: 'also take 1 less damage' },
  dark: { name: 'Ambush', desc: 'Your Dark Pokémon deal +1 to targets at full HP', desc2: '+2 to full-HP targets' },
  bug: { name: 'Swarm', desc: 'Your Bug Pokémon strike twice with normal attacks', desc2: 'and gain +1 ATK' },
}

/** Field Poké Ball drops. Vest and Orb attach to a Pokémon (one held item each). */
export const ITEMS: Record<ItemKey, { name: string; desc: string; attach: boolean }> = {
  potion: { name: 'Potion', desc: 'Restore 3 HP to one of your Pokémon', attach: false },
  'super-potion': { name: 'Super Potion', desc: 'Restore 5 HP to one of your Pokémon', attach: false },
  'max-potion': { name: 'Max Potion', desc: 'Fully restore one of your Pokémon', attach: false },
  revive: { name: 'Revive', desc: 'Return a fainted Pokémon to your deploy rows', attach: false },
  'assault-vest': { name: 'Assault Vest', desc: 'Attach: +2 max HP', attach: true },
  'life-orb': { name: 'Life Orb', desc: 'Attach: all damage this Pokémon deals +1', attach: true },
  'choice-scarf': { name: 'Choice Scarf', desc: 'Attach: +2 movement', attach: true },
  'choice-specs': { name: 'Choice Specs', desc: 'Attach: +3 range', attach: true },
  'power-herb': { name: 'Power Herb', desc: 'Instantly fills a Pokémon’s special charge', attach: false },
  'lum-berry': { name: 'Lum Berry', desc: 'Cures a stunned Pokémon', attach: false },
}

/** Weighted field-drop table. Ball drops convert to currency the moment they're grabbed. */
export type Drop = { type: 'item'; key: ItemKey } | { type: 'ball'; tier: 'great' | 'ultra' }
export const DROPS: { drop: Drop; weight: number }[] = [
  { drop: { type: 'item', key: 'potion' }, weight: 10 },
  { drop: { type: 'item', key: 'super-potion' }, weight: 10 },
  { drop: { type: 'item', key: 'max-potion' }, weight: 7 },
  { drop: { type: 'item', key: 'revive' }, weight: 10 },
  { drop: { type: 'item', key: 'assault-vest' }, weight: 12 },
  { drop: { type: 'item', key: 'life-orb' }, weight: 12 },
  /* currency drops trimmed (anti-flood) in favor of consumables */
  { drop: { type: 'ball', tier: 'great' }, weight: 15 },
  { drop: { type: 'ball', tier: 'ultra' }, weight: 10 },
  { drop: { type: 'item', key: 'lum-berry' }, weight: 6 },
  /* the game-warping attachments stay VERY rare */
  { drop: { type: 'item', key: 'choice-scarf' }, weight: 4 },
  { drop: { type: 'item', key: 'choice-specs' }, weight: 4 },
  { drop: { type: 'item', key: 'power-herb' }, weight: 4 },
]

/** One rock cluster: two touching tiles, mirrored to the other side (4 blocked tiles total). */
export const ROCK_CLUSTERS = 1
export const CHEST_MAX = 2
export const CHEST_EVERY = 3 // a field Poké Ball drops every 3 rounds

export const ROLE_META: Record<Role, { label: string }> = {
  tank: { label: 'Tank' },
  dealer: { label: 'Dealer' },
  specialist: { label: 'Specialist' },
  generalist: { label: 'Generalist' },
}

export const TIER_META: Record<BallTier, { label: string; short: string; color: string }> = {
  poke: { label: 'Poké Ball', short: 'Poké', color: '#D64545' },
  great: { label: 'Great Ball', short: 'Great', color: '#3B6FB5' },
  ultra: { label: 'Ultra Ball', short: 'Ultra', color: '#C9930A' },
}

export const costEquiv = (c: Cost) =>
  c.poke + c.great * TRADE_GREAT_COST + c.ultra * TRADE_ULTRA_COST

const P = (poke: number): Cost => ({ poke, great: 0, ultra: 0 })
const G = (poke: number): Cost => ({ poke, great: 1, ultra: 0 })
const U = (poke: number): Cost => ({ poke, great: 0, ultra: 1 })

/* ---------- type chart (real matchups, single-type simplification) ---------- */

export const TYPE_META: Record<PType, { label: string; color: string }> = {
  normal: { label: 'Normal', color: '#A8A878' },
  fire: { label: 'Fire', color: '#F08030' },
  water: { label: 'Water', color: '#6890F0' },
  electric: { label: 'Electric', color: '#E0B420' },
  grass: { label: 'Grass', color: '#78C850' },
  ice: { label: 'Ice', color: '#6FC5C5' },
  fighting: { label: 'Fighting', color: '#C03028' },
  psychic: { label: 'Psychic', color: '#F85888' },
  bug: { label: 'Bug', color: '#A8B820' },
  rock: { label: 'Rock', color: '#B8A038' },
  ghost: { label: 'Ghost', color: '#705898' },
  dragon: { label: 'Dragon', color: '#7038F8' },
  dark: { label: 'Dark', color: '#705848' },
  steel: { label: 'Steel', color: '#8A8AA8' },
}

const STRONG: Record<PType, PType[]> = {
  normal: [],
  fire: ['grass', 'ice', 'bug', 'steel'],
  water: ['fire', 'rock'],
  electric: ['water'],
  grass: ['water', 'rock'],
  ice: ['grass', 'dragon'],
  fighting: ['normal', 'ice', 'rock', 'dark', 'steel'],
  psychic: ['fighting'],
  bug: ['grass', 'psychic', 'dark'],
  rock: ['fire', 'ice', 'bug'],
  ghost: ['psychic', 'ghost'],
  dragon: ['dragon'],
  dark: ['psychic', 'ghost'],
  steel: ['ice', 'rock'],
}

/** Defenders that resist (or are immune to) the attacker's type. */
const RESIST: Record<PType, PType[]> = {
  normal: ['rock', 'steel', 'ghost'],
  fire: ['fire', 'water', 'rock', 'dragon'],
  water: ['water', 'grass', 'dragon'],
  electric: ['electric', 'grass', 'dragon'],
  grass: ['fire', 'grass', 'bug', 'dragon', 'steel'],
  ice: ['fire', 'water', 'ice', 'steel'],
  fighting: ['psychic', 'bug', 'ghost'],
  psychic: ['psychic', 'steel', 'dark'],
  bug: ['fire', 'fighting', 'ghost', 'steel'],
  rock: ['fighting', 'steel'],
  ghost: ['normal', 'dark'],
  dragon: ['steel'],
  dark: ['fighting', 'dark'],
  steel: ['fire', 'water', 'electric', 'steel'],
}

/** +3 super effective, −2 resisted, 0 neutral. Damage floor is 1. */
export const TYPE_STRONG_BONUS = 3
export const TYPE_RESIST_PENALTY = -2
export function typeMod(a: PType, d: PType): number {
  if (STRONG[a].includes(d)) return TYPE_STRONG_BONUS
  if (RESIST[a].includes(d)) return TYPE_RESIST_PENALTY
  return 0
}

/* ---------- roster: 60 Pokémon, all Gen 5 or earlier ----------
   Movement doctrine: most Pokémon move 1; only the fast-natured move 2–3.
   HP values below are pre-inflation; HP_INFLATE is applied at the bottom. */

export const ROSTER: Record<string, Species> = {
  /* tanks — big HP, melee, specials charge fast */
  onix: {
    key: 'onix', name: 'Onix', dex: 95, role: 'tank', ptype: 'rock', tier: 'poke', cost: P(2), cooldown: 4,
    hp: 9, atk: 2, range: 1, move: 1, chargeMax: 2,
    special: 'Bind', hint: '2 dmg and the target is stunned — it can’t move next turn',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  grotle: {
    key: 'grotle', name: 'Grotle', dex: 388, role: 'tank', ptype: 'grass', tier: 'poke', cost: P(2), cooldown: 4,
    hp: 10, atk: 2, range: 1, move: 1, chargeMax: 2,
    special: 'Synthesis', hint: 'Restore 4 HP to itself, right away',
    targeting: { kind: 'self' }, pattern: 'self',
  },
  ferroseed: {
    key: 'ferroseed', name: 'Ferroseed', dex: 597, role: 'tank', ptype: 'steel', tier: 'poke', cost: P(1), cooldown: 3,
    hp: 6, atk: 1, range: 1, move: 1, chargeMax: 2,
    special: 'Iron Defense', hint: 'Restore 2 HP to itself, right away',
    targeting: { kind: 'self' }, pattern: 'self',
  },
  gigalith: {
    key: 'gigalith', name: 'Gigalith', dex: 526, role: 'tank', ptype: 'rock', tier: 'poke', cost: P(4), cooldown: 4,
    hp: 11, atk: 2, range: 1, move: 1, chargeMax: 2,
    special: 'Rock Slide', hint: '3 dmg, plus 2 to every enemy beside the target',
    targeting: { kind: 'enemy' }, pattern: 'splash',
  },
  quagsire: {
    key: 'quagsire', name: 'Quagsire', dex: 195, role: 'tank', ptype: 'water', tier: 'poke', cost: P(3), cooldown: 4,
    hp: 10, atk: 2, range: 1, move: 1, chargeMax: 2,
    special: 'Muddy Water', hint: '3 dmg and washes the target back a tile',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  ferrothorn: {
    key: 'ferrothorn', name: 'Ferrothorn', dex: 598, role: 'tank', ptype: 'steel', tier: 'great', cost: G(1), cooldown: 6,
    hp: 12, atk: 2, range: 1, move: 1, chargeMax: 2,
    special: 'Power Whip', hint: '4 dmg and drags the target adjacent to Ferrothorn',
    targeting: { kind: 'enemy', rangeOverride: 2 }, pattern: 'target',
  },
  steelix: {
    key: 'steelix', name: 'Steelix', dex: 208, role: 'tank', ptype: 'steel', tier: 'ultra', cost: U(0), cooldown: 8,
    hp: 14, atk: 3, range: 1, move: 1, chargeMax: 2,
    special: 'Iron Tail', hint: '4 dmg and knocks the target back a tile',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  carracosta: {
    key: 'carracosta', name: 'Carracosta', dex: 565, role: 'tank', ptype: 'water', tier: 'great', cost: G(1), cooldown: 6,
    hp: 11, atk: 3, range: 1, move: 1, chargeMax: 2,
    special: 'Shell Smash', hint: 'Right away: +2 ATK and +2 movement this turn',
    targeting: { kind: 'self' }, pattern: 'self',
  },
  beartic: {
    key: 'beartic', name: 'Beartic', dex: 614, role: 'tank', ptype: 'ice', tier: 'great', cost: G(1), cooldown: 6,
    hp: 11, atk: 3, range: 1, move: 1, chargeMax: 2,
    special: 'Icicle Crash', hint: '4 dmg, +2 if the target is stunned',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  lapras: {
    key: 'lapras', name: 'Lapras', dex: 131, role: 'tank', ptype: 'water', tier: 'great', cost: G(2), cooldown: 7,
    hp: 12, atk: 2, range: 2, move: 1, chargeMax: 2,
    special: 'Surf', hint: '3 dmg, plus 2 to every enemy beside the target',
    targeting: { kind: 'enemy' }, pattern: 'splash',
  },
  bronzong: {
    key: 'bronzong', name: 'Bronzong', dex: 437, role: 'tank', ptype: 'steel', tier: 'great', cost: G(1), cooldown: 6,
    hp: 11, atk: 2, range: 1, move: 1, chargeMax: 2,
    special: 'Hypnosis', hint: '1 dmg at range 2 and the target is stunned — it can’t move next turn',
    targeting: { kind: 'enemy', rangeOverride: 2 }, pattern: 'target',
  },
  squirtle: {
    key: 'squirtle', name: 'Squirtle', dex: 7, role: 'tank', ptype: 'water', tier: 'poke', cost: P(1), cooldown: 3,
    hp: 6, atk: 1, range: 1, move: 1, chargeMax: 2,
    special: 'Withdraw', hint: 'Restore 2 HP to itself, right away',
    targeting: { kind: 'self' }, pattern: 'self',
  },
  golem: {
    key: 'golem', name: 'Golem', dex: 76, role: 'tank', ptype: 'rock', tier: 'great', cost: G(1), cooldown: 6,
    hp: 12, atk: 3, range: 1, move: 1, chargeMax: 2,
    special: 'Rock Blast', hint: '2 dmg, hitting 2–4 times',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  umbreon: {
    key: 'umbreon', name: 'Umbreon', dex: 197, role: 'tank', ptype: 'dark', tier: 'great', cost: G(1), cooldown: 6,
    hp: 11, atk: 2, range: 1, move: 1, chargeMax: 2,
    special: 'Snarl', hint: '3 dmg, and Umbreon heals itself 2',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  rhyperior: {
    key: 'rhyperior', name: 'Rhyperior', dex: 464, role: 'tank', ptype: 'rock', tier: 'ultra', cost: U(2), cooldown: 8,
    hp: 14, atk: 4, range: 1, move: 1, chargeMax: 2,
    special: 'Rock Wrecker', hint: '6 dmg and knocks the target back a tile',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  snorlax: {
    key: 'snorlax', name: 'Snorlax', dex: 143, role: 'tank', ptype: 'normal', tier: 'ultra', cost: U(2), cooldown: 8,
    hp: 16, atk: 3, range: 1, move: 1, chargeMax: 2,
    special: 'Body Slam', hint: '5 dmg and the target is stunned — it can’t move next turn',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },

  /* bugs — the Swarm package: shell, lance, and knife */
  metapod: {
    key: 'metapod', name: 'Metapod', dex: 11, role: 'tank', ptype: 'bug', tier: 'poke', cost: P(2), cooldown: 4,
    hp: 13, atk: 1, range: 1, move: 1, chargeMax: 2,
    special: 'Harden', hint: 'Restore 4 HP to itself, right away — it does nothing else, magnificently',
    targeting: { kind: 'self' }, pattern: 'self',
  },
  escavalier: {
    key: 'escavalier', name: 'Escavalier', dex: 589, role: 'tank', ptype: 'bug', tier: 'great', cost: G(2), cooldown: 6, pierceBasic: true,
    hp: 11, atk: 3, range: 1, move: 1, chargeMax: 4,
    special: 'Megahorn', hint: '5 dmg, lancing through the two tiles behind for 3 — its NORMAL attacks skewer the unit behind, too',
    targeting: { kind: 'enemy' }, pattern: 'pierce',
  },
  accelgor: {
    key: 'accelgor', name: 'Accelgor', dex: 617, role: 'dealer', ptype: 'bug', tier: 'great', cost: G(1), cooldown: 6,
    hp: 5, atk: 4, range: 1, move: 3, chargeMax: 4,
    special: 'U-turn', hint: '4 dmg, then Accelgor slips 2 tiles back',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },

  /* dealers — frail, fast, hit hard, specials charge slowly */
  starly: {
    key: 'starly', name: 'Starly', dex: 396, role: 'dealer', ptype: 'normal', tier: 'poke', cost: P(2), cooldown: 3,
    hp: 3, atk: 2, range: 1, move: 3, chargeMax: 3,
    special: 'Fly-by', hint: '3 dmg, then Starly darts 2 tiles back',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  croagunk: {
    key: 'croagunk', name: 'Croagunk', dex: 453, role: 'dealer', ptype: 'fighting', tier: 'poke', cost: P(1), cooldown: 3,
    hp: 4, atk: 2, range: 1, move: 1, chargeMax: 3,
    special: 'Sucker Punch', hint: '4 dmg, +2 against targets still at full HP',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  haunter: {
    key: 'haunter', name: 'Haunter', dex: 93, role: 'dealer', ptype: 'ghost', tier: 'poke', cost: P(3), cooldown: 4,
    hp: 4, atk: 3, range: 2, move: 2, chargeMax: 4,
    special: 'Shadow Ball', hint: '4 dmg that phases straight through blockers',
    targeting: { kind: 'enemy', rangeOverride: 2, ignoreBlock: true }, pattern: 'target',
  },
  hitmonlee: {
    key: 'hitmonlee', name: 'Hitmonlee', dex: 106, role: 'dealer', ptype: 'fighting', tier: 'poke', cost: P(3), cooldown: 4,
    hp: 5, atk: 3, range: 1, move: 1, chargeMax: 4,
    special: 'High Jump Kick', hint: '8 dmg — but 25% chance to crash, miss, and take 2 itself',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  scyther: {
    key: 'scyther', name: 'Scyther', dex: 123, role: 'dealer', ptype: 'bug', tier: 'poke', cost: P(4), cooldown: 4,
    hp: 5, atk: 4, range: 1, move: 3, chargeMax: 4,
    special: 'X-Scissor', hint: 'Slashes twice for 3 dmg each',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  luxray: {
    key: 'luxray', name: 'Luxray', dex: 405, role: 'dealer', ptype: 'electric', tier: 'great', cost: G(1), cooldown: 6,
    hp: 6, atk: 4, range: 1, move: 2, chargeMax: 4,
    special: 'Wild Charge', hint: '6 dmg, but Luxray takes 1 recoil',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  weavile: {
    key: 'weavile', name: 'Weavile', dex: 461, role: 'dealer', ptype: 'ice', tier: 'great', cost: G(1), cooldown: 6,
    hp: 5, atk: 4, range: 1, move: 3, chargeMax: 4,
    special: 'Ice Shard', hint: '4 dmg, then Weavile retreats 2 tiles',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  gallade: {
    key: 'gallade', name: 'Gallade', dex: 475, role: 'dealer', ptype: 'fighting', tier: 'great', cost: G(2), cooldown: 6,
    hp: 7, atk: 4, range: 1, move: 2, chargeMax: 4,
    special: 'Psycho Cut', hint: '4 dmg, cutting through to whatever hides behind for 3',
    targeting: { kind: 'enemy' }, pattern: 'pierce',
  },
  arcanine: {
    key: 'arcanine', name: 'Arcanine', dex: 59, role: 'dealer', ptype: 'fire', tier: 'great', cost: G(2), cooldown: 7,
    hp: 8, atk: 4, range: 1, move: 3, chargeMax: 4,
    special: 'Extreme Speed', hint: '4 dmg that lands INSTANTLY when declared',
    targeting: { kind: 'enemy', instant: true }, pattern: 'target',
  },
  poochyena: {
    key: 'poochyena', name: 'Poochyena', dex: 261, role: 'dealer', ptype: 'dark', tier: 'poke', cost: P(1), cooldown: 3,
    hp: 3, atk: 2, range: 1, move: 2, chargeMax: 3,
    special: 'Roar', hint: '2 dmg and shoves the target back 2 tiles',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  ponyta: {
    key: 'ponyta', name: 'Ponyta', dex: 77, role: 'dealer', ptype: 'fire', tier: 'poke', cost: P(3), cooldown: 4,
    hp: 5, atk: 3, range: 1, move: 3, chargeMax: 3,
    special: 'Flame Charge', hint: '3 dmg, and Ponyta permanently gains +1 movement',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  houndoom: {
    key: 'houndoom', name: 'Houndoom', dex: 229, role: 'dealer', ptype: 'dark', tier: 'great', cost: G(1), cooldown: 6,
    hp: 6, atk: 4, range: 2, move: 2, chargeMax: 4,
    special: 'Dark Pulse', hint: '4 dmg, piercing on for 3 into the tile behind',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  zoroark: {
    key: 'zoroark', name: 'Zoroark', dex: 571, role: 'dealer', ptype: 'dark', tier: 'great', cost: G(2), cooldown: 6,
    hp: 7, atk: 4, range: 1, move: 3, chargeMax: 4,
    special: 'Night Daze', hint: '5 dmg — a KO refunds the full charge',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  gengar: {
    key: 'gengar', name: 'Gengar', dex: 94, role: 'dealer', ptype: 'ghost', tier: 'ultra', cost: U(2), cooldown: 8,
    hp: 7, atk: 5, range: 2, move: 3, chargeMax: 3,
    special: 'Shadow Ball', hint: '5 dmg through blockers, +2 against full-HP targets',
    targeting: { kind: 'enemy', rangeOverride: 2, ignoreBlock: true }, pattern: 'target',
  },
  machamp: {
    key: 'machamp', name: 'Machamp', dex: 68, role: 'dealer', ptype: 'fighting', tier: 'ultra', cost: U(2), cooldown: 8,
    hp: 11, atk: 5, range: 1, move: 2, chargeMax: 3,
    special: 'Cross Chop', hint: '6 dmg and knocks the target back a tile',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  gyarados: {
    key: 'gyarados', name: 'Gyarados', dex: 130, role: 'dealer', ptype: 'water', tier: 'ultra', cost: U(3), cooldown: 8,
    hp: 10, atk: 5, range: 1, move: 2, chargeMax: 3,
    special: 'Dragon Rage', hint: '5 dmg and hurls the target back 2 tiles',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  garchomp: {
    key: 'garchomp', name: 'Garchomp', dex: 445, role: 'dealer', ptype: 'dragon', tier: 'ultra', cost: U(3), cooldown: 8,
    hp: 10, atk: 6, range: 1, move: 2, chargeMax: 3,
    special: 'Earthquake', hint: '4 dmg to every enemy in the 8 tiles around Garchomp',
    targeting: { kind: 'aoe' }, pattern: 'ring1',
  },

  primeape: {
    key: 'primeape', name: 'Primeape', dex: 57, role: 'dealer', ptype: 'fighting', tier: 'poke', cost: P(4), cooldown: 4,
    hp: 6, atk: 4, range: 1, move: 2, chargeMax: 4,
    special: 'Karate Chop', hint: 'A furious 6 dmg blow',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  tangrowth: {
    key: 'tangrowth', name: 'Tangrowth', dex: 465, role: 'tank', ptype: 'grass', tier: 'ultra', cost: U(2), cooldown: 8,
    hp: 15, atk: 3, range: 2, move: 1, chargeMax: 2,
    special: 'Giga Drain', hint: '4 dmg, and Tangrowth drinks 2 HP back',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  serperior: {
    key: 'serperior', name: 'Serperior', dex: 497, role: 'dealer', ptype: 'grass', tier: 'ultra', cost: U(2), cooldown: 8,
    hp: 9, atk: 4, range: 2, move: 2, chargeMax: 3,
    special: 'Leaf Storm', hint: 'A regal tempest: 5 dmg, plus 2 to every enemy beside the target',
    targeting: { kind: 'enemy' }, pattern: 'splash',
  },

  /* specialists — long range, board-warping specials, slowest charge */
  rotommow: {
    key: 'rotommow', name: 'Rotom-Mow', dex: 10012, role: 'specialist', ptype: 'grass', tier: 'great', cost: G(1), cooldown: 6,
    hp: 6, atk: 3, range: 2, move: 1, chargeMax: 5,
    special: 'Razor Leaf', hint: '3 dmg, plus 2 to every enemy beside the target',
    targeting: { kind: 'enemy' }, pattern: 'splash',
  },
  magneton: {
    key: 'magneton', name: 'Magneton', dex: 82, role: 'specialist', ptype: 'electric', tier: 'poke', cost: P(3), cooldown: 4,
    hp: 5, atk: 2, range: 3, move: 1, chargeMax: 5,
    special: 'Zap Cannon', hint: '4 dmg and the target is stunned — it can’t move next turn',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  porygon2: {
    key: 'porygon2', name: 'Porygon2', dex: 233, role: 'specialist', ptype: 'normal', tier: 'poke', cost: P(3), cooldown: 4,
    hp: 6, atk: 3, range: 2, move: 1, chargeMax: 5,
    special: 'Tri Attack', hint: '3 dmg, piercing on to enemies up to 2 tiles behind the target',
    targeting: { kind: 'enemy' }, pattern: 'pierce',
  },
  jynx: {
    key: 'jynx', name: 'Jynx', dex: 124, role: 'specialist', ptype: 'ice', tier: 'poke', cost: P(3), cooldown: 4,
    hp: 5, atk: 2, range: 2, move: 1, chargeMax: 4,
    special: 'Lovely Kiss', hint: '2 dmg and the target is stunned — it can’t move next turn',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  rotomwash: {
    key: 'rotomwash', name: 'Rotom-Wash', dex: 10009, role: 'specialist', ptype: 'water', tier: 'great', cost: G(1), cooldown: 6,
    hp: 6, atk: 3, range: 2, move: 1, chargeMax: 5,
    special: 'Hydro Pump', hint: '3 dmg to EVERY enemy in the target’s column',
    targeting: { kind: 'enemy' }, pattern: 'column',
  },
  chandelure: {
    key: 'chandelure', name: 'Chandelure', dex: 609, role: 'specialist', ptype: 'fire', tier: 'great', cost: G(2), cooldown: 6,
    hp: 7, atk: 3, range: 3, move: 1, chargeMax: 4,
    special: 'Heat Wave', hint: '3 dmg to every enemy within 2 tiles of Chandelure',
    targeting: { kind: 'aoe' }, pattern: 'ring2',
  },
  espeon: {
    key: 'espeon', name: 'Espeon', dex: 196, role: 'specialist', ptype: 'psychic', tier: 'great', cost: G(1), cooldown: 6,
    hp: 6, atk: 3, range: 2, move: 1, chargeMax: 4,
    special: 'Psyshock', hint: '4 dmg and hurls the target back 2 tiles',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  magmortar: {
    key: 'magmortar', name: 'Magmortar', dex: 467, role: 'specialist', ptype: 'fire', tier: 'great', cost: G(1), cooldown: 6,
    hp: 7, atk: 3, range: 3, move: 1, chargeMax: 4,
    special: 'Lava Plume', hint: '3 dmg, plus 2 to every enemy beside the target',
    targeting: { kind: 'enemy' }, pattern: 'splash',
  },
  alakazam: {
    key: 'alakazam', name: 'Alakazam', dex: 65, role: 'specialist', ptype: 'psychic', tier: 'ultra', cost: U(2), cooldown: 8,
    hp: 6, atk: 4, range: 3, move: 1, chargeMax: 3,
    special: 'Psychic', hint: '5 dmg and hurls the target back 2 tiles',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },

  /* generalists — flexible stats, utility specials */
  vulpix: {
    key: 'vulpix', name: 'Vulpix', dex: 37, role: 'generalist', ptype: 'fire', tier: 'poke', cost: P(1), cooldown: 3,
    hp: 3, atk: 2, range: 2, move: 1, chargeMax: 2,
    special: 'Ember', hint: '2 dmg, and the flame licks the tile behind for 1',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  lillipup: {
    key: 'lillipup', name: 'Lillipup', dex: 506, role: 'generalist', ptype: 'normal', tier: 'poke', cost: P(1), cooldown: 3,
    hp: 3, atk: 2, range: 1, move: 2, chargeMax: 2,
    special: 'Pickup', hint: 'Scrounges up a Poké Ball, right away',
    targeting: { kind: 'self' }, pattern: 'self',
  },
  sunkern: {
    key: 'sunkern', name: 'Sunkern', dex: 191, role: 'generalist', ptype: 'grass', tier: 'poke', cost: P(1), cooldown: 3,
    hp: 3, atk: 1, range: 1, move: 1, chargeMax: 2,
    special: 'Ingrain', hint: 'Restore 2 HP to itself, right away',
    targeting: { kind: 'self' }, pattern: 'self',
  },
  abra: {
    key: 'abra', name: 'Abra', dex: 63, role: 'generalist', ptype: 'psychic', tier: 'poke', cost: P(1), cooldown: 4,
    hp: 3, atk: 1, range: 2, move: 1, chargeMax: 2,
    special: 'Teleport', hint: 'Right away: hop to any empty tile within 3',
    targeting: { kind: 'blink', rangeOverride: 3 }, pattern: 'anywhere',
  },
  pikachu: {
    key: 'pikachu', name: 'Pikachu', dex: 25, role: 'generalist', ptype: 'electric', tier: 'poke', cost: P(2), cooldown: 3,
    hp: 4, atk: 2, range: 2, move: 2, chargeMax: 3,
    special: 'Thunder Wave', hint: '1 dmg and the target is stunned — it can’t move next turn',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  kirlia: {
    key: 'kirlia', name: 'Kirlia', dex: 281, role: 'generalist', ptype: 'psychic', tier: 'poke', cost: P(2), cooldown: 4,
    hp: 5, atk: 2, range: 2, move: 1, chargeMax: 3,
    special: 'Heal Pulse', hint: 'Restore 4 HP to an ally within 2 tiles, right away',
    targeting: { kind: 'ally', rangeOverride: 2 }, pattern: 'ally',
  },
  audino: {
    key: 'audino', name: 'Audino', dex: 531, role: 'generalist', ptype: 'normal', tier: 'poke', cost: P(2), cooldown: 4,
    hp: 8, atk: 1, range: 1, move: 1, chargeMax: 3,
    special: 'Refresh', hint: 'Restore 3 HP to an ally within 2 tiles, right away',
    targeting: { kind: 'ally', rangeOverride: 2 }, pattern: 'ally',
  },
  chansey: {
    key: 'chansey', name: 'Chansey', dex: 113, role: 'generalist', ptype: 'normal', tier: 'great', cost: G(1), cooldown: 6,
    hp: 12, atk: 1, range: 1, move: 1, chargeMax: 3,
    special: 'Soft-Boiled', hint: 'Restore 5 HP to an ally within 2 tiles, right away',
    targeting: { kind: 'ally', rangeOverride: 2 }, pattern: 'ally',
  },
  lucario: {
    key: 'lucario', name: 'Lucario', dex: 448, role: 'generalist', ptype: 'fighting', tier: 'great', cost: G(1), cooldown: 6,
    hp: 7, atk: 3, range: 2, move: 2, chargeMax: 3,
    special: 'Aura Sphere', hint: '4 dmg to any enemy within 3 tiles — never blocked',
    targeting: { kind: 'enemy', rangeOverride: 3, ignoreBlock: true }, pattern: 'anywhere',
  },
  blaziken: {
    key: 'blaziken', name: 'Blaziken', dex: 257, role: 'generalist', ptype: 'fire', tier: 'great', cost: G(3), cooldown: 6,
    hp: 9, atk: 3, range: 1, move: 2, chargeMax: 3,
    special: 'Blaze Kick', hint: '4 dmg, a guaranteed CRIT against full-HP targets',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  krookodile: {
    key: 'krookodile', name: 'Krookodile', dex: 553, role: 'generalist', ptype: 'dark', tier: 'great', cost: G(3), cooldown: 6,
    hp: 9, atk: 3, range: 1, move: 1, chargeMax: 3,
    special: 'Crunch', hint: '4 dmg, +3 if the target is below half HP',
    targeting: { kind: 'enemy' }, pattern: 'target',
  },
  dragonite: {
    key: 'dragonite', name: 'Dragonite', dex: 149, role: 'generalist', ptype: 'dragon', tier: 'ultra', cost: U(2), cooldown: 8,
    hp: 12, atk: 4, range: 2, move: 2, chargeMax: 3,
    special: 'Hyper Beam', hint: '5 dmg to the first enemy in a straight line, any distance',
    targeting: { kind: 'enemy', rangeOverride: 9 }, pattern: 'line',
  },
}

/* ---------- champions: the four mythicals ---------- */

export const CHAMPIONS: Record<string, ChampionSpecies> = {
  mew: {
    key: 'mew', name: 'Mew', dex: 151, ptype: 'psychic',
    hp: 9, atk: 2, range: 1, move: 1, chargeMax: 6,
    ability: 'Genesis', hint: 'Bring one of your fainted Pokémon back onto your deploy rows, free',
    targeting: { kind: 'revive' }, pattern: 'team',
  },
  celebi: {
    key: 'celebi', name: 'Celebi', dex: 251, ptype: 'grass',
    hp: 8, atk: 1, range: 1, move: 1, chargeMax: 4,
    ability: 'Healing Wish', hint: 'Restore 3 HP to every one of your Pokémon, right away',
    targeting: { kind: 'team' }, pattern: 'team',
  },
  jirachi: {
    key: 'jirachi', name: 'Jirachi', dex: 385, ptype: 'steel',
    hp: 8, atk: 1, range: 2, move: 1, chargeMax: 5,
    ability: 'Doom Desire', hint: 'A meteor deals 5 dmg in a cross of 5 tiles, anywhere within 5 tiles',
    targeting: { kind: 'tile', rangeOverride: 5 }, pattern: 'cross',
  },
  victini: {
    key: 'victini', name: 'Victini', dex: 494, ptype: 'fire',
    hp: 9, atk: 2, range: 1, move: 1, chargeMax: 5,
    ability: 'V-Create', hint: 'This turn, every one of your Pokémon gets +2 attack and +2 movement, right away',
    targeting: { kind: 'team' }, pattern: 'team',
  },
  manaphy: {
    key: 'manaphy', name: 'Manaphy', dex: 490, ptype: 'water',
    hp: 9, atk: 1, range: 2, move: 1, chargeMax: 6,
    ability: 'Surf', hint: 'A tidal wave hits every Pokémon outside her own back two rows for 4 — friend and foe alike',
    targeting: { kind: 'aoe' }, pattern: 'anywhere',
  },
}

/* HP inflation: applied once, so draft cards and battle agree. */
for (const s of Object.values(ROSTER)) s.hp += HP_INFLATE
for (const c of Object.values(CHAMPIONS)) c.hp += HP_INFLATE

export const CHAMPION_ORDER = ['mew', 'celebi', 'jirachi', 'victini', 'manaphy']

export const ROLE_ORDER: Role[] = ['tank', 'dealer', 'specialist', 'generalist']

/* ---------- helpers ---------- */

export const nameOf = (u: Unit): string =>
  u.isChampion ? CHAMPIONS[u.key].name : ROSTER[u.key].name

export const dexOf = (u: Unit): number =>
  u.isChampion ? CHAMPIONS[u.key].dex : ROSTER[u.key].dex

export const specialNameOf = (u: Unit): string =>
  u.isChampion ? CHAMPIONS[u.key].ability : ROSTER[u.key].special

export const specialHintOf = (u: Unit): string =>
  u.isChampion ? CHAMPIONS[u.key].hint : ROSTER[u.key].hint

export const metaOf = (u: Unit) =>
  u.isChampion ? CHAMPIONS[u.key].targeting : ROSTER[u.key].targeting

export const ptypeOf = (u: Unit): PType =>
  u.isChampion ? CHAMPIONS[u.key].ptype : ROSTER[u.key].ptype

export const roleOf = (u: Unit) => (u.isChampion ? null : ROSTER[u.key].role)
