// Run with playwright-cli run-code --filename on the local AU preview.
async (page) => {
  const origin = new URL(page.url()).origin
  await page.evaluate(() => localStorage.removeItem('verygood-au-cake-cart-v1'))
  const results = []
  const requests = []
  page.on('request', request => requests.push(request.url()))
  const check = (value, message) => { if (!value) throw Error(message) }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const switchLanguage = async (language) => {
    const control = page.locator('.au-language-control:visible')
    check(await control.count() === 1, 'Exactly one visible header language control')
    const group = control.locator('.au-language-options')
    if (await group.isVisible()) await group.getByRole('button', { name: language === 'ko' ? '한국어' : 'EN', exact: true }).click()
    else if (await page.evaluate(() => document.documentElement.lang.startsWith('ko')) !== (language === 'ko')) await control.locator('.au-language-compact').click()
    await page.waitForFunction(want => document.documentElement.lang.startsWith(want), language === 'ko' ? 'ko' : 'en')
    check(await page.evaluate(() => localStorage.getItem('au-cake-language')) === language, 'Language must persist in existing storage')
  }
  for (const width of [1440, 1024, 834, 769, 768, 767, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const path of ['/', '/cakes', '/cakes/custom-cake']) {
      await page.goto(origin + path)
      const consent = page.getByRole('button', { name: /Essential only|필수.*허용/ })
      if (await consent.isVisible()) await consent.click()
      for (const language of ['en', 'ko']) {
        await switchLanguage(language)
        if (width <= 768) {
          const target = await page.locator('.au-language-control:visible .au-language-compact').boundingBox()
          check(target.width >= 44 && target.height >= 44, 'Mobile language target must be at least 44px')
        }
        await page.evaluate(() => document.fonts.ready)
        const header = page.locator(path === '/' ? '.rd-header' : '.au-redesign-header')
        const geometry = await header.evaluate(root => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          controls: [...root.querySelectorAll('a,button,summary')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').map(el => {
            const b = el.getBoundingClientRect()
            return { text: el.textContent, left: b.left, right: b.right, top: b.top, bottom: b.bottom }
          }),
        }))
        check(!geometry.overflow, `${path}/${width}/${language}: page overflow`)
        check(geometry.controls.every(b => b.left >= 0 && b.right <= width + 1), `${path}/${width}/${language}: clipped control ${JSON.stringify(geometry.controls)}`)
        for (let i = 0; i < geometry.controls.length; i++) for (let j = i + 1; j < geometry.controls.length; j++) {
          const a = geometry.controls[i], b = geometry.controls[j]
          check(!(a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1), `${path}/${width}: overlapping ${a.text}/${b.text}`)
        }
        await page.evaluate(() => scrollTo(0, 0))
        if (width === 1440 || width <= 390) await page.screenshot({ path: `/tmp/au-services-qa/language-${path === '/' ? 'home' : path.endsWith('custom-cake') ? 'custom' : 'cakes'}-${language}-${width}.png` })
      }
      await page.reload()
      await page.waitForFunction(() => document.documentElement.lang === 'ko')
      if (path === '/') {
        check((await page.locator('.rd-hero-copy').innerText()).includes('시드니'), 'Home copy follows Korean')
        check(!requests.some(url => url.endsWith('/customer-stories/korea.json')), 'Home must not load the full archive')
      }
      results.push({ width, path, controlsVisible: true, noOverflow: true, storedLanguage: 'ko' })
    }
  }
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const [path, heading] of [
      ['/business/events', '함께 나누는 자리를 위한 디저트.'],
      ['/business/cafe-supply', '카페를 위한 디저트 컬렉션.'],
      ['/business/consulting', '메뉴에서 시작되는 고객 경험.'],
      ['/customer-stories/korea', '한국에서 전해온 고객의 이야기.'],
      ['/chocolates', '초콜릿 [4]'],
    ]) {
      await page.goto(origin + path)
      await page.getByRole('heading', { name: heading, exact: true }).waitFor()
      await page.evaluate(() => document.fonts.ready)
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path}/${width}: Korean content overflow`)
      if (path === '/customer-stories/korea') {
        await page.getByText('검색 결과 293건', { exact: true }).waitFor()
        await page.getByLabel('후기 검색', { exact: true }).fill('Sunday')
        check(await page.locator('.au-stories-archive-grid article').count() > 0, 'Korean UI keeps bilingual search')
        await page.getByRole('button', { name: '전체 후기 (293)', exact: true }).click()
        await page.getByLabel('후기 검색', { exact: true }).fill('파베초콜릿케이크 ㅈㅁ')
        await page.locator('[data-story-id="R0035"]').waitFor()
        await page.getByRole('button', { name: '후기 전체 보기', exact: true }).first().click()
        const dialog = page.locator('dialog[open]')
        await dialog.waitFor()
        check(await dialog.locator('.au-story-full-text').getAttribute('lang') === 'ko', 'Dialog shows Korean original first')
        check(await dialog.locator('.au-story-original p').getAttribute('lang') === 'en', 'English translation is still available')
        await page.keyboard.press('Escape')
        check(await page.locator('dialog[open]').count() === 0, 'Korean dialog Escape')
      }
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({ path: `/tmp/au-services-qa/language-${path.split('/').at(-1)}-ko-${width}.png` })
    }
  }
  // Language changes must not reset an in-progress product selection or cart.
  // Only local cart state is written; no reservation is submitted.
  await page.setViewportSize({ width: 390, height: 1000 })
  await page.goto(origin + '/cakes/pave-chocolate-cake')
  await switchLanguage('en')
  await page.getByRole('button', { name: /^8″ serves/ }).click()
  await page.getByRole('button', { name: 'Increase quantity', exact: true }).click()
  await switchLanguage('ko')
  check(await page.getByRole('button', { name: /^8″ serves/ }).getAttribute('aria-pressed') === 'true', 'Language switch reset cake size')
  await page.getByRole('button', { name: 'ADD TO ORDER — AUD 218.00', exact: true }).first().click()
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('verygood-au-cake-cart-v1')))
  const selection = cart.lines[0]
  check(selection.productId === 'pave-cake' && selection.cakeSize === '8in' && selection.quantity === 2, 'Language switch changed cart handoff')
  await page.goto(origin + '/cart')
  await page.locator('h1').waitFor()
  check(await page.evaluate(() => localStorage.getItem('au-cake-language')) === 'ko', 'Cart navigation lost language')
  await page.evaluate(() => localStorage.removeItem('verygood-au-cake-cart-v1'))
  await page.goto(origin + '/')
  await switchLanguage('en')
  return { headerChecks: results, localizedServiceAndArchiveChecks: 15, selectionAndCartPreserved: true }
}
