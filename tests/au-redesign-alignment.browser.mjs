// Run with an AU dev server open in Playwright CLI:
// playwright-cli -s=au-polish run-code --filename tests/au-redesign-alignment.browser.mjs
// Run against the local demo store. No cart/checkout interaction or dependencies.
async (page) => {
  const origin = await page.evaluate(() => location.origin)
  const failures = []
  const results = []
  const widths = [1440, 1101, 900, 800, 769, 768, 390, 320]
  const check = (condition, message) => { if (!condition) failures.push(message) }
  const aligned = (values) => Math.max(...values) - Math.min(...values) <= 1

  for (const route of ['/', '/cakes', '/chocolates', '/cakes/pave-chocolate-cake']) {
    await page.goto(`${origin}${route}`)
    await page.locator('.rd-header-logo, .au-redesign-header > .au-redesign-wordmark').first().waitFor({ state: 'visible' })
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(async () => {
        await document.fonts.ready
        for (const img of document.querySelectorAll('.rd-best-photo, .au-redesign-product-card img')) {
          img.scrollIntoView()
          await img.decode()
        }
      })
      const layout = await page.evaluate(() => {
        const rect = (element) => {
          const box = element.getBoundingClientRect()
          return { top: box.top + scrollY, bottom: box.bottom + scrollY, left: box.left, right: box.right, height: box.height, width: box.width }
        }
        const ink = (element) => {
          const range = document.createRange()
          range.selectNodeContents(element)
          return rect(range)
        }
        const logo = document.querySelector('.rd-header > .rd-header-logo, .au-redesign-header > .au-redesign-wordmark')
        const logoStyle = getComputedStyle(logo)
        const best = !!document.querySelector('.rd-best-grid')
        const cards = [...document.querySelectorAll(best ? '.rd-best-col' : '.au-redesign-product-card')].map((card) => {
          const price = card.querySelector(best ? '.rd-best-price-label' : '.au-redesign-card-bottom > span')
          const action = card.querySelector(best ? '.rd-best-action-row' : '.au-redesign-card-bottom')
          const title = card.querySelector('h3')
          const meta = card.querySelector('p')
          const label = card.querySelector('.rd-best-action-label')
          const badge = card.querySelector('.rd-hogirl-sticker')
          const referencePrice = card.querySelector('.au-redesign-card-bottom small')
          return {
            card: rect(card), title: ink(title), meta: meta ? ink(meta) : null,
            image: rect(card.querySelector(best ? '.rd-best-photo-frame' : 'img')),
            price: ink(price), action: rect(action), label: label ? ink(label) : null,
            referencePrice: referencePrice ? ink(referencePrice) : null,
            badge: badge ? { text: badge.textContent.trim(), ...rect(badge) } : null,
          }
        })
        return { best, cards, overflow: document.documentElement.scrollWidth > innerWidth,
          logo: { text: logo.textContent.trim(), href: logo.getAttribute('href'),
            font: logoStyle.fontFamily, size: logoStyle.fontSize, weight: logoStyle.fontWeight } }
      })
      const label = `${route} @ ${width}px`
      check(layout.logo.text === 'verygood' && layout.logo.href === '/', `${label}: lowercase Home logo link`)
      check(layout.logo.font.includes('Work Sans') && Number(layout.logo.weight) === 800, `${label}: ExtraBold Work Sans logo`)
      check(!layout.overflow, `${label}: page overflow`)
      check(layout.cards.length > 0, `${label}: expected product cards`)
      check(aligned(layout.cards.map((card) => card.card.height)), `${label}: inconsistent card heights`)

      const rows = new Map()
      for (const card of layout.cards) {
        const row = Math.round(card.card.top)
        if (!rows.has(row)) rows.set(row, [])
        rows.get(row).push(card)
        check(card.title.bottom <= (card.meta?.top ?? card.image.top) + 1, `${label}: title overlaps next region`)
        if (card.meta) check(card.meta.bottom <= card.image.top + 1, `${label}: description overlaps image`)
        check(card.price.top >= card.action.top && card.price.bottom <= card.action.bottom, `${label}: price escapes its row`)
        for (const text of [card.price, card.label, card.referencePrice].filter(Boolean)) {
          check(text.left >= card.action.left && text.right <= card.action.right, `${label}: action text overflows horizontally`)
          check(text.top >= card.action.top && text.bottom <= card.action.bottom, `${label}: action text overflows vertically`)
        }
        if (card.label) check(card.label.top >= card.action.top && card.label.bottom <= card.action.bottom, `${label}: button label escapes its row`)
        if (card.label && card.label.bottom > card.price.top && card.price.bottom > card.label.top) {
          check(card.label.right + 4 <= card.price.left, `${label}: button label overlaps price`)
        }
      }
      for (const row of rows.values()) {
        for (const [name, value] of Object.entries({
          imageTop: (c) => c.image.top, imageHeight: (c) => c.image.height,
          priceBaseline: (c) => c.price.bottom, actionTop: (c) => c.action.top,
          actionHeight: (c) => c.action.height, cardBottom: (c) => c.card.bottom,
          ...(layout.best ? {} : { descriptionTop: (c) => c.meta.top }),
        })) check(aligned(row.map(value)), `${label}: ${name} is not aligned`)
      }
      if (layout.best) {
        check(layout.cards.map((card) => card.badge.text).join(',') === '#1,#2,#3', `${label}: compact rank-only badges`)
        check(layout.cards.every((card) => card.badge.width <= 56), `${label}: oversized badge`)
        check(layout.cards.every((card) => !card.label || card.label.height <= 16), `${label}: wrapped button label`)
      }
      results.push({ route, width, cards: layout.cards.length, rows: rows.size, logo: layout.logo })
    }
  }
  for (const width of widths) {
    const logos = results.filter((result) => result.width === width).map((result) => JSON.stringify(result.logo))
    check(new Set(logos).size === 1, `Header typography differs between AU routes at ${width}px`)
  }
  if (failures.length) throw new Error(failures.join('\n'))
  return { passed: results.length, results }
}
