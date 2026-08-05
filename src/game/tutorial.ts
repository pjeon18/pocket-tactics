import type { DraftResult, GameState } from './types'
import { makeUnit, newBattle } from './actions'

/**
 * The guided tutorial's fixed board.
 *
 * It teaches the ordinary turn, in the order you actually do it: pay for a
 * Pokémon, let it settle, walk it into range, declare a plain attack, watch the
 * declaration resolve at End turn — and only then the charged special. The
 * earlier version jumped straight to the special and never once showed a normal
 * attack, which is the thing you spend most of a real game doing.
 *
 * There are two rival pieces on purpose. Squirtle is a throwaway body to learn
 * the attack loop on; Manaphy is the champion and the actual win condition. Both
 * are water, so Pikachu reads as super effective throughout.
 *
 * The rival never acts, and the numbers are arranged so the last point of damage
 * lands on the special:
 *   deploy → settle → move+strike Squirtle (3) → move+strike Manaphy (5→2)
 *   → Thunder Wave (2) → KO.
 */
export function makeTutorialDrafts(): { draftA: DraftResult; draftB: DraftResult } {
  return {
    draftA: { champion: 'victini', picks: ['pikachu'], summons: [] },
    draftB: { champion: 'manaphy', picks: [], summons: [] },
  }
}

/** The rival body the player learns the attack loop against. */
export const TUTORIAL_MINION = 'squirtle'

export function makeTutorialState(): GameState {
  const { draftA, draftB } = makeTutorialDrafts()
  const s = newBattle(draftA, draftB, false, 'summer')
  s.deterministic = true // a tutorial must never teach you a lesson the dice then contradict
  s.rocks = []
  s.chests = []
  s.hazards = []
  s.log = []

  const champB = s.units.find((u) => u.owner === 'B' && u.isChampion)!
  champB.col = 3
  champB.row = 1
  champB.hp = 5
  champB.maxHp = 5

  // a soft target, deliberately out of reach on the turn Pikachu lands
  const minion = makeUnit(TUTORIAL_MINION, 'B', 3, 3)
  minion.hp = 3
  minion.maxHp = 3
  s.units.push(minion)

  s.players.A.poke = 5
  s.players.B.poke = 0
  s.players.B.great = 0
  s.players.B.bench = []
  return s
}
