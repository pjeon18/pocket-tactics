import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'
import { startMode } from './menu-nav.mjs'
const { chromium } = pw
const sleep = ms => new Promise(r => setTimeout(r, ms))
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 150)))
await p.goto('http://localhost:5203/', { waitUntil: 'networkidle' }); await sleep(500)

await startMode(p, 'Puzzles')
await p.waitForSelector('.puzzle-grid', { timeout: 8000 }); await sleep(400)
const cards = await p.evaluate(() => [...document.querySelectorAll('.puzzle-card')].map(c => c.querySelector('.card-name')?.textContent))
console.log('puzzles listed:', JSON.stringify(cards))

// open puzzle 1 (Declaration) — solve: move champion adjacent, attack, end turn
await p.evaluate(() => document.querySelector('.puzzle-card')?.click())
await p.waitForSelector('.puzzle-hud', { timeout: 8000 }); await sleep(1200)
const hud = await p.evaluate(() => ({
  name: document.querySelector('.puzzle-hud-name')?.textContent,
  pips: document.querySelectorAll('.turn-pip').length,
  left: document.querySelector('.puzzle-hud-turns em')?.textContent,
}))
console.log('hud:', JSON.stringify(hud))

// select my champion, move toward the foe, then attack it
await p.evaluate(() => [...document.querySelectorAll('.unit-mine')][0]?.click()); await sleep(400)
await p.evaluate(() => {
  const foe = document.querySelector('.unit-foe'); const fr = foe.getBoundingClientRect()
  const cells = [...document.querySelectorAll('.cell-move')]
  cells.sort((a, c) => {
    const ar = a.getBoundingClientRect(), cr = c.getBoundingClientRect()
    return Math.hypot(ar.left - fr.left, ar.top - fr.top) - Math.hypot(cr.left - fr.left, cr.top - fr.top)
  })
  cells[0]?.click()
}); await sleep(500)
// the unit stays selected after moving — clicking it again would deselect it
await p.evaluate(() => document.querySelector('.unit-foe')?.click()); await sleep(500)
console.log('planned?', await p.evaluate(() => !!document.querySelector('.unit-atk, .unit-spc')))
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'End turn' && !x.disabled)?.click())
await sleep(5200)
const res = await p.evaluate(() => ({
  overlay: document.querySelector('.overlay-title')?.textContent,
  teaches: document.querySelector('.overlay-sub')?.textContent?.slice(0, 60),
  solvedStore: localStorage.getItem('pt-puzzles-solved'),
}))
console.log('result:', JSON.stringify(res))
console.log(res.overlay === 'Solved' ? 'PUZZLE UI: PASS' : 'PUZZLE UI: CHECK')
await b.close()
