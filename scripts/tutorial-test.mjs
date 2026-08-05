/** Plays the guided tutorial to completion and asserts what it taught. */
import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'
const { chromium } = pw
const sleep = ms => new Promise(r => setTimeout(r, ms))
const VIEW = process.argv[2] === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 900 }

const b = await chromium.launch()
const p = await b.newPage({ viewport: VIEW })
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 150)))
await p.goto('http://localhost:5203/', { waitUntil: 'networkidle' }); await sleep(500)
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.includes('Play the tutorial'))?.click())
await p.waitForSelector('.tutorial-coach', { timeout: 9000 }); await sleep(700)

const title = () => p.evaluate(() => document.querySelector('.tutorial-coach-title')?.textContent || '')
const click = s => p.evaluate(x => { const e = document.querySelector(x); if (e) { e.click(); return true } return false }, s)
const endTurn = () => p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'End turn' && !x.disabled)?.click())
// pick the element of `cls` nearest the frontmost enemy
const nearestFoe = cls => p.evaluate(c => {
  const foes = [...document.querySelectorAll('.unit-foe')]
  if (!foes.length) return false
  const fr = foes.sort((a, z) => a.getBoundingClientRect().top - z.getBoundingClientRect().top).pop().getBoundingClientRect()
  const els = [...document.querySelectorAll(c)]
  if (!els.length) return false
  els.sort((a, z) => {
    const ar = a.getBoundingClientRect(), zr = z.getBoundingClientRect()
    return Math.hypot(ar.left - fr.left, ar.top - fr.top) - Math.hypot(zr.left - fr.left, zr.top - fr.top)
  })
  els[0].click(); return true
}, cls)
const clickFrontFoe = () => p.evaluate(() => {
  const foes = [...document.querySelectorAll('.unit-foe')]
  if (!foes.length) return false
  foes.sort((a, z) => a.getBoundingClientRect().top - z.getBoundingClientRect().top)
  foes[foes.length - 1].click(); return true
})

const seen = []
let won = false, minionKilled = false
for (let i = 0; i < 40; i++) {
  if (await p.evaluate(() => !!document.querySelector('.overlay-title'))) { won = true; break }
  const t = await title()
  if (t && !seen.includes(t)) seen.push(t)
  const foes = await p.evaluate(() => document.querySelectorAll('.unit-foe').length)
  if (foes === 1) minionKilled = true

  if (t.includes('Deploy a')) { await click('.bench-card'); await sleep(250); await nearestFoe('.cell-special'); await sleep(450) }
  else if (t.includes('settle') || t.includes('End the turn') || t.includes('Out of moves') || t.includes('Charging') || t.includes('Nothing left')) { await endTurn(); await sleep(1700) }
  else if (t.includes('Rival')) { await sleep(1100) }
  else if (t.includes('Walk into range')) { await click('.unit-mine:not(.unit-champ)'); await sleep(250); await nearestFoe('.cell-move'); await sleep(450) }
  else if (t.includes('Declare an attack')) { await click('.unit-mine:not(.unit-champ)'); await sleep(250); await clickFrontFoe(); await sleep(450) }
  else if (t.includes('Finish with the special')) { await click('.unit-mine:not(.unit-champ)'); await sleep(300); await click('.btn-gold'); await sleep(300); await clickFrontFoe(); await sleep(450) }
  else await sleep(500)
}
await sleep(5200)
const ov = await p.evaluate(() => ({ t: document.querySelector('.overlay-title')?.textContent, btns: [...document.querySelectorAll('.overlay-btns button')].map(b => b.textContent) }))
console.log('steps seen:', JSON.stringify(seen))
console.log('minion killed by a normal attack:', minionKilled)
console.log('overlay:', JSON.stringify(ov))
const taughtStrike = seen.some(s => s.includes('Declare an attack'))
const taughtSpecial = seen.some(s => s.includes('Finish with the special'))
console.log(won && taughtStrike && taughtSpecial && minionKilled ? 'TUTORIAL: PASS' : 'TUTORIAL: FAIL')
await b.close()
