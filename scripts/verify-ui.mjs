import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'
const { chromium } = pw
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 980 } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
await page.goto('http://localhost:5202/?season=spring&sky=noon', { waitUntil: 'networkidle' })
await sleep(700)

await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Battle the Rival'))?.click())
// wave plays ~850ms, then draft mounts
await page.waitForSelector('.draft-head', { timeout: 5000 })
await sleep(200)
const pick = async (n) => { await page.evaluate((name) => {
  const c = [...document.querySelectorAll('.card')].find((x) => x.querySelector('.card-name')?.textContent === name)
  if (c) { const o = { bubbles: true, cancelable: true, pointerId: 1 }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); c.click() }
}, n); await sleep(70) }
for (const n of ['Victini','Starly','Squirtle','Pikachu','Croagunk','Onix','Grotle','Haunter','Magneton','Kirlia','Lucario']) await pick(n)
await page.evaluate(() => document.querySelector('.draft-foot button')?.click())
await page.waitForSelector('.battle', { timeout: 9000 })
await sleep(500)

const layout = await page.evaluate(() => ({
  helpCorner: !!document.querySelector('.help-corner'),
  endTurnInHud: !!document.querySelector('.hud .endturn-hud'),
  econRow: !!document.querySelector('.econ-row'),
}))
console.log('layout:', JSON.stringify(layout))

// end turn; the AI plays, then our income should pop a +N chip
await page.evaluate(() => document.querySelector('.endturn-hud')?.click())
let gainSeen = false
for (let t = 0; t < 300 && !gainSeen; t++) {
  await sleep(120)
  gainSeen = await page.evaluate(() => !!document.querySelector('.econ-gain'))
}
console.log('income +N animation seen:', gainSeen)
if (gainSeen) await page.screenshot({ path: 'scripts/vf-gain.png' })

// hover the help corner
await page.hover('.help-btn')
await sleep(300)
const helpOpen = await page.evaluate(() => getComputedStyle(document.querySelector('.help-pop')).display !== 'none')
console.log('help popover opens on hover:', helpOpen)
console.log('page errors:', errors.length ? errors : 'none')
await browser.close()
