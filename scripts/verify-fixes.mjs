import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'
const { chromium } = pw
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1360, height: 940 }, deviceScaleFactor: 2 })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto('http://localhost:5202/?season=autumn&sky=noon', { waitUntil: 'networkidle' })
await sleep(700)
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Battle the Rival'))?.click())
await sleep(400)
const pick = async (name) => {
  await page.evaluate((n) => {
    const c = [...document.querySelectorAll('.card')].find((x) => x.querySelector('.card-name')?.textContent === n)
    if (c) { const o = { bubbles: true, cancelable: true, pointerId: 1 }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); c.click() }
  }, name)
  await sleep(80)
}
for (const n of ['Victini','Starly','Squirtle','Pikachu','Croagunk','Onix','Grotle','Haunter','Magneton','Kirlia','Lucario']) await pick(n)
await page.evaluate(() => document.querySelector('.draft-foot button')?.click())
await sleep(3000)

// deploy two cheap units up front
for (let i = 0; i < 2; i++) {
  await page.evaluate(() => { const b = [...document.querySelectorAll('.bench-card')].filter((x) => !x.disabled); b[0]?.click() })
  await sleep(250)
  await page.evaluate((i) => { const lit = [...document.querySelectorAll('.cell-special')]; lit[i + 2]?.click() }, i)
  await sleep(350)
}
// tree close-up shot
const board = await page.$('.board')
await board.screenshot({ path: 'scripts/vf-board.png' })

// play up to 8 rounds ending turns; grab a frame when an effectiveness caption appears
let gotSub = false
for (let round = 0; round < 8 && !gotSub; round++) {
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'End turn' && !b.disabled)?.click())
  // watch for float-sub during the resolution window
  for (let t = 0; t < 40; t++) {
    await sleep(300)
    const found = await page.evaluate(() => !!document.querySelector('.float-sub'))
    if (found) {
      await page.$('.board').then((b) => b.screenshot({ path: 'scripts/vf-float.png' }))
      gotSub = true
      break
    }
    const myTurn = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'End turn')
      return btn && !btn.disabled
    })
    if (myTurn && t > 4) break
  }
}
console.log('effectiveness caption captured:', gotSub)
await board.screenshot({ path: 'scripts/vf-late.png' })
await browser.close()
