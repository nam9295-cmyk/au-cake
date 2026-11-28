// Run against a built AU preview with playwright-cli run-code --filename.
async (page) => {
  const origin = new URL(page.url()).origin
  const probe = await page.context().newPage()
  probe.setDefaultTimeout(10000)
  probe.setDefaultNavigationTimeout(15000)
  const check = (ok, message) => { if (!ok) throw Error(message) }
  const homeModule = /\/assets\/[^/]+\/index-[^/]+\.js$/
  const catalogModule = /\/AuRenewalCatalog-[^/]+\.js$/
  const isLoading = () => {
    const el = document.getElementById('au-page-loading')
    return !!el?.getBoundingClientRect().width && getComputedStyle(el).visibility === 'visible'
  }
  async function holdNextResource(pattern) {
    let release
    const gate = new Promise(resolve => { release = resolve })
    await probe.route(pattern, async route => {
      await gate
      await route.continue()
    }, { times: 1 })
    return release
  }
  const videoRequests = []
  const documentPaths = []
  probe.on('request', request => {
    if (request.url().endsWith('.mp4')) videoRequests.push(request.url())
    if (request.isNavigationRequest() && request.frame() === probe.mainFrame()) documentPaths.push(new URL(request.url()).pathname)
  })
  try {
    await probe.setViewportSize({ width: 390, height: 844 })
    await probe.emulateMedia({ reducedMotion: 'reduce' })
    // This loading check opens the evergreen cake notice, even during seasonal campaigns.
    await probe.clock.setFixedTime(new Date('2026-11-28T12:00:00+11:00'))
    const releaseHome = await holdNextResource(homeModule)
    try {
      await probe.goto(origin, { waitUntil: 'commit' })
      await probe.waitForFunction(isLoading, undefined, { polling: 50 })
      check(await probe.evaluate(() => getComputedStyle(document.querySelector('#au-page-loading > span'), '::after').animationName === 'none'), 'Reduced motion still animates the line')
    } finally { releaseHome() }
    await probe.locator('.mini-cake-launch-notice[open]').waitFor()
    check(!(await probe.evaluate(isLoading)), 'The ready home is covered')
    await probe.emulateMedia({ reducedMotion: 'no-preference' })
    await probe.locator('.mini-cake-launch-photo').first().evaluate(img => img.decode())
    check(!videoRequests.length, 'Video requested behind the launch notice')

    // Hold the destination HTML long enough to catch an outgoing overlay on the open dialog.
    await probe.evaluate(() => {
      const mark = () => {
        const el = document.getElementById('au-page-loading')
        if (el?.getBoundingClientRect().width && getComputedStyle(el).visibility === 'visible') sessionStorage.setItem('qa-outgoing-heart', '1')
      }
      new MutationObserver(mark).observe(document.documentElement, { attributes: true })
    })
    const shop = probe.locator('.mini-cake-launch-order[href*="pave-chocolate-cake"]')
    const destination = new URL(await shop.getAttribute('href'), origin)
    await probe.route(destination.href, async route => {
      await new Promise(resolve => setTimeout(resolve, 900))
      await route.continue()
    }, { times: 1 })
    const releaseCatalog = await holdNextResource(catalogModule)
    try {
      await shop.click({ noWaitAfter: true })
      await probe.waitForURL(destination.href, { waitUntil: 'domcontentloaded' })
      check(await probe.locator('#root > main h1').isVisible(), 'Static product information disappeared while options were downloading')
      check(!(await probe.locator('#au-page-loading').count()), 'Product HTML contains the heart')
      check(!(await probe.evaluate(() => sessionStorage.getItem('qa-outgoing-heart'))), 'The heart returned on the outgoing home')
    } finally { releaseCatalog() }
    await probe.locator('.au-product-detail .au-pave-size-options button').first().waitFor()
    check(documentPaths.filter(path => path === destination.pathname).length === 1, 'Product click requested more than one document')
    await probe.goBack()
    await probe.locator('.rd-hero-poster img').waitFor()
    check(!(await probe.evaluate(isLoading)), 'Back navigation is covered')

    await probe.goto(origin + '/journal')
    check(!(await probe.locator('#au-page-loading').count()), 'Journal index contains the heart')
    await probe.locator('main a[href^="/journal/"]').first().click()
    await probe.locator('article').first().waitFor()
    check(!(await probe.locator('#au-page-loading').count()), 'Journal article contains the heart')
    const releaseReturn = await holdNextResource(homeModule)
    try {
      await probe.locator('a[href="/"]').first().click({ noWaitAfter: true })
      await probe.waitForURL(origin + '/', { waitUntil: 'commit' })
      await probe.waitForFunction(() => document.body && performance.now() > 700, undefined, { polling: 50 })
      check(!(await probe.evaluate(isLoading)), 'A slow return home repeated the heart')
    } finally { releaseReturn() }
    await probe.locator('.rd-hero-poster img').waitFor()

    // A fresh context exercises a real download failure even if WebKit cached the previous module.
    const fresh = await page.context().browser().newContext({ viewport: probe.viewportSize() })
    try {
      const failed = await fresh.newPage()
      let productRequests = 0
      const almond = origin + '/chocolates/almond-chocoball'
      failed.on('request', request => {
        if (request.isNavigationRequest() && request.url() === almond) productRequests++
      })
      await failed.route(catalogModule, route => route.abort())
      await failed.goto(almond)
      const retry = failed.getByRole('button', { name: 'Page controls could not load. Try again' })
      await retry.waitFor()
      check(await failed.locator('#root > main h1').isVisible(), 'Failed options removed the product information')
      check(productRequests === 1, 'A failed download automatically reloaded the product')
      await failed.unroute(catalogModule)
      await retry.click()
      await failed.getByRole('group', { name: 'Choose your pack' }).getByRole('button').first().waitFor()
    } finally { await fresh.close() }

    // Session dismissal is per tab; "today" spans tabs and expires at Sydney midnight.
    const seasonal = await page.context().browser().newContext({ viewport: probe.viewportSize() })
    try {
      const tab = await seasonal.newPage()
      const campaignDay = new Date('2026-12-02T10:00:00+11:00')
      await tab.clock.setFixedTime(campaignDay)
      await tab.goto(origin)
      const topNotice = tab.getByRole('dialog')
      const checkFront = async (name) => {
        await topNotice.getByRole('heading', { name, exact: true }).waitFor()
        check(await topNotice.count() === 1, 'More than one dialog is exposed to assistive technology')
        check(await topNotice.evaluate(dialog => dialog.contains(document.activeElement)), 'Keyboard focus escaped the front announcement')
        check(await tab.locator('.rd-hero-photo-wrap video').count() === 0, 'Hero started while an announcement was still open')
      }
      await checkFront('4 Boxes of Almond Chocolates')
      check(await tab.locator('dialog[open][data-campaign="cakes"]').count() === 1, 'The strawberry cakes are missing from beneath the almond offer')
      await topNotice.getByRole('button', { name: "Don't show again today" }).click()
      await checkFront('Mini Whole Cakes Are Here!')
      await tab.keyboard.press('Escape')
      await topNotice.waitFor({ state: 'hidden' })
      await tab.locator('.rd-hero-photo-wrap video').waitFor({ state: 'attached' })
      await tab.reload()
      await tab.locator('.rd-hero-photo-wrap video').waitFor({ state: 'attached' })
      check(await topNotice.count() === 0, 'Dismissed notices returned in the same tab')

      const secondTab = await seasonal.newPage()
      await secondTab.clock.setFixedTime(campaignDay)
      await secondTab.goto(origin)
      const cake = secondTab.getByRole('dialog', { name: 'Mini Whole Cakes Are Here!' })
      await cake.waitFor()
      await cake.getByRole('link', { name: 'Shop Pavé' }).click()
      await secondTab.waitForURL(url => url.pathname === '/cakes/pave-chocolate-cake' && url.searchParams.get('size') === '4in')
      await tab.clock.setFixedTime(new Date('2026-12-03T00:01:00+11:00'))
      await tab.goto(origin)
      await checkFront('4 Boxes of Almond Chocolates')
      await topNotice.getByRole('link', { name: 'Shop the gift set' }).click()
      await tab.waitForURL(url => url.pathname === '/chocolates/almond-chocoball' && url.searchParams.get('offer') === 'almond-triangle-gift-4x60g')
      await tab.goto(origin)
      await checkFront('Mini Whole Cakes Are Here!')
    } finally { await seasonal.close() }
    return { slowFirstHome: true, reducedMotion: true, popupVideoDeferred: true, seasonalPopupOrder: true, product: true, back: true, journal: true, returnHome: true, retry: true }
  } finally { await probe.close() }
}
