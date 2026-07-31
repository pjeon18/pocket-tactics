import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'
const { chromium } = pw
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } })
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 160)))
const sleep = ms => new Promise(r => setTimeout(r, ms))
await p.goto('http://localhost:5203/', { waitUntil: 'networkidle' }); await sleep(500)
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.includes('Play the tutorial'))?.click())
await p.waitForSelector('.tutorial-coach', { timeout: 8000 }); await sleep(600)
const title = () => p.evaluate(() => document.querySelector('.tutorial-coach-title')?.textContent || '')
const rings = () => p.evaluate(() => document.querySelectorAll('.tut-ring').length)
const clickSel = s => p.evaluate(x => { const e = document.querySelector(x); if (e) { e.click(); return true } return false }, s)
const endTurn = () => p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'End turn' && !x.disabled)?.click())
const clickNearChamp = cls => p.evaluate(c => {
  const champ = document.querySelector('.unit-foe.unit-champ'); if (!champ) return false
  const cr = champ.getBoundingClientRect(); const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2
  const els = [...document.querySelectorAll(c)]; if (!els.length) return false
  els.sort((a, d) => Math.hypot(a.getBoundingClientRect().left - cx, a.getBoundingClientRect().top - cy) - Math.hypot(d.getBoundingClientRect().left - cx, d.getBoundingClientRect().top - cy))
  els[0].click(); return true
}, cls)
const seen = []; const ringsSeen = {}; let won = false
for (let i = 0; i < 30; i++) {
  const t = await title()
  if (await p.evaluate(() => !!document.querySelector('.overlay-title'))) { won = true; break }
  if (!seen.includes(t)) { seen.push(t); ringsSeen[t] = await rings() }
  if (t.includes('Step 1')) { await clickSel('.bench-card'); await sleep(200); await clickNearChamp('.cell-special'); await sleep(400) }
  else if (t.includes('Settle') || t.includes('Resolve') || t.includes('Keep closing') || t.includes('Charge the special')) { await endTurn(); await sleep(1700) }
  else if (t.includes('Rival')) { await sleep(1100) }
  else if (t.includes('Move in')) { await clickSel('.unit-mine:not(.unit-champ)'); await sleep(250); await clickNearChamp('.cell-move'); await sleep(400) }
  else if (t.includes('Unleash')) { await clickSel('.unit-mine:not(.unit-champ)'); await sleep(300); await clickSel('.btn-gold'); await sleep(300); await clickSel('.unit-foe.unit-champ'); await sleep(400) }
  else await sleep(500)
}
const ov = await p.evaluate(() => document.querySelector('.overlay-title')?.textContent || '')
console.log('steps seen:', JSON.stringify(seen))
console.log('rings per step:', JSON.stringify(ringsSeen))
console.log('won:', won, '| overlay:', JSON.stringify(ov))
console.log(won && /complete/i.test(ov) ? 'TUTORIAL: PASS' : 'TUTORIAL: FAIL')
await b.close()
