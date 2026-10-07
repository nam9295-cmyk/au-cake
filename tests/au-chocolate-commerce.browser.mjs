// Run with a local AU dev page in Playwright CLI. No reservation is submitted.
async (page) => {
  const origin = await page.evaluate(() => location.origin)
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  const expected = [
    ['almond-chocoball-80g', 5, '80g'],
    ['almond-chocoball-6pack', 1, '80g × 6'],
    ['almond-chocoball-black-tub-2x80g', 1, '80g × 2'],
    ['pave-chocolate-100g', 2, '100g'],
    ['eiffel-tower-chocolate-6', 3, '6 pieces'],
  ]
  const results = []

  async function assertLayout(width, label) {
    const layout = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }))
    check(layout.content <= layout.viewport, `${label} overflows at ${width}px`)
    check(await page.locator('main select').count() === 0, `${label} has a native select`)
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: `/tmp/au-chocolate-controls-${width}-${label}.png`, fullPage: true })
  }

  async function quantity(value, label) {
    const decrease = page.getByRole('button', { name: 'Decrease quantity' })
    const increase = page.getByRole('button', { name: 'Increase quantity' })
    check(await decrease.isDisabled(), `${label}: minus must stop at 1`)
    check((await page.locator('.au-chocolate-quantity output').innerText()) === '1', `${label}: initial quantity must be 1`)
    for (let index = 1; index < value; index++) await increase.click()
    check((await page.locator('.au-chocolate-quantity output').innerText()) === String(value), `${label}: stepper did not reach ${value}`)
    if (value === 5) {
      check(await increase.isDisabled(), `${label}: plus must stop at 5`)
      await decrease.click()
      check((await page.locator('.au-chocolate-quantity output').innerText()) === '4', `${label}: minus did not decrement`)
      await increase.click()
    }
  }

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    await page.goto(`${origin}/chocolates/almond-chocoball`)
    const consent = page.getByRole('button', { name: 'Essential only', exact: true })
    if (await consent.isVisible()) await consent.click()
    await page.evaluate(() => localStorage.removeItem('verygood-au-cake-cart-v1'))
    await page.reload()

    const variants = page.locator('.au-chocolate-variants button')
    check(await variants.count() === 3, `Almond must show three variant cards at ${width}px`)
    const cardHeights = await variants.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height))
    check(cardHeights.every((height) => height <= 72), `Almond variant cards are taller than the cake option rhythm at ${width}px: ${cardHeights.join(', ')}`)
    check(Math.max(...cardHeights) - Math.min(...cardHeights) <= 1, `Almond variant cards have uneven heights at ${width}px`)
    check(!(await variants.allTextContents()).some((label) => label.includes('BUY 5, GET 1 FREE')), 'Six-pack promotion belongs below the option cards')
    check(await variants.nth(0).getAttribute('aria-pressed') === 'true', '80g must be selected initially')
    check(await page.locator('.au-chocolate-promo-note').count() === 0, 'Single must not show six-pack promo note')
    await quantity(5, 'Single')
    check(await page.getByText('Total · AUD 60.00', { exact: true }).count() === 1, 'Single ×5 must total AUD60')
    await assertLayout(width, 'almond-single')
    await page.locator('.au-redesign-chocolate-info').getByRole('button', { name: 'Add to order' }).click()

    await variants.nth(1).click()
    check(await variants.nth(1).getAttribute('aria-pressed') === 'true', '6 Pack must be selected')
    check(await variants.nth(0).getAttribute('aria-pressed') === 'false', 'Single must be deselected')
    check(await page.locator('.au-redesign-price').innerText() === 'AUD 60.00', '6 Pack price must be AUD60')
    check((await page.locator('.au-chocolate-promo-note').innerText()).includes('BUY 5, GET 1 FREE — 6 PACK / AUD 60'), 'Missing six-pack promo')
    check((await page.locator('.au-chocolate-promo-note').innerText()).includes('Coupons do not apply to this six pack.'), 'Missing six-pack coupon notice')
    check(await page.getByText(/^Reference photo:/).count() === 1, 'Six-pack photo must be labelled as a reference')
    for (let index = 1; index < 5; index++) await page.getByRole('button', { name: 'Decrease quantity' }).click()
    check((await page.locator('.au-chocolate-quantity output').innerText()) === '1', 'Six-pack quantity must be 1')
    check(await page.getByText('Total · AUD 60.00', { exact: true }).count() === 1, '6 Pack ×1 must total AUD60')
    await assertLayout(width, 'almond-six-pack')
    await page.locator('.au-redesign-chocolate-info').getByRole('button', { name: 'Add to order' }).click()

    await variants.nth(2).click()
    check(await variants.nth(2).getAttribute('aria-pressed') === 'true', 'Black Tub must be selected')
    check(await page.locator('.au-chocolate-promo-note').count() === 0, 'Black Tub must not show six-pack promo note')
    check(await page.locator('.au-redesign-price').innerText() === 'AUD 25.00', 'Black Tub price must be AUD25')
    check(await page.getByText(/^Reference photo:/).count() === 1, 'Black Tub photo must be labelled as a reference')
    await page.locator('.au-redesign-chocolate-info').getByRole('button', { name: 'Add to order' }).click()
    await assertLayout(width, 'almond')

    for (const [slug, count, total] of [['pave-chocolate', 2, '24.00'], ['eiffel-tower-chocolate', 3, '30.00']]) {
      await page.goto(`${origin}/chocolates/${slug}`)
      check(await page.locator('.au-chocolate-variants').count() === 0, `${slug}: unexpected pack selector`)
      await quantity(count, slug)
      check(await page.getByText(`Total · AUD ${total}`, { exact: true }).count() === 1, `${slug}: total did not update`)
      await page.locator('.au-redesign-chocolate-info').getByRole('button', { name: 'Add to order' }).click()
      await assertLayout(width, slug)
    }

    await page.locator('.au-redesign-chocolate-info').getByRole('button', { name: 'View order' }).click()
    check(await page.locator('.cart-line').count() === 5, 'The five sale units must remain separate in the cart')
    const data = await page.evaluate(() => JSON.parse(localStorage.getItem('verygood-au-cake-cart-v1')))
    check(data.lines.length === expected.length, 'Cart must store five product lines')
    expected.forEach(([productId, count], index) => {
      check(data.lines[index].productId === productId && data.lines[index].quantity === count,
        `Wrong cart SKU or quantity at line ${index + 1}`)
    })
    const cartText = (await page.locator('.cart-line').allTextContents()).join(' ')
    expected.forEach(([, , unit]) => check(cartText.includes(unit), `Missing sale unit ${unit} in cart`))
    check(await page.getByText('AUD 199.00', { exact: true }).count() > 0, 'Cart subtotal must be AUD199')
    check(!/Cake Size|15cm/.test(cartText), 'Chocolate cart must not show cake sizes')
    results.push({ width, lines: expected.map(([productId, count]) => ({ productId, count })), subtotal: 'AUD 199.00' })
  }
  return results
}
