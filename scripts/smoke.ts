/* Headless engine smoke test: rules, planning/resolution, specials, abilities, AI games. */
import {
  cancelPlan,
  useSummon,
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
ok(s2.players.A.cooldowns.pikachu === 6, 'deploying starts the redeploy cooldown (cheap Pokémon +3)')
ok(deploy(s2, 'A', 'pikachu', 1, 9) === null, 'cannot redeploy while on cooldown')
let s3 = s2
for (let i = 0; i < 6; i++) s3 = endTurnFully(endTurnFully(s3)) // 6 full rounds tick the cooldown to 0
ok((s3.players.A.cooldowns.pikachu ?? 0) === 0 && deploy(s3, 'A', 'pikachu', 1, 9) !== null, 'card is redeployable after its cooldown')

/* --- deploy time: nobody attacks the turn they land, but they may move --- */
let dt = newBattle(draftA, draftB)
dt.rocks = []
dt.players.A.poke = 5
const dpk = deploy(dt, 'A', 'pikachu', 0, 9)!
const fresh = dpk.units.find((u) => u.key === 'pikachu')!
ok(fresh.summoned === true, 'every deploy waits a turn to attack')
ok(canMoveNow(dpk, fresh), 'a freshly deployed Pokémon may still move')
ok(planAttack(dpk, fresh.id, dpk.units.find((u) => u.owner === 'B')!.id, false) === null, 'and cannot declare an attack')

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

/* --- Jirachi plans, resolves, and is REPEATABLE (no more once-per-game) --- */
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
ok(planArea(jr, jir2.id, { col: 3, row: 3 }) !== null, 'Doom Desire is repeatable once recharged')

/* --- tiered deploy zones: cheap units reach deeper --- */
let tz = newBattle(draftA, draftB)
tz.rocks = []
tz.players.A.poke = 8
tz.players.A.great = 1
tz.players.A.ultra = 1
ok(deploy(tz, 'A', 'pikachu', 0, 6) !== null, 'Poké-tier deploys 4 rows deep (row 6)')
ok(deploy(tz, 'A', 'lucario', 1, 6) === null, 'Great-tier refused at row 6')
ok(deploy(tz, 'A', 'lucario', 1, 7) !== null, 'Great-tier deploys 3 rows deep (row 7)')
ok(deploy(tz, 'A', 'snorlax', 2, 7) === null, 'Ultra-tier refused at row 7')
ok(deploy(tz, 'A', 'snorlax', 2, 8) !== null, 'Ultra-tier deploys 2 rows deep (row 8)')

/* --- Manaphy Surf: 4 dmg, her own shore stays dry --- */
let mn = newBattle({ ...draftA, champion: 'manaphy' }, draftB)
mn.rocks = []
const mana = mn.units.find((u) => u.isChampion && u.owner === 'A')!
mana.charge = mana.chargeMax
spawn(mn, 950, 'krookodile', 'B', 2, 4, { hp: 12 })            // midfield enemy: hit
spawn(mn, 951, 'pikachu', 'A', 0, 8, { hp: 7 })                 // ally on her shore: dry
spawn(mn, 952, 'haunter', 'A', 1, 5, { hp: 7 })                 // midfield ally: soaked
let mp = planArea(mn, mana.id)!
let mr = resolveStep(mp)!
const surfMid = mr.units.find((u) => u.id === 950)!
const surfShore = mr.units.find((u) => u.id === 951)!
const surfAlly = mr.units.find((u) => u.id === 952)!
ok(surfMid.hp < 12 && surfShore.hp === 7 && surfAlly.hp < 7, 'Surf soaks midfield (both sides) but spares her back two rows')

/* --- Mamoswine Icicle Spear: 1–4 hits of 3, declining odds --- */
let ice = newBattle(draftA, draftB)
ice.rocks = []
spawn(ice, 960, 'mamoswine', 'A', 2, 5, { charge: 3, chargeMax: 3 })
spawn(ice, 961, 'snorlax', 'B', 2, 4, { hp: 22, maxHp: 22 }) // ice vs normal = neutral, big body to survive
const spearPlan = planAttack(ice, 960, 961, true)!
const allSpears = withRandom(0, () => resolveStep(spearPlan)!) // 0 < every chance → all four land
ok(allSpears.units.find((u) => u.id === 961)!.hp === 22 - 16, 'Icicle Spear can strike four times (4×4 dmg, premium +1)')
const oneSpear = withRandom(0.99, () => resolveStep(planAttack(ice, 960, 961, true)!)!) // first lands, second (0.99≥0.75) stops
ok(oneSpear.units.find((u) => u.id === 961)!.hp === 22 - 4, 'Icicle Spear stops after the first hit misses (min 1 hit)')

/* --- Drifblim Ominous Wind: ranged phasing hit + self-heal --- */
let dbl = newBattle(draftA, draftB)
dbl.rocks = []
spawn(dbl, 970, 'drifblim', 'A', 2, 6, { charge: 3, chargeMax: 3, hp: 5, maxHp: 13 })
spawn(dbl, 971, 'blaziken', 'B', 2, 4, { hp: 15, maxHp: 15 }) // ghost vs fire = neutral, two rows away
const windPlan = planAttack(dbl, 970, 971, true)!
const windRes = resolveStep(windPlan)!
ok(windRes.units.find((u) => u.id === 971)!.hp === 15 - 5, 'Ominous Wind hits for 5 at range (premium +1)')
ok(windRes.units.find((u) => u.id === 970)!.hp === 7, 'Ominous Wind heals Drifblim by 2')

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
ok(ic2.players.A.poke === 3, 'income cap: round 30 pays the capped 3/turn')

// income steps: 1/turn early, 2 at round 6, 3 at round 16
let inc16 = newBattle(draftA, draftB)
inc16.players.A.poke = 0
inc16.round = 16
const inc16b = endTurnFully(endTurnFully(inc16))
ok(inc16b.players.A.poke === 3, 'income reaches 3/turn at round 16')

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

/* --- legendary summons --- */
const draftS = { champion: 'victini', picks: draftA.picks, summons: ['hooh', 'lugia'] }
let sm = newBattle(draftS, draftB)
sm.rocks = []
spawn(sm, 970, 'pikachu', 'A', 0, 8, { hp: 7, maxHp: 7 })
sm.players.A.poke = 20
ok(useSummon(sm, 'A', 'dialga') === null, 'cannot use a summon you did not draft')
const smh = useSummon(sm, 'A', 'hooh')!
const buffed = smh.units.find((u) => u.id === 970)!
ok(smh !== null && buffed.maxHp === 10 && buffed.hp === 10, 'Ho-Oh grants +3 max HP to fielded allies')
ok(smh.players.A.poke === 14, 'summons cost Poké Balls (Ho-Oh is 6)')
ok(useSummon(smh, 'A', 'hooh') !== null, 'summons are re-castable — not once per game')
const sml = useSummon(smh, 'A', 'lugia')!
ok(sml !== null && sml.lugiaLock === 'B', 'Lugia grounds the opponent')
const smlB = endTurnFully(sml) // now B's turn, locked
const bUnit0 = smlB.units.find((u) => u.owner === 'B' && u.isChampion)!
ok(!canMoveNow(smlB, bUnit0), "Lugia: the grounded side can't move")
smlB.players.B.poke = 8
ok(deploy(smlB, 'B', 'pikachu', 0, 0) === null, "Lugia: the grounded side can't deploy")
const smlDone = endTurnFully(smlB)
ok(smlDone.lugiaLock === null, "Lugia's roar fades after the grounded turn")

/* --- Payday: Normal synergy pays Poké Balls (2 uniques → +1) --- */
let pd = newBattle(draftA, draftB)
pd.rocks = []
spawn(pd, 975, 'snorlax', 'A', 0, 8)
spawn(pd, 976, 'porygon2', 'A', 1, 8)
pd.players.A.poke = 0
const pd2 = endTurnFully(endTurnFully(pd)) // B, then back to A's income
ok(pd2.players.A.poke >= 2, 'Payday: two unique Normals pay +1 extra ball')

/* --- Kyogre: a 3×3 whirlpool that crashes down after one round --- */
const draftKG = { champion: 'victini', picks: draftA.picks, summons: ['kyogre', 'groudon'] }
let ky = newBattle(draftKG, draftB)
ky.rocks = []
ky.players.A.poke = 8
spawn(ky, 980, 'magneton', 'B', 3, 4, { hp: 10, maxHp: 10 }) // electric: neutral to water
ok(useSummon(ky, 'A', 'kyogre', { row: 0 }) === null, 'Kyogre cannot be aimed at the foe’s back rows')
const kyCast = useSummon(ky, 'A', 'kyogre', { col: 3, row: 4 })!
ok(kyCast !== null && kyCast.units.find((u) => u.id === 980)!.hp === 10, 'whirlpool does not hit the moment it is placed')
const kyMid = endTurnFully(kyCast) // A ends: fuse 2→1, still no hit
ok(kyMid.units.find((u) => u.id === 980)!.hp === 10, 'whirlpool waits a full round')
const kyDone = endTurnFully(kyMid) // B ends: fuse 1→0, crashes down for 4
ok(kyDone.units.find((u) => u.id === 980)!.hp === 6, 'whirlpool hits everything still inside for 4')

/* --- Groudon: a row erupts for 6 at the end of your own turn --- */
let gr = newBattle(draftKG, draftB)
gr.rocks = []
gr.players.A.poke = 8
spawn(gr, 985, 'magneton', 'B', 2, 4, { hp: 12, maxHp: 12 })
const grCast = useSummon(gr, 'A', 'groudon', { row: 4 })!
ok(grCast.units.find((u) => u.id === 985)!.hp === 12, 'eruption is telegraphed, not instant')
const grDone = endTurnFully(grCast) // A ends: fuse 1→0, erupts for 6
ok(grDone.units.find((u) => u.id === 985)!.hp === 6, 'eruption hits its row for 6 at end of turn')

/* --- premium (Great/Ultra) Pokémon get +1 on their special --- */
let pr = newBattle(draftA, draftB)
pr.rocks = []
spawn(pr, 990, 'lucario', 'A', 2, 5, { charge: 5, chargeMax: 5 }) // great-tier, Aura Sphere 4 → 5
spawn(pr, 991, 'blaziken', 'B', 2, 4, { hp: 15, maxHp: 15 }) // fighting vs fire = neutral
const prRes = resolveStep(planAttack(pr, 990, 991, true)!)!
ok(prRes.units.find((u) => u.id === 991)!.hp === 15 - 5, 'premium special hits +1 harder (Lucario 4→5)')

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
