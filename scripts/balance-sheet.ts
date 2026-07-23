/**
 * Generates docs/BALANCE.md from the live game data — the master sheet for
 * balance passes. Re-run after any data change: npx tsx scripts/balance-sheet.ts
 */
import { writeFileSync } from 'node:fs'
import { CHAMPIONS, DROPS, ITEMS, ROSTER, SYNERGIES, TYPE_META, costEquiv } from '../src/game/data'
import type { ItemKey, PType, Role, Species } from '../src/game/types'

const all = Object.values(ROSTER)
const lines: string[] = []
const push = (s = '') => lines.push(s)

const costStr = (s: Species) => {
  const parts = []
  if (s.cost.ultra) parts.push(`${s.cost.ultra}U`)
  if (s.cost.great) parts.push(`${s.cost.great}G`)
  if (s.cost.poke) parts.push(`${s.cost.poke}P`)
  return parts.join('+') || 'free'
}

push('# Pocket Tactics — Balance Master Sheet')
push()
push('_Generated from `src/game/data.ts` by `scripts/balance-sheet.ts` — do not edit the tables by hand._')
push()
push(`**Roster: ${all.length} Pokémon + ${Object.keys(CHAMPIONS).length} champions.** Cost letters: P = Poké Ball, G = Great Ball, U = Ultra Ball. Equiv = total value in Poké Balls (G=3, U=6).`)
push()

/* ---------- full roster table ---------- */
push('## Every Pokémon')
push()
push('| Pokémon | Role | Type | Cost | Equiv | CD | HP | ATK | RNG | MOV | Charge | Special | Effect |')
push('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for (const s of [...all].sort((a, b) => costEquiv(a.cost) - costEquiv(b.cost) || a.name.localeCompare(b.name))) {
  push(
    `| ${s.name} | ${s.role} | ${TYPE_META[s.ptype].label} | ${costStr(s)} | ${costEquiv(s.cost)} | ${s.cooldown} | ${s.hp} | ${s.atk} | ${s.range} | ${s.move} | ${s.chargeMax} | ${s.special} | ${s.hint} |`,
  )
}
push()
push('## Champions')
push()
push('| Champion | Type | HP | ATK | RNG | MOV | Charge | Ability | Effect |')
push('|---|---|---|---|---|---|---|---|---|')
for (const c of Object.values(CHAMPIONS)) {
  push(`| ${c.name} | ${TYPE_META[c.ptype].label} | ${c.hp} | ${c.atk} | ${c.range} | ${c.move} | ${c.chargeMax}${c.once ? ' (once)' : ''} | ${c.ability} | ${c.hint} |`)
}
push()

/* ---------- distributions ---------- */
const count = <K extends string>(keys: K[]) => {
  const m = new Map<K, number>()
  keys.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1))
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

push('## Distributions')
push()
push('### By type (synergy threshold is 3 — champion types add to the count in play)')
push()
push('| Type | Roster count | Synergy defined |')
push('|---|---|---|')
for (const [t, n] of count(all.map((s) => s.ptype))) {
  push(`| ${TYPE_META[t as PType].label} | ${n} | ${SYNERGIES[t as PType] ? `✓ ${SYNERGIES[t as PType]!.name}` : '—'} |`)
}
push()
push('### By role')
push()
push('| Role | Count |')
push('|---|---|')
for (const [r, n] of count(all.map((s) => s.role as Role))) push(`| ${r} | ${n} |`)
push()
push('### Cost curve (equiv Poké Balls)')
push()
push('| Equiv cost | Count | Who |')
push('|---|---|---|')
const byEquiv = new Map<number, string[]>()
for (const s of all) {
  const e = costEquiv(s.cost)
  byEquiv.set(e, [...(byEquiv.get(e) ?? []), s.name])
}
for (const [e, names] of [...byEquiv.entries()].sort((a, b) => a[0] - b[0])) {
  push(`| ${e} | ${names.length} | ${names.join(', ')} |`)
}
push()
push('### Movement')
push()
push('| MOV | Count |')
push('|---|---|')
for (const [m, n] of count(all.map((s) => String(s.move))).sort((a, b) => Number(a[0]) - Number(b[0]))) push(`| ${m} | ${n} |`)
push()
push('### Range')
push()
push('| RNG | Count |')
push('|---|---|')
for (const [r, n] of count(all.map((s) => String(s.range))).sort((a, b) => Number(a[0]) - Number(b[0]))) push(`| ${r} | ${n} |`)
push()
const stunners = all.filter((s) => s.hint.includes('stunned')).map((s) => s.name)
const healers = all.filter((s) => s.targeting.kind === 'ally' || (s.targeting.kind === 'self' && s.hint.includes('Restore'))).map((s) => s.name)
push('### Special-effect census')
push()
push(`- **Stun sources (${stunners.length}):** ${stunners.join(', ')}`)
push(`- **Healers/self-healers (${healers.length}):** ${healers.join(', ')}`)
push(`- **Targeting kinds:** ${count(all.map((s) => s.targeting.kind)).map(([k, n]) => `${k} ×${n}`).join(' · ')}`)
push()

/* ---------- items & drops ---------- */
push('## Items')
push()
push('| Item | Effect | Kind |')
push('|---|---|---|')
for (const k of Object.keys(ITEMS) as ItemKey[]) {
  push(`| ${ITEMS[k].name} | ${ITEMS[k].desc} | ${ITEMS[k].attach ? 'held (one per Pokémon)' : 'consumable'} |`)
}
push()
push('## Field Poké Ball drop rates')
push()
const totalW = DROPS.reduce((n, d) => n + d.weight, 0)
push('| Drop | Weight | Chance |')
push('|---|---|---|')
for (const d of DROPS) {
  const name = d.drop.type === 'ball' ? `${d.drop.tier === 'great' ? 'Great' : 'Ultra'} Ball (currency)` : ITEMS[d.drop.key].name
  push(`| ${name} | ${d.weight} | ${((d.weight / totalW) * 100).toFixed(1)}% |`)
}
push()
push(`One field Poké Ball spawns every 4 rounds (max 2 on the board). Deploy time: Poké-tier basics act the turn they land; Great/Ultra-tier need a turn to arrive.`)
push()
push('## Signature specials — status')
push()
push('The iteration-9 pass implemented every proposed upgrade; the Effect column above is the live truth. Distinct identities now include: instant resolution (Extreme Speed), risk attacks (High Jump Kick), multi-hit (Rock Blast), pulls (Power Whip), permanent self-buffs (Flame Charge), KO refunds (Night Daze), phasing (both Shadow Balls), and conditional finishers/openers (Crunch, Sucker Punch, Blaze Kick, Icicle Crash, Gengar).')
push()

writeFileSync(new URL('../docs/BALANCE.md', import.meta.url), lines.join('\n'))
console.log(`BALANCE.md written: ${all.length} Pokémon, ${lines.length} lines`)
