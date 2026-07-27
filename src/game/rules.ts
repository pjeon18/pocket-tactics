import { COLS, DEPLOY_DEPTH, ROSTER, ROWS, SYNERGIES, SYNERGY_THRESHOLD, SYNERGY_TIER2, ptypeOf } from './data'
import type { BallTier, BoardLike, GameState, Owner, PType, PlayerState, Species, Unit } from './types'

export const inBounds = (c: number, r: number) => c >= 0 && c < COLS && r >= 0 && r < ROWS

export const at = (units: Unit[], c: number, r: number) =>
  units.find((u) => u.col === c && u.row === r)

export const rockAt = (board: BoardLike, c: number, r: number) =>
  board.rocks.some(([rc, rr]) => rc === c && rr === r)

/** Anything that stops movement or a line of fire. */
export const blockedAt = (board: BoardLike, c: number, r: number) =>
  !!at(board.units, c, r) || rockAt(board, c, r)

export const otherOwner = (o: Owner): Owner => (o === 'A' ? 'B' : 'A')

/**
 * Tiered deploy zones: the cheaper the Pokémon, the closer to the front it may
 * land — Poké-tier reaches 4 rows deep, Great-tier 3, Ultra-tier 2.
 */
export const deployDepthFor = (tier: BallTier): number =>
  tier === 'poke' ? 4 : tier === 'great' ? 3 : 2

export const inDeployZone = (o: Owner, r: number, depth: number = DEPLOY_DEPTH) =>
  o === 'A' ? r >= ROWS - depth : r < depth

export const canAfford = (p: PlayerState, sp: Species) =>
  p.poke >= sp.cost.poke && p.great >= sp.cost.great && p.ultra >= sp.cost.ultra

/** Off cooldown AND (unless blitz mode already paid at the shop) affordable. */
export const canDeployCard = (p: PlayerState, key: string, shopMode = false) =>
  (p.cooldowns[key] ?? 0) === 0 && (shopMode || canAfford(p, ROSTER[key]))

/* ---------- type synergies (TFT-style, champion counts) ----------
   Tier 1 at 3 UNIQUE same-type Pokémon, tier 2 at 5 — duplicates of the same
   species never add to the count, so spamming one cheap body can't cheat it. */

export function synergyCounts(units: Unit[], owner: Owner): Partial<Record<PType, number>> {
  const seen = new Set<string>()
  const counts: Partial<Record<PType, number>> = {}
  for (const u of units) {
    if (u.owner !== owner || seen.has(u.key)) continue
    seen.add(u.key)
    const t = ptypeOf(u)
    counts[t] = (counts[t] ?? 0) + 1
  }
  return counts
}

/** 0 = inactive, 1 = three uniques fielded, 2 = five uniques fielded. */
export function synergyTier(units: Unit[], owner: Owner, t: PType): 0 | 1 | 2 {
  if (!SYNERGIES[t]) return 0
  const n = synergyCounts(units, owner)[t] ?? 0
  if (n >= SYNERGY_TIER2) return 2
  if (n >= SYNERGY_THRESHOLD) return 1
  return 0
}

export function activeSynergies(units: Unit[], owner: Owner): Set<PType> {
  const out = new Set<PType>()
  const counts = synergyCounts(units, owner)
  for (const t in counts) {
    const pt = t as PType
    if (SYNERGIES[pt] && (counts[pt] ?? 0) >= SYNERGY_THRESHOLD) out.add(pt)
  }
  return out
}

export const hasSynergy = (units: Unit[], u: Unit) =>
  synergyTier(units, u.owner, ptypeOf(u)) >= 1

/** The unit's own synergy tier — numeric bonuses double at tier 2. */
export const tierOf = (units: Unit[], u: Unit) => synergyTier(units, u.owner, ptypeOf(u))

/** ATK with buffs, Blaze (fire +1/+2), Guts (normal +1/+2 below half HP), Swarm tier 2 (+1). */
export function effAtk(units: Unit[], u: Unit): number {
  let a = u.atk + u.atkBuff
  const t = ptypeOf(u)
  const tier = tierOf(units, u)
  if (tier >= 1) {
    if (t === 'fire') a += tier
    if (t === 'normal' && u.hp * 2 <= u.maxHp) a += tier
    if (t === 'bug' && tier >= 2) a += 1
  }
  return a
}

/** Range with Mindlink (psychic +1/+2) and Choice Specs (+3). */
export function effRange(units: Unit[], u: Unit): number {
  let r = u.range
  if (ptypeOf(u) === 'psychic') r += tierOf(units, u)
  if (u.heldItem === 'choice-specs') r += 3
  return r
}

/** Move with buffs, Torrent (water +1/+2), and Choice Scarf (+2). */
export function effMove(units: Unit[], u: Unit): number {
  let m = u.move + u.moveBuff
  if (ptypeOf(u) === 'water') m += tierOf(units, u)
  if (u.heldItem === 'choice-scarf') m += 2
  return m
}

/* ---------- movement ---------- */

export const championMovedThisTurn = (state: GameState) =>
  state.units.some((u) => u.owner === state.current && u.isChampion && u.moved)

export const othersMovedThisTurn = (state: GameState) =>
  state.units.some((u) => u.owner === state.current && !u.isChampion && u.moved)

/**
 * Movement gates: MOVE_CAP non-champion moves per turn, and the champion rule —
 * the champion only moves if nothing else has, and once it moves nothing else may.
 */
export function canMoveNow(state: GameState, u: Unit): boolean {
  if (state.winner || u.owner !== state.current) return false
  if (u.moved || u.stunned) return false // freshly deployed units may move — just not attack
  if (u.isChampion) return !othersMovedThisTurn(state) && !championMovedThisTurn(state)
  return state.movesLeft > 0 && !championMovedThisTurn(state)
}

/** Stun blocks movement only — a stunned Pokémon can still attack from where it stands. */
export function canActNow(state: GameState, u: Unit): boolean {
  if (state.winner || u.owner !== state.current) return false
  return !u.acted && !u.summoned
}

const ORTHO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

/** BFS of tiles reachable in up to `max` orthogonal steps; units and rocks block. */
export function rawReachable(board: BoardLike, u: Unit, max: number): [number, number][] {
  const seen = new Set([`${u.col},${u.row}`])
  const out: [number, number][] = []
  let frontier: [number, number][] = [[u.col, u.row]]
  for (let step = 0; step < max; step++) {
    const next: [number, number][] = []
    for (const [c, r] of frontier) {
      for (const [dc, dr] of ORTHO) {
        const nc = c + dc
        const nr = r + dr
        const k = `${nc},${nr}`
        if (!inBounds(nc, nr) || seen.has(k) || blockedAt(board, nc, nr)) continue
        seen.add(k)
        next.push([nc, nr])
        out.push([nc, nr])
      }
    }
    frontier = next
  }
  return out
}

export function reachable(state: GameState, u: Unit): [number, number][] {
  if (!canMoveNow(state, u)) return []
  return rawReachable(state, u, effMove(state.units, u))
}

/* ---------- attacking ---------- */

export const DIRS8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const

/**
 * Enemies attackable from (col,row): scan the 8 rays out to `range`; the first
 * unit or rock on a ray ends it (allies and terrain block the line of fire).
 * With `ignoreBlock`, instead returns every enemy within Chebyshev `range`.
 */
export function targetsFrom(
  board: BoardLike,
  u: Unit,
  col = u.col,
  row = u.row,
  range?: number,
  ignoreBlock = false,
): Unit[] {
  range ??= effRange(board.units, u)
  if (ignoreBlock) {
    return board.units.filter(
      (t) =>
        t.owner !== u.owner &&
        Math.max(Math.abs(t.col - col), Math.abs(t.row - row)) <= range,
    )
  }
  const out: Unit[] = []
  for (const [dc, dr] of DIRS8) {
    for (let d = 1; d <= range; d++) {
      const c = col + dc * d
      const r = row + dr * d
      if (!inBounds(c, r)) break
      if (rockAt(board, c, r)) break
      const t = at(board.units, c, r)
      if (t) {
        if (t.owner !== u.owner) out.push(t)
        break
      }
    }
  }
  return out
}

/** Every tile `u` could attack after any of its possible moves — the danger-zone overlay. */
export function threatTiles(state: GameState, u: Unit): Set<string> {
  const tiles = new Set<string>()
  const range = effRange(state.units, u)
  const dests: [number, number][] = [[u.col, u.row]]
  if (!u.summoned && !u.stunned) dests.push(...rawReachable(state, u, effMove(state.units, u)))
  for (const [c, r] of dests) {
    for (const [dc, dr] of DIRS8) {
      for (let d = 1; d <= range; d++) {
        const nc = c + dc * d
        const nr = r + dr * d
        if (!inBounds(nc, nr)) break
        if (rockAt(state, nc, nr)) break
        tiles.add(`${nc},${nr}`)
        const blocker = at(state.units, nc, nr)
        if (blocker && blocker.id !== u.id) break
      }
    }
  }
  return tiles
}

/** Empty tiles in `owner`'s deploy zone. */
export function openDeployTiles(state: GameState, owner: Owner, depth: number = DEPLOY_DEPTH): [number, number][] {
  const rows: number[] = []
  for (let d = 1; d <= depth; d++) rows.push(owner === 'A' ? ROWS - d : d - 1)
  const out: [number, number][] = []
  for (const r of rows)
    for (let c = 0; c < COLS; c++) if (!blockedAt(state, c, r)) out.push([c, r])
  return out
}

export const speciesOf = (key: string): Species => ROSTER[key]
