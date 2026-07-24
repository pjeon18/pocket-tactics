import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'
const { chromium } = pw
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 980 } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
await page.goto('http://localhost:5202/?season=spring&sky=noon&tt=12', { waitUntil: 'networkidle' })
await sleep(600)
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Battle the Rival'))?.click())
await page.waitForSelector('.draft-head', { timeout: 6000 })
await sleep(200)
const pick = async (n) => { await page.evaluate((name) => {
  const c = [...document.querySelectorAll('.card')].find((x) => x.querySelector('.card-name')?.textContent === name)
  if (c) { const o = { bubbles: true, cancelable: true, pointerId: 1 }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); c.click() }
}, n); await sleep(60) }
for (const n of ['Victini','Starly','Squirtle','Pikachu','Croagunk','Onix','Grotle','Haunter','Magneton','Kirlia','Lucario']) await pick(n)
await page.evaluate(() => document.querySelector('.draft-foot button')?.click())
await page.waitForSelector('.battle', { timeout: 9000 })
await sleep(400)

const dangerGone = await page.evaluate(() => !document.body.textContent.includes('Danger zone'))
const clockShown = await page.evaluate(() => document.querySelector('.turn-clock')?.textContent)
console.log('danger button gone:', dangerGone, '| clock shows:', clockShown)

// don't touch anything — the 12s clock should end the turn by itself
const round1Turn = await page.evaluate(() => document.querySelector('.status-line')?.textContent)
let autoEnded = false
for (let t = 0; t < 140; t++) {
  await sleep(250)
  const st = await page.evaluate(() => document.querySelector('.status-line')?.textContent)
  if (st && st !== 'Your move') { autoEnded = true; break }
}
console.log('turn auto-ended at zero:', autoEnded, '(was:', round1Turn, ')')

// while the AI plays, click an enemy unit → info card should appear
let inspected = false
for (let t = 0; t < 60 && !inspected; t++) {
  await sleep(300)
  const status = await page.evaluate(() => document.querySelector('.status-line')?.textContent)
  if (status !== 'Rival is planning…') continue
  await page.evaluate(() => {
    const foe = [...document.querySelectorAll('.unit')].find((x) => x.className.includes('unit-foe'))
    foe?.click()
  })
  await sleep(300)
  inspected = await page.evaluate(() => {
    const ab = document.querySelector('.actionbar')
    return !!ab && !ab.className.includes('actionbar-empty') && ab.textContent.includes('strike')
  })
}
console.log('off-turn enemy inspection works:', inspected)
console.log('page errors:', errors.length ? errors : 'none')
await browser.close()
