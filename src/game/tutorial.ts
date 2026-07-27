import type { DraftResult, GameState } from './types'
import { newBattle } from './actions'

/**
 * The guided tutorial's fixed setup. No draft, no RNG board: the player gets a
 * fire champion (Victini) plus one Pikachu on the bench, and the passive rival
 * is a wounded Manaphy champion sitting in the open — electric beats water, so
 * a single clean hit ends it. The whole core loop (deploy → rest → move →
 * declare → resolve → win) plays out in two short turns.
 */
export function makeTutorialDrafts(): { draftA: DraftResult; draftB: DraftResult } {
  return {
    draftA: { champion: 'victini', picks: ['pikachu'], summons: [] },
    draftB: { champion: 'manaphy', picks: [], summons: [] },
  }
}

export function makeTutorialState(): GameState {
  const { draftA, draftB } = makeTutorialDrafts()
  const s = newBattle(draftA, draftB, false, 'summer')
  // a clear, obstacle-free stage
  s.rocks = []
  s.chests = []
  // the rival champion stands forward and wounded — and never acts
  const champB = s.units.find((u) => u.owner === 'B' && u.isChampion)!
  champB.col = 3
  champB.row = 3
  champB.hp = 3
  champB.maxHp = 3
  // give the player exactly enough to deploy Pikachu; strip the rival's economy
  s.players.A.poke = 5
  s.players.B.poke = 0
  s.players.B.great = 0
  s.players.B.bench = []
  s.log = []
  return s
}
