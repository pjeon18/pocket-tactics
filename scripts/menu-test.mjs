/** The menu is a selection screen: picking a mode must not commit; Start game must. */
import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'
const { chromium } = pw
const sleep = ms => new Promise(r => setTimeout(r, ms))
const b = await chromium.launch()
let fails = 0
const ok = (c, n) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`) }

const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 140)))
await p.goto('http://localhost:5203/', { waitUntil: 'networkidle' }); await sleep(500)

const pick = async label => {
  await p.evaluate(l => [...document.querySelectorAll('.mode-card')].find(c => c.querySelector('.mode-card-label').textContent === l)?.click(), label)
  await sleep(250)
}
const onMenu = () => p.evaluate(() => !!document.querySelector('.mode-grid'))

// clicking every mode must leave us on the menu
for (const label of ['Tabletop Multiplayer', 'Play Online', 'Campaign', 'Puzzles', 'Tutorial', 'Single Player']) {
  await pick(label)
  const still = await onMenu()
  ok(still, `selecting "${label}" does not start anything`)
}

// settings react to the selection
await pick('Puzzles')
ok(!(await p.evaluate(() => !!document.querySelector('.draft-style'))), 'draft settings hidden for Puzzles')
await pick('Single Player')
ok(await p.evaluate(() => !!document.querySelector('.difficulty-label')), 'CPU difficulty shown for Single Player')
await pick('Tabletop Multiplayer')
ok(!(await p.evaluate(() => !!document.querySelector('.difficulty-label'))), 'CPU difficulty hidden for Tabletop')

// Start game commits, and routes per selection
const routes = [
  ['Single Player', '.draft-head'],
  ['Tabletop Multiplayer', '.draft-head'],
  ['Campaign', '.ladder'],
  ['Puzzles', '.puzzle-grid'],
  ['Tutorial', '.tutorial-coach'],
  ['Play Online', '.room-code, .code-input'],
]
for (const [label, sel] of routes) {
  await p.goto('http://localhost:5203/', { waitUntil: 'networkidle' }); await sleep(400)
  await pick(label)
  await p.evaluate(() => document.querySelector('.btn-start')?.click())
  let arrived = true
  try { await p.waitForSelector(sel, { timeout: 9000 }) } catch { arrived = false }
  ok(arrived, `Start game routes "${label}" to ${sel}`)
}
console.log(fails === 0 ? '\nMENU: PASS' : `\nMENU: ${fails} FAILURES`)
await b.close()
process.exit(fails ? 1 : 0)
