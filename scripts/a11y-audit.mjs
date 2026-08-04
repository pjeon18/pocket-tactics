/**
 * Contrast auditor — walks the real running app and reports every text element
 * whose colour fails WCAG AA against the surface it actually sits on.
 *
 *   node scripts/a11y-audit.mjs [baseUrl]
 *
 * Written after the same bug shipped three times (turn clock, quit dialog,
 * result card): light-surface and dark-surface components sharing one set of
 * ink tokens. A tool catches that; reading CSS does not.
 */
import pw from '/Users/pauljeon/Downloads/assets/iso-prototype/node_modules/playwright/index.js'

const { chromium } = pw
const BASE = process.argv[2] ?? 'http://localhost:5203/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Injected into the page: returns every failing text node with its numbers. */
const AUDIT = `(() => {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  // Normalise ANY css colour through a canvas — color-mix() resolves to
  // color(srgb 0.93 0.97 0.91), whose channels are 0-1 floats, and naive
  // regex parsing reads those as near-black.
  const cv = document.createElement('canvas'); cv.width = cv.height = 1
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  const toRGBA = (css) => {
    if (!css || css === 'none' || css === 'transparent') return null
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = css
    const resolved = ctx.fillStyle
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = resolved
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    let alpha = 1
    const m = String(css).match(/rgba?\\([^)]*?([\\d.]+)\\s*\\)$/)
    if (m) alpha = Number(m[1])
    if (/\\/\\s*[\\d.]+\\s*\\)/.test(String(css))) alpha = Number(String(css).match(/\\/\\s*([\\d.]+)\\s*\\)/)[1])
    return { r: d[0], g: d[1], b: d[2], a: alpha }
  }
  const lum = (css) => {
    const c = toRGBA(css)
    if (!c) return null
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
  }
  const hexLum = (hex) => lum(hex)
  /** Worst-case (lightest) stop of a gradient, since our buttons use white ink. */
  const gradientWorst = (img) => {
    const hexes = img.match(/#[0-9a-fA-F]{3,8}/g) || []
    const rgbs = img.match(/rgba?\\([^)]+\\)/g) || []
    const ls = [...hexes.map(hexLum), ...rgbs.map(lum)].filter((x) => x != null)
    return ls.length ? Math.max(...ls) : null
  }
  /** Effective background luminance: walk up until something opaque is found. */
  const bgLum = (el) => {
    let e = el
    while (e && e !== document.documentElement) {
      const cs = getComputedStyle(e)
      const img = cs.backgroundImage
      if (img && img !== 'none' && /gradient/.test(img)) {
        const g = gradientWorst(img)
        if (g != null) return g
      }
      const c = toRGBA(cs.backgroundColor)
      if (c && c.a > 0.85) {
        // an inset box-shadow wash paints over the background — composite it
        const inset = cs.boxShadow && cs.boxShadow.includes('inset')
          ? (cs.boxShadow.match(/rgba?\\([^)]+\\)/g) || [])[0] : null
        if (inset) {
          const w = toRGBA(inset)
          if (w && w.a > 0) {
            const mix = (a, b) => a * (1 - w.a) + b * w.a
            const r = mix(c.r, w.r), g = mix(c.g, w.g), bl = mix(c.b, w.b)
            return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl)
          }
        }
        return lum(cs.backgroundColor)
      }
      e = e.parentElement
    }
    return lum(getComputedStyle(document.body).backgroundColor) ?? 1
  }

  const out = []
  document.querySelectorAll('*').forEach((el) => {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim()
    if (!own) return
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.15) return
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return
    const fg = lum(cs.color)
    const bg = bgLum(el)
    if (fg == null || bg == null) return
    const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
    const size = parseFloat(cs.fontSize)
    const weight = parseInt(cs.fontWeight) || 400
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const need = large ? 3 : 4.5
    if (ratio + 0.005 < need) {
      out.push({
        text: own.slice(0, 34), cls: String(el.className).slice(0, 46),
        color: cs.color, size: Math.round(size), weight,
        ratio: Math.round(ratio * 100) / 100, need,
      })
    }
  })
  // de-duplicate identical class+ratio pairs so one repeated component reports once
  const seen = new Set()
  return out.filter((o) => { const k = o.cls + '|' + o.ratio; if (seen.has(k)) return false; seen.add(k); return true })
})()`

async function draftInto(p) {
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Battle the Rival'))?.click())
  await p.waitForSelector('.draft-head', { timeout: 10000 })
  await sleep(250)
  for (const n of ['Victini', 'Ho-Oh', 'Lugia', 'Pikachu', 'Squirtle', 'Onix', 'Croagunk', 'Starly', 'Haunter', 'Grotle', 'Vulpix']) {
    await p.evaluate((nm) => {
      const c = [...document.querySelectorAll('.card')].find((x) => x.querySelector('.card-name')?.textContent === nm)
      if (c) { const o = { bubbles: true, cancelable: true, pointerId: 1 }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); c.click() }
    }, n)
    await sleep(35)
  }
  await sleep(150)
  await p.evaluate(() => document.querySelector('.draft-foot button')?.click())
  await p.waitForSelector('.battle', { timeout: 14000 })
  await sleep(1400)
}

const OVERLAY_HTML = `<div class='overlay' id='probe'><div class='overlay-card'>
  <div class='overlay-title'>Defeat</div>
  <div class='overlay-sub'>Jirachi fainted · 9 rounds · 14:34</div>
  <div class='overlay-btns'><button class='btn btn-primary'>Rematch</button>
  <button class='btn btn-ghost'>New draft</button></div>
  <button class='btn btn-tiny overlay-review'>View the final board</button></div></div>`

const scenes = [
  ['menu', async () => {}],
  ['menu-expanded', async (p) => { await p.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true))); await sleep(300) }],
  ['draft', async (p) => { await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Battle the Rival'))?.click()); await p.waitForSelector('.draft-head'); await sleep(400) }],
  ['battle', async (p) => { await draftInto(p) }],
  ['battle-selected', async (p) => { await draftInto(p); await p.evaluate(() => [...document.querySelectorAll('.unit-mine')].pop()?.click()); await sleep(500) }],
  ['result-overlay', async (p) => { await draftInto(p); await p.evaluate((h) => document.body.insertAdjacentHTML('beforeend', h), OVERLAY_HTML); await sleep(400) }],
]

const b = await chromium.launch()
let total = 0
for (const [name, setup] of scenes) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(BASE, { waitUntil: 'networkidle' })
  await sleep(500)
  await setup(p)
  const fails = await p.evaluate(AUDIT)
  total += fails.length
  console.log(`\n── ${name}: ${fails.length ? fails.length + ' failing' : 'clean'}`)
  for (const f of fails) {
    console.log(`   ${String(f.ratio).padStart(5)}:1 (need ${f.need})  "${f.text}"  ${f.size}px/${f.weight}  ${f.color}  .${f.cls}`)
  }
  await p.close()
}
await b.close()
console.log(`\n${total === 0 ? 'PASS — no contrast failures' : `FAIL — ${total} contrast issues`}`)
process.exit(total === 0 ? 0 : 1)
