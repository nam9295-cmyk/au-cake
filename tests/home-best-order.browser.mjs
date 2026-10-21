// Playwright CLI run-code --filename tests/home-best-order.browser.mjs
// Requires the local AU preview at 127.0.0.1:4173; blocks production API and writes.
async (page) => {
  const check = (ok, message) => { if (!ok) throw Error(message) }
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method()) || url.hostname === 'api.verygood-chocolate.com' || url.pathname.startsWith('/appwrite/')) return route.abort()
    return route.continue()
  })
  await page.goto('http://127.0.0.1:4173/')
  await page.evaluate(() => localStorage.setItem('au-cake-language', 'en'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const results = []
  for (const width of [1440, 1024, 834, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('http://127.0.0.1:4173/')
    await page.locator('#best').waitFor()
    const closeNotice = page.getByRole('button', { name: 'Dismiss announcement', exact: true })
    if (await closeNotice.isVisible()) await closeNotice.click()
    const consent = page.getByRole('button', { name: 'Essential only', exact: true })
    if (await consent.isVisible()) await consent.click()
    await page.evaluate(() => document.fonts.ready)
    const cards = page.locator('.au-v02-best-card')
    check(await cards.count() === 4, `${width}: 4 Best cards`)
    check(await cards.last().locator('.au-v02-best-action').getAttribute('href') === '/chocolates/chocolate-mochi', `${width}: Mochi product link`)
    check((await cards.last().textContent()).includes('From AUD 8.00 each'), `${width}: existing Mochi price`)
    const order = await page.evaluate(() => {
      const nodes = ['#best', '#au-collection', '.au-v02-craft', '.au-stories-home', '#custom-cakes'].map(selector => document.querySelector(selector))
      return nodes.every((node, index) => node && (!index || Boolean(nodes[index - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)))
    })
    check(order, `${width}: Best → collection → craft → reviews → custom`)
    const track = page.locator('.au-v02-best-track')
    await track.scrollIntoViewIfNeeded()
    for (const img of await cards.locator('img').all()) {
      await img.scrollIntoViewIfNeeded()
      await img.evaluate(async image => { await image.decode() })
    }
    check(await cards.last().evaluate(el => el.querySelector("img").getBoundingClientRect().bottom <= el.querySelector(".au-v02-best-rank").getBoundingClientRect().top), `${width}: Mochi image does not overlap rank`)
    if (width < 768) {
      await track.evaluate(el => el.scrollTo({ left: 0, behavior: 'instant' }))
      await track.focus()
      for (let i = 1; i <= 3; i++) {
        await track.press('ArrowRight')
        await page.waitForFunction(index => document.querySelectorAll('.au-v02-best-indicators button')[index]?.getAttribute('aria-pressed') === 'true', i)
      }
      check(await cards.last().evaluate(el => {
        const card = el.getBoundingClientRect(), track = el.parentElement.getBoundingClientRect()
        return card.left >= track.left - 2 && card.right <= track.right + 2
      }), `${width}: fourth card fully visible`)
      await page.screenshot({ path: `output/playwright/home-best-pickup-20261021/mobile-mochi-${width}.png` })
      await track.press('ArrowLeft')
      await page.waitForFunction(() => document.querySelectorAll('.au-v02-best-indicators button')[2]?.getAttribute('aria-pressed') === 'true')
      await page.locator('.au-v02-best-indicators button').last().click()
      await page.waitForFunction(() => document.querySelector('.au-v02-best-indicators button:last-child')?.getAttribute('aria-pressed') === 'true')
    } else {
      const columns = await track.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)
      check(columns === (width >= 1200 ? 4 : 2), `${width}: responsive grid`)
      if (width === 1440) {
        await track.scrollIntoViewIfNeeded()
        await page.screenshot({ path: 'output/playwright/home-best-pickup-20261021/desktop-best.png' })
      }
    }
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${width}: no page overflow`)
    results.push({ width, bestCards: 4, sectionOrder: 'PASS', layout: width < 768 ? 'swipe + keyboard to fourth card PASS' : width >= 1200 ? '4 columns' : '2 columns' })
  }
  await page.evaluate(() => localStorage.setItem('au-cake-language', 'ko'))
  await page.goto('http://127.0.0.1:4173/')
  await page.locator('#best').waitFor()
  check((await page.locator('.au-v02-best-card').last().textContent()).includes('개당 AUD 8.00부터'), 'Korean Mochi price')
  check((await page.locator('#best').textContent()).includes('BEST [4]'), 'Korean Best count')
  check(errors.length === 0, `browser errors: ${errors.join('; ')}`)
  return { results, korean: 'PASS', browserErrors: errors, productionWrites: 0 }
}
