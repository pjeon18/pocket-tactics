import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'
import { startMode } from './menu-nav.mjs'
const { chromium } = pw
const sleep = ms => new Promise(r => setTimeout(r, ms))
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 950 } })
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 150)))
await p.goto('http://localhost:5203/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.removeItem('pt-campaign'))
await p.reload({ waitUntil: 'networkidle' }); await sleep(500)

await startMode(p, 'Campaign')
await p.waitForSelector('.ladder', { timeout: 8000 }); await sleep(400)
const ladder = await p.evaluate(() => ({
  rows: document.querySelectorAll('.ladder-row').length,
  locked: document.querySelectorAll('.ladder-row.is-locked').length,
  enabled: [...document.querySelectorAll('.ladder-go')].filter(b => !b.disabled).length,
  first: document.querySelector('.ladder-name')?.textContent?.trim().slice(0, 30),
}))
console.log('ladder:', JSON.stringify(ladder))

// card book: locked cards should outnumber owned at the start
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.includes('Card book'))?.click())
await p.waitForSelector('.book-grid'); await sleep(400)
const book = await p.evaluate(() => ({
  total: document.querySelectorAll('.book-card').length,
  locked: document.querySelectorAll('.book-card.is-locked').length,
  sub: document.querySelector('.menu-sub')?.textContent,
}))
console.log('card book:', JSON.stringify(book))
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.includes('‹ Campaign'))?.click())
await p.waitForSelector('.ladder'); await sleep(300)

// challenge trainer 1 — the draft must only offer owned cards
await p.evaluate(() => document.querySelector('.ladder-go')?.click())
await p.waitForSelector('.draft-head', { timeout: 9000 }); await sleep(500)
const draft = await p.evaluate(() => ({
  offered: [...document.querySelectorAll('.roster-grid .card-name')].map(n => n.textContent),
  summons: [...document.querySelectorAll('.summon-grid .card-name')].map(n => n.textContent),
  label: document.querySelector('.draft-player')?.textContent,
}))
console.log('draft label:', draft.label, '| cards offered:', draft.offered.length, '| summons:', draft.summons.length)
console.log('offered:', JSON.stringify(draft.offered))
await b.close()
