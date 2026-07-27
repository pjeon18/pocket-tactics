import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'
const { chromium } = pw
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } })
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 160)))
const sleep = ms => new Promise(r => setTimeout(r, ms))
await p.goto('http://localhost:5202/', { waitUntil: 'networkidle' }); await sleep(500)
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.includes('Play the tutorial'))?.click())
await p.waitForSelector('.tutorial-coach', { timeout: 8000 }); await sleep(600)
const title = () => p.evaluate(() => document.querySelector('.tutorial-coach-title')?.textContent || '')
const clickSel = s => p.evaluate(x => { const e = document.querySelector(x); if (e) { e.click(); return true } return false }, s)
const endTurn = () => p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'End turn' && !x.disabled)?.click())
// click the tile of class `cls` whose center is nearest the enemy champion
const clickNearChamp = cls => p.evaluate(c => {
  const champ = document.querySelector('.unit-foe.unit-champ'); if (!champ) return false
  const cr = champ.getBoundingClientRect(); const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2
  const els = [...document.querySelectorAll(c)]; if (!els.length) return false
  els.sort((a, d) => { const ar = a.getBoundingClientRect(), dr = d.getBoundingClientRect()
    return Math.hypot(ar.left - cx, ar.top - cy) - Math.hypot(dr.left - cx, dr.top - cy) })
  els[0].click(); return true
}, cls)
const seen = []; let won = false
for (let i = 0; i < 26; i++) {
  const t = await title()
  if (await p.evaluate(() => !!document.querySelector('.overlay-title'))) { won = true; break }
  if (!seen.includes(t)) seen.push(t)
  if (t.includes('Step 1')) { await clickSel('.bench-card'); await sleep(200); await clickNearChamp('.cell-special'); await sleep(400) }
  else if (t.includes('End your turn') || t.includes('Resolve') || t.includes('Keep closing')) { await endTurn(); await sleep(1700) }
  else if (t.includes('Rival')) { await sleep(1100) }
  else if (t.includes('Move in')) { await clickSel('.unit-mine:not(.unit-champ)'); await sleep(250); await clickNearChamp('.cell-move'); await sleep(400) }
  else if (t.includes('Declare')) { await clickSel('.unit-mine:not(.unit-champ)'); await sleep(250); await clickSel('.unit-foe.unit-champ'); await sleep(400) }
  else await sleep(500)
}
const ov = await p.evaluate(() => document.querySelector('.overlay-title')?.textContent || '')
console.log('steps seen:', JSON.stringify(seen))
console.log('won:', won, '| overlay:', JSON.stringify(ov))
console.log(won && /complete/i.test(ov) ? 'TUTORIAL: PASS' : 'TUTORIAL: FAIL')
await b.close()
