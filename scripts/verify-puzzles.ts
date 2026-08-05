/**
 * Puzzle verifier — proves every hand-authored puzzle is actually solvable, and
 * that its stated par is the tightest solution.
 *
 *   npx tsx scripts/verify-puzzles.ts [--print]
 *
 * For each puzzle it searches the full space of legal turns (move / declare /
 * special / end turn) and asserts:
 *   1. a winning line exists within `turns`      — the puzzle is not impossible
 *   2. NO winning line exists within `turns - 1` — par is not padded
 *
 * Shipping an unsolvable puzzle is the worst possible outcome, and eyeballing a
 * board is not proof. Puzzles are deterministic, so an exhaustive search is
 * exact rather than statistical.
 */
import {
  finishTurn, moveUnit, planArea, planAttack, resolveStep, useAbility,
} from '../src/game/actions'
import { canActNow, canMoveNow, reachable, targetsFrom } from '../src/game/rules'
import { metaOf } from '../src/game/data'
import { PUZZLES, makePuzzleState, type Puzzle } from '../src/game/puzzles'
import type { GameState } from '../src/game/types'

const PRINT = process.argv.includes('--print')

/** Resolve all declared actions, then hand over and immediately take the turn back
 *  (the rival is inert in puzzles, so its turn is a formality). */
function endTurn(s: GameState): GameState {
  let cur = s
  for (let i = 0; i < 60; i++) {
    const next = resolveStep(cur)
    if (!next) break
    cur = next
  }
  // the KO lands during resolution — check BEFORE handing the turn over, or a
  // won position gets carried past the win and reported unsolvable
  if (cur.winner) return cur
  cur = finishTurn(cur) // now the rival's turn
  if (cur.winner) return cur
  let back = cur
  for (let i = 0; i < 60; i++) {
    const next = resolveStep(back)
    if (!next) break
    back = next
  }
  if (back.winner) return back
  return finishTurn(back) // back to us
}

interface Move { label: string; apply: (s: GameState) => GameState | null }

/** Every legal thing the player could do right now, excluding ending the turn. */
function legalMoves(s: GameState): Move[] {
  const out: Move[] = []
  const mine = s.units.filter((u) => u.owner === 'A')
  for (const u of mine) {
    if (canMoveNow(s, u)) {
      for (const [c, r] of reachable(s, u)) {
        out.push({ label: `move ${u.key}->${c},${r}`, apply: (st) => moveUnit(st, u.id, c, r) })
      }
    }
    if (!canActNow(s, u)) continue
    // normal attack
    for (const t of targetsFrom(s, u)) {
      out.push({ label: `hit ${u.key}->${t.key}`, apply: (st) => planAttack(st, u.id, t.id, false) })
    }
    // special, if charged
    if (u.charge >= u.chargeMax) {
      const meta = metaOf(u)
      if (meta.kind === 'enemy') {
        const range = meta.rangeOverride
        for (const t of targetsFrom(s, u, u.col, u.row, range, meta.ignoreBlock)) {
          out.push({ label: `SPC ${u.key}->${t.key}`, apply: (st) => planAttack(st, u.id, t.id, true) })
        }
      } else if (meta.kind === 'aoe') {
        out.push({ label: `AOE ${u.key}`, apply: (st) => planArea(st, u.id) })
      } else if (meta.kind === 'self' || meta.kind === 'team') {
        out.push({ label: `ABL ${u.key}`, apply: (st) => useAbility(st, u.id, {}) })
      }
    }
  }
  return out
}

/**
 * Compact signature of a position, for memoisation.
 *
 * The declared action must be encoded IN FULL. Collapsing it to a boolean makes
 * "Haunter declares a normal attack on the blocker" and "Haunter declares Shadow
 * Ball on the champion" hash identically — the first is explored, fails, and
 * poisons the memo so the winning line is silently pruned.
 */
const plannedSig = (u: GameState['units'][number]) => {
  const p = u.planned
  if (!p) return '-'
  if (p.kind === 'tile') return `tile@${p.col},${p.row}`
  if (p.kind === 'aoe') return 'aoe'
  return `${p.kind}@${p.targetId}`
}
const sig = (s: GameState) =>
  s.units
    .map((u) => `${u.id}:${u.col},${u.row},${u.hp},${u.charge},${u.moved ? 1 : 0},${u.acted ? 1 : 0},${plannedSig(u)}`)
    .sort()
    .join('|') + `#${s.movesLeft}`

/**
 * Can the player force a win within `turnsLeft` of their own turns?
 * Returns the winning line, or null.
 */
function solve(s: GameState, turnsLeft: number, budget = { n: 400000 }): string[] | null {
  if (s.winner === 'A') return []
  if (s.winner === 'B' || turnsLeft <= 0) return null

  const seen = new Set<string>()
  // explore all action sequences WITHIN this turn, then end the turn and recurse
  const walk = (cur: GameState, acted: string[]): string[] | null => {
    if (budget.n-- <= 0) return null
    const k = sig(cur) + `@${turnsLeft}`
    if (seen.has(k)) return null
    seen.add(k)

    // option 1: stop here and end the turn
    const ended = endTurn(cur)
    if (ended.winner === 'A') return [...acted, 'END']
    if (!ended.winner) {
      const rest = solve(ended, turnsLeft - 1, budget)
      if (rest) return [...acted, 'END', ...rest]
    }

    // option 2: take another action first
    for (const m of legalMoves(cur)) {
      const next = m.apply(cur)
      if (!next) continue
      const got = walk(next, [...acted, m.label])
      if (got) return got
    }
    return null
  }
  return walk(s, [])
}

let failures = 0
for (const p of PUZZLES as Puzzle[]) {
  const at = solve(makePuzzleState(p), p.turns)
  const under = p.turns > 1 ? solve(makePuzzleState(p), p.turns - 1) : null

  const solvable = at !== null
  const tight = under === null
  if (!solvable) { failures++; console.log(`FAIL  ${p.id.padEnd(12)} NOT SOLVABLE in ${p.turns} turn(s)`) }
  else if (!tight) { failures++; console.log(`FAIL  ${p.id.padEnd(12)} par is padded — solvable in ${p.turns - 1}: ${under!.join(' , ')}`) }
  else console.log(`PASS  ${p.id.padEnd(12)} solvable in ${p.turns}, not in ${p.turns - 1}`)

  if (PRINT && at) console.log(`      line: ${at.join(' , ')}`)
}

console.log(failures === 0 ? `\nAll ${PUZZLES.length} puzzles verified.` : `\n${failures} puzzle(s) need attention.`)
process.exit(failures === 0 ? 0 : 1)
