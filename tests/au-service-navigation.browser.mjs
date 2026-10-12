// Run with playwright-cli run-code --filename against the local AU preview.
async (page) => {
  const results = []
  const openMenu = async (home, width) => {
    if (width > 768) return
    if (home) await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    else await page.locator('.au-redesign-mobile-menu summary').click()
  }
  for (const width of [1440, 1024, 834, 769, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const path of ['/', '/cakes', '/cakes/custom-cake']) {
      await page.goto('http://127.0.0.1:5184' + path)
      const consent = page.getByRole('button', { name: 'Essential only', exact: true })
      if (await consent.isVisible()) await consent.click()
      await page.evaluate(() => document.fonts.ready)
      const home = path === '/'
      const header = page.locator(home ? '.rd-header' : '.au-redesign-header')
      const bounds = await header.evaluate((root) => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        items: [...root.children]
          .filter((el) => getComputedStyle(el).display !== 'none')
          .map((el) => {
            const rect = el.getBoundingClientRect()
            return [rect.left, rect.right]
          }),
      }))
      if (bounds.overflow) throw Error(`Page overflow: ${width} ${path}`)
      if (bounds.items.some((box) => box[0] < 0 || box[1] > width + 1)) {
        throw Error(`Clipped header control: ${width} ${path}`)
      }
      if (bounds.items.some((box, i, all) => i && box[0] < all[i - 1][1] - 1)) {
        throw Error(`Overlapping header controls: ${width} ${path}`)
      }
      if (home) {
        const image = page.locator('.rd-story-photo')
        await image.scrollIntoViewIfNeeded()
        await image.evaluate((img) => img.decode())
        if (!(await image.getAttribute('src')).includes('/business/events-hero-')) {
          throw Error('Home story must use the approved party photograph')
        }
        await page.evaluate(() => scrollTo(0, 0))
      }
      const nav = page.locator(width <= 768
        ? home ? '.rd-mobile-drawer-links' : '.au-redesign-mobile-menu[open] nav'
        : home ? '.rd-header-nav' : '.au-redesign-desktop-nav')
      await openMenu(home, width)
      await nav.getByText('EVENTS & BUSINESS', { exact: true }).click()
      await page.waitForURL('**/business/events')
      await page.locator('.au-business-events').waitFor()
      await page.goto('http://127.0.0.1:5184' + path)
      await openMenu(home, width)
      await nav.getByText('KIDS CLASSES', { exact: true }).click()
      await page.waitForURL('**/classes')
      await page.locator('h1').first().waitFor()
      results.push({ width, path, events: '/business/events', kids: '/classes' })
    }
  }
  return results
}
