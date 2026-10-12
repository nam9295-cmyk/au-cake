// Playwright CLI run-code --filename. Local UI only; no orders or enquiries submitted.
async (page) => {
  const origin = new URL(page.url()).origin
  const check = (value, message) => { if (!value) throw Error(message) }
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const results = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [1440, 834, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(origin + '/portfolio')
    const consent = page.getByRole('button', { name: 'Essential only', exact: true })
    if (await consent.isVisible()) await consent.click()
    await page.evaluate(() => document.fonts.ready)
    const main = page.locator('.company-portfolio')
    check(await main.locator('h1').textContent() === 'FIND YOUR SWEET MOMENT.', 'Portfolio headline')
    check(await main.locator('img').count() === 10, 'Source photograph count')
    for (const image of await main.locator('img').all()) {
      await image.scrollIntoViewIfNeeded()
      await image.evaluate(el => el.decode())
    }
    const buttons = await main.locator('a').evaluateAll(links => links.map(el => ({text:el.textContent, height:el.getBoundingClientRect().height,href:el.getAttribute('href')})))
    check(buttons.every(button => button.height >= 44), `${width}: link target height`)
    check(buttons.filter(button => button.href === 'https://www.instagram.com/verygood_syd/').length === 5, 'Instagram enquiry routes')
    check(await page.locator('#vg-chat-launcher').isVisible(), 'Existing chat entry')
    for (const link of await main.locator('.portfolio-action').all()) {
      await link.evaluate(el => el.scrollIntoView({block:'center',behavior:'instant'}))
      check(await link.evaluate(el => {
        const box=el.getBoundingClientRect()
        return el.contains(document.elementFromPoint(box.left+box.width/2,box.top+box.height/2))
      }), `${width}: chat/header covers an action's hit target`)
    }
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: horizontal overflow`)
    await page.evaluate(() => { window.scrollTo(0,0); document.activeElement?.blur() })
    await page.screenshot({path:`/tmp/au-portfolio-v03/portfolio-${width}.png`,fullPage:true})
    await page.locator('.portfolio-page-inner').screenshot({path:`/tmp/au-portfolio-v03/content-${width}.png`,style:'.au-v02-header { visibility: hidden !important; }'})
    for (const id of ['sharing','individual-packs','custom-cakes','business']) {
      await main.locator(`.portfolio-choices a[href="#${id}"]`).click()
      await page.waitForFunction(id => document.activeElement?.id === id, id)
      check(await main.locator(`#${id}`).evaluate(el => el.getBoundingClientRect().top >= 60), `${id}: header obscures anchor`)
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    for (const id of ['wholesale','consulting']) {
      await page.goto(origin + '/portfolio#' + id)
      await page.waitForFunction(id => document.activeElement?.id === id, id)
      check(await page.locator('#business').evaluate(el => getComputedStyle(el).opacity) === '1', `${id}: legacy anchor hidden by reveal`)
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(origin + '/portfolio')
    if (width <= 390) {
      const heroEnd = await page.locator('.portfolio-hero-copy .portfolio-actions').evaluate(el => el.getBoundingClientRect().bottom)
      check(heroEnd < 844, `${width}: initial shopping actions below compact first viewport`)
    }
    results.push({width,images:10,allLinksAtLeast44px:true,overflow:false,legacyAnchors:true})
  }
  await page.locator('.portfolio-hero-copy').getByRole('link',{name:'Shop cakes & treats',exact:true}).click()
  await page.waitForURL('**/cakes')
  await page.goto(origin + '/portfolio')
  await page.locator('.portfolio-hero-copy').getByRole('link',{name:'Explore chocolates',exact:true}).click()
  await page.waitForURL('**/chocolates')
  await page.goto(origin + '/portfolio')
  await page.locator('#custom-cakes').getByRole('link',{name:'Explore custom cakes',exact:true}).click()
  await page.waitForURL('**/cakes/custom-cake')
  await page.locator('.custom-cake-detail-page').waitFor()
  check(errors.length === 0, errors.join('\n'))
  await page.goto(origin + '/portfolio')
  return {results,shoppingLinks:true,customCakeEntry:true,pageErrors:errors,submitted:false}
}
