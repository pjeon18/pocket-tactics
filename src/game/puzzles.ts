import { COLS, ROWS } from './data'
import { makeChampion, makeUnit, newBattle } from './actions'
import type { GameState, Owner } from './types'

/**
 * Puzzle mode — hand-authored, perfectly deterministic boards.
 *
 * Every puzzle is one question: "KO the rival champion within N turns." There is
 * no RNG (see GameState.deterministic), no fog, no economy to manage — only the
 * position in front of you. Each one exists to teach a single rule by making
 * that rule the solution, which the tutorial can only tell you about.
 *
 * The rival never acts. That is deliberate: a puzzle is a statement about the
 * board, and an opponent's reply would turn it into a negotiation.
 *
 * Every puzzle here is machine-checked by scripts/verify-puzzles.ts, which
 * searches for a winning line and asserts that one exists AND that none exists
 * a turn sooner — so the stated par is genuinely the tightest solution.
 */

export interface PuzzleUnit {
  key: string
  owner: Owner
  col: number
  row: number
  /** Override starting HP — how a puzzle sets up an exact lethal sum. */
  hp?: number
  /** Start with the special charged (or partly charged). */
  charge?: number
  isChampion?: boolean
}

export interface Puzzle {
  id: string
  name: string
  /** What the player is told up front. */
  brief: string
  /** The rule this board exists to teach — shown after a solve. */
  teaches: string
  /** Win within this many of YOUR turns. */
  turns: number
  rocks: [number, number][]
  units: PuzzleUnit[]
}

const mid = Math.floor(COLS / 2)

export const PUZZLES: Puzzle[] = [
  {
    id: 'p1-declare',
    name: 'Declaration',
    brief: 'Victini can reach Mew where it stands. End the rival in one turn.',
    teaches:
      'Attacks are declared, not dealt. Nothing lands until you press End turn — which means your whole turn resolves at once, and you can see it coming.',
    turns: 1,
    rocks: [],
    units: [
      { key: 'victini', owner: 'A', col: mid, row: ROWS - 4, isChampion: true },
      { key: 'mew', owner: 'B', col: mid, row: ROWS - 5, isChampion: true, hp: 2 },
    ],
  },
  {
    id: 'p2-reach',
    name: 'Closing the gap',
    brief: 'Pikachu is two tiles short. Two turns.',
    teaches:
      'Move and attack are separate halves of a turn: you may move a Pokémon and still declare with it, but a freshly deployed one has to settle first.',
    turns: 2,
    rocks: [],
    units: [
      { key: 'victini', owner: 'A', col: 0, row: ROWS - 1, isChampion: true },
      { key: 'pikachu', owner: 'A', col: mid, row: ROWS - 4 },
      { key: 'mew', owner: 'B', col: mid, row: ROWS - 7, isChampion: true, hp: 4 },
    ],
  },
  {
    id: 'p3-matchup',
    name: 'The right tool',
    brief: 'Manaphy is on 3 HP. One of these two can finish it; the other cannot.',
    teaches:
      'Matchups multiply. Grotle is grass into water, so its 2 becomes 3 — lethal. Vulpix is fire into water and its 2 becomes 1. Same attack, opposite result.',
    turns: 1,
    rocks: [],
    units: [
      { key: 'victini', owner: 'A', col: 0, row: ROWS - 1, isChampion: true },
      { key: 'grotle', owner: 'A', col: mid, row: 6 },
      { key: 'vulpix', owner: 'A', col: mid + 2, row: 4 },
      { key: 'manaphy', owner: 'B', col: mid, row: 4, isChampion: true, hp: 3 },
    ],
  },
  {
    id: 'p4-screen',
    name: 'Through the wall',
    brief: 'Onix is in the way and the flanks are walled. Haunter is already charged.',
    teaches:
      'A normal attack stops at the first body in its path. Shadow Ball phases straight through — when a champion hides behind a screen, a phasing special is the answer.',
    turns: 1,
    rocks: [[mid - 1, 5], [mid + 1, 5], [mid - 1, 4], [mid + 1, 4]],
    units: [
      { key: 'victini', owner: 'A', col: 0, row: ROWS - 1, isChampion: true },
      { key: 'haunter', owner: 'A', col: mid, row: 6, charge: 4 },
      { key: 'onix', owner: 'B', col: mid, row: 5 },
      { key: 'mew', owner: 'B', col: mid, row: 4, isChampion: true, hp: 5 },
    ],
  },
  {
    id: 'p5-charge',
    name: 'Worth the wait',
    brief:
      'Dragonite is far out of reach and cannot close the gap in time. Hyper Beam needs two more notches. Three turns.',
    teaches:
      'A special charges one notch at the end of each of your turns, and Hyper Beam fires the length of the board where a normal attack reaches two tiles. Waiting is a move.',
    turns: 3,
    rocks: [],
    units: [
      { key: 'victini', owner: 'A', col: 0, row: ROWS - 1, isChampion: true },
      { key: 'dragonite', owner: 'A', col: mid, row: 9, charge: 1 },
      { key: 'mew', owner: 'B', col: mid, row: 1, isChampion: true, hp: 6 },
    ],
  },
  {
    id: 'p6-lock',
    name: 'The champion\u2019s burden',
    brief:
      'Machamp needs two steps to reach Mew. Your champion would also like to move. You cannot have both.',
    teaches:
      'If your champion moves, nothing else may move that turn — and the reverse. Move the champion first here and Machamp is frozen in place.',
    turns: 1,
    rocks: [],
    units: [
      { key: 'victini', owner: 'A', col: mid - 2, row: 7, isChampion: true },
      { key: 'machamp', owner: 'A', col: mid, row: 7 },
      { key: 'mew', owner: 'B', col: mid, row: 4, isChampion: true, hp: 3 },
    ],
  },
]

/** Build the exact starting position for a puzzle. */
export function makePuzzleState(p: Puzzle): GameState {
  // borrow a normal battle for its shape, then replace everything that matters
  const s = newBattle(
    { champion: 'victini', picks: [], summons: [] },
    { champion: 'mew', picks: [], summons: [] },
    false,
    'summer',
  )
  s.deterministic = true
  s.rocks = p.rocks.map(([c, r]) => [c, r] as [number, number])
  s.chests = []
  s.hazards = []
  s.log = []
  s.units = []

  for (const u of p.units) {
    const unit = u.isChampion
      ? makeChampion(u.key, u.owner, u.col, u.row)
      : makeUnit(u.key, u.owner, u.col, u.row)
    if (u.hp != null) unit.hp = u.hp
    if (u.charge != null) unit.charge = Math.min(u.charge, unit.chargeMax)
    s.units.push(unit)
  }

  // puzzles are about the position, not the purse
  for (const o of ['A', 'B'] as Owner[]) {
    s.players[o].bench = []
    s.players[o].poke = 0
    s.players[o].great = 0
    s.players[o].ultra = 0
    s.players[o].summons = []
    s.players[o].items = []
  }
  s.players.A.championKey = p.units.find((u) => u.isChampion && u.owner === 'A')!.key
  s.players.B.championKey = p.units.find((u) => u.isChampion && u.owner === 'B')!.key
  return s
}

export const puzzleById = (id: string) => PUZZLES.find((p) => p.id === id)
