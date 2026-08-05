/**
 * Shared menu navigation for the browser suites.
 *
 * The menu is a selection screen: clicking a mode only marks it, and Start game
 * is what commits. Selecting and starting must be separate evaluates — doing
 * both in one task lets React batch the state update, so Start would still read
 * the previously selected mode.
 */
export async function startMode(page, label, { settle = 120 } = {}) {
  await page.evaluate((l) => {
    const card = [...document.querySelectorAll('.mode-card')]
      .find((c) => c.querySelector('.mode-card-label')?.textContent === l)
    if (!card) throw new Error(`no mode card "${l}"`)
    card.click()
  }, label)
  await new Promise((r) => setTimeout(r, settle))
  await page.evaluate(() => {
    const b = document.querySelector('.btn-start')
    if (!b) throw new Error('no Start game button')
    b.click()
  })
}
