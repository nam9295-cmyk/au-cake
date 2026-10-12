// Run through playwright-cli run-code --filename against the local AU preview.
// Start at /?qaPhase=before to preserve the failing baseline screenshots.
async (page) => {
  const url = new URL(page.url())
  const phase = url.searchParams.get('qaPhase') === 'before' ? 'before' : 'after'
  const errors = []
  const results = []
  // Exact CE0035 fixture: a compact excerpt must never replace either full text.
  const fullReview = {
    original: '나른한 일요일 오후에 최고의 선택 ㅠ 당 땡겼는데 브라우니바치케가 꾸덕하고 많이 안 달아서 좋아요',
    english: 'The best choice for a lazy Sunday afternoon ㅠ I was craving something sweet, and I like that the brownie Basque cheesecake is dense and not too sweet.',
  }
  const check = (value, message) => { if (!value) errors.push(message) }
  const inspect = async (root, rules, label) => {
    const measurements = []
    for (const [selector, minimum] of rules) {
      const elements = root.locator(selector)
      check(await elements.count() > 0, `${label}: missing ${selector}`)
      for (const element of await elements.all()) {
        if (!await element.isVisible()) continue
        const size = await element.evaluate(el => parseFloat(getComputedStyle(el).fontSize))
        check(size >= minimum, `${label}: ${selector} is ${size}px, requires >=${minimum}px`)
        measurements.push({ selector, pixels: size })
      }
    }
    return measurements
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const language of ['en', 'ko']) {
      const label = `${width}/${language}`
      await page.goto(url.origin)
      await page.evaluate(value => {
        localStorage.setItem('au-cake-language', value)
        localStorage.removeItem('vg-analytics-consent')
      }, language)
      await page.reload()
      const consent = page.getByRole('button', { name: /Essential only|필수 기능만/ })
      await consent.waitFor()
      await consent.click()
      await page.evaluate(() => document.fonts.ready)
      const home = page.locator('.au-stories-home')
      await home.scrollIntoViewIfNeeded()
      for (const image of await home.locator('img').all()) await image.evaluate(img => img.decode())
      const fonts = await inspect(home, [
        ['.au-story-product', 11], ['.au-story-source', 11],
        ['.au-story-rating small', 12], ['.au-story-translation', 12],
        ['.au-story-excerpt', 14], ['.au-story-meta', 11],
        ['.au-story-read', 12], ['footer', 12],
        ['.au-stories-carousel-controls button', 12],
      ], label)
      const row = home.locator('.au-stories-home-grid')
      await row.evaluate(el => el.scrollTo(0, 0))
      const geometry = () => row.evaluate(el => {
        const bounds = el.getBoundingClientRect()
        return [...el.children].map(card => {
          const b = card.getBoundingClientRect()
          return { left: b.left - bounds.left, right: b.right - bounds.left, width: b.width, viewport: bounds.width }
        })
      })
      const first = await geometry()
      check(first.length === 3 && Math.abs(first[0].left) < 2 && Math.abs(first[1].right - first[1].viewport) < 2,
        `${label}: initial window must show cards 1+2`)
      check(await row.evaluate(el => getComputedStyle(el).scrollSnapType.includes('mandatory')), `${label}: missing scroll snap`)
      for (const badge of await home.locator('.au-story-product, .au-story-source, .au-story-meta, .au-story-translation').all()) {
        check(await badge.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1),
          `${label}: cropped badge/metadata/translation`)
      }
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: Home overflow`)
      await home.screenshot({ path: `/tmp/au-services-qa/readability-${phase}-home-${language}-${width}.png` })
      const bounds = await row.boundingBox()
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 60)
      await page.mouse.wheel(width, 0)
      await page.waitForFunction(() => {
        const el = document.querySelector('.au-stories-home-grid')
        return Math.abs(el.scrollLeft - (el.scrollWidth - el.clientWidth)) < 2
      })
      const second = await geometry()
      check(Math.abs(second[1].left) < 2 && Math.abs(second[2].right - second[2].viewport) < 2,
        `${label}: horizontal swipe must show cards 2+3`)
      await home.screenshot({ path: `/tmp/au-services-qa/readability-${phase}-swiped-${language}-${width}.png` })
      // The compact excerpt must not replace the complete original/translation.
      await home.getByRole('button', { name: language === 'en' ? 'Read full review' : '후기 전체 보기', exact: true }).last().click()
      const dialog = page.locator('dialog[open]')
      await dialog.waitFor()
      check(await dialog.locator('.au-story-full-text').textContent() ===
        (language === 'ko' ? fullReview.original : fullReview.english), `${label}: full primary review changed`)
      check(await dialog.locator('.au-story-original p').textContent() ===
        (language === 'ko' ? fullReview.english : fullReview.original), `${label}: full original/translation changed`)
      await page.keyboard.press('Escape')
      await page.goto(url.origin + '/customer-stories/korea')
      await page.getByText(language === 'en' ? '293 matching stories' : '검색 결과 293건', { exact: true }).waitFor()
      await page.evaluate(() => document.fonts.ready)
      const archiveFonts = await inspect(page.locator('.au-stories-archive'), [
        ['.au-stories-disclosure', 14], ['.au-stories-filters > small', 14],
        ['.au-stories-stats small', 12],
        ['.au-story-source', 11], ['.au-story-rating small', 12],
        ['.au-story-translation', 12],
      ], `archive/${label}`)
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `archive/${label}: overflow`)
      await page.screenshot({ path: `/tmp/au-services-qa/readability-${phase}-archive-${language}-${width}.png` })
      await page.locator('.au-stories-filters').evaluate(el => el.scrollIntoView({ block: 'center' }))
      await page.locator('.au-stories-filters').screenshot({
        path: `/tmp/au-services-qa/readability-${phase}-archive-filters-${language}-${width}.png`,
      })
      await page.locator('.au-stories-archive-grid article').first().evaluate(el => el.scrollIntoView({ block: 'center' }))
      await page.locator('.au-stories-archive-grid article').first().screenshot({
        path: `/tmp/au-services-qa/readability-${phase}-archive-card-${language}-${width}.png`,
      })
      results.push({ width, language, fonts, archiveFonts, twoCardWindows: ['1+2', '2+3'] })
    }
  }
  if (errors.length) throw Error(JSON.stringify({ errors, results }))
  return { phase, results, errors }
}
