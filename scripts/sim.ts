/**
 * Balance telemetry harness — runs headless AI-vs-AI games at scale and emits a
 * rich dataset about how the system actually behaves, instead of how we imagine
 * it behaves.
 *
 *   npx tsx scripts/sim.ts [games] [--seed=N] [--tag=name] [--quiet]
 *
 * Writes docs/telemetry/<tag>.json (full aggregate) and prints a summary table.
 * Games are seeded and reproducible, so a rules change can be A/B'd against the
 * same population of matches.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { finishTurn, newBattle, resolveStep } from '../src/game/actions'
import { aiDraft, aiStep } from '../src/game/ai'
import { CHAMPIONS, FATIGUE_ROUND, ROSTER, SUMMONS, costEquiv } from '../src/game/data'
import type { DraftResult, GameState, Owner, Unit } from '../src/game/types'

/* ---------- seeded RNG so runs are reproducible and comparable ---------- */
const realRandom = Math.random
function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------- CLI ---------- */
const argv = process.argv.slice(2)
const GAMES = Number(argv.find((a) => /^\d+$/.test(a)) ?? 2000)
const SEED0 = Number((argv.find((a) => a.startsWith('--seed=')) ?? '--seed=1').split('=')[1])
const TAG = (argv.find((a) => a.startsWith('--tag=')) ?? '--tag=baseline').split('=')[1]
const QUIET = argv.includes('--quiet')

const STEP_CAP = 6000 // a game that exceeds this is a genuine stall

/** One game's worth of observations. */
interface GameRecord {
  winner: Owner | null
  rounds: number
  steps: number
  stalled: boolean
  reachedFatigue: boolean
  champions: Record<Owner, string>
  drafted: Record<Owner, string[]>
  deployed: Record<Owner, string[]>
  summonsDrafted: Record<Owner, string[]>
  summonsUsed: Record<Owner, string[]>
  kos: { round: number; victim: Owner; key: string; isChampion: boolean }[]
  firstKoBy: Owner | null
  firstKoRound: number | null
  koCount: Record<Owner, number>
  damage: Record<Owner, Record<string, number>>
  /** Per-round samples of board/economy state. */
  timeline: {
    round: number
    fielded: Record<Owner, number>
    poke: Record<Owner, number>
    champHpFrac: Record<Owner, number>
  }[]
  peakFielded: Record<Owner, number>
  chestsOpened: number
  itemsHeld: number
}

const otherOwner = (o: Owner): Owner => (o === 'A' ? 'B' : 'A')

/** Resolve all pending plans, then hand the turn over. */
function endTurnFully(s: GameState): GameState {
  let cur = s
  for (let i = 0; i < 60; i++) {
    const next = resolveStep(cur)
    if (!next) break
    cur = next
  }
  return finishTurn(cur)
}

function playOne(seed: number): GameRecord {
  Math.random = mulberry32(seed)

  const draftA: DraftResult = aiDraft()
  const draftB: DraftResult = aiDraft()
  let g = newBattle(draftA, draftB)

  const rec: GameRecord = {
    winner: null,
    rounds: 0,
    steps: 0,
    stalled: false,
    reachedFatigue: false,
    champions: { A: draftA.champion, B: draftB.champion },
    drafted: { A: [...draftA.picks], B: [...draftB.picks] },
    deployed: { A: [], B: [] },
    summonsDrafted: { A: [...(draftA.summons ?? [])], B: [...(draftB.summons ?? [])] },
    summonsUsed: { A: [], B: [] },
    kos: [],
    firstKoBy: null,
    firstKoRound: null,
    koCount: { A: 0, B: 0 },
    damage: { A: {}, B: {} },
    timeline: [],
    peakFielded: { A: 0, B: 0 },
    chestsOpened: 0,
    itemsHeld: 0,
  }

  const seenUnits = new Map<number, Unit>()
  const noteUnits = (s: GameState) => {
    for (const u of s.units) {
      if (!seenUnits.has(u.id)) {
        seenUnits.set(u.id, u)
        if (!u.isChampion) rec.deployed[u.owner].push(u.key)
      } else {
        seenUnits.set(u.id, u)
      }
    }
  }

  /** Detect units that vanished between states — those are KOs. */
  const diffKos = (before: GameState, after: GameState) => {
    if (before.units.length <= after.units.length) return
    const alive = new Set(after.units.map((u) => u.id))
    for (const u of before.units) {
      if (alive.has(u.id)) continue
      rec.kos.push({ round: after.round, victim: u.owner, key: u.key, isChampion: u.isChampion })
      const scorer = otherOwner(u.owner)
      rec.koCount[scorer]++
      if (!rec.firstKoBy) {
        rec.firstKoBy = scorer
        rec.firstKoRound = after.round
      }
    }
  }

  const sampleRound = (s: GameState) => {
    const fielded = (o: Owner) => s.units.filter((u) => u.owner === o && !u.isChampion).length
    const champ = (o: Owner) => s.units.find((u) => u.owner === o && u.isChampion)
    const hpFrac = (o: Owner) => {
      const c = champ(o)
      return c ? c.hp / c.maxHp : 0
    }
    rec.timeline.push({
      round: s.round,
      fielded: { A: fielded('A'), B: fielded('B') },
      poke: { A: s.players.A.poke, B: s.players.B.poke },
      champHpFrac: { A: hpFrac('A'), B: hpFrac('B') },
    })
    rec.peakFielded.A = Math.max(rec.peakFielded.A, fielded('A'))
    rec.peakFielded.B = Math.max(rec.peakFielded.B, fielded('B'))
  }

  noteUnits(g)
  let lastRoundSampled = -1
  let steps = 0

  while (!g.winner && steps < STEP_CAP) {
    if (g.round !== lastRoundSampled) {
      sampleRound(g)
      lastRoundSampled = g.round
    }
    const before = g
    const next = aiStep(g)
    g = next ?? endTurnFully(g)
    diffKos(before, g)
    noteUnits(g)
    steps++
  }

  rec.steps = steps
  rec.rounds = g.round
  rec.winner = g.winner
  rec.stalled = steps >= STEP_CAP
  rec.reachedFatigue = g.round >= FATIGUE_ROUND
  rec.damage = { A: { ...g.stats.A }, B: { ...g.stats.B } }
  rec.summonsUsed = { A: [...g.players.A.usedSummons], B: [...g.players.B.usedSummons] }
  rec.itemsHeld = g.units.filter((u) => u.heldItem).length

  Math.random = realRandom
  return rec
}

/* ---------- aggregation ---------- */
interface Tally { n: number; wins: number }
const bump = (m: Record<string, Tally>, k: string, won: boolean) => {
  const t = (m[k] ??= { n: 0, wins: 0 })
  t.n++
  if (won) t.wins++
}

function aggregate(games: GameRecord[]) {
  const finished = games.filter((g) => g.winner && !g.stalled)
  const champStats: Record<string, Tally> = {}
  const unitDraft: Record<string, Tally> = {}
  const unitDeploy: Record<string, Tally> = {}
  const summonDraft: Record<string, Tally> = {}
  const summonUse: Record<string, number> = {}
  const damageBySpecies: Record<string, { total: number; games: number }> = {}
  const lengths: number[] = []
  const koRounds: number[] = []

  let aWins = 0
  let fatigue = 0
  let stalled = 0
  let snowballHits = 0
  let snowballGames = 0
  let totalKos = 0

  // economy / board curves indexed by round
  const curve: Record<number, { n: number; poke: number; fielded: number; champHp: number }> = {}

  for (const g of games) {
    if (g.stalled) { stalled++; continue }
    if (!g.winner) continue
    lengths.push(g.rounds)
    if (g.winner === 'A') aWins++
    if (g.reachedFatigue) fatigue++
    totalKos += g.koCount.A + g.koCount.B

    for (const o of ['A', 'B'] as Owner[]) {
      const won = g.winner === o
      bump(champStats, g.champions[o], won)
      for (const k of new Set(g.drafted[o])) bump(unitDraft, k, won)
      for (const k of new Set(g.deployed[o])) bump(unitDeploy, k, won)
      for (const k of new Set(g.summonsDrafted[o])) bump(summonDraft, k, won)
      for (const k of g.summonsUsed[o]) summonUse[k] = (summonUse[k] ?? 0) + 1
      for (const [k, dmg] of Object.entries(g.damage[o])) {
        const d = (damageBySpecies[k] ??= { total: 0, games: 0 })
        d.total += dmg
        d.games++
      }
    }

    if (g.firstKoBy) {
      snowballGames++
      if (g.firstKoBy === g.winner) snowballHits++
      if (g.firstKoRound != null) koRounds.push(g.firstKoRound)
    }

    for (const t of g.timeline) {
      const c = (curve[t.round] ??= { n: 0, poke: 0, fielded: 0, champHp: 0 })
      c.n += 2
      c.poke += t.poke.A + t.poke.B
      c.fielded += t.fielded.A + t.fielded.B
      c.champHp += t.champHpFrac.A + t.champHpFrac.B
    }
  }

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const pct = (xs: number[], p: number) => {
    if (!xs.length) return 0
    const s = [...xs].sort((a, b) => a - b)
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
  }

  const rate = (t: Tally) => (t.n ? t.wins / t.n : 0)
  const tableOf = (m: Record<string, Tally>, label: (k: string) => string) =>
    Object.entries(m)
      .map(([k, t]) => ({ key: k, name: label(k), n: t.n, wins: t.wins, winRate: rate(t) }))
      .sort((a, b) => b.winRate - a.winRate)

  const lengthHist: Record<string, number> = {}
  for (const l of lengths) {
    const bucket = `${Math.floor(l / 5) * 5}-${Math.floor(l / 5) * 5 + 4}`
    lengthHist[bucket] = (lengthHist[bucket] ?? 0) + 1
  }

  const roster = Object.values(ROSTER)
  const pickWin = tableOf(unitDraft, (k) => ROSTER[k]?.name ?? k).map((r) => ({
    ...r,
    pickRate: r.n / (finished.length * 2),
    deployRate: unitDeploy[r.key] ? unitDeploy[r.key].n / r.n : 0,
    cost: costEquiv(ROSTER[r.key]?.cost ?? { poke: 0, great: 0, ultra: 0 }),
    tier: ROSTER[r.key]?.tier ?? '?',
    ptype: ROSTER[r.key]?.ptype ?? '?',
    role: ROSTER[r.key]?.role ?? '?',
    avgDamage: damageBySpecies[r.key] ? damageBySpecies[r.key].total / damageBySpecies[r.key].games : 0,
  }))

  // correlation between draft-cost and win rate (is investing in premium worth it?)
  const corr = (xs: number[], ys: number[]) => {
    const n = xs.length
    if (n < 2) return 0
    const mx = mean(xs), my = mean(ys)
    let num = 0, dx = 0, dy = 0
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my)
      dx += (xs[i] - mx) ** 2
      dy += (ys[i] - my) ** 2
    }
    return dx && dy ? num / Math.sqrt(dx * dy) : 0
  }
  const costVsWin = corr(pickWin.map((r) => r.cost), pickWin.map((r) => r.winRate))
  const deployVsWin = corr(pickWin.map((r) => r.deployRate), pickWin.map((r) => r.winRate))

  return {
    meta: {
      tag: TAG,
      seed: SEED0,
      games: games.length,
      finished: finished.length,
      stalled,
      generatedAt: new Date().toISOString(),
      rosterSize: roster.length,
    },
    headline: {
      firstPlayerWinRate: finished.length ? aWins / finished.length : 0,
      avgRounds: mean(lengths),
      medianRounds: pct(lengths, 50),
      p90Rounds: pct(lengths, 90),
      minRounds: lengths.length ? Math.min(...lengths) : 0,
      maxRounds: lengths.length ? Math.max(...lengths) : 0,
      fatigueRate: finished.length ? fatigue / finished.length : 0,
      stallRate: games.length ? stalled / games.length : 0,
      snowballIndex: snowballGames ? snowballHits / snowballGames : 0,
      snowballSample: snowballGames,
      avgFirstKoRound: mean(koRounds),
      avgKosPerGame: finished.length ? totalKos / finished.length : 0,
      costVsWinCorrelation: costVsWin,
      deployVsWinCorrelation: deployVsWin,
    },
    champions: tableOf(champStats, (k) => CHAMPIONS[k]?.name ?? k),
    units: pickWin,
    summons: tableOf(summonDraft, (k) => SUMMONS[k]?.name ?? k).map((r) => ({
      ...r,
      timesCast: summonUse[r.key] ?? 0,
      castsPerDraft: r.n ? (summonUse[r.key] ?? 0) / r.n : 0,
    })),
    lengthHistogram: lengthHist,
    curves: Object.entries(curve)
      .map(([round, c]) => ({
        round: Number(round),
        avgPoke: c.poke / c.n,
        avgFielded: c.fielded / c.n,
        avgChampHp: c.champHp / c.n,
        sample: c.n,
      }))
      .sort((a, b) => a.round - b.round),
  }
}

/* ---------- run ---------- */
const t0 = Date.now()
const games: GameRecord[] = []
for (let i = 0; i < GAMES; i++) {
  games.push(playOne(SEED0 + i))
  if (!QUIET && (i + 1) % 250 === 0) {
    const el = (Date.now() - t0) / 1000
    process.stdout.write(`  ${i + 1}/${GAMES} games  (${el.toFixed(1)}s, ${((i + 1) / el).toFixed(0)}/s)\n`)
  }
}
const out = aggregate(games)
const elapsed = (Date.now() - t0) / 1000

mkdirSync(new URL('../docs/telemetry/', import.meta.url), { recursive: true })
writeFileSync(
  new URL(`../docs/telemetry/${TAG}.json`, import.meta.url),
  JSON.stringify({ ...out, meta: { ...out.meta, elapsedSeconds: elapsed } }, null, 2),
)

const h = out.headline
const p = (x: number) => `${(x * 100).toFixed(1)}%`
console.log(`\n=== ${TAG}: ${out.meta.finished}/${out.meta.games} games in ${elapsed.toFixed(1)}s ===`)
console.log(`first-player win rate  ${p(h.firstPlayerWinRate)}   (50% = fair)`)
console.log(`snowball index         ${p(h.snowballIndex)}   (first KO predicts winner; 50% = no snowball)`)
console.log(`rounds  avg ${h.avgRounds.toFixed(1)}  median ${h.medianRounds}  p90 ${h.p90Rounds}  max ${h.maxRounds}`)
console.log(`fatigue rate           ${p(h.fatigueRate)}   (games dragging to round ${FATIGUE_ROUND})`)
console.log(`stall rate             ${p(h.stallRate)}`)
console.log(`avg KOs/game           ${h.avgKosPerGame.toFixed(2)}   first KO ~round ${h.avgFirstKoRound.toFixed(1)}`)
console.log(`cost→win correlation   ${h.costVsWinCorrelation.toFixed(3)}   (is premium investment rewarded?)`)

console.log(`\nchampions (win rate, n):`)
for (const c of out.champions) console.log(`  ${c.name.padEnd(10)} ${p(c.winRate)}  n=${c.n}`)

const best = out.units.slice(0, 8)
const worst = out.units.slice(-8).reverse()
console.log(`\ntop units:`)
for (const u of best) console.log(`  ${u.name.padEnd(12)} ${p(u.winRate)}  deploy ${p(u.deployRate)}  dmg ${u.avgDamage.toFixed(1)}  cost ${u.cost}`)
console.log(`bottom units:`)
for (const u of worst) console.log(`  ${u.name.padEnd(12)} ${p(u.winRate)}  deploy ${p(u.deployRate)}  dmg ${u.avgDamage.toFixed(1)}  cost ${u.cost}`)

console.log(`\nsummons:`)
for (const s of out.summons) console.log(`  ${s.name.padEnd(9)} win ${p(s.winRate)}  casts/draft ${s.castsPerDraft.toFixed(2)}`)

console.log(`\nwrote docs/telemetry/${TAG}.json`)
