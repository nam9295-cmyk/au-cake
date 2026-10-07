// Run on the isolated local AU preview, never on production:
// playwright-cli -s=au-pave run-code --filename tests/au-pave-detail.browser.mjs
async (page) => {
  const origin = await page.evaluate(() => location.origin)
  if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(origin)) throw new Error('Local preview required')
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  const results = []
  const route = `${origin}/cakes/pave-chocolate-cake`
  const screenshots = '/tmp/au-pave-detail-20261002'
  const expected = ['party', 'occasion', 'birthday', 'gathering']
  await page.evaluate(() => localStorage.removeItem('verygood-au-cake-cart-v1'))
  for (const width of [1440, 834, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(route)
    const consent = page.getByRole('button', { name: 'Essential only', exact: true })
    if (await consent.isVisible()) await consent.click()
    await page.locator('.au-pave-detail').waitFor()
    await page.evaluate(() => document.fonts.ready)
    const gallery = page.getByRole('group', { name: 'Cake quantity' })
    check(await gallery.isVisible(), `${width}: quantity missing`)
    for (const [index, name] of ['hero', 'angle', 'slice', 'sharing', 'party', 'sizes'].entries()) {
      await page.getByRole('button', { name: `Photo ${index + 1}`, exact: true }).click()
      check((await page.locator('.au-pave-gallery-main > img').getAttribute('src')).includes(`/${name}-`), `${width}: gallery photo ${index + 1}`)
      check(await page.getByRole('button', { name: `Photo ${index + 1}`, exact: true }).getAttribute('aria-pressed') === 'true', 'Selected gallery state')
    }
    await page.getByRole('button', { name: 'Photo 1', exact: true }).click()
    const purchase = page.locator('.au-pave-purchase')
    const add = purchase.getByRole('button', { name: /^ADD TO ORDER/ })
    for (const [index, price] of [79, 109, 159].entries()) {
      await purchase.locator('.au-pave-size-options button').nth(index).click()
      check((await add.innerText()).includes(`${price}.00`), `${width}: size price ${price}`)
      check(await purchase.locator('.au-pave-size-options [aria-pressed="true"]').count() === 1, 'Exclusive size selection')
    }
    await purchase.locator('.au-pave-size-options button').first().click()
    for (const [index, total] of [91, 89, 99].entries()) {
      await purchase.locator('.au-pave-extra-options button').nth(index).click()
      check((await add.innerText()).includes(`${total}.00`), `${width}: extra total ${total}`)
    }
    await purchase.getByRole('button', { name: 'Increase quantity' }).click()
    check((await add.innerText()).includes('178.00'), 'Extra must be charged once per cart row')
    for (let n = 2; n < 5; n++) await purchase.getByRole('button', { name: 'Increase quantity' }).click()
    check(await purchase.getByRole('button', { name: 'Increase quantity' }).isDisabled(), 'Quantity max 5')
    for (let n = 5; n > 1; n--) await purchase.getByRole('button', { name: 'Decrease quantity' }).click()
    check(await purchase.getByRole('button', { name: 'Decrease quantity' }).isDisabled(), 'Quantity min 1')
    await purchase.getByRole('button', { name: 'No chocolate extra', exact: true }).click()
    check((await add.innerText()).includes('79.00'), 'No extra restores base price')
    for (const section of await page.locator('.au-pave-story > section').all()) {
      await section.scrollIntoViewIfNeeded()
      await page.waitForTimeout(430)
      await section.evaluate(async (element) => { await Promise.all([...element.querySelectorAll('img')].map((image) => image.decode())) })
      const name = await section.getAttribute('class')
      await section.screenshot({ path: `${screenshots}/${width}-${name}.png` })
    }
    const layout = await page.evaluate(() => ({
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      photos: [...document.querySelectorAll('.au-pave-occasion-grid img')].map((image) => image.getAttribute('src').split('/').pop().replace('-960.webp', '')),
      broken: [...document.querySelectorAll('.au-pave-detail img')].filter((image) => getComputedStyle(image).display !== 'none' && (!image.complete || image.naturalWidth === 0)).map((image) => image.src),
      related: [...document.querySelectorAll('.au-pave-related-grid a')].map((link) => link.getAttribute('href')),
      video: document.querySelectorAll('.au-pave-video video').length,
    }))
    check(layout.scrollWidth <= width, `${width}: horizontal overflow ${layout.scrollWidth}`)
    check(!layout.broken.length, `${width}: missing image ${layout.broken}`)
    check(JSON.stringify(layout.photos) === JSON.stringify(expected), `${width}: narrative order`)
    check(layout.related.length === 3 && layout.related[2] === '/chocolates/almond-chocoball', 'Related 3 products')
    check(layout.video === 1, 'Video Moment uses the supplied film')
    const prices = await page.locator('.au-pave-option-price').evaluateAll((elements) => elements.map((element) => ({ size: getComputedStyle(element).fontSize, weight: getComputedStyle(element).fontWeight })))
    check(prices.length === 6 && prices.every((price) => price.size === (width === 390 ? '11px' : '12px') && price.weight === '700'), 'Option prices are 1px larger and bold')
    const video = page.locator('.au-pave-video video')
    await video.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => { const video = document.querySelector('.au-pave-video video'); return !video.paused && video.currentTime > 0.1 })
    check(await video.evaluate((element) => !element.error && element.videoWidth === 1440 && element.muted && element.loop), 'Video automatically plays muted and loops')
    check(await video.evaluate((element) => !element.controls && Math.abs(element.duration - 8) < 0.05), 'Video has no player controls and runs for eight seconds')
    await page.evaluate(() => scrollTo(0, 0))
    await page.waitForFunction(() => document.querySelector('.au-pave-video video').paused)
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: `${screenshots}/${width}-full.png`, fullPage: true })
    await page.screenshot({ path: `${screenshots}/${width}-hero.png` })
    if (width === 390) {
      const launcher = page.locator('#vg-chat-launcher')
      if (await launcher.count()) {
        const chat = await launcher.boundingBox()
        const bar = await page.locator('.au-pave-sticky-order').boundingBox()
        check(chat.y + chat.height <= bar.y, 'Chat must not cover the mobile purchase bar')
      }
      const touch = page.locator('.au-pave-gallery-main')
      await touch.evaluate((element) => {
        const start = new Touch({ identifier: 1, target: element, clientX: 280, clientY: 150 })
        const end = new Touch({ identifier: 1, target: element, clientX: 80, clientY: 150 })
        element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start] }))
        element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end] }))
      })
      check((await touch.locator(':scope > img').getAttribute('src')).includes('/angle-'), 'Mobile swipe gallery')
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await page.locator('.au-pave-detail').waitFor()
    check(await page.locator('.au-pave-awaiting').count() === 0, 'Reduced motion does not hide content')
    const transition = await page.locator('.au-pave-hook').evaluate((element) => getComputedStyle(element).transitionDuration)
    check(transition === '0s', 'Reduced motion disables reveals')
    await page.locator('.au-pave-video').scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    check(await page.locator('.au-pave-video video').evaluate((element) => element.paused && element.currentTime === 0), 'Reduced motion keeps poster without autoplay')
    results.push({ width, layout, reducedMotion: true })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(route)
  const purchase = page.locator('.au-pave-purchase')
  await purchase.locator('.au-pave-size-options button').nth(1).click()
  await purchase.locator('.au-pave-extra-options button').nth(2).click()
  await purchase.getByRole('button', { name: 'Increase quantity' }).click()
  await purchase.getByRole('button', { name: /^ADD TO ORDER/ }).click()
  await purchase.getByRole('button', { name: 'View order', exact: true }).click()
  await page.waitForURL('**/cart')
  const cart = await page.locator('main').innerText()
  check(cart.includes('238.00') && cart.includes('8"') && cart.includes('Chocolate Extra Set'), 'Cart handoff must preserve 8in, qty 2, combo, AUD 238')
  await page.screenshot({ path: `${screenshots}/cart-handoff.png` })
  await page.goto(route)
  for (const href of ['/cakes/signature-gateau-au-chocolat', '/cakes/brownie-cheesecake', '/chocolates/almond-chocoball']) {
    await page.locator(`.au-pave-related-grid a[href="${href}"]`).click()
    await page.waitForURL(`**${href}`)
    check(!/could not find|404/i.test(await page.locator('main').innerText()), `Related route ${href}`)
    await page.goto(route)
  }
  check(!errors.length, `Page errors: ${errors.join('; ')}`)
  return { results, cartHandoff: true, relatedLinks: true, errors, screenshots }
}
