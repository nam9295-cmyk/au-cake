// Local purchase regression: no API submissions or external orders.
async (page) => {
  const origin = new URL(page.url()).origin
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(origin)) throw new Error('Local QA only')
  const check = (value, message) => { if (!value) throw new Error(message) }
  const results = []
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    const open = async (slug) => {
      await page.evaluate(() => localStorage.removeItem('verygood-au-cake-cart-v1'))
      await page.goto(`${origin}/cakes/${slug}`)
      const consent = page.getByRole('button', { name: 'Essential only', exact: true })
      if (await consent.isVisible()) await consent.click()
      return page.locator('.cake-detail-purchase')
    }
    const field = (purchase, legend) => purchase.locator('fieldset').filter({ has: page.locator('legend', { hasText: legend }) })
    const total = async (purchase, amount) => check((await purchase.locator('.cake-detail-price-primary').innerText()).includes(amount.toFixed(2)), `${width}: expected ${amount}`)
    let purchase = await open('signature-gateau-au-chocolat')
    for (const [index, price] of [45,52,55].entries()) {
      await field(purchase, /^Choose a finish$/).getByRole('button').nth(index).click()
      await total(purchase, price)
    }
    purchase = await open('chocolate-cupcakes')
    const pack = field(purchase, /^Pack size$/i)
    for (const [packIndex, prices] of [[0,[31,36,41]],[1,[55,64,73]]]) {
      await pack.getByRole('button').nth(packIndex).click()
      for (const [index, price] of prices.entries()) {
        await field(purchase, /^Finish$/).getByRole('button').nth(index).click()
        await total(purchase, price)
      }
    }
    await purchase.getByRole('checkbox', { name: /Add individual packaging/ }).check()
    await total(purchase, 79)
    await purchase.getByRole('button', { name: 'Increase quantity', exact: true }).click()
    await total(purchase, 146) // Eligible product subtotal exceeds A$100: free packaging.
    purchase = await open('lemon-cake')
    const lemonPacks = field(purchase, /^Choose a style$/)
    for (const [index, price] of [36,45,65,85].entries()) {
      await lemonPacks.getByRole('button').nth(index).click()
      await total(purchase, price)
    }
    await purchase.getByRole('slider', { name: 'Dark chocolate finish pieces' }).fill('2')
    await total(purchase, 86)
    purchase = await open('fresh-strawberry-vanilla-cream-cake')
    for (const [index, price] of [65,89,129].entries()) {
      await field(purchase, /^Choose your size$/).getByRole('button').nth(index).click()
      await total(purchase, price)
    }
    purchase = await open('brownie-cheesecake')
    const brownieFinish = field(purchase, /^Choose a finish$/)
    check(await brownieFinish.getByRole('button').count() === 3, `${width}: Brownie finish should have three choices`)
    for (const [index, price] of [85,105,95].entries()) {
      await brownieFinish.getByRole('button').nth(index).click()
      await total(purchase, price)
    }
    purchase = await open('smore-stick')
    for (const [quantity, price] of [[5,22.5],[6,24.3],[12,43.2]]) {
      await purchase.getByRole('spinbutton', { name: 'Quantity input' }).fill(String(quantity))
      await total(purchase, price)
    }
    await purchase.getByRole('button', { name: /^Add to (order|cart)/i }).click()
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('verygood-au-cake-cart-v1')))
    check(cart.lines[0].productId === 'smore-stick' && cart.lines[0].quantity === 12, 'S’more quantity/SKU preserved')
    results.push({ width, pound: '45/52/55', cupcakes: '31/36/41 and 55/64/73; packaging free at 100+', lemon: '36/45/65/85 + finish', strawberry: '65/89/129', brownie: '85+20 / 95', smore: '5/6/12 tiers and cart' })
  }
  return results
}
