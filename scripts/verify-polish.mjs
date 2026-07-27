import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'
const { chromium } = pw
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 980 } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)))
await page.goto('http://localhost:5202/?season=spring&sky=noon&tt=300', { waitUntil: 'networkidle' })
await sleep(700)

// menu: wallpaper + timer chip + side-by-side rules
const menu = await page.evaluate(() => ({
  wallpaper: !!document.querySelector('.ball-wallpaper'),
  timerChip: [...document.querySelectorAll('.chip')].some((c) => c.textContent.includes('Turn clock')),
  rulesRow: getComputedStyle(document.querySelector('.rules-row')).display === 'flex',
}))
console.log('menu:', JSON.stringify(menu))

await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Battle the Rival'))?.click())
await page.waitForSelector('.draft-head', { timeout: 6000 })
// draft: back + search + legend note once
const draft = await page.evaluate(() => ({
  back: !!document.querySelector('.draft-back'),
  search: !!document.querySelector('.draft-search'),
  wallpaper: !!document.querySelector('.draft .ball-wallpaper'),
}))
console.log('draft:', JSON.stringify(draft))
// search filters
await page.fill('.draft-search', 'pika')
await sleep(250)
const found = await page.evaluate(() => [...document.querySelectorAll('.roster-grid .card-name')].map((n) => n.textContent))
console.log('search "pika" →', JSON.stringify(found))
await page.fill('.draft-search', '')

const pick = async (n) => { await page.evaluate((name) => {
  const c = [...document.querySelectorAll('.card')].find((x) => x.querySelector('.card-name')?.textContent === name)
  if (c) { const o = { bubbles: true, cancelable: true, pointerId: 1 }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); c.click() }
}, n); await sleep(60) }
for (const n of ['Victini','Starly','Squirtle','Pikachu','Croagunk','Onix','Haunter','Lucario','Snorlax']) await pick(n)
await page.evaluate(() => document.querySelector('.draft-foot button')?.click())
await page.waitForSelector('.battle', { timeout: 9000 })
await sleep(400)

const battle = await page.evaluate(() => {
  const hud = document.querySelector('.hud')
  const btn = hud?.querySelector('.endturn-hud')
  const hudRect = hud?.getBoundingClientRect()
  const btnRect = btn?.getBoundingClientRect()
  const bench = document.querySelector('.bench-card')?.getBoundingClientRect()
  return {
    endTurnInHudRow: !!btnRect && !!hudRect && btnRect.top >= hudRect.top && btnRect.bottom <= hudRect.bottom + 4,
    benchSquare: bench ? Math.abs(bench.width - bench.height) < 3 : false,
    noTabletop: ![...document.querySelectorAll('button')].some((b) => b.textContent.includes('Tabletop')),
  }
})
console.log('battle:', JSON.stringify(battle))

// quit confirm
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('‹ Menu'))?.click())
await sleep(300)
const quit = await page.evaluate(() => document.querySelector('.overlay-title')?.textContent)
console.log('quit dialog:', quit)
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Keep playing'))?.click())
await sleep(200)
console.log('errors:', errs.length ? errs : 'none')
await browser.close()
