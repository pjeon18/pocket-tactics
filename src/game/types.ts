export type Owner = 'A' | 'B'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type Role = 'tank' | 'dealer' | 'specialist' | 'generalist'
export type BallTier = 'poke' | 'great' | 'ultra'

/** Real Pokémon types present in the roster (single-type simplification). */
export type PType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice' | 'fighting'
  | 'psychic' | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel'

/** How a special/ability picks its target. */
export type TargetKind =
  | 'enemy' // planned through the attack flow at an enemy unit
  | 'aoe' // planned, no target — damages an area around the user
  | 'tile' // planned, tap a board tile (Jirachi)
  | 'ally' // instant — tap a friendly unit
  | 'self' // instant, no target
  | 'team' // instant, whole side
  | 'revive' // instant — pick a fainted ally, then an empty deploy tile
  | 'blink' // instant — teleport self to an empty tile within range (Abra)

/** What a Pokémon costs to deploy — can mix ball tiers. */
export interface Cost {
  poke: number
  great: number
  ultra: number
}

/** Shape glyph for the pattern-preview diagrams. */
export type PatternShape =
  | 'target' | 'splash' | 'pierce' | 'column' | 'cross' | 'ring1' | 'ring2'
  | 'line' | 'anywhere' | 'self' | 'ally' | 'team'

export interface SpecialMeta {
  kind: TargetKind
  rangeOverride?: number
  ignoreBlock?: boolean
  /** The special resolves the moment it is declared (Arcanine's Extreme Speed). */
  instant?: boolean
}

/** Consumables and held items dropped by field Poké Balls. */
export type ItemKey =
  | 'potion' | 'super-potion' | 'max-potion' | 'revive' | 'assault-vest' | 'life-orb'
  | 'choice-scarf' | 'choice-specs' | 'power-herb' | 'lum-berry'

export interface Species {
  key: string
  name: string
  dex: number
  role: Role
  ptype: PType
  /** Rarity band — drives filters, AI curve, and cooldown feel. */
  tier: BallTier
  /** Multi-ball deploy cost. */
  cost: Cost
  /** Turns before this card can be deployed again (cards are never consumed). */
  cooldown: number
  /** Normal attacks skewer the unit directly behind the target (Escavalier). */
  pierceBasic?: boolean
  hp: number
  atk: number
  range: number
  move: number
  chargeMax: number
  special: string
  hint: string
  targeting: SpecialMeta
  pattern: PatternShape
}

export interface ChampionSpecies {
  key: string
  name: string
  dex: number
  ptype: PType
  hp: number
  atk: number
  range: number
  move: number
  chargeMax: number
  once?: boolean
  ability: string
  hint: string
  targeting: SpecialMeta
  pattern: PatternShape
}

/** A declared action that resolves when the turn ends. */
export type Planned =
  | { kind: 'attack'; targetId: number }
  | { kind: 'special'; targetId: number }
  | { kind: 'aoe' }
  | { kind: 'tile'; col: number; row: number }

export interface Unit {
  id: number
  key: string
  owner: Owner
  isChampion: boolean
  col: number
  row: number
  hp: number
  maxHp: number
  atk: number
  range: number
  move: number
  charge: number
  chargeMax: number
  moved: boolean
  /** Where it moved from this turn (undo target); null once undo is impossible. */
  movedFrom: [number, number] | null
  /** Has a planned action or already used an instant ability this turn. */
  acted: boolean
  planned: Planned | null
  /** Declaration order — planned actions resolve in this order. */
  plannedSeq: number
  /** Deployed this turn — cannot move or act until next turn. */
  summoned: boolean
  /** Skips its next turn (cannot move or act). Champions immune. */
  stunned: boolean
  atkBuff: number
  moveBuff: number
  abilityUsed: boolean
  /** Attached held item (Assault Vest / Life Orb). One per Pokémon. */
  heldItem: ItemKey | null
}

export interface PlayerState {
  championKey: string
  /** The drafted 8 — a permanent deck; deploying never consumes a card. */
  bench: string[]
  fainted: string[]
  /** Per-card redeploy cooldowns, ticking down at your turn start. */
  cooldowns: Record<string, number>
  /** Cards the opponent has seen — a card is revealed forever once deployed. */
  revealed: string[]
  /** Blitz mode only: the 5 Pokémon currently offered by this player's shop. */
  shop: string[]
  poke: number
  great: number
  ultra: number
  turns: number
  /** Items collected from field Poké Balls, usable freely on your turn. */
  items: ItemKey[]
  /** The two drafted legendary summons, and which have been spent. */
  summons: string[]
  usedSummons: string[]
}

export interface FloatEvent {
  col: number
  row: number
  text: string
  color: string
  /** Small caption under the number — "Super effective!" / "Not very effective…" */
  sub?: string
}

export interface Chest {
  col: number
  row: number
}

/** A delayed area effect from a targeted summon (Kyogre's whirlpool, Groudon's
 * eruption). Ticks down each turn end; when `fuse` hits 0 it damages every unit
 * standing on one of its tiles, then clears. */
export interface Hazard {
  key: string
  owner: Owner
  /** Damage type for effectiveness, or null for flat/typeless damage. */
  ptype: PType | null
  dmg: number
  tiles: [number, number][]
  fuse: number
  label: string
}

export interface GameState {
  units: Unit[]
  players: Record<Owner, PlayerState>
  current: Owner
  round: number
  winner: Owner | null
  /** Non-champion moves remaining this turn (MOVE_CAP per turn). */
  movesLeft: number
  /** Impassable terrain, mirrored for fairness; blocks movement and lines of fire. */
  rocks: [number, number][]
  /** Field Poké Balls — move onto one to open it (drops an item). */
  chests: Chest[]
  /** Pending delayed area effects from targeted summons. */
  hazards: Hazard[]
  /** Damage dealt per species, per side — feeds the battle-stats panel. */
  stats: Record<Owner, Record<string, number>>
  /** Blitz draft: no pre-drafted deck — deploy straight from a rotating shop. */
  shopMode: boolean
  /** Field palette for this battle, one of the four season tile sets. */
  season: Season
  /** Monotonic counter for plannedSeq. */
  seq: number
  /** Bumps on every action — lets an online guest reconcile optimistic states. */
  tick: number
  /** Lugia's roar: this owner can neither move nor deploy on their next turn. */
  lugiaLock: Owner | null
  /** Transient: the unit acting this resolution step + its attack direction (drives the lunge). */
  acting: { id: number; dc: number; dr: number } | null
  log: string[]
  /** Transient per-action events for floating numbers; overwritten each action. */
  events: FloatEvent[]
}

/** The subset of state the board-geometry helpers need (AI builds virtual ones). */
export type BoardLike = Pick<GameState, 'units' | 'rocks'>

export interface DraftResult {
  champion: string
  picks: string[]
  /** Two legendary summons — one-shot battlefield effects, not units. */
  summons?: string[]
}
