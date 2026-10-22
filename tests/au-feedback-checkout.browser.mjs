// Run against the isolated AU build with playwright-cli run-code --filename.
// VITE_APPWRITE_ENDPOINT must point to <origin>/test-appwrite/v1; account flags stay off.
async (page) => {
  const check = (condition, message) => { if (!condition) throw Error(message) }
  const current = new URL(page.url() === 'about:blank' ? 'http://127.0.0.1:4173' : page.url())
  check(current.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(current.hostname), 'Only a local HTTP build is allowed')
  const origin = current.origin
  const errors = [], submissions = [], blockedExternal = [], unexpectedActions = [], unexpectedWrites = [], results = []
  let failOrder = true
  page.on('pageerror', error => errors.push(error.message))
  await page.unroute('**/*')
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) {
      blockedExternal.push(request.url())
      return request.resourceType() === 'stylesheet'
        ? route.fulfill({ contentType: 'text/css', body: '' })
        : route.abort()
    }
    const respond = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (!url.pathname.startsWith('/test-appwrite/v1/')) {
      if (!['GET', 'HEAD'].includes(request.method())) {
        unexpectedWrites.push(`${request.method()} ${url.pathname}`)
        return route.abort()
      }
      return route.continue()
    }
    if (/\/functions\/[^/]+\/executions$/.test(url.pathname)) {
      const envelope = JSON.parse(request.postDataJSON().body)
      const { action, data } = envelope
      if (action === 'renewal-health') return respond({ responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: {
        contractVersion: 'au-renewal.2026-10.v2', pickupPolicyVersion: 'au-renewal-pickup.2026-10-14.v2',
        enabled: true, preordersEnabled: false, weekendApproved: true,
      } }) })
      if (action === 'create-cake') {
        submissions.push(envelope)
        if (failOrder) return respond({ responseStatusCode: 503, responseBody: '{"ok":false,"code":"SERVICE_UNAVAILABLE"}' })
        return respond({ responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: {
          ...projections['1'], pickupDate: data.pickupDate, pickupTime: data.pickupTime,
        } }) })
      }
      unexpectedActions.push(action)
      return respond({ responseStatusCode: 400, responseBody: '{"ok":false,"code":"UNEXPECTED_LOCAL_ACTION"}' })
    }
    if (request.method() === 'GET' && /\/settings\/documents$/.test(url.pathname)) {
      return respond({ total: 1, documents: [{
        $id: 'local-settings', bankName: 'BSB 000111', bankAccount: 'Account 222333', accountHolder: 'LOCAL TEST STORE',
      }] })
    }
    unexpectedActions.push(`${request.method()} ${url.pathname}`)
    return respond({ code: 404, message: 'Local-only test endpoint' }, 404)
  })
  // This request is explicitly local and cannot follow a redirect to production.
  const fixture = await page.request.get(`${origin}/tests/fixtures/customer-account/renewal-browser-projections.json`, { maxRedirects: 0 })
  check(fixture.status() === 200, 'Local renewal projection fixture is unavailable')
  const projections = await fixture.json()
  await page.clock.setFixedTime(new Date('2026-10-22T01:00:00Z'))
  await page.addInitScript(() => { localStorage.setItem('au-cake-language', 'en') })
  await page.emulateMedia({ reducedMotion: 'reduce' })

  async function dismissConsent() {
    const button = page.getByRole('button', { name: 'Essential only', exact: true })
    if (await button.isVisible()) await button.click()
  }
  async function noOverflow(label) {
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: horizontal page overflow`)
  }
  async function paymentNotice(root) {
    const notice = root.locator('.renewal-payment-notice')
    await notice.getByText('BSB 000111 Account 222333', { exact: true }).waitFor()
    const text = await notice.innerText()
    for (const expected of ['No payment is taken now', 'wait for our instructions before transferring', 'confirmed once payment is received', 'LOCAL TEST STORE']) {
      check(text.includes(expected), `Missing payment guidance: ${expected}`)
    }
    check(!/PayID|Payment amount/.test(text), 'Payment notice invents PayID or states an unconfirmed payable amount')
    return notice
  }

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const kind of ['business', 'custom-cakes']) {
      await page.goto(`${origin}/${kind}`)
      const main = page.locator(`.au-service-landing-${kind}`)
      await main.waitFor()
      await dismissConsent()
      const images = await main.locator('img').all()
      check(images.length === (kind === 'business' ? 3 : 1), `${kind}: approved photos missing`)
      for (const image of images) {
        await image.scrollIntoViewIfNeeded()
        await image.evaluate(async img => { await img.decode(); if (!img.naturalWidth || !img.alt.trim()) throw Error('Missing image or accessible description') })
      }
      const links = await main.locator('a').evaluateAll(items => items.map(item => item.getAttribute('href')))
      const expectedLinks = kind === 'business'
        ? ['/business/cafe-supply', '/business/events', '/business/consulting']
        : ['/cakes/custom-cake', '/classes']
      for (const href of expectedLinks) check(links.includes(href), `${kind}: missing destination ${href}`)
      check(links.includes('https://www.instagram.com/verygood_syd/'), `${kind}: enquiry destination changed`)
      check(!links.includes('/class-reserve'), `${kind}: paused classes expose a reservation action`)
      if (kind === 'custom-cakes') check((await main.innerText()).includes('Currently paused'), 'Class pause information is missing')
      await noOverflow(`${kind}/${width}`)
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({ path: `/tmp/au-feedback-${kind}-${width}.png`, fullPage: true, animations: 'disabled' })
      results.push({ kind, width, photos: images.length, linksChecked: expectedLinks, overflow: false })
    }
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${origin}/robots.txt`)
  // Seed on an inert document before CartProvider migrates/persists the guest cart.
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('au-cake-language', 'en')
    localStorage.setItem('verygood-au-renewal-cart-v1', JSON.stringify({ version: 1, lines: [
      { lineId: 'line-a', offerId: 'pave-cake', size: '8in', quantity: 1 },
    ] }))
  })
  const health = page.waitForResponse(response => response.url().includes('/test-appwrite/v1/functions/') && response.request().postData()?.includes('renewal-health'))
  await page.goto(`${origin}/reserve`)
  await health
  const form = page.locator('form.renewal-checkout')
  await form.waitFor()
  await dismissConsent()
  await paymentNotice(form)
  check(await form.locator('input[type=date]').count() === 0, 'Native date input remains in the active checkout')
  check(await form.locator('select').inputValue() === '', 'Pickup time must start blank')
  const dateTrigger = form.locator('.weekend-date-trigger')
  const timeSelect = form.getByRole('combobox', { name: 'Pickup time', exact: true })
  const submit = form.getByRole('button', { name: 'Send request', exact: true })
  await dateTrigger.click()
  const calendar = page.getByRole('dialog', { name: 'Pickup date calendar', exact: true })
  await calendar.waitFor()
  for (const date of ['2026-10-26', '2026-10-27', '2026-10-29']) {
    check(await calendar.getByRole('button', { name: new RegExp(`^${date}(?:,|$)`) }).isDisabled(), `${date}: closed weekday is selectable`)
  }
  for (const date of ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-28', '2026-10-30']) {
    check(await calendar.getByRole('button', { name: new RegExp(`^${date}(?:,|$)`) }).isEnabled(), `${date}: approved date is disabled`)
  }
  await noOverflow('mobile calendar')
  await page.screenshot({ path: '/tmp/au-feedback-calendar-390.png', fullPage: true, animations: 'disabled' })
  await page.keyboard.press('Escape')

  async function selectDate(date) {
    await dateTrigger.click()
    await calendar.getByRole('button', { name: new RegExp(`^${date}(?:,|$)`) }).click()
  }
  async function checkClosing(date, closing) {
    await selectDate(date)
    check(await timeSelect.inputValue() === '', `${date}: changing the date retained the previous time`)
    const slots = await timeSelect.locator('option').evaluateAll(options => options.map(option => option.value).filter(Boolean))
    check(slots[0] === '09:00' && slots.at(-1) === closing, `${date}: wrong pickup hours ${slots[0]}–${slots.at(-1)}`)
    check(!slots.includes(closing === '20:00' ? '20:15' : '13:15'), `${date}: slot extends past closing`)
    await timeSelect.selectOption(closing)
  }
  await checkClosing('2026-10-28', '20:00')
  await checkClosing('2026-10-30', '20:00')
  await checkClosing('2026-10-24', '13:00')
  await checkClosing('2026-10-25', '13:00')
  await checkClosing('2026-10-23', '20:00')
  await form.locator('input[name=name]').fill('Local Test Buyer')
  await form.locator('input[name=phone]').fill('0412345678')
  await form.locator('input[name=email]').fill('local-buyer@example.test')
  await form.locator('input[name=privacy]').check()
  await noOverflow('mobile reservation form')
  await page.screenshot({ path: '/tmp/au-feedback-reserve-390.png', fullPage: true, animations: 'disabled' })

  async function submitFailure(expectedCount) {
    await submit.click()
    await page.getByRole('alert').waitFor()
    check(submissions.length === expectedCount, 'Unexpected number of local create-cake submissions')
    check(await submit.isEnabled(), 'Failed request did not unlock explicit retry')
  }
  await submitFailure(1)
  const first = submissions[0]
  check(!first.customerAccount && first.data.orderLines[0].size === '8in', 'Guest checkout or seeded order changed')
  await selectDate('2026-10-23')
  check(await timeSelect.inputValue() === '20:00', 'Reselecting the same date erased the chosen time')
  await submitFailure(2)
  check(submissions[1].data.requestId === first.data.requestId, 'Unchanged failed retry replaced requestId')
  check(JSON.stringify(submissions[1].data) === JSON.stringify(first.data), 'Unchanged retry mutated the order data')
  await selectDate('2026-10-24')
  check(await timeSelect.inputValue() === '', 'Changed pickup date retained the failed request time')
  check(await submit.isDisabled(), 'Changed date can submit before a new time is selected')
  await timeSelect.selectOption('13:00')
  failOrder = false
  await submit.click()
  await page.getByRole('heading', { name: 'Request received', exact: true }).waitFor()
  check(submissions.length === 3, 'Successful order was submitted more than once')
  check(submissions[2].data.requestId !== first.data.requestId, 'Changed pickup date reused the failed requestId')
  check(submissions[2].data.pickupDate === '2026-10-24' && submissions[2].data.pickupTime === '13:00', 'Selected weekend closing time was not submitted')
  const receipt = page.locator('main.renewal-page')
  const notice = await paymentNotice(receipt)
  const receiptText = await notice.innerText()
  check(receiptText.includes('Transfer reference: LOCAL-TEST-ORDER') && receiptText.includes('After receiving payment instructions'), 'Receipt transfer reference lacks payment timing')
  await noOverflow('mobile receipt')
  await page.screenshot({ path: '/tmp/au-feedback-receipt-390.png', fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await noOverflow('desktop receipt')
  await page.screenshot({ path: '/tmp/au-feedback-receipt-1440.png', fullPage: true, animations: 'disabled' })
  check(errors.length === 0, `Page errors: ${JSON.stringify(errors)}`)
  check(unexpectedActions.length === 0, `Unexpected API actions: ${JSON.stringify(unexpectedActions)}`)
  check(unexpectedWrites.length === 0, `Unexpected local writes: ${JSON.stringify(unexpectedWrites)}`)
  check(!blockedExternal.some(url => /appwrite|verygood|resend/.test(new URL(url).hostname)), 'Build attempted a production API request; use the local test endpoint')
  return { servicePages: results, pickup: 'Closed weekdays, weekday 20:00 and weekend 13:00 checked', retry: 'Same-date retry retained identity; changed date received a new identity', submissions: submissions.length, receiptPayment: true, pageErrors: errors.length, blockedExternalRequests: blockedExternal.length, productionNetworkRequests: 0 }
}
