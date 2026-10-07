// Focused visual evidence, run after the responsive/commerce suite has finished.
async (page) => {
  const origin = new URL(page.url()).origin
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(origin)) throw new Error('Local QA only')
  const cases = [
    ['signature-gateau-au-chocolat', 1440, '.cake-detail-hero', 'signature-hero'],
    ['chocolate-cupcakes', 1440, '.au-pave-inside', 'cupcake-inside'],
    ['smore-stick', 1440, '.au-pave-packaging', 'smore-packaging'],
    ['almond-chocoball', 390, '.au-pave-hero', 'almond-mobile-purchase'],
  ]
  const results = []
  for (const [slug, width, selector, label] of cases) {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`${origin}/${slug === 'almond-chocoball' ? 'chocolates' : 'cakes'}/${slug}`)
    const target = page.locator(selector)
    await target.scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready)
    await target.evaluate(async (element) => Promise.all([...element.querySelectorAll('img')].filter((img) => img.getClientRects().length).map((img) => img.decode())))
    await target.screenshot({ path: `/tmp/au-product-details-20261007/comparisons/${label}-web.png` })
    results.push({ label, width, fonts: await page.locator('h1,.au-pave-hook > p:last-child').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).fontFamily)) })
  }
  return results
}
