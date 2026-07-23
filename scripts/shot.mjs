import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'; const { chromium } = pw;
const url = 'http://localhost:5202/?season=spring&sky=noon'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1360, height: 940 }, deviceScaleFactor: 2 })
await page.goto(url, { waitUntil: 'networkidle' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const tap = async (sel, text) => {
  const el = await page.$$(sel)
  for (const e of el) { const t = await e.textContent(); if (!text || (t && t.includes(text))) { await e.click(); return true } }
  return false
}
await sleep(700)
await tap('button', 'Battle the Rival')
await sleep(400)
// pick champion + 10 via the card tap handler
const pick = async (name) => {
  await page.evaluate((n) => {
    const c = [...document.querySelectorAll('.card')].find((x) => x.querySelector('.card-name')?.textContent === n)
    if (c) { const o = { bubbles: true, cancelable: true, pointerId: 1 }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); c.click() }
  }, name)
  await sleep(90)
}
for (const n of ['Victini','Starly','Squirtle','Pikachu','Croagunk','Onix','Grotle','Haunter','Magneton','Kirlia','Lucario']) await pick(n)
await sleep(300)
await page.evaluate(() => document.querySelector('.draft-foot button')?.click())
await sleep(3000)
// deploy 3 units
for (let i = 0; i < 3; i++) {
  await page.evaluate((i) => {
    const b = [...document.querySelectorAll('.bench-card')].filter((x) => !x.disabled)
    b[0]?.click()
  }, i)
  await sleep(250)
  await page.evaluate((i) => { const lit = [...document.querySelectorAll('.cell-special')]; lit[i * 2 + 2]?.click() }, i)
  await sleep(350)
}
// select a unit for the blue move overlay
await page.evaluate(() => { const u = [...document.querySelectorAll('.unit')].find((x) => x.querySelector('img') && !x.className.includes('unit-champ')); u?.click() })
await sleep(500)
const board = await page.$('.panel')
await board.screenshot({ path: 'scripts/card-board.png' })
await page.screenshot({ path: 'scripts/card-full.png' })
console.log('shots saved')
await browser.close()
