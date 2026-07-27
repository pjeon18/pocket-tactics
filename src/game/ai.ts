import { CHAMPION_ORDER, DRAFT_SIZE, SUMMONS, SUMMON_ORDER, GREAT_CAP, ROSTER, TRADE_GREAT_COST, TRADE_ULTRA_COST, ULTRA_CAP, costEquiv, metaOf, ptypeOf, typeMod } from './data'
import { deploy, moveUnit, planArea, planAttack, tradeBalls, useAbility, useSummon } from './actions'
import {
  canActNow,
  deployDepthFor,
  canAfford,
  canDeployCard,
  canMoveNow,
  effAtk,
  openDeployTiles,
  reachable,
  targetsFrom,
} from './rules'
import type { BoardLike, DraftResult, GameState, Owner, Unit } from './types'

const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

/* ---------- draft ---------- */

/** A curve-aware random draft: 1 ultra, ~3 great, rest poké. */
export function aiDraft(): DraftResult {
  const champion = rand(CHAMPION_ORDER)
  const all = Object.values(ROSTER)
  const byTier = (t: string) => all.filter((s) => s.tier === t).map((s) => s.key)
  const picks: string[] = []
  const take = (pool: string[], n: number) => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    for (const k of shuffled) {
      if (picks.length >= DRAFT_SIZE || n <= 0) break
      if (!picks.includes(k)) {
        picks.push(k)
        n--
      }
    }
  }
  take(byTier('ultra'), 2)
  take(byTier('great'), 4)
  take(byTier('poke'), DRAFT_SIZE - picks.length)
  // the AI only drafts summons it knows how to cast (the untargeted ones)
  const summons = SUMMON_ORDER.filter((k) => !SUMMONS[k].target).sort(() => Math.random() - 0.5).slice(0, 2)
  return { champion, picks, summons }
}

/* ---------- battle ---------- */

const tierRank = { poke: 0, great: 1, ultra: 2 } as const

function pickDeploySpot(state: GameState, me: Owner, depth = 2): [number, number] | null {
  const open = openDeployTiles(state, me, depth)
  if (!open.length) return null
  const enemies = state.units.filter((u) => u.owner !== me && !u.isChampion)
  const advanced = enemies.sort((a, b) => (me === 'B' ? a.row - b.row : b.row - a.row))[0]
  if (advanced && Math.random() < 0.7) {
    const near = open.filter(([c]) => Math.abs(c - advanced.col) <= 1)
    if (near.length) return rand(near)
  }
  return rand(open)
}

/** Approximate damage a special would deal (pre type-mod), for scoring. */
function specialValue(u: Unit, t: Unit): number {
  const table: Record<string, number> = {
    onix: 3.5, gigalith: 4, ferrothorn: 4, steelix: 4, snorlax: 6.5,
    haunter: 5, scyther: 6, luxray: 5.5, weavile: 4.5, gallade: 5,
    magneton: 5.5, porygon2: 4, rotomwash: 4.5, espeon: 4.5, alakazam: 6,
    pikachu: 2.5, lucario: 4, blaziken: 4.5, krookodile: 5, dragonite: 5,
    quagsire: 4, beartic: 5, starly: 3, croagunk: 4, arcanine: 5, magmortar: 4,
    bronzong: 2.5, jynx: 3.5, lapras: 4, hitmonlee: 6,
    vulpix: 2, squirtle: 0, lillipup: 0, poochyena: 3, ponyta: 4, golem: 4, umbreon: 3.5,
    rhyperior: 6, houndoom: 5, zoroark: 5, gengar: 6, machamp: 7, gyarados: 5.5,
    metapod: 0, escavalier: 6, accelgor: 4.5, primeape: 6, tangrowth: 4.5, serperior: 6, rotommow: 4,
  }
  return Math.min(t.hp + 1.5, table[u.key] ?? u.atk + 2)
}

/** Damage already declared against a unit this turn (avoid overkill piling). */
function plannedDamageOn(state: GameState, targetId: number): number {
  let sum = 0
  for (const u of state.units) {
    if (u.owner !== state.current || !u.planned) continue
    if (u.planned.kind === 'attack' && u.planned.targetId === targetId) sum += u.atk + u.atkBuff
    if (u.planned.kind === 'special' && u.planned.targetId === targetId) sum += 5
  }
  return sum
}

interface Plan {
  unitId: number
  dest: [number, number] | null
  targetId: number | null
  special: boolean
  score: number
}

function bestPlan(state: GameState): Plan | null {
  const me = state.current
  const enemyChamp = state.units.find((u) => u.isChampion && u.owner !== me)
  let best: Plan | null = null

  // the AI only marches its champion once it has nothing else on the board
  const soloChampion = !state.units.some((x) => x.owner === me && !x.isChampion)

  for (const u of state.units.filter((x) => x.owner === me)) {
    const mayAct = canActNow(state, u)
    const mayMove = canMoveNow(state, u) && (!u.isChampion || soloChampion)
    if (!mayAct && !mayMove) continue

    const dests: [number, number][] = [[u.col, u.row]]
    if (mayMove) dests.push(...reachable(state, u))

    for (const [c, r] of dests) {
      const isMove = c !== u.col || r !== u.row
      let moveScore = 0
      if (enemyChamp && isMove) {
        const d0 = Math.abs(u.col - enemyChamp.col) + Math.abs(u.row - enemyChamp.row)
        const d1 = Math.abs(c - enemyChamp.col) + Math.abs(r - enemyChamp.row)
        moveScore = (d0 - d1) * 0.4 - 0.05
      }
      if (isMove && state.chests.some((ch) => ch.col === c && ch.row === r)) moveScore += 1.6

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

        const scoreTarget = (t: Unit, dmgBase: number, isSpecial: boolean) => {
          const effHp = t.hp - plannedDamageOn(state, t.id)
          if (effHp <= 0) return // already dead on paper — don't pile on
          const dmg = Math.min(effHp, Math.max(1, dmgBase + typeMod(ptypeOf(u), ptypeOf(t))))
          let s = dmg + (dmg >= effHp ? 3 : 0)
          if (t.isChampion) s *= 2.2
          if (s > attackScore) {
            attackScore = s
            targetId = t.id
            special = isSpecial
          }
        }
        for (const t of targetsFrom(virtual, vu)) scoreTarget(t, effAtk(state.units, u), false)
        if (charged) {
          const sTargets = targetsFrom(virtual, vu, c, r, meta.rangeOverride ?? u.range, meta.ignoreBlock)
          for (const t of sTargets) scoreTarget(t, specialValue(u, t), true)
        }
      }

      const total = moveScore + attackScore
      if (total > 0.15 && (!best || total > best.score)) {
        best = { unitId: u.id, dest: isMove ? [c, r] : null, targetId, special, score: total }
      }
    }
  }
  return best
}

/** Fire a charged ability if it is clearly worth it (instant support or planned area). */
function tryAbility(state: GameState): GameState | null {
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
      // Pickup is free money — use it whenever charged
      return useAbility(state, u.id, {})
    } else if (['grotle', 'sunkern', 'ferroseed', 'squirtle', 'metapod'].includes(u.key)) {
      if (u.hp <= u.maxHp - (u.key === 'grotle' || u.key === 'metapod' ? 4 : 2)) return useAbility(state, u.id, {})
    } else if (u.key === 'manaphy') {
      // Surf hits its own side too — only worth it when the enemy board is loaded
      const enemies = state.units.filter((x) => x.owner !== me).length
      const mine = state.units.filter((x) => x.owner === me && !x.isChampion).length
      if (enemies >= 4 && mine <= 2) return planArea(state, u.id)
    } else if (u.key === 'carracosta') {
      const near = enemies.some(
        (t) => Math.max(Math.abs(t.col - u.col), Math.abs(t.row - u.row)) <= 3,
      )
      if (near) return useAbility(state, u.id, {})
    } else if (metaOf(u).kind === 'ally') {
      // any healer: Kirlia, Audino, Chansey
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
    }
  }
  return null
}

/**
 * One AI planning action: deploy, ability, or a unit activation (move + declared
 * attack). Returns the new state, or null when planning is done — the caller then
 * plays the resolution and finishes the turn.
 */
export function aiStep(state: GameState): GameState | null {
  if (state.winner) return null
  const me = state.current
  const p = state.players[me]

  // 0. blitz mode: deploy the best thing the shop offers, straight to the field
  if (state.shopMode) {
    const buyable = p.shop
      .filter((k) => canAfford(p, ROSTER[k]))
      .sort((a, b) => costEquiv(ROSTER[b].cost) - costEquiv(ROSTER[a].cost))
    if (buyable.length) {
      const spot = pickDeploySpot(state, me, deployDepthFor(ROSTER[buyable[0]].tier))
      if (spot) {
        const next = deploy(state, me, buyable[0], spot[0], spot[1])
        if (next) return next
      }
    }
  }

  // 1a. trade up when flush: aim for the biggest ball a benched card needs
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

  // 1a½. unleash a summon when the moment is right
  for (const key of p.summons) {
    if (p.usedSummons.includes(key) || p.poke < (SUMMONS[key]?.cost ?? 99)) continue
    const mine = state.units.filter((u) => u.owner === me && !u.isChampion).length
    const theirs = state.units.filter((u) => u.owner !== me && !u.isChampion).length
    const worth =
      (key === 'hooh' && mine >= 3) ||
      (key === 'dialga' && mine >= 3) ||
      (key === 'lugia' && theirs >= 4) ||
      (key === 'palkia' && mine >= 3 && state.round >= 6)
    if (worth) {
      const next = useSummon(state, me, key)
      if (next) return next
    }
  }

  // 1b. deploy the best deployable Pokémon
  const deployable = p.bench
    .filter((k) => canDeployCard(p, k, state.shopMode))
    .sort((a, b) => tierRank[ROSTER[b].tier] - tierRank[ROSTER[a].tier])
  if (deployable.length) {
    const spot = pickDeploySpot(state, me, deployDepthFor(ROSTER[deployable[0]].tier))
    if (spot) {
      const next = deploy(state, me, deployable[0], spot[0], spot[1])
      if (next) return next
    }
  }

  // 2. charged abilities that are clearly good
  const withAbility = tryAbility(state)
  if (withAbility) return withAbility

  // 3. best unit activation
  const plan = bestPlan(state)
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
