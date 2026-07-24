import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'
const { chromium } = pw
const browser = await chromium.launch()
const ctx = await browser.newContext()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const A = await ctx.newPage()
const B = await ctx.newPage()
for (const [name, page] of [['A', A], ['B', B]]) {
  page.on('pageerror', (e) => console.log(`[${name}] pageerror`, String(e).slice(0, 140)))
}
await A.goto('http://localhost:5202/', { waitUntil: 'networkidle' })
await B.goto('http://localhost:5202/', { waitUntil: 'networkidle' })
await sleep(400)

const click = (page, text) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t))?.click(), text)
await click(A, 'Play Online'); await sleep(250)
await click(A, 'Create a room'); await sleep(1200)
const code = await A.evaluate(() => document.querySelector('.room-code')?.textContent)
console.log('room:', code)

await click(B, 'Play Online'); await sleep(250)
await B.evaluate((c) => {
  const inp = document.querySelector('.code-input')
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(inp, c)
  inp.dispatchEvent(new Event('input', { bubbles: true }))
}, code)
await B.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Join')?.click())

// wait for both to reach the draft
let joined = false
for (let t = 0; t < 30; t++) {
  await sleep(1000)
  const a = await A.evaluate(() => !!document.querySelector('.draft-head'))
  const b = await B.evaluate(() => !!document.querySelector('.draft-head'))
  if (a && b) { joined = true; break }
}
console.log('handshake → both drafting:', joined)
if (!joined) { await browser.close(); process.exit(1) }

// draft on both sides
const draft = async (page, champ) => {
  const pick = (n) => page.evaluate((name) => {
    const c = [...document.querySelectorAll('.card')].find((x) => x.querySelector('.card-name')?.textContent === name)
    if (c) { const o = { bubbles: true, cancelable: true, pointerId: 1 }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); c.click() }
  }, n)
  for (const n of [champ, 'Starly', 'Squirtle', 'Pikachu', 'Croagunk', 'Onix', 'Grotle', 'Haunter', 'Magneton', 'Kirlia', 'Lucario']) { await pick(n); await sleep(70) }
  await page.evaluate(() => document.querySelector('.draft-foot button')?.click())
}
await draft(A, 'Victini')
await draft(B, 'Celebi')
await sleep(3500) // intros

// both should reach battle; guest should get host state (no Connecting overlay)
const battleA = await A.evaluate(() => !!document.querySelector('.battle'))
const battleB = await B.evaluate(() => !!document.querySelector('.battle'))
const guestSynced = await B.evaluate(() => !document.body.textContent.includes('Waiting for the host'))
console.log('battle mounted:', { battleA, battleB, guestSynced })

// HOST (A) deploys a unit → guest must see 3 units
await A.evaluate(() => { const b = [...document.querySelectorAll('.bench-card')].filter((x) => !x.disabled); b[0]?.click() })
await sleep(250)
await A.evaluate(() => document.querySelector('.cell-special')?.click())
await sleep(1200)
const unitsB = await B.evaluate(() => document.querySelectorAll('.unit').length)
console.log('guest sees host deploy (expect 3):', unitsB)

// host ends turn → resolution → guest's turn
await A.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'End turn' && !b.disabled)?.click())
await sleep(3500)
const guestTurn = await B.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'End turn')
  return btn && !btn.disabled
})
console.log("guest's turn active:", guestTurn)

// GUEST deploys → host must see it
await B.evaluate(() => { const b = [...document.querySelectorAll('.bench-card')].filter((x) => !x.disabled); b[0]?.click() })
await sleep(300)
await B.evaluate(() => document.querySelector('.cell-special')?.click())
await sleep(1500)
const unitsA = await A.evaluate(() => document.querySelectorAll('.unit').length)
console.log('host sees guest deploy (expect 4):', unitsA)

// guest ends turn → host resolves → back to host's turn
await B.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'End turn' && !b.disabled)?.click())
await sleep(3500)
const hostTurn = await A.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'End turn')
  return btn && !btn.disabled
})
console.log("back to host's turn:", hostTurn)

const ok = joined && battleA && battleB && guestSynced && unitsB === 3 && guestTurn && unitsA === 4 && hostTurn
console.log(ok ? 'ONLINE PROTOCOL: ALL PASS' : 'ONLINE PROTOCOL: FAILURES ABOVE')
await browser.close()
process.exit(ok ? 0 : 1)
