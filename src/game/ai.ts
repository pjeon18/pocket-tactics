import {
  CHAMPION_ORDER, DRAFT_SIZE, SUMMONS, SUMMON_ORDER, GREAT_CAP, ROSTER,
  TRADE_GREAT_COST, TRADE_ULTRA_COST, ULTRA_CAP, ROWS, COLS,
  costEquiv, metaOf, ptypeOf, typeMult, synergyThresholds, SYNERGIES,
} from './data'
import { deploy, moveUnit, planArea, planAttack, resolveStep, tradeBalls, useAbility, useItem, useSummon } from './actions'
import {
  canActNow,
  deployDepthFor,
  canAfford,
  canDeployCard,
  canMoveNow,
  effAtk,
  openDeployTiles,
  otherOwner,
  reachable,
  targetsFrom,
} from './rules'
import type { BoardLike, DraftResult, GameState, ItemKey, Owner, PType, Unit } from './types'

export type Difficulty = 'easy' | 'normal' | 'hard'

const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const key = (c: number, r: number) => `${c},${r}`

/**
 * Run a piece of engine code with the dice neutralised, so lookahead measures the
 * average outcome instead of one lucky roll. 0.5 clears both the miss and crit
 * thresholds, giving a plain, unmodified hit.
 */
function deterministic<T>(fn: () => T): T {
  const real = Math.random
  Math.random = () => 0.5
  try {
    return fn()
  } finally {
    Math.random = real
  }
}

/* ---------- draft ---------- */

/**
 * Draft a curve plus a type core. Picking three of one type turns on that type's
 * synergy, which is worth more than three unrelated bodies — so the AI commits to
 * one (hard: two) type spines and fills the rest on cost curve.
 */
export function aiDraft(difficulty: Difficulty = 'normal'): DraftResult {
  const champion = rand(CHAMPION_ORDER)
  const all = Object.values(ROSTER)
  const picks: string[] = []
  const push = (k: string) => {
    if (picks.length < DRAFT_SIZE && !picks.includes(k)) picks.push(k)
  }

  if (difficulty !== 'easy') {
    // commit to synergy spines: enough same-type bodies to actually switch it on
    const types = (Object.keys(SYNERGIES) as PType[]).sort(() => Math.random() - 0.5)
    const spines = difficulty === 'hard' ? 2 : 1
    for (const t of types.slice(0, spines)) {
      const need = synergyThresholds(t)[0]
      const pool = all.filter((s) => s.ptype === t).sort((a, b) => costEquiv(a.cost) - costEquiv(b.cost))
      for (const s of pool.slice(0, need)) push(s.key)
    }
  }

  // fill on a sane curve: a couple of premiums, the rest affordable bodies
  const byTier = (t: string) =>
    all.filter((s) => s.tier === t && !picks.includes(s.key)).sort(() => Math.random() - 0.5)
  for (const s of byTier('ultra').slice(0, 1)) push(s.key)
  for (const s of byTier('great').slice(0, 2)) push(s.key)
  for (const s of byTier('poke')) push(s.key)
  for (const s of [...all].sort(() => Math.random() - 0.5)) push(s.key)

  // easy sticks to the untargeted summons; better AIs use the aimed ones too
  const pool = difficulty === 'easy' ? SUMMON_ORDER.filter((k) => !SUMMONS[k].target) : SUMMON_ORDER
  const summons = [...pool].sort(() => Math.random() - 0.5).slice(0, 2)
  return { champion, picks: picks.slice(0, DRAFT_SIZE), summons }
}

/* ---------- position evaluation ---------- */

const tierRank = { poke: 0, great: 1, ultra: 2 } as const

/** What a body is worth: what it cost, scaled by how much of it is left. */
function unitValue(u: Unit): number {
  const c = ROSTER[u.key] ? costEquiv(ROSTER[u.key].cost) : 3
  return (2 + c) * (u.hp / Math.max(1, u.maxHp))
}

/**
 * Score a position from `me`'s point of view. Champion health dominates on
 * purpose — it is the only win condition, and an AI that merely trades bodies
 * grinds to the fatigue timer instead of closing games out.
 */
function evaluate(state: GameState, me: Owner): number {
  const foe = otherOwner(me)
  const myChamp = state.units.find((u) => u.isChampion && u.owner === me)
  const foeChamp = state.units.find((u) => u.isChampion && u.owner === foe)
  if (!foeChamp) return 1e6
  if (!myChamp) return -1e6

  let score = 0
  score += (myChamp.hp / myChamp.maxHp) * 120
  score -= (foeChamp.hp / foeChamp.maxHp) * 120

  for (const u of state.units) {
    if (u.isChampion) continue
    score += (u.owner === me ? 1 : -1) * unitValue(u)
  }

  // pressure: reward having attackers close to the enemy champion
  for (const u of state.units) {
    if (u.isChampion || u.owner !== me) continue
    const d = Math.max(Math.abs(u.col - foeChamp.col), Math.abs(u.row - foeChamp.row))
    score += Math.max(0, 6 - d) * 0.35
  }

  const p = state.players[me]
  score += (p.poke + p.great * 3 + p.ultra * 6) * 0.25
  return score
}

/** Tiles the given side can strike next turn, for safety scoring. */
function threatTiles(state: GameState, by: Owner): Set<string> {
  const out = new Set<string>()
  for (const u of state.units) {
    if (u.owner !== by) continue
    const reach = u.range + (u.isChampion ? 0 : u.moveBuff)
    for (let dc = -reach; dc <= reach; dc++) {
      for (let dr = -reach; dr <= reach; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) > reach) continue
        out.add(key(u.col + dc, u.row + dr))
      }
    }
  }
  return out
}

/**
 * Actually play an action out with the dice neutralised and report what it did.
 * This replaces the old hand-maintained damage table — AOE, multi-hit, pierce,
 * self-heal and knockback all get measured rather than guessed.
 */
function simulateAction(
  state: GameState,
  me: Owner,
  unitId: number,
  dest: [number, number] | null,
  targetId: number,
  special: boolean,
): { enemyLoss: number; champLoss: number; kills: number; selfLoss: number } | null {
  return deterministic(() => {
    let s: GameState | null = state
    if (dest) {
      s = moveUnit(s, unitId, dest[0], dest[1])
      if (!s) return null
    }
    // isolate this action: drop everyone else's declarations so resolveStep runs ours
    const solo: GameState = structuredClone(s)
    for (const u of solo.units) if (u.id !== unitId) u.planned = null
    const declared = planAttack(solo, unitId, targetId, special)
    if (!declared) return null
    const done = resolveStep(declared) ?? declared

    const before = state.units
    const after = done.units
    let enemyLoss = 0, champLoss = 0, kills = 0, selfLoss = 0
    for (const b of before) {
      const a = after.find((x) => x.id === b.id)
      const lost = a ? b.hp - a.hp : b.hp
      if (lost <= 0) continue
      if (b.owner === me) selfLoss += lost
      else {
        enemyLoss += lost
        if (b.isChampion) champLoss += lost
        if (!a) kills++
      }
    }
    return { enemyLoss, champLoss, kills, selfLoss }
  })
}

interface Plan {
  unitId: number
  dest: [number, number] | null
  targetId: number | null
  special: boolean
  score: number
}

function bestPlan(state: GameState, difficulty: Difficulty): Plan | null {
  const me = state.current
  const foe = otherOwner(me)
  const enemyChamp = state.units.find((u) => u.isChampion && u.owner === foe)
  const threat = difficulty === 'easy' ? new Set<string>() : threatTiles(state, foe)
  const noise = difficulty === 'easy' ? 6 : difficulty === 'normal' ? 1.2 : 0
  let best: Plan | null = null

  // hold the champion back until it is the only piece left to play
  const soloChampion = !state.units.some((x) => x.owner === me && !x.isChampion)

  for (const u of state.units.filter((x) => x.owner === me)) {
    const mayAct = canActNow(state, u)
    const mayMove = canMoveNow(state, u) && (!u.isChampion || soloChampion)
    if (!mayAct && !mayMove) continue

    const dests: [number, number][] = [[u.col, u.row]]
    if (mayMove) dests.push(...reachable(state, u))

    // rank destinations cheaply first so the expensive simulation only runs on good ones
    const scoredDests = dests.map(([c, r]) => {
      const isMove = c !== u.col || r !== u.row
      let s = 0
      if (enemyChamp && isMove) {
        const d0 = Math.max(Math.abs(u.col - enemyChamp.col), Math.abs(u.row - enemyChamp.row))
        const d1 = Math.max(Math.abs(c - enemyChamp.col), Math.abs(r - enemyChamp.row))
        s += (d0 - d1) * 0.5 - 0.05
      }
      if (isMove && state.chests.some((ch) => ch.col === c && ch.row === r)) s += 2
      // don't park fragile or valuable pieces where they will be shot
      if (threat.has(key(c, r))) s -= unitValue(u) * (u.isChampion ? 1.2 : 0.25)
      return { c, r, isMove, s }
    })
    scoredDests.sort((a, b) => b.s - a.s)
    const considered = difficulty === 'hard' ? scoredDests.slice(0, 10) : scoredDests.slice(0, 6)

    for (const { c, r, isMove, s: moveScore } of considered) {
      let attackScore = 0
      let targetId: number | null = null
      let special = false

      if (mayAct) {
        const virtual: BoardLike = {
          units: state.units.map((x) => (x.id === u.id ? { ...x, col: c, row: r } : x)),
          rocks: state.rocks,
        }
        const vu = virtual.units.find((x) => x.id === u.id)!
        const meta = metaOf(u)
        const charged = u.charge >= u.chargeMax && meta.kind === 'enemy'

        // normal attacks: damage is exactly computable, no simulation needed
        for (const t of targetsFrom(virtual, vu)) {
          const dmg = Math.max(1, Math.ceil(effAtk(state.units, u) * typeMult(ptypeOf(u), ptypeOf(t))))
          const eff = Math.min(dmg, t.hp)
          let sc = eff + (dmg >= t.hp ? 4 : 0)
          if (t.isChampion) sc *= 3
          if (sc > attackScore) { attackScore = sc; targetId = t.id; special = false }
        }

        // specials: play them out for real rather than trusting a table
        if (charged) {
          const sTargets = targetsFrom(virtual, vu, c, r, meta.rangeOverride ?? u.range, meta.ignoreBlock)
          for (const t of sTargets.slice(0, difficulty === 'hard' ? 8 : 4)) {
            const sim = simulateAction(state, me, u.id, isMove ? [c, r] : null, t.id, true)
            if (!sim) continue
            let sc = sim.enemyLoss + sim.kills * 4 + sim.champLoss * 2 - sim.selfLoss * 1.2
            if (t.isChampion) sc *= 1.6
            if (sc > attackScore) { attackScore = sc; targetId = t.id; special = true }
          }
        }
      }

      const total = moveScore + attackScore + (noise ? (Math.random() - 0.5) * noise : 0)
      if (total > 0.15 && (!best || total > best.score)) {
        best = { unitId: u.id, dest: isMove ? [c, r] : null, targetId, special, score: total }
      }
    }
  }
  return best
}

/* ---------- items ---------- */

/** Spend a consumable or attach a held item when it clearly helps. */
function tryItem(state: GameState, difficulty: Difficulty): GameState | null {
  if (difficulty === 'easy') return null
  const me = state.current
  const p = state.players[me]
  if (!p.items.length) return null
  const mine = state.units.filter((u) => u.owner === me)

  const healAmount: Partial<Record<ItemKey, number>> = { potion: 3, 'super-potion': 5, 'max-potion': 99 }
  for (const item of p.items) {
    const heal = healAmount[item]
    if (heal) {
      // heal the piece that gets the most out of it, and only if it isn't wasted
      const hurt = mine
        .filter((u) => u.maxHp - u.hp >= Math.min(heal, 3))
        .sort((a, b) => (b.isChampion ? 1 : 0) - (a.isChampion ? 1 : 0) || a.hp / a.maxHp - b.hp / b.maxHp)[0]
      if (hurt) {
        const next = useItem(state, me, item, { targetId: hurt.id })
        if (next) return next
      }
      continue
    }
    if (item === 'lum-berry') {
      const stunned = mine.find((u) => u.stunned)
      if (stunned) {
        const next = useItem(state, me, item, { targetId: stunned.id })
        if (next) return next
      }
      continue
    }
    if (item === 'power-herb') {
      // best charged-up payoff: the strongest attacker still waiting on its meter
      const waiting = mine
        .filter((u) => u.charge < u.chargeMax && metaOf(u).kind === 'enemy')
        .sort((a, b) => b.atk - a.atk)[0]
      if (waiting) {
        const next = useItem(state, me, item, { targetId: waiting.id })
        if (next) return next
      }
      continue
    }
    if (item === 'revive') {
      if (p.fainted.length) {
        const spot = openDeployTiles(state, me, 3)[0]
        if (spot) {
          const bring = [...p.fainted].sort((a, b) => tierRank[ROSTER[b].tier] - tierRank[ROSTER[a].tier])[0]
          const next = useItem(state, me, item, { reviveKey: bring, col: spot[0], row: spot[1] })
          if (next) return next
        }
      }
      continue
    }
    // held items go on the best unattached body
    const holder = mine
      .filter((u) => !u.heldItem && !u.isChampion)
      .sort((a, b) => b.atk + b.hp / 2 - (a.atk + a.hp / 2))[0]
    if (holder) {
      const next = useItem(state, me, item, { targetId: holder.id })
      if (next) return next
    }
  }
  return null
}

/* ---------- summons ---------- */

function trySummon(state: GameState, difficulty: Difficulty): GameState | null {
  if (difficulty === 'easy') return null
  const me = state.current
  const foe = otherOwner(me)
  const p = state.players[me]
  const mine = state.units.filter((u) => u.owner === me && !u.isChampion).length
  const enemies = state.units.filter((u) => u.owner === foe)
  const theirs = enemies.filter((u) => !u.isChampion).length

  for (const k of p.summons) {
    if (p.poke < (SUMMONS[k]?.cost ?? 99)) continue

    if (k === 'kyogre' || k === 'groudon') {
      // aim where it actually catches bodies; back two enemy rows are off-limits
      const banned = foe === 'B' ? [0, 1] : [ROWS - 2, ROWS - 1]
      let bestSpot: { col: number; row: number; hits: number } | null = null
      for (let r = 0; r < ROWS; r++) {
        if (banned.includes(r)) continue
        for (let c = 0; c < COLS; c++) {
          const hits = enemies.filter((e) =>
            k === 'groudon'
              ? e.row === r
              : Math.max(Math.abs(e.col - c), Math.abs(e.row - r)) <= 1,
          ).length
          const friendly = state.units.filter((e) =>
            e.owner === me &&
            (k === 'groudon' ? e.row === r : Math.max(Math.abs(e.col - c), Math.abs(e.row - r)) <= 1),
          ).length
          const net = hits - friendly
          if (net >= 2 && (!bestSpot || net > bestSpot.hits)) bestSpot = { col: c, row: r, hits: net }
          if (k === 'groudon') break // a row only needs one probe
        }
      }
      if (bestSpot) {
        const next = useSummon(state, me, k, { col: bestSpot.col, row: bestSpot.row })
        if (next) return next
      }
      continue
    }

    const worth =
      (k === 'hooh' && mine >= 3) ||
      (k === 'dialga' && mine >= 3) ||
      (k === 'lugia' && theirs >= 4) ||
      (k === 'palkia' && mine >= 3 && state.round >= 6)
    if (worth) {
      const next = useSummon(state, me, k)
      if (next) return next
    }
  }
  return null
}

/* ---------- charged abilities ---------- */

function tryAbility(state: GameState, difficulty: Difficulty): GameState | null {
  const me = state.current
  for (const u of state.units.filter((x) => x.owner === me)) {
    if (!canActNow(state, u) || u.charge < u.chargeMax) continue
    const enemies = state.units.filter((x) => x.owner !== me)
    const allies = state.units.filter((x) => x.owner === me)

    if (u.key === 'garchomp' || u.key === 'chandelure') {
      const radius = u.key === 'garchomp' ? 1 : 2
      const victims = enemies.filter(
        (t) => Math.max(Math.abs(t.col - u.col), Math.abs(t.row - u.row)) <= radius,
      )
      if (victims.length >= 2) return planArea(state, u.id)
    } else if (u.key === 'lillipup') {
      return useAbility(state, u.id, {})
    } else if (['grotle', 'sunkern', 'ferroseed', 'squirtle', 'metapod'].includes(u.key)) {
      if (u.hp <= u.maxHp - (u.key === 'grotle' || u.key === 'metapod' ? 4 : 2)) return useAbility(state, u.id, {})
    } else if (u.key === 'manaphy') {
      const foes = state.units.filter((x) => x.owner !== me).length
      const mine = state.units.filter((x) => x.owner === me && !x.isChampion).length
      if (foes >= 4 && mine <= 2) return planArea(state, u.id)
    } else if (u.key === 'carracosta') {
      const near = enemies.some(
        (t) => Math.max(Math.abs(t.col - u.col), Math.abs(t.row - u.row)) <= 3,
      )
      if (near) return useAbility(state, u.id, {})
    } else if (metaOf(u).kind === 'ally') {
      const range = metaOf(u).rangeOverride ?? u.range
      const hurt = allies
        .filter((t) => t.id !== u.id && t.hp <= t.maxHp - 3)
        .filter((t) => Math.max(Math.abs(t.col - u.col), Math.abs(t.row - u.row)) <= range)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)
      if (hurt.length) return useAbility(state, u.id, { targetId: hurt[0].id })
    } else if (u.key === 'celebi') {
      const missing = allies.reduce((n, t) => n + (t.maxHp - t.hp), 0)
      if (missing >= 5) return useAbility(state, u.id, {})
    } else if (u.key === 'victini') {
      const attackers = allies.filter((t) => !t.acted && targetsFrom(state, t).length > 0)
      if (attackers.length >= 2) return useAbility(state, u.id, {})
    } else if (u.key === 'jirachi' && !u.abilityUsed) {
      for (const t of enemies) {
        if (Math.max(Math.abs(t.col - u.col), Math.abs(t.row - u.row)) > 4) continue
        const cross = [
          [t.col, t.row], [t.col + 1, t.row], [t.col - 1, t.row], [t.col, t.row + 1], [t.col, t.row - 1],
        ]
        const hits = enemies.filter((e) => cross.some(([c, r]) => e.col === c && e.row === r))
        if (hits.length >= 2 || hits.some((h) => h.isChampion)) {
          return planArea(state, u.id, { col: t.col, row: t.row })
        }
      }
    } else if (u.key === 'mew') {
      const p = state.players[me]
      if (p.fainted.length) {
        const spot = openDeployTiles(state, me)[0]
        if (spot) {
          const bring = [...p.fainted].sort(
            (a, b) => tierRank[ROSTER[b].tier] - tierRank[ROSTER[a].tier],
          )[0]
          return useAbility(state, u.id, { reviveKey: bring, col: spot[0], row: spot[1] })
        }
      }
    } else if (difficulty === 'hard' && metaOf(u).kind === 'blink') {
      continue // handled positionally elsewhere; never blink aimlessly
    }
  }
  return null
}

/* ---------- deployment ---------- */

function pickDeploySpot(state: GameState, me: Owner, depth: number, difficulty: Difficulty): [number, number] | null {
  const open = openDeployTiles(state, me, depth)
  if (!open.length) return null
  if (difficulty === 'easy') return rand(open)

  const foe = otherOwner(me)
  const threat = threatTiles(state, foe)
  const enemies = state.units.filter((u) => u.owner !== me && !u.isChampion)
  const advanced = enemies.sort((a, b) => (me === 'B' ? a.row - b.row : b.row - a.row))[0]

  const scored = open.map(([c, r]) => {
    let s = 0
    // land near the front line, but not inside someone's firing arc
    if (advanced) s -= Math.abs(c - advanced.col) * 0.5
    if (threat.has(key(c, r))) s -= 3
    s += me === 'A' ? -r * 0.1 : r * 0.1
    return { c, r, s }
  })
  scored.sort((a, b) => b.s - a.s)
  return [scored[0].c, scored[0].r]
}

/**
 * One AI planning action: deploy, item, summon, ability, or a unit activation
 * (move + declared attack). Returns the new state, or null when planning is done —
 * the caller then plays the resolution and finishes the turn.
 */
export function aiStep(state: GameState, difficulty: Difficulty = 'normal'): GameState | null {
  if (state.winner) return null
  const me = state.current
  const p = state.players[me]

  // 0. blitz: deploy the best thing the shop offers, straight to the field
  if (state.shopMode) {
    const buyable = p.shop
      .filter((k) => canAfford(p, ROSTER[k]))
      .sort((a, b) => costEquiv(ROSTER[b].cost) - costEquiv(ROSTER[a].cost))
    if (buyable.length) {
      const spot = pickDeploySpot(state, me, deployDepthFor(ROSTER[buyable[0]].tier), difficulty)
      if (spot) {
        const next = deploy(state, me, buyable[0], spot[0], spot[1])
        if (next) return next
      }
    }
  }

  // 1. bank toward the biggest ball a benched card actually needs
  const wantsUltra = p.bench.some((k) => ROSTER[k].cost.ultra > 0)
  const wantsGreat = p.bench.some((k) => ROSTER[k].cost.great > 0)
  if (wantsUltra && p.ultra < ULTRA_CAP && p.poke >= TRADE_ULTRA_COST + 1) {
    const next = tradeBalls(state, me, 'ultra')
    if (next) return next
  }
  if (wantsGreat && p.great < GREAT_CAP && p.poke >= TRADE_GREAT_COST + 1) {
    const next = tradeBalls(state, me, 'great')
    if (next) return next
  }

  // 2. free value: items cost no action
  const withItem = tryItem(state, difficulty)
  if (withItem) return withItem

  // 3. summons
  const withSummon = trySummon(state, difficulty)
  if (withSummon) return withSummon

  // 4. deploy — prefer the most expensive card that is actually affordable
  const deployable = p.bench
    .filter((k) => canDeployCard(p, k, state.shopMode))
    .sort((a, b) => tierRank[ROSTER[b].tier] - tierRank[ROSTER[a].tier])
  if (deployable.length) {
    const spot = pickDeploySpot(state, me, deployDepthFor(ROSTER[deployable[0]].tier), difficulty)
    if (spot) {
      const next = deploy(state, me, deployable[0], spot[0], spot[1])
      if (next) return next
    }
  }

  // 5. charged abilities that are clearly good
  const withAbility = tryAbility(state, difficulty)
  if (withAbility) return withAbility

  // 6. best unit activation
  const plan = bestPlan(state, difficulty)
  if (!plan) return null
  let next: GameState = state
  if (plan.dest) {
    const moved = moveUnit(next, plan.unitId, plan.dest[0], plan.dest[1])
    if (!moved) return null
    next = moved
  }
  if (plan.targetId != null) {
    const attacked = planAttack(next, plan.unitId, plan.targetId, plan.special)
    if (attacked) next = attacked
    else if (!plan.dest) return null
  }
  if (next === state) return null
  return next
}

export { evaluate as evaluatePosition }
