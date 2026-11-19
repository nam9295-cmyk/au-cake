// Run against a local AU server. Check links without submitting enquiries.
async (page) => {
  const origin = new URL(page.url()).origin
  for (const width of [1440, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(origin + '/portfolio')
    const main = page.locator('main.company-portfolio')
    await main.waitFor()
    for (const image of await main.locator('img:visible').all()) {
      await image.scrollIntoViewIfNeeded()
      await image.evaluate(el => el.decode())
    }
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Overflow at ' + width)
    const links = await main.locator('a').evaluateAll(items => items.map(a => ({
      valid: !a.hash || a.origin !== location.origin || !!document.getElementById(a.hash.slice(1)),
      height: a.getBoundingClientRect().height,
    })))
    if (links.some(link => !link.valid || link.height < 44)) throw Error('Invalid link at ' + width)
    await main.locator('nav a[href="#consulting"]').click()
    await page.waitForURL('**/portfolio#consulting')
  }
}
