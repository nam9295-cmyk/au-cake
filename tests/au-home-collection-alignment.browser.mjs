// Open the local AU demo Home in Playwright CLI, then run:
// playwright-cli -s=au-collection run-code --filename tests/au-home-collection-alignment.browser.mjs
// Only category tabs are clicked. No product/cart/checkout interaction.
async (page) => {
  const origin = await page.evaluate(() => location.origin)
  await page.goto(`${origin}/`)
  const navigation = page.getByRole('navigation', { name: 'Collection categories' })
  await navigation.waitFor()
  const tabs = await navigation.getByRole('button').allTextContents()
  const failures = []
  const results = []
  const check = (condition, message) => { if (!condition) failures.push(message) }
  const aligned = (values) => Math.max(...values) - Math.min(...values) <= 1

  for (const width of [1440, 1280, 1101, 1100, 900, 800, 769, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const [index, tab] of tabs.entries()) {
      await navigation.getByRole('button').nth(index).click()
      await page.evaluate(async () => {
        await document.fonts.ready
        for (const image of document.querySelectorAll('.rd-collection-main img')) {
          image.scrollIntoView()
          await new Promise(requestAnimationFrame)
          await image.decode()
        }
        document.querySelector('.rd-collection-grid').scrollLeft = 0
      })
      const layout = await page.evaluate(() => {
        const rect = (element) => {
          const box = element.getBoundingClientRect()
          return { top: box.top + scrollY, bottom: box.bottom + scrollY, left: box.left, right: box.right, width: box.width, height: box.height }
        }
        const ink = (element) => {
          const range = document.createRange()
          range.selectNodeContents(element)
          return rect(range)
        }
        const grid = document.querySelector('.rd-collection-grid')
        return { grid: rect(grid), swipe: getComputedStyle(grid).overflowX === 'auto',
          cards: [...grid.querySelectorAll('.rd-product-card')].map((card) => ({
            box: rect(card), link: rect(card.querySelector('a')), name: ink(card.querySelector('h3')),
            meta: ink(card.querySelector('p')), photo: rect(card.querySelector('.rd-product-photo-wrap')),
            price: ink(card.querySelector('.rd-product-price-row')), priceRow: rect(card.querySelector('.rd-product-price-row')),
            imageFit: getComputedStyle(card.querySelector('img')).objectFit,
          })) }
      })
      const label = `${tab.trim()} @ ${width}px`
      check(layout.cards.length === Number(tab.match(/\[(\d+)\]/)[1]), `${label}: tab count does not match cards`)
      check(aligned(layout.cards.map((card) => card.box.height)), `${label}: card heights differ`)
      check(aligned(layout.cards.map((card) => card.photo.height)), `${label}: image heights differ`)
      check(aligned(layout.cards.map((card) => card.photo.top - card.box.top)), `${label}: image offsets differ`)
      check(aligned(layout.cards.map((card) => card.price.bottom - card.box.top)), `${label}: price baselines differ`)
      check(aligned(layout.cards.map((card) => card.priceRow.height)), `${label}: price row heights differ`)

      const rows = new Map()
      for (const card of layout.cards) {
        const row = Math.round(card.box.top)
        if (!rows.has(row)) rows.set(row, [])
        rows.get(row).push(card)
        check(card.name.bottom <= card.meta.top + 1, `${label}: title overlaps description`)
        check(card.meta.bottom <= card.photo.top + 1, `${label}: description overlaps photo`)
        check(card.photo.bottom <= card.price.top + 1, `${label}: photo overlaps price`)
        check(card.price.bottom <= card.box.bottom - 8, `${label}: missing space below price`)
        for (const text of [card.name, card.meta, card.price]) {
          check(text.left >= card.link.left - 1 && text.right <= card.link.right + 1, `${label}: text escapes the card`)
        }
        check(card.imageFit === 'contain', `${label}: image ratio/crop is not preserved`)
        if (!layout.swipe) check(card.box.left >= layout.grid.left - 1 && card.box.right <= layout.grid.right + 1, `${label}: card clipped by grid`)
      }
      for (const row of rows.values()) {
        check(aligned(row.map((card) => card.photo.top)), `${label}: image tops are not aligned`)
        check(aligned(row.map((card) => card.price.bottom)), `${label}: price baselines are not aligned`)
      }
      results.push({ tab: tab.trim(), width, cards: layout.cards.length, rows: rows.size, swipe: layout.swipe })
    }
  }
  if (failures.length) throw new Error([...new Set(failures)].join('\n'))
  return { passed: results.length, results }
}
