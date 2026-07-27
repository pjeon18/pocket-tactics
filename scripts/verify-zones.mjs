import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'
const { chromium } = pw
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 980 } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto('http://localhost:5202/?season=spring&sky=noon&tt=300', { waitUntil: 'networkidle' })
await sleep(600)
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Battle the Rival'))?.click())
await page.waitForSelector('.draft-head', { timeout: 6000 })
const pick = async (n) => { await page.evaluate((name) => {
  const c = [...document.querySelectorAll('.card')].find((x) => x.querySelector('.card-name')?.textContent === name)
  if (c) { const o = { bubbles: true, cancelable: true, pointerId: 1 }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); c.click() }
}, n); await sleep(60) }
for (const n of ['Victini','Starly','Squirtle','Pikachu','Croagunk','Onix','Haunter','Lucario','Snorlax']) await pick(n)
const foot = await page.evaluate(() => document.querySelector('.draft-foot button')?.textContent)
console.log('draft foot (should say Lock in team at 8 picks):', foot)
await page.evaluate(() => document.querySelector('.draft-foot button')?.click())
await page.waitForSelector('.battle', { timeout: 9000 })
await sleep(500)
// give ourselves funding, then check highlight depth per tier
const counts = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const out = {}
  const clickCard = async (name) => {
    const b = [...document.querySelectorAll('.bench-card')].find((x) => x.title.startsWith(name))
    b?.click(); await sleep(250)
    const n = document.querySelectorAll('.cell-special').length
    b?.click(); await sleep(150) // deselect
    return n
  }
  out.poke = await clickCard('Squirtle')  // poké-tier: up to 4 rows ≈ 28 tiles minus occupied
  return out
})
console.log('poké-tier highlight tiles (expect ~26-27, i.e. 4 rows):', counts.poke)
await browser.close()
