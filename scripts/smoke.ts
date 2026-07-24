/* Headless engine smoke test: rules, planning/resolution, specials, abilities, AI games. */
import {
  cancelPlan,
  deploy,
  finishTurn,
  moveUnit,
  newBattle,
  planArea,
  planAttack,
  resolveStep,
  tradeBalls,
  undoMove,
  useAbility,
  useItem,
} from '../src/game/actions'
import { aiDraft, aiStep } from '../src/game/ai'
import { MOVE_CAP, ROSTER, costEquiv, typeMod } from '../src/game/data'
import { canMoveNow, openDeployTiles, reachable, targetsFrom } from '../src/game/rules'
import type { GameState, Unit } from '../src/game/types'

let failures = 0
const ok = (cond: boolean, name: string) => {
  if (!cond) failures++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
}

/** Resolve every pending plan, then hand the turn over. */
const endTurnFully = (s: GameState): GameState => {
  let cur = s
  for (let i = 0; i < 50; i++) {
    const next = resolveStep(cur)
    if (!next) break
    cur = next
  }
  return finishTurn(cur)
}

const mkUnit = (tpl: Unit, over: Partial<Unit>): Unit => ({ ...tpl, ...over })
const spawn = (s: GameState, id: number, key: string, owner: 'A' | 'B', col: number, row: number, over: Partial<Unit> = {}): Unit => {
  const u = mkUnit(s.units[0], {
    id, key, owner, isChampion: false, col, row,
    hp: 8, maxHp: 8, atk: 3, range: 2, move: 2, charge: 0, chargeMax: 4,
    moved: false, movedFrom: null, acted: false, planned: null, plannedSeq: 0,
    summoned: false, stunned: false, atkBuff: 0, moveBuff: 0, abilityUsed: false,
    heldItem: null,
    ...over,
  })
  s.units.push(u)
  return u
}

/** Deterministic RNG override for crit/miss tests. */
const realRandom = Math.random
const withRandom = <T,>(value: number, fn: () => T): T => {
  Math.random = () => value
  try {
    return fn()
  } finally {
    Math.random = realRandom
  }
}

const draftA = { champion: 'victini', picks: ['pikachu', 'onix', 'kirlia', 'haunter', 'rotomwash', 'lucario', 'grotle', 'snorlax'] }
const draftB = { champion: 'celebi', picks: ['pikachu', 'onix', 'magneton', 'scyther', 'gigalith', 'weavile', 'krookodile', 'garchomp'] }

/* --- type chart --- */
ok(typeMod('water', 'fire') === 3, 'water beats fire (+3)')
ok(typeMod('fire', 'water') === -2, 'fire resisted by water (−2)')
ok(typeMod('normal', 'normal') === 0, 'neutral is 0')
ok(typeMod('electric', 'grass') === -2, 'electric resisted by grass')

/* --- economy & deploy --- */
let s = newBattle(draftA, draftB)
ok(s.players.A.poke === 2, 'A opens with 2 pokeballs (1 income/turn)')
ok(s.rocks.length === 4, 'terrain generated as mirrored pairs')
ok(s.rocks.every(([c, r]) => s.rocks.some(([mc, mr]) => mc === 6 - c && mr === 9 - r)), 'rocks are mirror-symmetric')
ok(deploy(s, 'A', 'snorlax', 0, 9) === null, 'cannot deploy Snorlax without an Ultra Ball')
let s2 = deploy(s, 'A', 'pikachu', 0, 9)!
ok(!!s2 && s2.players.A.poke === 0, 'deploy pays pokeballs (Pikachu costs 2 now)')
ok(s2.players.A.bench.includes('pikachu'), 'the card stays in the deck after deploying')
ok(s2.players.A.cooldowns.pikachu === 3, 'deploying starts the redeploy cooldown')
ok(deploy(s2, 'A', 'pikachu', 1, 9) === null, 'cannot redeploy while on cooldown')
let s3 = s2
for (let i = 0; i < 3; i++) s3 = endTurnFully(endTurnFully(s3)) // 3 full rounds tick the cooldown to 0
ok((s3.players.A.cooldowns.pikachu ?? 0) === 0 && deploy(s3, 'A', 'pikachu', 1, 9) !== null, 'card is redeployable after its cooldown')

/* --- deploy time: basics land ready, strong Pokémon need a turn --- */
let dt = newBattle(draftA, draftB)
dt.players.A.poke = 5
dt.players.A.great = 1
const dpk = deploy(dt, 'A', 'pikachu', 0, 9)!
ok(dpk !== null && dpk.units.find((u) => u.key === 'pikachu')!.summoned === false, 'basics fight the turn they land')
const dgr = deploy(dpk, 'A', 'lucario', 1, 9)
ok(dgr !== null && dgr!.units.find((u) => u.key === 'lucario')!.summoned === true, 'great-tier needs a turn to land')

/* --- blitz shop mode: deploy straight from the shop, nothing is kept --- */
let bz = newBattle(draftA, draftB, true)
ok(bz.shopMode && bz.players.A.bench.length === 0, 'blitz: no pre-drafted deck')
ok(bz.players.A.shop.length === 5, 'blitz: shop offers 5')
bz.players.A.poke = 8
const buyKey = [...bz.players.A.shop].sort((a, b) => costEquiv(ROSTER[a].cost) - costEquiv(ROSTER[b].cost))[0]
const bSpot = openDeployTiles(bz, 'A')[0]
const bDep = deploy(bz, 'A', buyKey, bSpot[0], bSpot[1])!
ok(bDep !== null && bDep.units.some((u) => u.key === buyKey), 'blitz: shop card deploys straight to the field')
ok(bDep.players.A.poke < 8, 'blitz: deploying pays at the shop')
ok(!bDep.players.A.bench.includes(buyKey) && !bDep.players.A.shop.includes(buyKey), 'blitz: nothing is kept — the card is gone')
ok(bDep.players.A.revealed.includes(buyKey), 'blitz: deploys still reveal to the opponent')

/* --- trading --- */
let tr0 = newBattle(draftA, draftB)
tr0.players.A.poke = 6
const trG = tradeBalls(tr0, 'A', 'great')!
ok(trG !== null && trG.players.A.poke === 3 && trG.players.A.great === 1, '3 pokeballs trade into a Great Ball')
const trU = tradeBalls(tr0, 'A', 'ultra')!
ok(trU !== null && trU.players.A.poke === 0 && trU.players.A.ultra === 1, '6 pokeballs trade into an Ultra Ball')
ok(tradeBalls(trG, 'A', 'ultra') === null, 'cannot trade without enough pokeballs')

/* --- income scales every 5 rounds --- */
let inc = newBattle(draftA, draftB)
inc.players.A.poke = 0
inc.round = 6 // rounds 6-10: 2/turn
const inc2 = endTurnFully(endTurnFully(inc)) // B's turn, then A's turn start grants income
ok(inc2.players.A.poke >= 2, 'income grows every 5 rounds')

/* --- move cap & undo --- */
let c = newBattle(draftA, draftB)
spawn(c, 800, 'pikachu', 'A', 0, 7)
spawn(c, 801, 'haunter', 'A', 1, 7)
spawn(c, 802, 'kirlia', 'A', 2, 7)
spawn(c, 803, 'grotle', 'A', 3, 7, { move: 1 })
c.rocks = [] // clear terrain for deterministic movement
let m = moveUnit(c, 800, 0, 6)!
m = moveUnit(m, 801, 1, 6)!
m = moveUnit(m, 802, 2, 6)!
ok(m.movesLeft === 0, `move cap consumed (${MOVE_CAP}/turn)`)
ok(moveUnit(m, 803, 3, 6) === null, 'fourth move is refused')
const undone = undoMove(m, 802)!
ok(undone !== null && undone.movesLeft === 1, 'undo refunds the move')
ok(undone.units.find((u) => u.id === 802)!.col === 2 && undone.units.find((u) => u.id === 802)!.row === 7, 'undo returns the unit home')
ok(moveUnit(undone, 803, 3, 6) !== null, 'refunded move can be spent again')

/* --- champion lock still holds --- */
const champA = m.units.find((u) => u.isChampion && u.owner === 'A')!
ok(!canMoveNow(m, champA), 'champion cannot move after others moved')

/* --- planning & deferred resolution --- */
let f = newBattle(draftA, draftB)
f.rocks = []
const atkr = spawn(f, 900, 'haunter', 'A', 2, 5, { atk: 3, range: 2 })
spawn(f, 901, 'magneton', 'B', 2, 3, { hp: 8 }) // ghost vs electric = neutral
let planned = planAttack(f, 900, 901, false)!
ok(planned !== null, 'attack can be planned')
ok(planned.units.find((u) => u.id === 901)!.hp === 8, 'no damage before the turn ends (deferred)')
const cancelled = cancelPlan(planned, 900)!
ok(cancelled !== null && cancelled.units.find((u) => u.id === 900)!.planned === null, 'plans can be cancelled')
let r1 = withRandom(0.5, () => resolveStep(planned)!)
ok(r1 !== null && r1.units.find((u) => u.id === 901)!.hp === 5, 'planned attack resolves at end of turn')
ok(resolveStep(r1) === null, 'nothing left to resolve after')

/* planning locks out undo */
let g = newBattle(draftA, draftB)
g.rocks = []
spawn(g, 905, 'haunter', 'A', 2, 5, { range: 3 })
spawn(g, 906, 'krookodile', 'B', 2, 3)
let gm = moveUnit(g, 905, 2, 4)!
gm = planAttack(gm, 905, 906, false)!
ok(undoMove(gm, 905) === null, 'cannot undo a move once an attack is declared')

/* --- type mod applies at resolution --- */
let tm = newBattle(draftA, draftB)
tm.rocks = []
spawn(tm, 910, 'rotomwash', 'A', 1, 5, { atk: 3, range: 2, charge: 5, chargeMax: 5 }) // water
spawn(tm, 911, 'blaziken', 'B', 1, 3, { hp: 7 }) // fire
let tp = planAttack(tm, 910, 911, false)!
let tr = withRandom(0.5, () => resolveStep(tp)!)
ok(tr.units.find((u) => u.id === 911)!.hp === 7 - 6, 'super effective adds +3 (water vs fire)')

/* --- chests --- */
let ch = newBattle(draftA, draftB)
ch.rocks = []
ch.chests = [{ col: 0, row: 5 }]
spawn(ch, 920, 'pikachu', 'A', 0, 7, { move: 2 })
const grabbed = moveUnit(ch, 920, 0, 5)!
ok(grabbed !== null && grabbed.chests.length === 0, 'moving onto a chest opens it')
ok(undoMove(grabbed, 920) === null, 'a chest pickup cannot be undone')

/* --- champion abilities (instant) --- */
let v = newBattle(draftA, draftB)
const vChamp = v.units.find((u) => u.isChampion && u.owner === 'A')!
vChamp.charge = vChamp.chargeMax
spawn(v, 930, 'pikachu', 'A', 0, 8)
const vUsed = useAbility(v, vChamp.id, {})!
ok(vUsed !== null && vUsed.units.find((u) => u.id === 930)!.moveBuff === 2, 'V-Create is instant (buffs before you move)')

/* --- Jirachi plans, resolves once --- */
let j = newBattle({ ...draftA, champion: 'jirachi' }, draftB)
j.rocks = []
const jir = j.units.find((u) => u.isChampion && u.owner === 'A')!
jir.charge = jir.chargeMax
jir.col = 3
jir.row = 5
spawn(j, 940, 'onix', 'B', 3, 3, { hp: 9 })
let jp = planArea(j, jir.id, { col: 3, row: 3 })!
ok(jp !== null, 'Doom Desire can be planned')
let jr = resolveStep(jp)!
ok(jr.units.find((u) => u.id === 940)!.hp === 9 - 8, 'Doom Desire resolves (5 base, steel beats rock → 8)')
const jir2 = jr.units.find((u) => u.isChampion && u.owner === 'A')!
jir2.charge = jir2.chargeMax
jir2.acted = false
ok(planArea(jr, jir2.id, { col: 3, row: 3 }) === null, 'Doom Desire is once per game')

/* --- crits & misses (normal attacks only, deterministic RNG) --- */
let cm = newBattle(draftA, draftB)
cm.rocks = []
spawn(cm, 950, 'haunter', 'A', 2, 5, { atk: 3, range: 2 })
spawn(cm, 951, 'magneton', 'B', 2, 3, { hp: 8 })
let cmPlan = planAttack(cm, 950, 951, false)!
const missed = withRandom(0.01, () => resolveStep(cmPlan)!) // 0.01 < miss chance
ok(missed.units.find((u) => u.id === 951)!.hp === 8, 'a miss deals no damage')
const crit = withRandom(0.06, () => resolveStep(cmPlan)!) // no miss (0.06 > 0.05), crit (0.06 < 0.10)
ok(crit.units.find((u) => u.id === 951)!.hp === 8 - 5, 'a crit adds +2 (3 atk → 5)')
const plain = withRandom(0.5, () => resolveStep(cmPlan)!)
ok(plain.units.find((u) => u.id === 951)!.hp === 8 - 3, 'plain hit deals normal damage')

/* --- type synergies --- */
let sy = newBattle({ ...draftA, champion: 'mew' }, draftB) // mew is psychic
sy.rocks = []
spawn(sy, 960, 'kirlia', 'A', 0, 7) // psychic
spawn(sy, 961, 'espeon', 'A', 1, 7) // psychic → 3 with Mew: Mindlink active
spawn(sy, 962, 'krookodile', 'B', 0, 4, { hp: 8 })
const kirlia = sy.units.find((u) => u.id === 960)!
ok(targetsFrom(sy, kirlia).some((t) => t.id === 962), 'Mindlink: psychic range 2 → 3 reaches an enemy 3 away')
const sy2 = structuredClone(sy)
sy2.units = sy2.units.filter((u) => u.id !== 961) // drop to 2 psychics
const kirlia2 = sy2.units.find((u) => u.id === 960)!
ok(!targetsFrom(sy2, kirlia2).some((t) => t.id === 962), 'synergy off below 3 same-type')

/* --- items --- */
let it = newBattle(draftA, draftB)
it.players.A.items = ['potion', 'assault-vest', 'life-orb', 'revive']
spawn(it, 970, 'haunter', 'A', 0, 7, { hp: 2, maxHp: 4 })
let itUsed = useItem(it, 'A', 'potion', { targetId: 970 })!
ok(itUsed !== null && itUsed.units.find((u) => u.id === 970)!.hp === 4 - 2 + 3 || itUsed.units.find((u) => u.id === 970)!.hp === 4, 'Potion heals 3 (capped at max)')
ok(itUsed.players.A.items.length === 3, 'items are consumed')
let itVest = useItem(itUsed, 'A', 'assault-vest', { targetId: 970 })!
ok(itVest !== null && itVest.units.find((u) => u.id === 970)!.maxHp === 6, 'Assault Vest adds +2 max HP')
ok(useItem(itVest, 'A', 'life-orb', { targetId: 970 }) === null, 'only one held item per Pokémon')
it.players.A.fainted = ['pikachu']
const itRev = useItem(it, 'A', 'revive', { reviveKey: 'pikachu', col: 1, row: 9 })!
ok(itRev !== null && itRev.units.some((u) => u.key === 'pikachu' && u.owner === 'A'), 'Revive returns a fainted Pokémon')

/* --- anti-wall patch: field cap, income cap, kill bounty, lance --- */
let fc = newBattle(draftA, draftB)
fc.rocks = []
fc.players.A.poke = 8
for (let i = 0; i < 7; i++) spawn(fc, 950 + i, 'pikachu', 'A', i % 7, 8)
ok(deploy(fc, 'A', 'pikachu', 0, 9) === null, `field cap: an 8th Pokémon cannot deploy (cap ${7})`)

let ic = newBattle(draftA, draftB)
ic.players.A.poke = 0
ic.round = 30
const ic2 = endTurnFully(endTurnFully(ic))
ok(ic2.players.A.poke <= 4, 'income cap: round 30 still pays only 2/turn')

let kb = newBattle(draftA, draftB)
kb.rocks = []
kb.players.A.poke = 3
spawn(kb, 960, 'haunter', 'A', 2, 5, { atk: 3, range: 2, charge: 4, chargeMax: 4 })
spawn(kb, 961, 'starly', 'B', 2, 3, { hp: 1 })
let kbp = planAttack(kb, 960, 961, true)! // Shadow Ball guarantees the KO
let kbr = resolveStep(kbp)!
ok(kbr !== null && kbr.players.A.poke === 4, 'kill bounty: a KO pays the hunter +1 Poké Ball')

let ln = newBattle(draftA, draftB)
ln.rocks = []
spawn(ln, 970, 'escavalier', 'A', 2, 5, { atk: 3, range: 1 })
spawn(ln, 971, 'magneton', 'B', 2, 4, { hp: 8 }) // bug vs electric: neutral
spawn(ln, 972, 'magneton', 'B', 2, 3, { hp: 8 }) // directly behind
let hitBoth = false
for (let tries = 0; tries < 12 && !hitBoth; tries++) {
  // fresh plan each try — the 5% miss roll consumes the plan without the lance
  const r = resolveStep(planAttack(ln, 970, 971, false)!)
  if (!r) break
  const front = r.units.find((u) => u.id === 971)
  const back = r.units.find((u) => u.id === 972)
  if (front && front.hp < 8 && back && back.hp < 8) hitBoth = true
}
ok(hitBoth, "Escavalier's normal attack lances the unit behind the target")

/* --- synergy tiers: uniques only, tier 2 at five --- */
import { effAtk, synergyTier } from '../src/game/rules'
let syU = newBattle(draftA, draftB)
syU.rocks = []
for (let i = 0; i < 3; i++) spawn(syU, 980 + i, 'pikachu', 'A', i, 8) // three DUPLICATE electrics
ok(synergyTier(syU.units, 'A', 'electric') === 0, 'duplicates do not count toward synergies')
let syT2 = newBattle(draftA, draftB) // NB: champion Victini is itself a unique FIRE
syT2.rocks = []
const fires = ['vulpix', 'ponyta', 'chandelure', 'blaziken'] // 4 uniques + Victini = 5
fires.forEach((k, i) => spawn(syT2, 985 + i, k, 'A', i, 8))
ok(synergyTier(syT2.units, 'A', 'fire') === 2, 'five unique fires (champion counts) reach tier 2')
const vul = syT2.units.find((u) => u.id === 985)!
vul.atk = 2
ok(effAtk(syT2.units, vul) === 4, 'Blaze tier 2 grants +2 ATK')
syT2.units = syT2.units.filter((u) => u.id !== 988) // drop to four fires
ok(synergyTier(syT2.units, 'A', 'fire') === 1 && effAtk(syT2.units, vul) === 3, 'tier falls back to 1 at four uniques')

/* --- full AI vs AI games run to completion --- */
for (let g2 = 0; g2 < 5; g2++) {
  let game = newBattle(aiDraft(), aiDraft())
  let steps = 0
  while (!game.winner && steps < 4000) {
    const next = aiStep(game)
    if (next) game = next
    else game = endTurnFully(game)
    steps++
    if (game.winner) break
  }
  ok(!!game.winner, `AI-vs-AI game ${g2 + 1} finishes (winner ${game.winner}, ${game.round} rounds, ${steps} steps)`)
}

console.log(failures ? `\n${failures} FAILURES` : '\nall good')
process.exit(failures ? 1 : 0)
