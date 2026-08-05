import {
  CHAMPIONS,
  CHEST_EVERY,
  CHEST_MAX,
  COLS,
  DROPS,
  FATIGUE_ROUND,
  GREAT_CAP,
  FIELD_CAP,
  INCOME_CAP,
  INCOME_BREAKS,
  KILL_BOUNTY,
  ITEMS,
  TUNING,
  MOVE_CAP,
  POKE_CAP,
  ROCK_CLUSTERS,
  ROSTER,
  ROWS,
  START_POKE_A,
  TRADE_GREAT_COST,
  TRADE_ULTRA_COST,
  ULTRA_CAP,
  costEquiv,
  metaOf,
  nameOf,
  ptypeOf,
  specialNameOf,
  typeMult,
  typeSign,
} from './data'
import {
  at,
  blockedAt,
  canActNow,
  canAfford,
  canDeployCard,
  canMoveNow,
  effAtk,
  hasSynergy,
  tierOf,
  inBounds,
  deployDepthFor,
  inDeployZone,
  openDeployTiles,
  otherOwner,
  reachable,
  rockAt,
  targetsFrom,
} from './rules'
import { SUMMONS, synergyThresholds } from './data'
import { synergyTier } from './rules'
import type { DraftResult, GameState, Hazard, ItemKey, Owner, Season, Unit } from './types'

let UID = 1

const COLOR = {
  normal: '#3B4046',
  strong: '#D64545',
  resist: '#A6ABB3',
  special: '#C9930A',
  heal: '#3E9B63',
  chest: '#C9930A',
}

export function makeUnit(key: string, owner: Owner, col: number, row: number): Unit {
  const s = ROSTER[key]
  return {
    id: UID++, key, owner, isChampion: false, col, row,
    hp: s.hp, maxHp: s.hp, atk: s.atk, range: s.range, move: s.move,
    charge: 0, chargeMax: s.chargeMax,
    moved: false, movedFrom: null, acted: false, planned: null, plannedSeq: 0,
    summoned: false, stunned: false, atkBuff: 0, moveBuff: 0, abilityUsed: false,
    heldItem: null,
  }
}

export function makeChampion(key: string, owner: Owner, col: number, row: number): Unit {
  const s = CHAMPIONS[key]
  return {
    id: UID++, key, owner, isChampion: true, col, row,
    hp: s.hp, maxHp: s.hp, atk: s.atk, range: s.range, move: s.move,
    charge: 0, chargeMax: s.chargeMax,
    moved: false, movedFrom: null, acted: false, planned: null, plannedSeq: 0,
    summoned: false, stunned: false, atkBuff: 0, moveBuff: 0, abilityUsed: false,
    heldItem: null,
  }
}

/** Mirrored terrain: each rock is paired with its 180°-rotated twin, so the map is fair. */
/**
 * Terrain spawns as touching DOMINOES (two adjacent tiles), each mirrored 180°
 * for fairness — so obstacles are always at least a 2-tile wall, never lone specks.
 */
function generateRocks(): [number, number][] {
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  let guard = 0
  while (guard++ < 80) {
    const c = Math.floor(Math.random() * COLS)
    const r = 3 + Math.floor(Math.random() * 4) // rows 3–6
    const [dc, dr] = DIRS[Math.floor(Math.random() * DIRS.length)]
    const c2 = c + dc
    const r2 = r + dr
    if (c2 < 0 || c2 >= COLS || r2 < 3 || r2 > 6) continue
    const cluster: [number, number][] = [
      [c, r],
      [c2, r2],
    ]
    const mirror: [number, number][] = cluster.map(([x, y]) => [COLS - 1 - x, ROWS - 1 - y])
    const keys = new Set(cluster.map(([x, y]) => `${x},${y}`))
    if (mirror.some(([x, y]) => keys.has(`${x},${y}`))) continue // overlaps its own mirror
    if (ROCK_CLUSTERS === 1) return [...cluster, ...mirror]
  }
  return []
}

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

export function newBattle(
  draftA: DraftResult,
  draftB: DraftResult,
  shopMode = false,
  season?: Season,
): GameState {
  const mid = Math.floor(COLS / 2)
  const state: GameState = {
    units: [
      makeChampion(draftA.champion, 'A', mid, ROWS - 1),
      makeChampion(draftB.champion, 'B', mid, 0),
    ],
    players: {
      A: { championKey: draftA.champion, bench: shopMode ? [] : [...draftA.picks], fainted: [], cooldowns: {}, revealed: [], shop: [], poke: START_POKE_A, great: 0, ultra: 0, turns: 0, items: [], summons: draftA.summons ?? [], usedSummons: [] },
      B: { championKey: draftB.champion, bench: shopMode ? [] : [...draftB.picks], fainted: [], cooldowns: {}, revealed: [], shop: [], poke: TUNING.startPokeB, great: TUNING.startGreatB, ultra: 0, turns: 0, items: [], summons: draftB.summons ?? [], usedSummons: [] },
    },
    current: 'A',
    round: 1,
    winner: null,
    movesLeft: MOVE_CAP,
    rocks: generateRocks(),
    chests: [],
    hazards: [],
    stats: { A: {}, B: {} },
    shopMode,
    season: season ?? SEASONS[Math.floor(Math.random() * SEASONS.length)],
    seq: 1,
    tick: 0,
    lugiaLock: null,
    acting: null,
    log: [],
    events: [],
  }
  grantIncome(state)
  return state
}

/* ---------- blitz-draft shop ---------- */

const SHOP_SIZE = 5

/**
 * Rotate the shop: 5 Pokémon you don't already own, filtered so the price band
 * grows with the game — cheap picks early, premiums once you could afford them.
 */
function rollShop(state: GameState, owner: Owner) {
  const p = state.players[owner]
  const maxEquiv = 3 + Math.floor(state.round * 1.2)
  const pool = Object.values(ROSTER).filter(
    (s) => !p.bench.includes(s.key) && costEquiv(s.cost) <= maxEquiv,
  )
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  p.shop = shuffled.slice(0, SHOP_SIZE).map((s) => s.key)
}


/* ---------- internals ---------- */

const clone = (state: GameState): GameState => {
  const next = structuredClone(state)
  next.events = []
  next.acting = null
  next.tick = (state.tick ?? 0) + 1
  return next
}

/** 1 Poké Ball per turn, stepping up at the INCOME_BREAKS rounds. Cooldowns tick here. */
function grantIncome(state: GameState) {
  const p = state.players[state.current]
  p.turns++
  // income growth is CAPPED — late game pays a steady trickle, not a flood
  const income = Math.min(INCOME_CAP, 1 + INCOME_BREAKS.filter((r) => state.round >= r).length)
  // Payday: Normal-type synergy pays out extra Poké Balls (2 uniques → +1, 4 → +2)
  const payday = synergyTier(state.units, state.current, 'normal')
  p.poke = Math.min(POKE_CAP, p.poke + income + payday)
  for (const key in p.cooldowns) {
    if (p.cooldowns[key] > 0) p.cooldowns[key]--
  }
  if (state.shopMode) rollShop(state, state.current)
}

/** Non-champion Pokémon a player has on the field. */
export const fieldedCount = (state: GameState, owner: Owner) =>
  state.units.filter((u) => u.owner === owner && !u.isChampion).length

/**
 * The one damage pipeline. Base + type mod (±1), +1 Life Orb (attacker),
 * +1 Focus on specials (fighting synergy), −1 Bulwark (steel-synergy defender);
 * floor 1. Attributed damage feeds the battle-stats panel.
 */
function dealDamage(
  state: GameState,
  src: Unit | null,
  tgt: Unit,
  base: number,
  color: string,
  kind: 'normal' | 'special' | 'raw' = 'special',
  suffix = '',
  crit = false,
) {
  let amt = base
  let mark = ''
  let sub: string | undefined
  if (src && kind !== 'raw') {
    // 1. flat modifiers (items, synergy riders) adjust the base hit …
    if (src.heldItem === 'life-orb') amt += 1
    const srcTier = tierOf(state.units, src)
    if (kind === 'special' && ptypeOf(src) === 'fighting') amt += srcTier
    if (tgt.stunned && ptypeOf(src) === 'ice') amt += srcTier
    if (tgt.hp === tgt.maxHp && ptypeOf(src) === 'dark') amt += srcTier
    const tgtTier = tierOf(state.units, tgt)
    if (ptypeOf(tgt) === 'steel') amt -= tgtTier
    if (ptypeOf(tgt) === 'rock' && tgtTier >= 2) amt -= 1 // Sturdy tier 2
    amt = Math.max(1, amt)

    // 2. … then the matchup scales it proportionally
    const sign = typeSign(ptypeOf(src), ptypeOf(tgt))
    if (sign !== 0) {
      amt = Math.max(1, Math.ceil(amt * typeMult(ptypeOf(src), ptypeOf(tgt))))
      mark = sign > 0 ? '!' : ''
      color = sign > 0 ? COLOR.strong : COLOR.resist
      sub = sign > 0 ? 'Super effective!' : 'Not very effective…'
    }
  }
  // 3. a critical hit scales whatever survived the above
  if (crit) amt = Math.ceil(amt * TUNING.critMult)
  amt = Math.max(1, amt)
  tgt.hp -= amt
  if (src) state.stats[src.owner][src.key] = (state.stats[src.owner][src.key] ?? 0) + amt
  state.events.push({ col: tgt.col, row: tgt.row, text: `-${amt}${mark}${suffix}`, color, sub })
}

function dealHeal(state: GameState, tgt: Unit, amt: number) {
  const healed = Math.min(amt, tgt.maxHp - tgt.hp)
  if (healed <= 0) return
  tgt.hp += healed
  state.events.push({ col: tgt.col, row: tgt.row, text: `+${healed}`, color: COLOR.heal })
}

function stun(tgt: Unit) {
  if (!tgt.isChampion) tgt.stunned = true
}

/** Push `tgt` up to `dist` tiles along the attacker→target vector. Champions immune. */
function knockback(state: GameState, attacker: Unit, tgt: Unit, dist: number) {
  if (tgt.isChampion) return
  const dc = Math.sign(tgt.col - attacker.col)
  const dr = Math.sign(tgt.row - attacker.row)
  for (let i = 0; i < dist; i++) {
    const nc = tgt.col + dc
    const nr = tgt.row + dr
    if (!inBounds(nc, nr) || blockedAt(state, nc, nr)) break
    tgt.col = nc
    tgt.row = nr
  }
}

/** Remove fainted units, record them, and set the winner if a champion fell. */
function cleanup(state: GameState) {
  const dead = state.units.filter((u) => u.hp <= 0)
  for (const d of dead) {
    state.log.push(`${nameOf(d)} fainted!`)
    if (d.isChampion) state.winner = otherOwner(d.owner)
    else {
      state.players[d.owner].fainted.push(d.key)
      // kill bounty: aggression is tempo — the KO pays the other side a ball
      const hunter = state.players[otherOwner(d.owner)]
      hunter.poke = Math.min(POKE_CAP, hunter.poke + KILL_BOUNTY)
      state.events.push({ col: d.col, row: d.row, text: '+1 ball', color: COLOR.chest })
      state.log.push(`Bounty: +${KILL_BOUNTY} Poké Ball.`)
    }
  }
  if (dead.length) state.units = state.units.filter((u) => u.hp > 0)
}

/* ---------- field Poké Balls (item drops) ---------- */


function openFieldBall(state: GameState, u: Unit) {
  const total = DROPS.reduce((n, d) => n + d.weight, 0)
  let roll = Math.random() * total
  let drop = DROPS[0].drop
  for (const d of DROPS) {
    roll -= d.weight
    if (roll <= 0) {
      drop = d.drop
      break
    }
  }
  const p = state.players[u.owner]
  if (drop.type === 'ball') {
    // ball drops convert straight to currency
    if (drop.tier === 'great') p.great = Math.min(GREAT_CAP, p.great + 1)
    else p.ultra = Math.min(ULTRA_CAP, p.ultra + 1)
    const label = drop.tier === 'great' ? 'Great Ball' : 'Ultra Ball'
    state.events.push({ col: u.col, row: u.row, text: `+${label}`, color: COLOR.chest })
    state.log.push(`${nameOf(u)} opened a Poké Ball — found a ${label}!`)
  } else {
    p.items.push(drop.key)
    state.events.push({ col: u.col, row: u.row, text: ITEMS[drop.key].name, color: COLOR.chest })
    state.log.push(`${nameOf(u)} opened a Poké Ball — found a ${ITEMS[drop.key].name}!`)
  }
}

/** A field Poké Ball drops like clockwork every CHEST_EVERY rounds. */
function maybeSpawnChest(state: GameState) {
  if (state.round % CHEST_EVERY !== 0 || state.chests.length >= CHEST_MAX) return
  const open: [number, number][] = []
  for (let r = 3; r <= 6; r++)
    for (let c = 0; c < COLS; c++)
      if (!blockedAt(state, c, r) && !state.chests.some((ch) => ch.col === c && ch.row === r))
        open.push([c, r])
  if (!open.length) return
  const [c, r] = open[Math.floor(Math.random() * open.length)]
  state.chests.push({ col: c, row: r })
  state.log.push('A Poké Ball appeared on the field.')
}

/* ---------- public actions (each returns a new state, or null if illegal) ---------- */

export function deploy(state0: GameState, owner: Owner, key: string, col: number, row: number): GameState | null {
  if (state0.winner || owner !== state0.current) return null
  const sp = ROSTER[key]
  const p0 = state0.players[owner]
  if (!sp) return null
  if (state0.shopMode) {
    // blitz: deploy straight from the rotating shop — you never keep a card
    if (!p0.shop.includes(key) || !canAfford(p0, sp)) return null
  } else {
    if (!p0.bench.includes(key) || !canDeployCard(p0, key)) return null
  }
  if (!inBounds(col, row) || !inDeployZone(owner, row, deployDepthFor(sp.tier)) || blockedAt(state0, col, row)) return null
  if (fieldedCount(state0, owner) >= FIELD_CAP) return null // quality over quantity
  if (state0.lugiaLock === owner) return null // Lugia's roar grounds new arrivals too

  const state = clone(state0)
  state.events = []
  const p = state.players[owner]
  p.poke -= sp.cost.poke
  p.great -= sp.cost.great
  p.ultra -= sp.cost.ultra
  if (state.shopMode) p.shop = p.shop.filter((k) => k !== key)
  else p.cooldowns[key] = sp.cooldown // the card stays in the deck; it just cools down
  if (!p.revealed.includes(key)) p.revealed.push(key) // once seen, seen forever
  const u = makeUnit(key, owner, col, row)
  // deploy time: nobody swings the turn they land (they may still move)
  u.summoned = true
  state.units.push(u)
  state.log.push(`${sp.name} joined the battle.`)
  return state
}

/**
 * Unleash a drafted legendary summon: a one-shot, field-wide effect. Free action
 * besides its Poké Ball cost; each summon fires once per game.
 */
/** Rows nearest the OPPONENT's home edge — off-limits for summon targeting. */
function oppBackRows(owner: Owner): number[] {
  return otherOwner(owner) === 'B' ? [0, 1] : [ROWS - 2, ROWS - 1]
}

export function useSummon(
  state0: GameState,
  owner: Owner,
  key: string,
  target?: { col?: number; row?: number },
): GameState | null {
  if (state0.winner || owner !== state0.current) return null
  const def = SUMMONS[key]
  const p0 = state0.players[owner]
  // re-castable: only requires that it was drafted and you can afford it
  if (!def || !p0.summons.includes(key)) return null
  if (p0.poke < def.cost) return null

  // targeted summons must be aimed at a legal spot
  const banned = oppBackRows(owner)
  if (def.target === 'tile') {
    if (target?.col == null || target?.row == null) return null
    if (target.col < 0 || target.col >= COLS || target.row < 0 || target.row >= ROWS) return null
    if (banned.includes(target.row)) return null
  }
  if (def.target === 'row') {
    if (target?.row == null || target.row < 0 || target.row >= ROWS) return null
    if (banned.includes(target.row)) return null
  }

  const state = clone(state0)
  const p = state.players[owner]
  p.poke -= def.cost
  if (!p.usedSummons.includes(key)) p.usedSummons.push(key) // revealed to the foe once cast
  const mine = state.units.filter((u) => u.owner === owner)

  switch (key) {
    case 'hooh':
      for (const u of mine) {
        u.maxHp += 3
        u.hp += 3
        state.events.push({ col: u.col, row: u.row, text: '+3', color: '#3E9B63' })
      }
      break
    case 'lugia':
      state.lugiaLock = otherOwner(owner)
      break
    case 'dialga':
      for (const u of mine) {
        if (u.charge < u.chargeMax) {
          u.charge = u.chargeMax
          state.events.push({ col: u.col, row: u.row, text: 'CHARGED', color: '#C9930A' })
        }
      }
      break
    case 'palkia':
      for (const u of mine) {
        u.moveBuff = Math.max(u.moveBuff, 5 - u.move)
        state.events.push({ col: u.col, row: u.row, text: 'WARP', color: '#C9930A' })
      }
      break
    case 'kyogre': {
      const tiles: [number, number][] = []
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const c = target!.col! + dc
          const r = target!.row! + dr
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS) tiles.push([c, r])
        }
      }
      // fuse 2: ticks at the end of this turn and again at the end of the foe's
      state.hazards.push({ key, owner, ptype: 'water', dmg: 4, tiles, fuse: 2, label: 'Whirlpool' })
      break
    }
    case 'groudon': {
      const tiles: [number, number][] = []
      for (let c = 0; c < COLS; c++) tiles.push([c, target!.row!])
      // fuse 1: erupts at the end of this turn — no time to flee. Typeless.
      state.hazards.push({ key, owner, ptype: null, dmg: 6, tiles, fuse: 1, label: 'Eruption' })
      break
    }
    default:
      return null
  }
  state.log.push(`${def.name} answered the call! ${def.desc}`)
  return state
}

/** Tick every pending hazard; resolve (damage everyone on its tiles) at fuse 0. */
function resolveHazards(state: GameState) {
  const survivors: Hazard[] = []
  for (const hz of state.hazards) {
    // a hazard strikes on EVERY turn end while it's alive — Kyogre's whirlpool
    // (fuse 2) hits at the end of the summon turn and again after the foe moves;
    // Groudon's eruption (fuse 1) strikes once, at the end of the summon turn.
    let hit = false
    for (const [c, r] of hz.tiles) {
      const u = at(state.units, c, r)
      if (!u) continue
      const amt = Math.max(1, Math.ceil(hz.dmg * (hz.ptype ? typeMult(hz.ptype, ptypeOf(u)) : 1)))
      dealDamage(state, null, u, amt, COLOR.special, 'raw', '')
      hit = true
    }
    if (hit) state.log.push(`${SUMMONS[hz.key]?.name ?? hz.label} crashes down!`)
    hz.fuse -= 1
    if (hz.fuse > 0) survivors.push(hz)
  }
  state.hazards = survivors
  cleanup(state)
}

/** Trade Poké Balls up: 3 → 1 Great Ball, 6 → 1 Ultra Ball. Free action. */
export function tradeBalls(state0: GameState, owner: Owner, target: 'great' | 'ultra'): GameState | null {
  if (state0.winner || owner !== state0.current) return null
  const p0 = state0.players[owner]
  if (target === 'great' && (p0.poke < TRADE_GREAT_COST || p0.great >= GREAT_CAP)) return null
  if (target === 'ultra' && (p0.poke < TRADE_ULTRA_COST || p0.ultra >= ULTRA_CAP)) return null

  const state = clone(state0)
  state.events = []
  const p = state.players[owner]
  if (target === 'great') {
    p.poke -= TRADE_GREAT_COST
    p.great += 1
    state.log.push('Traded 3 Poké Balls for a Great Ball.')
  } else {
    p.poke -= TRADE_ULTRA_COST
    p.ultra += 1
    state.log.push('Traded 6 Poké Balls for an Ultra Ball.')
  }
  return state
}

export function moveUnit(state0: GameState, unitId: number, col: number, row: number): GameState | null {
  const u0 = state0.units.find((x) => x.id === unitId)
  if (!u0 || !canMoveNow(state0, u0)) return null
  if (!reachable(state0, u0).some(([c, r]) => c === col && r === row)) return null

  const state = clone(state0)
  state.events = []
  const u = state.units.find((x) => x.id === unitId)!
  u.movedFrom = [u.col, u.row]
  u.col = col
  u.row = row
  u.moved = true
  if (!u.isChampion) state.movesLeft--
  const chest = state.chests.find((ch) => ch.col === col && ch.row === row)
  if (chest) {
    state.chests = state.chests.filter((ch) => ch !== chest)
    openFieldBall(state, u)
    u.movedFrom = null // a field ball can't be un-opened
  }
  return state
}

/** Reusable revive: shared by Mew's Genesis and the Revive item. */
function reviveUnit(state: GameState, owner: Owner, key: string, col: number, row: number): boolean {
  const p = state.players[owner]
  if (!p.fainted.includes(key)) return false
  if (!inDeployZone(owner, row, deployDepthFor(ROSTER[key].tier)) || blockedAt(state, col, row)) return false
  if (fieldedCount(state, owner) >= FIELD_CAP) return false
  p.fainted.splice(p.fainted.indexOf(key), 1)
  const nu = makeUnit(key, owner, col, row)
  nu.summoned = true
  state.units.push(nu)
  return true
}

/** Use a collected item. Free — costs no move, no action. */
export function useItem(
  state0: GameState,
  owner: Owner,
  item: ItemKey,
  payload: { targetId?: number; reviveKey?: string; col?: number; row?: number } = {},
): GameState | null {
  if (state0.winner || owner !== state0.current) return null
  if (!state0.players[owner].items.includes(item)) return null

  const state = clone(state0)
  state.events = []
  const p = state.players[owner]
  const target = state.units.find((x) => x.id === payload.targetId)

  if (item === 'potion' || item === 'super-potion' || item === 'max-potion') {
    if (!target || target.owner !== owner) return null
    dealHeal(state, target, item === 'potion' ? 3 : item === 'super-potion' ? 5 : target.maxHp)
  } else if (item === 'power-herb') {
    if (!target || target.owner !== owner || target.charge >= target.chargeMax) return null
    target.charge = target.chargeMax
    state.events.push({ col: target.col, row: target.row, text: 'CHARGED', color: COLOR.special })
  } else if (item === 'lum-berry') {
    if (!target || target.owner !== owner || !target.stunned) return null
    target.stunned = false
    state.events.push({ col: target.col, row: target.row, text: 'CURED', color: COLOR.heal })
  } else if (item === 'revive') {
    if (payload.reviveKey == null || payload.col == null || payload.row == null) return null
    if (!reviveUnit(state, owner, payload.reviveKey, payload.col, payload.row)) return null
  } else {
    // held items attach permanently, one per Pokémon
    if (!target || target.owner !== owner || target.heldItem) return null
    target.heldItem = item
    if (item === 'assault-vest') {
      target.maxHp += 2
      target.hp += 2
      state.events.push({ col: target.col, row: target.row, text: '+2 HP', color: COLOR.heal })
    } else {
      state.events.push({ col: target.col, row: target.row, text: ITEMS[item].name, color: COLOR.chest })
    }
  }
  p.items.splice(p.items.indexOf(item), 1)
  state.log.push(`${ITEMS[item].name} used.`)
  return state
}

/** Return a moved unit to where it started this turn (mis-press insurance). */
export function undoMove(state0: GameState, unitId: number): GameState | null {
  const u0 = state0.units.find((x) => x.id === unitId)
  if (!u0 || state0.winner || u0.owner !== state0.current) return null
  if (!u0.moved || !u0.movedFrom) return null
  const [c, r] = u0.movedFrom
  if (blockedAt(state0, c, r)) return null

  const state = clone(state0)
  state.events = []
  const u = state.units.find((x) => x.id === unitId)!
  u.col = c
  u.row = r
  u.moved = false
  u.movedFrom = null
  if (!u.isChampion) state.movesLeft++
  // the plan was made from the new position — clear it rather than let it dangle
  if (u.planned) {
    u.planned = null
    u.acted = false
  }
  return state
}

/* ---------- planning (damage is declared now, dealt at end of turn) ---------- */

/** Plan a normal attack, or an enemy-targeted special when `special` is true. */
export function planAttack(state0: GameState, attackerId: number, targetId: number, special: boolean): GameState | null {
  const a0 = state0.units.find((x) => x.id === attackerId)
  const t0 = state0.units.find((x) => x.id === targetId)
  if (!a0 || !t0 || t0.owner === a0.owner || !canActNow(state0, a0)) return null

  const meta = metaOf(a0)
  if (special) {
    if (a0.charge < a0.chargeMax || meta.kind !== 'enemy') return null
    const legal = targetsFrom(state0, a0, a0.col, a0.row, meta.rangeOverride ?? a0.range, meta.ignoreBlock)
    if (!legal.some((x) => x.id === targetId)) return null
  } else {
    if (!targetsFrom(state0, a0).some((x) => x.id === targetId)) return null
  }

  const state = clone(state0)
  state.events = []
  const a = state.units.find((x) => x.id === attackerId)!

  // Extreme Speed: the only attack that resolves the moment it is declared
  if (special && meta.instant) {
    const t = state.units.find((x) => x.id === targetId)!
    state.acting = { id: a.id, dc: Math.sign(t.col - a.col), dr: Math.sign(t.row - a.row) }
    state.log.push(`${nameOf(a)} used ${specialNameOf(a)} on ${nameOf(t)} — instantly!`)
    a.charge = 0
    resolveEnemySpecial(state, a, t)
    a.acted = true
    a.movedFrom = null
    cleanup(state)
    return state
  }

  a.planned = { kind: special ? 'special' : 'attack', targetId }
  a.plannedSeq = state.seq++
  a.acted = true
  a.movedFrom = null // committed — the move can no longer be undone
  return state
}

/** Plan an area special (Garchomp, Chandelure) or Jirachi's tile strike. */
export function planArea(state0: GameState, unitId: number, tile?: { col: number; row: number }): GameState | null {
  const u0 = state0.units.find((x) => x.id === unitId)
  if (!u0 || !canActNow(state0, u0) || u0.charge < u0.chargeMax) return null
  const meta = metaOf(u0)
  if (u0.isChampion && CHAMPIONS[u0.key].once && u0.abilityUsed) return null

  const state = clone(state0)
  state.events = []
  const u = state.units.find((x) => x.id === unitId)!
  if (meta.kind === 'aoe') {
    u.planned = { kind: 'aoe' }
  } else if (meta.kind === 'tile') {
    if (!tile || !inBounds(tile.col, tile.row)) return null
    const range = meta.rangeOverride ?? u.range
    if (Math.max(Math.abs(tile.col - u.col), Math.abs(tile.row - u.row)) > range) return null
    u.planned = { kind: 'tile', col: tile.col, row: tile.row }
  } else return null
  u.plannedSeq = state.seq++
  u.acted = true
  u.movedFrom = null
  return state
}

/** Take back a planned action (before the turn ends). */
export function cancelPlan(state0: GameState, unitId: number): GameState | null {
  const u0 = state0.units.find((x) => x.id === unitId)
  if (!u0 || u0.owner !== state0.current || !u0.planned) return null
  const state = clone(state0)
  state.events = []
  const u = state.units.find((x) => x.id === unitId)!
  u.planned = null
  u.acted = false
  return state
}

/* ---------- instant support abilities (heals, buffs, revive) ---------- */

export interface AbilityPayload {
  targetId?: number
  col?: number
  row?: number
  reviveKey?: string
}

export function useAbility(state0: GameState, unitId: number, payload: AbilityPayload = {}): GameState | null {
  const u0 = state0.units.find((x) => x.id === unitId)
  if (!u0 || !canActNow(state0, u0) || u0.charge < u0.chargeMax) return null
  const meta = metaOf(u0)
  if (!['self', 'ally', 'team', 'revive', 'blink'].includes(meta.kind)) return null

  const state = clone(state0)
  state.events = []
  const u = state.units.find((x) => x.id === unitId)!

  switch (meta.kind) {
    case 'self': {
      // Grotle · Synthesis / Sunkern · Ingrain / Ferroseed · Iron Defense / Carracosta · Shell Smash
      if (u.key === 'carracosta') {
        u.atkBuff += 2
        u.moveBuff += 2
        state.events.push({ col: u.col, row: u.row, text: 'SMASH', color: COLOR.special })
      } else if (u.key === 'lillipup') {
        // Pickup — scrounges up a spare Poké Ball (was 2: too strong an engine)
        const p = state.players[u.owner]
        p.poke = Math.min(POKE_CAP, p.poke + 1)
        state.events.push({ col: u.col, row: u.row, text: '+1 ball', color: COLOR.chest })
      } else {
        dealHeal(state, u, u.key === 'grotle' || u.key === 'metapod' ? 4 : 2)
      }
      break
    }
    case 'blink': {
      // Abra · Teleport
      const { col, row } = payload
      const range = meta.rangeOverride ?? 3
      if (col == null || row == null || !inBounds(col, row)) return null
      if (blockedAt(state, col, row)) return null
      if (Math.max(Math.abs(col - u.col), Math.abs(row - u.row)) > range) return null
      u.col = col
      u.row = row
      u.movedFrom = null
      state.events.push({ col, row, text: '✦', color: COLOR.special })
      break
    }
    case 'ally': {
      // healers: Kirlia (4) · Audino (3) · Chansey (5)
      const t = state.units.find((x) => x.id === payload.targetId)
      if (!t || t.owner !== u.owner || t.id === u.id) return null
      const range = meta.rangeOverride ?? u.range
      if (Math.max(Math.abs(t.col - u.col), Math.abs(t.row - u.row)) > range) return null
      const amount = { kirlia: 4, audino: 3, chansey: 5 }[u.key] ?? 4
      dealHeal(state, t, amount)
      state.log.push(`${nameOf(u)} healed ${nameOf(t)}.`)
      break
    }
    case 'team': {
      if (u.key === 'celebi') {
        for (const s of state.units) if (s.owner === u.owner) dealHeal(state, s, 3)
      } else if (u.key === 'victini') {
        for (const s of state.units) {
          if (s.owner !== u.owner) continue
          s.atkBuff += 2
          s.moveBuff += 2
        }
        state.events.push({ col: u.col, row: u.row, text: 'V!', color: COLOR.special })
      } else return null
      break
    }
    case 'revive': {
      // Mew · Genesis
      const { reviveKey, col, row } = payload
      if (reviveKey == null || col == null || row == null) return null
      if (!reviveUnit(state, u.owner, reviveKey, col, row)) return null
      break
    }
  }

  state.log.push(`${nameOf(u)} used ${specialNameOf(u)}!`)
  u.charge = 0
  u.acted = true
  u.abilityUsed = true
  return state
}

/* ---------- resolution: planned actions fire one by one at end of turn ---------- */

const rayDir = (a: Unit, t: Unit): [number, number] => [
  Math.sign(t.col - a.col),
  Math.sign(t.row - a.row),
]

function resolveEnemySpecial(state: GameState, a: Unit, t: Unit) {
  const S = COLOR.special
  switch (a.key) {
    case 'onix': {
      dealDamage(state, a, t, 2, S)
      stun(t)
      break
    }
    case 'gigalith': {
      dealDamage(state, a, t, 3, S)
      for (const s of state.units) {
        if (s.owner === a.owner || s.id === t.id) continue
        if (Math.max(Math.abs(s.col - t.col), Math.abs(s.row - t.row)) === 1) dealDamage(state, a, s, 2, S)
      }
      break
    }
    case 'ferrothorn': {
      // Power Whip: drag the target adjacent
      dealDamage(state, a, t, 4, S)
      if (t.hp > 0 && !t.isChampion) {
        const dcF = Math.sign(a.col - t.col)
        const drF = Math.sign(a.row - t.row)
        while (Math.max(Math.abs(t.col - a.col), Math.abs(t.row - a.row)) > 1) {
          const nc = t.col + dcF
          const nr = t.row + drF
          if (blockedAt(state, nc, nr)) break
          t.col = nc
          t.row = nr
        }
      }
      break
    }
    case 'steelix': {
      dealDamage(state, a, t, 4, S)
      if (t.hp > 0) knockback(state, a, t, 1)
      break
    }
    case 'snorlax': {
      dealDamage(state, a, t, 5, S)
      stun(t)
      break
    }
    case 'quagsire': {
      dealDamage(state, a, t, 3, S)
      if (t.hp > 0) knockback(state, a, t, 1)
      break
    }
    case 'bronzong': {
      dealDamage(state, a, t, 1, S)
      stun(t)
      break
    }
    case 'jynx': {
      dealDamage(state, a, t, 2, S)
      stun(t)
      break
    }
    case 'lapras': {
      dealDamage(state, a, t, 3, S)
      for (const s of state.units) {
        if (s.owner === a.owner || s.id === t.id) continue
        if (Math.max(Math.abs(s.col - t.col), Math.abs(s.row - t.row)) === 1) dealDamage(state, a, s, 2, S)
      }
      break
    }
    case 'hitmonlee': {
      // High Jump Kick: huge, but risky
      if (Math.random() < 0.25) {
        state.events.push({ col: t.col, row: t.row, text: 'MISS', color: COLOR.resist })
        dealDamage(state, null, a, 2, COLOR.normal)
        state.log.push(`${nameOf(a)} crashed and took 2!`)
      } else {
        dealDamage(state, a, t, 8, S)
      }
      break
    }
    case 'umbreon': {
      dealDamage(state, a, t, 3, S)
      dealHeal(state, a, 2)
      break
    }
    case 'rhyperior': {
      dealDamage(state, a, t, 6, S)
      if (t.hp > 0) knockback(state, a, t, 1)
      break
    }
    case 'gyarados': {
      dealDamage(state, a, t, 6, S)
      if (t.hp > 0) knockback(state, a, t, 2)
      break
    }
    case 'vulpix': {
      dealDamage(state, a, t, 2, S)
      const [dcV, drV] = rayDir(a, t)
      const lick = at(state.units, t.col + dcV, t.row + drV)
      if (lick && lick.owner !== a.owner) dealDamage(state, a, lick, 1, S)
      break
    }
    case 'poochyena': {
      dealDamage(state, a, t, 2, S)
      if (t.hp > 0) knockback(state, a, t, 2)
      break
    }
    case 'ponyta': {
      dealDamage(state, a, t, 3, S)
      a.move += 1 // permanently faster
      state.events.push({ col: a.col, row: a.row, text: 'MOV+1', color: S })
      break
    }
    case 'golem': {
      // Rock Blast: 2 dmg, 2-4 times
      const hits = 2 + Math.floor(Math.random() * 3)
      for (let i = 0; i < hits && t.hp > 0; i++) dealDamage(state, a, t, 2, S)
      break
    }
    case 'mamoswine': {
      // Icicle Spear: up to 4 spears at 3 dmg each; the first always lands,
      // each further spear only fires if the previous did (100/75/50/25%).
      const chances = [1, 0.75, 0.5, 0.25]
      for (const c of chances) {
        if (t.hp <= 0 || Math.random() >= c) break
        dealDamage(state, a, t, 4, S)
      }
      break
    }
    case 'houndoom': {
      dealDamage(state, a, t, 4, S)
      const [dcH, drH] = rayDir(a, t)
      const behindH = at(state.units, t.col + dcH, t.row + drH)
      if (behindH && behindH.owner !== a.owner) dealDamage(state, a, behindH, 3, S)
      break
    }
    case 'zoroark': {
      dealDamage(state, a, t, 5, S)
      if (t.hp <= 0) {
        a.charge = a.chargeMax // a KO refunds the charge (reset to 0 happens after; see below)
        state.log.push(`${nameOf(a)}'s Night Daze KO — charge refunded!`)
      }
      break
    }
    case 'gengar': {
      // 6, plus a 4-damage burst against a full-HP target
      dealDamage(state, a, t, t.hp === t.maxHp ? 10 : 6, S)
      break
    }
    case 'escavalier': {
      // Megahorn: lances through the two tiles behind the target
      dealDamage(state, a, t, 5, S)
      const [dc, dr] = rayDir(a, t)
      for (let d = 1; d <= 2; d++) {
        const behind = at(state.units, t.col + dc * d, t.row + dr * d)
        if (behind && behind.owner !== a.owner) dealDamage(state, a, behind, 3, S)
      }
      break
    }
    case 'accelgor': {
      dealDamage(state, a, t, 4, S)
      const dr2 = a.owner === 'A' ? 1 : -1
      for (let i = 0; i < 2; i++) {
        const nr = a.row + dr2
        if (!inBounds(a.col, nr) || blockedAt(state, a.col, nr)) break
        a.row = nr
      }
      break
    }
    case 'primeape': {
      dealDamage(state, a, t, 6, S)
      break
    }
    case 'tangrowth': {
      dealDamage(state, a, t, 6, S)
      dealHeal(state, a, 2)
      break
    }
    case 'serperior': {
      // Leaf Storm: 6 to the target, 2 to every enemy beside it
      dealDamage(state, a, t, 6, S)
      for (const s of state.units) {
        if (s.owner === a.owner || s.id === t.id) continue
        if (Math.max(Math.abs(s.col - t.col), Math.abs(s.row - t.row)) === 1) dealDamage(state, a, s, 2, S)
      }
      break
    }
    case 'rotommow': {
      dealDamage(state, a, t, 3, S)
      for (const s of state.units) {
        if (s.owner === a.owner || s.id === t.id) continue
        if (Math.max(Math.abs(s.col - t.col), Math.abs(s.row - t.row)) === 1) dealDamage(state, a, s, 2, S)
      }
      break
    }
    case 'machamp': {
      dealDamage(state, a, t, 6, S)
      if (t.hp > 0) knockback(state, a, t, 1)
      break
    }
    case 'beartic': {
      dealDamage(state, a, t, t.stunned ? 6 : 4, S)
      break
    }
    case 'starly': {
      // Fly-by: hit and dart away
      dealDamage(state, a, t, 3, S)
      const drS = a.owner === 'A' ? 1 : -1
      for (let i = 0; i < 2; i++) {
        const nr = a.row + drS
        if (!inBounds(a.col, nr) || blockedAt(state, a.col, nr)) break
        a.row = nr
      }
      break
    }
    case 'croagunk': {
      dealDamage(state, a, t, t.hp === t.maxHp ? 6 : 4, S)
      break
    }
    case 'arcanine': {
      dealDamage(state, a, t, 4, S)
      break
    }
    case 'magmortar': {
      dealDamage(state, a, t, 3, S)
      for (const s of state.units) {
        if (s.owner === a.owner || s.id === t.id) continue
        if (Math.max(Math.abs(s.col - t.col), Math.abs(s.row - t.row)) === 1) dealDamage(state, a, s, 2, S)
      }
      break
    }
    case 'haunter': {
      dealDamage(state, a, t, 4, S)
      break
    }
    case 'drifblim': {
      dealDamage(state, a, t, 4, S)
      dealHeal(state, a, 2)
      break
    }
    case 'scyther': {
      dealDamage(state, a, t, 3, S)
      if (t.hp > 0) dealDamage(state, a, t, 3, S)
      break
    }
    case 'luxray': {
      dealDamage(state, a, t, 6, S)
      dealDamage(state, null, a, 1, COLOR.normal)
      break
    }
    case 'weavile': {
      dealDamage(state, a, t, 4, S)
      const dr = a.owner === 'A' ? 1 : -1
      for (let i = 0; i < 2; i++) {
        const nr = a.row + dr
        if (!inBounds(a.col, nr) || blockedAt(state, a.col, nr)) break
        a.row = nr
      }
      break
    }
    case 'gallade': {
      dealDamage(state, a, t, 4, S)
      const [dc, dr] = rayDir(a, t)
      for (let d = 1; d <= 2; d++) {
        const behind = at(state.units, t.col + dc * d, t.row + dr * d)
        if (behind) {
          if (behind.owner !== a.owner) dealDamage(state, a, behind, 3, S)
          break
        }
      }
      break
    }
    case 'magneton': {
      dealDamage(state, a, t, 4, S)
      stun(t)
      break
    }
    case 'porygon2': {
      dealDamage(state, a, t, 3, S)
      const [dc, dr] = rayDir(a, t)
      for (let d = 1; d <= 2; d++) {
        const behind = at(state.units, t.col + dc * d, t.row + dr * d)
        if (behind && behind.owner !== a.owner) dealDamage(state, a, behind, 3, S)
      }
      break
    }
    case 'rotomwash': {
      for (const s of state.units) {
        if (s.owner !== a.owner && s.col === t.col) dealDamage(state, a, s, 3, S)
      }
      break
    }
    case 'espeon': {
      dealDamage(state, a, t, 4, S)
      if (t.hp > 0) knockback(state, a, t, 2)
      break
    }
    case 'alakazam': {
      dealDamage(state, a, t, 6, S)
      if (t.hp > 0) knockback(state, a, t, 2)
      break
    }
    case 'pikachu': {
      dealDamage(state, a, t, 1, S)
      stun(t)
      break
    }
    case 'lucario': {
      dealDamage(state, a, t, 4, S)
      break
    }
    case 'blaziken': {
      const kick = t.hp === t.maxHp
      dealDamage(state, a, t, kick ? 6 : 4, S, 'special', kick ? ' CRIT' : '')
      break
    }
    case 'krookodile': {
      // 5, plus a 5-damage finisher when the target is below half HP
      dealDamage(state, a, t, t.hp * 2 < t.maxHp ? 10 : 5, S)
      break
    }
    case 'dragonite': {
      dealDamage(state, a, t, 6, S)
      break
    }
    default: {
      dealDamage(state, a, t, a.atk + a.atkBuff + 2, S)
    }
  }
}

/**
 * Resolve ONE pending planned action of the current player (declaration order).
 * Returns the new state, or null when nothing is left to resolve.
 */
export function resolveStep(state0: GameState): GameState | null {
  const pending = state0.units
    .filter((u) => u.owner === state0.current && u.planned)
    .sort((a, b) => a.plannedSeq - b.plannedSeq)
  if (!pending.length) return null

  const state = clone(state0)
  state.events = []
  const u = state.units.find((x) => x.id === pending[0].id)!
  const plan = u.planned!
  u.planned = null

  if (plan.kind === 'attack' || plan.kind === 'special') {
    const t = state.units.find((x) => x.id === plan.targetId)
    if (t) {
      state.acting = { id: u.id, dc: Math.sign(t.col - u.col), dr: Math.sign(t.row - u.row) }
      if (plan.kind === 'attack') {
        // normal attacks roll the dice: small miss chance, small crit chance
        if (!state.deterministic && Math.random() < TUNING.missChance) {
          state.events.push({ col: t.col, row: t.row, text: 'MISS', color: COLOR.resist })
          state.log.push(`${nameOf(u)} missed ${nameOf(t)}!`)
        } else {
          // Static: crit chance ×2 at tier 1, ×3 at tier 2
          const critChance =
            state.deterministic ? 0
              : ptypeOf(u) === 'electric' ? TUNING.critChance * (1 + tierOf(state.units, u)) : TUNING.critChance
          const critProof = ptypeOf(t) === 'rock' && hasSynergy(state.units, t) // Sturdy
          const crit = !critProof && Math.random() < critChance
          const before = t.hp
          dealDamage(
            state, u, t,
            effAtk(state.units, u),
            COLOR.normal, 'normal', crit ? ' CRIT' : '', crit,
          )
          const mod = typeSign(ptypeOf(u), ptypeOf(t))
          const eff = mod > 0 ? ' — super effective!' : mod < 0 ? ' — not very effective' : ''
          state.log.push(
            `${nameOf(u)} hit ${nameOf(t)} for ${before - t.hp}${crit ? ' — CRITICAL!' : ''}${eff}`,
          )
          // Swarm: bug-synergy normal attacks strike twice
          if (t.hp > 0 && ptypeOf(u) === 'bug' && hasSynergy(state.units, u)) {
            const crit2 = !critProof && Math.random() < critChance
            const b2 = t.hp
            dealDamage(
              state, u, t,
              effAtk(state.units, u),
              COLOR.normal, 'normal', crit2 ? ' CRIT' : '', crit2,
            )
            state.log.push(`${nameOf(u)} struck again for ${b2 - t.hp} (Swarm).`)
          }
          // lance-bearers skewer the unit directly behind the target (anti-wall)
          if (!u.isChampion && ROSTER[u.key]?.pierceBasic) {
            const [dc, dr] = [Math.sign(t.col - u.col), Math.sign(t.row - u.row)]
            const behind = at(state.units, t.col + dc, t.row + dr)
            if (behind && behind.owner !== u.owner) {
              const b3 = behind.hp
              dealDamage(state, u, behind, effAtk(state.units, u), COLOR.normal, 'normal')
              state.log.push(`${nameOf(u)}'s lance skewered ${nameOf(behind)} for ${b3 - behind.hp}.`)
            }
          }
        }
      } else {
        state.log.push(`${nameOf(u)} used ${specialNameOf(u)} on ${nameOf(t)}!`)
        u.charge = 0 // before resolution, so Zoroark's KO refund can restore it
        resolveEnemySpecial(state, u, t)
      }
    } else if (plan.kind === 'special') {
      // target already fainted — the special stays banked
      u.acted = false
      return state
    }
  } else if (plan.kind === 'aoe') {
    state.log.push(`${nameOf(u)} used ${specialNameOf(u)}!`)
    state.acting = { id: u.id, dc: 0, dr: 0 }
    if (u.key === 'manaphy') {
      // Surf: a tidal wave over the field — friend and foe alike, but it never
      // reaches Manaphy's own back two rows (her shore stays dry)
      const dry = (r: number) => (u.owner === 'A' ? r >= ROWS - 2 : r < 2)
      for (const s of state.units) {
        if (s.id === u.id || dry(s.row)) continue
        dealDamage(state, u, s, 4, COLOR.special)
      }
    } else {
      const radius = u.key === 'chandelure' ? 2 : 1
      for (const s of state.units) {
        if (s.owner === u.owner) continue
        if (Math.max(Math.abs(s.col - u.col), Math.abs(s.row - u.row)) <= radius)
          dealDamage(state, u, s, u.key === 'chandelure' ? 3 : u.key === 'garchomp' ? 6 : 4, COLOR.special)
      }
    }
    u.charge = 0
  } else if (plan.kind === 'tile') {
    state.log.push(`${nameOf(u)} used ${specialNameOf(u)}!`)
    const cross = [
      [plan.col, plan.row],
      [plan.col + 1, plan.row],
      [plan.col - 1, plan.row],
      [plan.col, plan.row + 1],
      [plan.col, plan.row - 1],
    ]
    for (const [c, r] of cross) {
      const s = at(state.units, c, r)
      if (s && s.owner !== u.owner) dealDamage(state, u, s, 5, COLOR.special)
      else if (inBounds(c, r)) state.events.push({ col: c, row: r, text: '✶', color: COLOR.special })
    }
    u.charge = 0
    u.abilityUsed = true
  }

  cleanup(state)
  return state
}

/** Upkeep after all planned actions resolved: flags, charge, income, chest spawn, hand over. */
export function finishTurn(state0: GameState): GameState {
  const state = clone(state0)
  state.events = []
  const ending = state.current
  // Photosynthesis: grass-synergy units regenerate 1 at the end of their turn
  for (const u of state.units) {
    if (u.owner !== ending) continue
    if (ptypeOf(u) === 'grass') {
      const tier = tierOf(state.units, u)
      if (tier >= 1) dealHeal(state, u, tier)
    }
  }
  for (const u of state.units) {
    if (u.owner !== ending) continue
    u.moved = false
    u.movedFrom = null
    u.acted = false
    u.planned = null
    u.summoned = false
    u.stunned = false
    u.atkBuff = 0
    u.moveBuff = 0
    u.charge = Math.min(u.chargeMax, u.charge + 1)
  }
  state.movesLeft = MOVE_CAP
  if (state.lugiaLock === ending) state.lugiaLock = null // the grounded turn is over
  resolveHazards(state) // whirlpools / eruptions tick and may crash down now
  state.current = otherOwner(ending)
  if (state.current === 'A') {
    state.round++
    if (!state.deterministic) maybeSpawnChest(state)
    if (!state.deterministic && state.round >= FATIGUE_ROUND) {
      // escalates so healers can never stall the game out forever
      const fatigue = 1 + Math.floor((state.round - FATIGUE_ROUND) / 5)
      for (const u of state.units) {
        if (!u.isChampion) continue
        u.hp -= fatigue
        state.events.push({ col: u.col, row: u.row, text: `-${fatigue}`, color: '#A6ABB3' })
      }
      state.log.push(`Fatigue — both champions take ${fatigue} damage.`)
      cleanup(state)
    }
  }
  grantIncome(state)
  return state
}

export { openDeployTiles, rockAt, COLS, ROWS, MOVE_CAP }
