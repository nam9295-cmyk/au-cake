// Run with an existing Playwright page on the desired local AU origin.
// Does not submit a reservation or contact an external service itself.
async (page) => {
  const origin = await page.evaluate(() => location.origin)
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  await page.goto(`${origin}/chocolates/almond-chocoball`)
  await page.evaluate(() => localStorage.removeItem('verygood-au-cake-cart-v1'))
  await page.reload()
  await page.getByLabel('Quantity', { exact: true }).selectOption('5')
  await page.getByRole('button', { name: 'Add to order', exact: true }).click()
  await page.getByLabel('Pack', { exact: true }).selectOption('almond-chocoball-6pack')
  check((await page.locator('figcaption').first().innerText()).includes('Reference photo'), 'Six-pack photograph must be labelled as a reference')
  await page.getByLabel('Quantity', { exact: true }).selectOption('2')
  await page.getByRole('button', { name: 'Add to order', exact: true }).click()
  await page.getByLabel('Pack', { exact: true }).selectOption('almond-chocoball-black-tub-2x80g')
  check((await page.locator('figcaption').first().innerText()).includes('Reference photo'), 'Black Tub photograph must be labelled as a reference')
  await page.getByLabel('Quantity', { exact: true }).selectOption('1')
  await page.getByRole('button', { name: 'Add to order', exact: true }).click()
  await page.getByRole('button', { name: 'View order', exact: true }).click()
  check(await page.locator('.cart-line').count() === 3, 'Three separate Almond sale units must remain in the cart')
  check(!(await page.locator('.cart-line-options').allTextContents()).join(' ').match(/Cake Size|15cm/), 'Chocolate cart must not show cake sizes')
  await page.reload()
  check(await page.locator('.cart-line').count() === 3, 'Chocolate cart must survive reload')
  check((await page.locator('.cart-summary').innerText()).includes('205.00'), 'Rendered cart subtotal must be AUD205.00')
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('verygood-au-cake-cart-v1')))
  check(data.lines[0].productId === 'almond-chocoball-80g' && data.lines[0].quantity === 5, 'Five bags must not be promoted to a six-pack')
  check(data.lines[1].productId === 'almond-chocoball-6pack' && data.lines[1].quantity === 2, 'Six-pack quantity must count packs')
  return { saleUnits: data.lines.map(({ productId, quantity }) => ({ productId, quantity })), summary: await page.locator('.cart-summary').innerText() }
}
