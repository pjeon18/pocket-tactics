/** Headless test of campaign progression: unlock gating, rewards, persistence. */
import { LADDER, STARTER_CARDS, claimWin, isUnlocked, loadCampaign, resetCampaign, rewardsOf } from '../src/game/campaign'
import { ROSTER, SUMMONS } from '../src/game/data'

// minimal localStorage for node
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

let fails = 0
const ok = (c: boolean, n: string) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`) }

let save = resetCampaign()
ok(save.cards.length === STARTER_CARDS.length, `starts with ${STARTER_CARDS.length} cards`)
ok(save.cards.length >= 8, 'starter pool can field a legal draft of 8')
ok(save.beaten.length === 0, 'nothing beaten yet')

ok(isUnlocked(save, 0), 'first trainer is open')
ok(!isUnlocked(save, 1), 'second trainer is locked')

// every ladder deck and reward must reference real cards
for (const o of LADDER) {
  ok(o.deck.every((k) => !!ROSTER[k]), `${o.id} deck is all real cards`)
  ok(o.deck.length === 8, `${o.id} fields a full deck of 8`)
  ok(o.summons.every((k) => !!SUMMONS[k]), `${o.id} summons exist`)
  ok(rewardsOf(o).every((k) => !!ROSTER[k]), `${o.id} rewards are real cards`)
  // the promise of the mode: they field what they hand over
  ok(rewardsOf(o).every((k) => o.deck.includes(k)), `${o.id} fields every card it rewards`)
}

// no reward is already in the starter pool — every win must actually give something
for (const o of LADDER) {
  ok(rewardsOf(o).some((k) => !STARTER_CARDS.includes(k)), `${o.id} rewards at least one new card`)
}

// beating trainer 1 grants its rewards and opens trainer 2
const before = loadCampaign().cards.length
const { save: after, gained } = claimWin(LADDER[0].id)
ok(gained.length > 0, 'first win grants cards')
ok(after.cards.length === before + gained.length, 'collection grew by exactly the new cards')
ok(after.beaten.includes(LADDER[0].id), 'win recorded')
ok(isUnlocked(after, 1), 'second trainer now open')

// a rematch grants nothing twice
const { gained: again } = claimWin(LADDER[0].id)
ok(again.length === 0, 'rematch grants no duplicates')
ok(loadCampaign().cards.length === after.cards.length, 'collection unchanged after rematch')

// persistence survives a reload
ok(loadCampaign().beaten.includes(LADDER[0].id), 'progress persists')

// the full ladder is completable and every reward is reachable
let s = resetCampaign()
for (const o of LADDER) s = claimWin(o.id).save
const reachable = new Set([...STARTER_CARDS, ...LADDER.flatMap((o) => rewardsOf(o))])
ok(s.beaten.length === LADDER.length, 'whole ladder can be completed')
ok(s.cards.length === reachable.size, `collection ends at ${reachable.size} cards`)
console.log(`\ncollectable: ${reachable.size} of ${Object.keys(ROSTER).length} cards via the ladder`)

console.log(fails === 0 ? '\nall good' : `\n${fails} failure(s)`)
process.exit(fails ? 1 : 0)
