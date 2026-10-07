// Local preview only. Run with playwright-cli -s=au-details run-code --filename ...
async (page) => {
  const origin = new URL(page.url()).origin
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(origin)) throw new Error('Local QA only')
  const check = (value, message) => { if (!value) throw new Error(message) }
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const products = [
    ['pave-chocolate-cake', '/cakes/pave-chocolate-cake', 'pave-cake', 79],
    ['signature-gateau-au-chocolat', '/cakes/signature-gateau-au-chocolat', 'pound-cake', 45],
    ['chocolate-cupcakes', '/cakes/chocolate-cupcakes', 'cupcake-dozen', 55],
    ['lemon-cake', '/cakes/lemon-cake', 'fresh-lemon-cupcakes-12', 65],
    ['bento-cake', '/cakes/bento-cake', null, null],
    ['fresh-strawberry-vanilla-cream-cake', '/cakes/fresh-strawberry-vanilla-cream-cake', 'fresh-strawberry-vanilla-cream-cake', 65],
    ['brownie-cheesecake', '/cakes/brownie-cheesecake', 'brownie-cheesecake', 85],
    ['almond-chocoball', '/chocolates/almond-chocoball', 'almond-chocoball-80g', 12],
    ['smore-stick', '/cakes/smore-stick', 'smore-stick', 4.5],
  ]
  const results = []
  for (const width of [1440, 834, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const [slug, route, id, price] of products) {
      await page.evaluate(() => localStorage.removeItem('verygood-au-cake-cart-v1'))
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto(`${origin}${route}`)
      const consent = page.getByRole('button', { name: 'Essential only', exact: true })
      if (await consent.isVisible()) await consent.click()
      const main = page.locator(`[data-au-product-detail="${slug}"]`)
      await main.waitFor()
      await page.evaluate(() => document.fonts.ready)
      for (const section of await main.locator('.au-pave-story > section').all()) {
        await section.scrollIntoViewIfNeeded()
        await section.evaluate(async (element) => Promise.all([...element.querySelectorAll('img')].map((image) => image.decode())))
      }
      await page.waitForTimeout(450)
      const layout = await main.evaluate((element) => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        broken: [...element.querySelectorAll('img')].filter((image) => getComputedStyle(image).display !== 'none' && (!image.complete || !image.naturalWidth)).map((image) => image.src),
        order: [...element.querySelectorAll('.au-pave-story > section')].map((section) => section.getAttribute('data-detail-section') || section.className),
        images: [...element.querySelectorAll('.au-pave-story img')].map((image) => image.getAttribute('src')),
        related: [...element.querySelectorAll('.au-pave-related-grid a')].map((link) => link.getAttribute('href')),
        fonts: [...element.querySelectorAll('h1,.au-pave-hook > p:last-child')].map((node) => getComputedStyle(node).fontFamily),
      }))
      check(layout.overflow <= 0, `${slug}/${width}: overflow ${layout.overflow}`)
      check(!layout.broken.length, `${slug}/${width}: broken ${layout.broken}`)
      check(layout.related.length === 3, `${slug}/${width}: related count`)
      const baseline = results.find((result) => result.slug === slug)
      if (baseline) check(JSON.stringify(baseline.layout.images) === JSON.stringify(layout.images), `${slug}/${width}: photo narrative drift`)
      await page.evaluate(() => scrollTo(0,0))
      await page.screenshot({ path: `/tmp/au-product-details-20261007/${slug}-${width}-full.png`, fullPage: true })
      await page.screenshot({ path: `/tmp/au-product-details-20261007/${slug}-${width}-hero.png` })
      if (id) {
        const purchase = slug === 'pave-chocolate-cake' ? main.locator('.au-pave-purchase')
          : slug === 'almond-chocoball' ? main.locator('.au-redesign-chocolate-info') : main.locator('.cake-detail-purchase')
        const add = purchase.getByRole('button', { name: /^(ADD TO ORDER|Add to order|Add to Cart)/ })
        check((await purchase.innerText()).includes(price.toFixed(2)), `${slug}: initial price`)
        await purchase.getByRole('button', { name: 'Increase quantity', exact: true }).click()
        await add.click()
        const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('verygood-au-cake-cart-v1')))
        check(cart.lines.length === 1 && cart.lines[0].productId === id && cart.lines[0].quantity === 2, `${slug}/${width}: cart handoff ${JSON.stringify(cart)}`)
        if (width === 390) {
          const bar = main.locator('.au-pave-sticky-order')
          check(await bar.isVisible(), `${slug}: mobile purchase bar missing`)
          await bar.getByRole('button', { name: 'ADD TO ORDER', exact: true }).click()
          const stickyCart = await page.evaluate(() => JSON.parse(localStorage.getItem('verygood-au-cake-cart-v1')))
          check(stickyCart.lines[0].productId === id && stickyCart.lines[0].quantity === 4, `${slug}: mobile purchase handler adds the same two units`)
          check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${slug}: added mobile controls overflow`)
        }
      } else check(!await main.getByRole('button', { name: /ADD TO ORDER|Add to Cart/i }).count(), 'Bento cannot be ordered')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.reload()
      await main.waitFor()
      check(await main.locator('.au-pave-awaiting').count() === 0, `${slug}/${width}: reduced motion hidden content`)
      results.push({ slug, width, layout, cartHandoff: Boolean(id), reducedMotion: true })
    }
  }
  check(!errors.length, `Page errors: ${errors}`)
  return { results, errors, screenshots: '/tmp/au-product-details-20261007' }
}
