// Run locally through playwright-cli run-code --filename.
async (page) => {
  const origin = 'http://127.0.0.1:5184'
  const check = (condition, message) => {
    if (!condition) throw Error(message)
  }
  const errors = []
  const requests = []
  const results = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => requests.push(request.url()))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const dismiss = async () => {
    const button = page.getByRole('button', {
      name: 'Essential only',
      exact: true,
    })
    if (await button.isVisible()) await button.click()
  }
  const loadImages = async (root) => {
    for (const image of await root.locator('img').all()) {
      await image.scrollIntoViewIfNeeded()
      await image.evaluate((img) => img.decode())
    }
  }
  for (const width of [1440, 834, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(origin + '/')
    await dismiss()
    await page.evaluate(() => document.fonts.ready)
    const home = page.locator('.au-stories-home')
    await loadImages(home)
    await home.scrollIntoViewIfNeeded()
    check(
      (await home.locator('article').count()) === 3,
      'home must have three stories',
    )
    check(
      !requests.some((url) => url.endsWith('/customer-stories/korea.json')) ||
        width !== 1440,
      'home fetched archive',
    )
    if (width <= 390) {
      await home
        .locator('.au-stories-home-grid')
        .evaluate((row) => row.scrollTo(0, 0))
      await home.getByRole('button', { name: /SWIPE TO EXPLORE/ }).waitFor()
      const geometry = await home
        .locator('.au-stories-home-grid')
        .evaluate((row) => ({
          width: row.clientWidth,
          card: row.firstElementChild.getBoundingClientRect().width,
          gap: parseFloat(getComputedStyle(row).gap),
        }))
      check(
        Math.abs(geometry.card * 2 + geometry.gap - geometry.width) < 2,
        'two cards must fit mobile',
      )
      await home.getByRole('button', { name: /SWIPE TO EXPLORE/ }).click()
      check(
        (await home
          .locator('.au-stories-home-grid')
          .evaluate((row) => row.scrollLeft)) > 20,
        'carousel does not scroll',
      )
      await home
        .locator('.au-stories-home-grid')
        .evaluate((row) => row.scrollTo(0, 0))
    }
    await home.screenshot({
      path: `/tmp/au-services-qa/home-stories-${width}.png`,
    })
    await home
      .getByRole('button', { name: 'Read full review', exact: true })
      .first()
      .click()
    await page.locator('dialog[open]').waitFor()
    check(
      await page
        .locator('dialog')
        .innerText()
        .then((text) => text.includes('파베초콜릿케이크')),
      'full Korean original missing',
    )
    await page.getByRole('button', { name: 'Next photo', exact: true }).click()
    await page.screenshot({
      path: `/tmp/au-services-qa/story-modal-${width}.png`,
    })
    await page.keyboard.press('Escape')
    check(
      (await page.locator('dialog[open]').count()) === 0,
      'ESC did not close',
    )
    check(
      await page.evaluate(() =>
        document.activeElement?.textContent?.includes('Read full review'),
      ),
      'focus not returned',
    )
    for (const slug of ['events', 'cafe-supply', 'consulting']) {
      await page.goto(origin + '/business/' + slug)
      await page.locator('.au-business').waitFor()
      await page.evaluate(() => document.fonts.ready)
      const main = page.locator('.au-business')
      await loadImages(main)
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${slug}/${width} overflow`,
      )
      check(
        await main
          .locator('img')
          .evaluateAll((images) =>
            images.every((img) => img.complete && img.naturalWidth > 0),
          ),
        `${slug} broken images`,
      )
      const sequence = await main
        .locator('img')
        .evaluateAll((images) => images.map((img) => img.getAttribute('src')))
      const previous = results.find((result) => result.slug === slug)
      if (previous)
        check(
          JSON.stringify(previous.sequence) === JSON.stringify(sequence),
          'desktop/mobile asset order drift',
        )
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({
        path: `/tmp/au-services-qa/${slug}-${width}.png`,
        fullPage: true,
      })
      await page.screenshot({
        path: `/tmp/au-services-qa/${slug}-${width}-hero.png`,
      })
      check(
        (await main.locator('#enquire a').getAttribute('href')) ===
          'https://www.instagram.com/verygood_syd/',
        'unconfirmed enquiry destination',
      )
      results.push({ slug, width, sequence, overflow: false })
    }
    await page.goto(origin + '/customer-stories/korea')
    await page.getByText('293 matching stories', { exact: true }).waitFor()
    check(
      (await page.locator('.au-stories-archive-grid article').count()) === 12,
      'archive initial count',
    )
    await page.getByRole('button', { name: /LOAD MORE STORIES/ }).click()
    check(
      (await page.locator('.au-stories-archive-grid article').count()) === 24,
      'load more failed',
    )
    await page
      .getByRole('button', { name: 'Baemin (114)', exact: true })
      .click()
    await page.getByText('114 matching stories', { exact: true }).waitFor()
    await page
      .getByRole('button', { name: 'With Photos (215)', exact: true })
      .click()
    await page.getByText('78 matching stories', { exact: true }).waitFor()
    await page
      .getByRole('button', { name: 'All Stories (293)', exact: true })
      .click()
    await page.getByLabel('Search reviews', { exact: true }).fill('Sunday')
    check(
      (await page.locator('.au-stories-archive-grid article').count()) > 0,
      'search missing results',
    )
    await page
      .getByLabel('Search reviews', { exact: true })
      .fill('zzzz-no-result')
    await page.getByText('0 matching stories', { exact: true }).waitFor()
    await page
      .getByRole('button', { name: 'All Stories (293)', exact: true })
      .click()
    await page
      .getByLabel('Product mentioned', { exact: true })
      .selectOption('cupcake')
    check(
      (await page.locator('.au-stories-archive-grid article').count()) > 0,
      'product filter empty',
    )
    await page
      .getByRole('button', { name: 'All Stories (293)', exact: true })
      .click()
    await loadImages(page.locator('.au-stories-archive-grid'))
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'archive overflow',
    )
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({
      path: `/tmp/au-services-qa/archive-${width}.png`,
      fullPage: true,
    })
    await page.screenshot({
      path: `/tmp/au-services-qa/archive-${width}-hero.png`,
    })
    if (width === 390) {
      await page
        .locator('.au-stories-archive-grid .au-story-photo')
        .first()
        .click()
      await page.locator('dialog[open]').waitFor()
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab')
        check(
          await page.evaluate(() =>
            Boolean(document.activeElement?.closest('dialog')),
          ),
          'dialog focus escaped',
        )
      }
      await page.keyboard.press('Escape')
    }
  }
  check(!errors.length, `page errors: ${errors}`)
  return {
    results,
    pageErrors: errors,
    archiveRequests: requests.filter((url) =>
      url.endsWith('/customer-stories/korea.json'),
    ).length,
  }
}
