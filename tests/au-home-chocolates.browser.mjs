// Open the local AU demo Home in Playwright CLI, then run:
// playwright-cli -s=au-chocolates run-code --filename tests/au-home-chocolates.browser.mjs
// Only collection filters and one detail are opened; no orders are submitted.
async (page) => {
  const origin = await page.evaluate(() => location.origin)
  const products = [
    { slug: 'almond-chocoball', name: 'Almond Chocoball', pack: '80g', price: 'AUD 12.00' },
    { slug: 'pave-chocolate', name: 'Pavé Chocolate', pack: '100g', price: 'AUD 12.00' },
    { slug: 'eiffel-tower-chocolate', name: 'Eiffel Tower Chocolate', pack: '6 pieces', price: 'AUD 10.00' },
    { slug: 'smore-stick', name: 'S’MORE STICK', pack: 'Bulk discounts', price: 'From AUD 4.50', href: '/cakes/smore-stick', photo: '/products/smore-stick-sydney.webp' },
  ]
  const results = []
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${origin}/`)
    const navigation = page.getByRole('navigation', { name: 'Collection categories' })
    await navigation.getByText('CHOCOLATES', { exact: true }).click()
    check(page.url() === `${origin}/`, `CHOCOLATES @ ${width}: filter navigated away from Home`)
    const main = page.locator('.rd-collection-main')
    await main.getByRole('heading', { name: 'Chocolates [4]', exact: true }).waitFor()
    check(await navigation.getByRole('button', { name: 'CHOCOLATES [4]', pressed: true }).count() === 1,
      `CHOCOLATES @ ${width}: selected filter is not announced`)
    check(await main.locator('.rd-product-card').count() === 4, `CHOCOLATES @ ${width}: expected four cards`)
    for (const product of products) {
      const card = main.locator(`[data-au-product="${product.slug}"]`)
      const text = await card.innerText()
      for (const expected of [product.name, product.pack, product.price]) {
        check(text.includes(expected), `${product.slug} @ ${width}: missing ${expected}`)
      }
      check(!/preview|coming soon/i.test(text), `${product.slug}: stale preview copy`)
      check(await card.locator('a').getAttribute('href') === (product.href || `/chocolates/${product.slug}`), `${product.slug}: wrong detail route`)
      const image = card.locator('img')
      await image.scrollIntoViewIfNeeded()
      const photo = await image.evaluate(async image => { await image.decode(); return {src:image.getAttribute('src'), width:image.naturalWidth, height:image.naturalHeight} })
      check(photo.src === (product.photo || `/products/chocolates/${product.slug}.webp`) && photo.width === 1080 && photo.height === 1012,
        `${product.slug} @ ${width}: approved product photo is missing`)
    }
    check(await main.locator('button, input, select').count() === 0, 'Home cards should link to product choices')
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `Home @ ${width}: page overflow`)
    check(await navigation.getByText('GATHER & CELEBRATE').count() === 0, 'Removed category remains in Home navigation')
    await navigation.getByRole('button', { name: 'GÂTEAU SHARING [3]', exact: true }).click()
    check(await main.locator('.rd-product-card').count() === 3, 'Sharing count no longer matches its cards')
    check(await main.locator('a[href="/cakes/lemon-cake"]').count() === 1, 'Lemon Cake is missing from Sharing')
    check(await main.locator('a[href="/cakes/smore-stick"]').count() === 0, 'S’more leaked into Sharing')
    await navigation.getByRole('button', { name: 'SIGNATURE GÂTEAU [2]', exact: true }).click()
    check(await main.locator('.rd-product-card').count() === 2, 'Cake filter no longer works')
    check(await main.locator('a[href^="/chocolates/"]').count() === 0, 'Chocolate cards leaked into cake filter')
    await navigation.getByRole('button', { name: 'ALL PRODUCTS [12]', exact: true }).click()
    check(await main.locator('.rd-product-card').count() === 12, 'ALL count no longer matches its cards')
    check(await main.locator('a[href^="/chocolates/"]').count() === 3, 'ALL omits chocolate products')
    check(await main.locator('a[href="/cakes/smore-stick"]').count() === 1, 'ALL omits S’more Stick')
    const chocolateTab = navigation.getByRole('button', { name: 'CHOCOLATES [4]', exact: true })
    await chocolateTab.focus()
    await page.keyboard.press('Enter')
    check(page.url() === `${origin}/`, 'Keyboard filter navigated away from Home')
    check(await chocolateTab.getAttribute('aria-pressed') === 'true', 'Keyboard filter did not activate')
    await main.locator('a[href="/chocolates/pave-chocolate"]').click()
    await page.waitForURL(`${origin}/chocolates/pave-chocolate`)
    check(await page.locator('[data-au-template="chocolate"]').count() === 1, 'Chocolate detail did not open')
    results.push({ width, chocolateCards: 4, allCards: 12, inlineSwitching: true, keyboard: true, detailLink: true })
  }
  return { passed: results.length, results }
}
