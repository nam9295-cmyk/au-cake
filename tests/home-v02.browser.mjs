// Playwright CLI run-code --filename; local browser only, never submits requests.
async (page) => {
  const origin = new URL(page.url()).origin
  const check = (value, message) => {
    if (!value) throw Error(message)
  }
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const baseline = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('home-v02-custom-baseline') || 'null'),
  )
  await page.evaluate(() => localStorage.setItem('au-cake-language', 'en'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const results = []
  for (const width of [1440, 1024, 834, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(origin + '/')
    const consent = page.getByRole('button', {
      name: 'Essential only',
      exact: true,
    })
    if (await consent.isVisible()) await consent.click()
    await page.evaluate(() => document.fonts.ready)
    check(
      (await page.locator('h1').textContent()) ===
        'CHOCOLATE, CAKES & CELEBRATIONS.',
      `${width}: headline`,
    )
    check(
      (await page.locator('[data-home-product]').count()) === 4,
      `${width}: default category`,
    )
    check(await page.locator('.au-v02-actions .au-v02-bag').evaluate(el => getComputedStyle(el).color) === 'rgb(255, 255, 255)', `${width}: Bag contrast`)
    const storyStyle = await page.locator('#home-stories-title').evaluate(el => ({weight:getComputedStyle(el).fontWeight,margin:getComputedStyle(el).marginBottom}))
    check(storyStyle.weight === '600' && storyStyle.margin === '16px', `${width}: unchanged Stories heading styles`)
    check(await page.locator('.au-stories-home .au-stories-eyebrow').evaluate(el => getComputedStyle(el).marginBottom) === '16px', `${width}: unchanged Stories eyebrow spacing`)
    for (const [name, ids] of [
      [
        'WHOLE CAKES',
        [
          'pave',
          'signature-gateau',
          'fresh-strawberry-vanilla-cream',
          'brownie-cheesecake',
        ],
      ],
      [
        'SHARING / CELEBRATION',
        ['cupcake', 'fresh-lemon-cupcakes', 'bento-cake'],
      ],
      [
        'CHOCOLATES',
        [
          'almond-chocoball',
          'pave-chocolate',
          'eiffel-tower-chocolate',
          'smore-stick',
        ],
      ],
    ]) {
      await page
        .getByRole('tab', { name: new RegExp('^' + name.replace('/', '\\/')) })
        .click()
      check(
        JSON.stringify(
          await page
            .locator('[data-home-product]')
            .evaluateAll((nodes) => nodes.map((n) => n.dataset.homeProduct)),
        ) === JSON.stringify(ids),
        `${width}: ${name} membership/order`,
      )
      for (const image of await page.locator('.au-v02-product img').all()) {
        await image.scrollIntoViewIfNeeded()
        await image.evaluate((img) => img.decode())
      }
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width}: document overflow`,
      )
      if (width <= 390)
        check(
          (await page
            .locator('.au-v02-product-grid')
            .evaluate(
              (el) =>
                getComputedStyle(el).gridTemplateColumns.split(' ').length,
            )) === 2,
          `${width}: two-column products`,
        )
      if (name === 'CHOCOLATES')
        check(
          (await page
            .locator('[data-home-product="smore-stick"] a')
            .getAttribute('href')) === '/cakes/smore-stick',
          'S’more route',
        )
      if (name.startsWith('SHARING'))
        check(
          (await page.locator('[data-home-product="bento-cake"] a').count()) ===
            0,
          'Bento must not link to an order',
        )
    }
    await page.getByRole('tab', { name: /^WHOLE CAKES/ }).click()
    await page.getByRole('tab', { name: /^WHOLE CAKES/ }).press('ArrowRight')
    check(
      (await page
        .getByRole('tab', { name: /^SHARING/ })
        .getAttribute('aria-selected')) === 'true',
      'Keyboard tabs',
    )
    await page.getByRole('tab', { name: /^SHARING/ }).press('Home')
    const best = page.locator('.au-v02-best-track')
    await best.scrollIntoViewIfNeeded()
    if (width <= 390) {
      const geometry = await best.evaluate((el) => {
        const b = el.getBoundingClientRect()
        return [...el.children].map((n) => {
          const r = n.getBoundingClientRect()
          return {
            left: r.left - b.left,
            right: r.right - b.left,
            width: r.width,
            viewport: b.width,
          }
        })
      })
      check(
        geometry[0].width / geometry[0].viewport > 0.79 &&
          geometry[0].width / geometry[0].viewport < 0.87,
        'Large Best card width',
      )
      check(
        geometry[1].left < geometry[1].viewport &&
          geometry[1].right > geometry[1].viewport,
        'Next Best card peek',
      )
      await best.focus()
      await best.press('ArrowRight')
      await page.waitForFunction(
        () => document.querySelector('.au-v02-best-track').scrollLeft > 150,
      )
      await best.press('ArrowRight')
      await page.waitForFunction(() => {
        const el = document.querySelector('.au-v02-best-track')
        const endGap = el.getBoundingClientRect().right - el.lastElementChild.getBoundingClientRect().right
        return endGap >= -1 && endGap <= 18
      })
      await page.waitForFunction(() => document.querySelector('.au-v02-best-indicators button:last-child').getAttribute('aria-pressed') === 'true')
      check(
        (await page
          .locator('.au-v02-best-indicators button')
          .last()
          .getAttribute('aria-pressed')) === 'true',
        'Best last indicator',
      )
      await best.evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }))
      const b = await best.boundingBox()
      await page.mouse.move(b.x + b.width / 2, b.y + 100)
      await page.mouse.wheel(geometry[0].width + 14, 0)
      await page.waitForFunction(
        () => document.querySelector('.au-v02-best-track').scrollLeft > 150,
      )
      await best.screenshot({
        path: `/tmp/au-home-v02.ozxCWo/best-swiped-${width}.png`,
      })
      await best.evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }))
      const stories = page.locator('.au-stories-home-grid')
      await stories.scrollIntoViewIfNeeded()
      const before = await stories.evaluate((el) => {
        const b = el.getBoundingClientRect(),
          r = el.children[1].getBoundingClientRect()
        return Math.abs(r.right - b.right) < 2
      })
      check(before, 'Stories initial two cards')
      const s = await stories.boundingBox()
      await page.mouse.move(s.x + s.width / 2, s.y + 70)
      await page.mouse.wheel(width, 0)
      await page.waitForFunction(() => {
        const el = document.querySelector('.au-stories-home-grid')
        return Math.abs(el.scrollWidth - el.clientWidth - el.scrollLeft) < 3
      })
      await stories.evaluate((el) => el.scrollTo(0, 0))
      check(
        (await page
          .locator('.au-story-excerpt')
          .first()
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) >= 14,
        'Stories font retained',
      )
    }
    // Decode lazy images by scrolling them into view before full-page evidence.
    for (const image of await page.locator('.au-home-v02 img').all()) {
      await image.scrollIntoViewIfNeeded()
      await image.evaluate((img) => img.decode())
    }
    // Image inspection can scroll their containing carousels as well as the page.
    await page.locator('.au-v02-best-track, .au-stories-home-grid').evaluateAll(nodes => nodes.forEach(el => el.scrollTo({left: 0, behavior: 'instant'})))
    await page.waitForFunction(() => [...document.querySelectorAll('.au-v02-best-track, .au-stories-home-grid')].every(el => el.scrollLeft < 3))
    await page.locator('.au-v02-best-track').evaluate(el => el.blur())
    await page.mouse.move(0, 0)
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({
      path: `/tmp/au-home-v02.ozxCWo/home-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    })
    await page.evaluate(() => scrollTo(0, 1000))
    check(
      await page
        .locator('.au-v02-header')
        .evaluate((el) => Math.abs(el.getBoundingClientRect().top) < 2),
      `${width}: sticky header`,
    )
    await page.evaluate(() => scrollTo(0, 0))
    if (width < 1100) {
      const open = page.getByRole('button', { name: 'Open menu', exact: true })
      await open.click()
      check(
        await page.locator('#au-v02-menu').evaluate((el) => el.open),
        'Menu opens',
      )
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press('Tab')
        check(
          await page.evaluate(
            () => !!document.activeElement.closest('#au-v02-menu'),
          ),
          'Focus trapped in menu',
        )
      }
      await page.screenshot({
        path: `/tmp/au-home-v02.ozxCWo/menu-${width}.png`,
      })
      await page.keyboard.press('Escape')
      check(
        await open.evaluate((el) => el === document.activeElement),
        'ESC restores focus',
      )
      await open.click()
      await page
        .getByRole('button', { name: 'Close menu', exact: true })
        .click()
      if (width === 834) {
        await open.click()
        await page.mouse.click(40, 300)
        check(
          await page.locator('#au-v02-menu').evaluate((el) => !el.open),
          'Backdrop closes',
        )
      }
    }
    const headerLinks = await page
      .locator('.au-v02-primary a')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href')))
    check(
      JSON.stringify(headerLinks) ===
        JSON.stringify([
          '/#story',
          '/#au-collection',
          '/cakes/custom-cake',
          '/#business',
        ]),
      'Header links',
    )
    results.push({
      width,
      overflow: false,
      categories: [4, 3, 4],
      best: width <= 390 ? 'one + peek + swipe' : '3 columns',
      images: 'decoded',
    })
  }
  // Cross-page Home anchor, language persistence, and header consistency.
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(origin + '/cakes')
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('link', { name: 'OUR STORY', exact: true })
    .click()
  await page.locator('#story').waitFor()
  await page.waitForFunction(() => {
    const heading = document.querySelector('#au-story-title').getBoundingClientRect()
    const header = document.querySelector('.au-v02-header').getBoundingClientRect()
    return heading.top >= header.bottom && heading.bottom < innerHeight
  })
  await page
    .locator('.au-v02-actions')
    .getByRole('button', { name: '한국어', exact: true })
    .click()
  check(
    (await page.locator('h1').textContent()).includes('초콜릿'),
    'Korean headline',
  )
  await page.goto(origin + '/chocolates')
  check(
    (await page
      .getByRole('navigation', { name: 'Main navigation', exact: true })
      .getByRole('link', { name: '메뉴', exact: true })
      .count()) === 1,
    'Internal Korean navigation',
  )
  await page
    .locator('.au-v02-actions')
    .getByRole('button', { name: 'EN', exact: true })
    .click()
  if (baseline)
    for (const previous of baseline) {
      await page.setViewportSize({ width: previous.width, height: 1000 })
      await page.goto(origin + '/cakes/custom-cake')
      await page.locator('.custom-cake-detail-page').waitFor()
      await page.evaluate(() => document.fonts.ready)
      const current = await page
        .locator('.custom-cake-detail-page')
        .evaluate((root) => {
          const copy = root.cloneNode(true)
          copy.querySelector('.au-redesign-header')?.remove()
          return {
            html: copy.innerHTML.replace(/_r_[a-z0-9]+_/g, '_REACT_ID_'),
            metrics: [
              ...root.querySelectorAll('h1,h2,fieldset,input,textarea,img'),
            ]
              .filter((el) => !el.closest('.au-redesign-header'))
              .map((el) => {
                const b = el.getBoundingClientRect(),
                  s = getComputedStyle(el)
                return {
                  tag: el.tagName,
                  text: el.textContent,
                  width: b.width,
                  height: b.height,
                  font: s.fontFamily,
                  fontSize: s.fontSize,
                  color: s.color,
                  display: s.display,
                }
              }),
          }
        })
      check(
        JSON.stringify(previous.snapshot) === JSON.stringify(current),
        `Custom Cake DOM/metrics changed at ${previous.width}`,
      )
    }
  check(errors.length === 0, `JS errors: ${errors.join('; ')}`)
  await page.goto(origin + '/')
  return { results, customBaselineIdentical: !!baseline, pageErrors: errors }
}
