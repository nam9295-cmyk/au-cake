// Open the local AU Home in Playwright CLI, then run this file with run-code.
// Video playback/navigation only; no cart or order interaction.
async (page) => {
  const origin = await page.evaluate(() => location.origin)
  const check = (ok, message) => { if (!ok) throw new Error(message) }
  const results = []
  const mediaRequests = []
  const onRequest = request => { if (/\/redesign\/hero\/.*\.mp4/.test(request.url())) mediaRequests.push(request.url()) }
  page.on('request', onRequest)
  try {
    await page.emulateMedia({reducedMotion:'no-preference'})
    for (const width of [1920, 1440, 769, 768, 390, 320]) {
      await page.setViewportSize({width, height:1100})
      mediaRequests.length = 0
      await page.goto(`${origin}/`)
      await page.locator('.rd-hero-poster img').waitFor()
      const close = page.getByRole('button', { name: 'Dismiss announcement' })
      if (await close.isVisible()) await close.click()
      const video = page.locator('video.rd-hero-photo')
      await video.waitFor()
      check(await video.count() === 1, `Hero @ ${width}: missing video`)
      await page.waitForFunction(() => {
        const video = document.querySelector('video.rd-hero-photo')
        return video && !video.paused && video.currentTime > 0.1
      })
      const state = await video.evaluate(video => {
        const box = video.getBoundingClientRect()
        return {src:video.currentSrc, width:box.width, height:box.height, left:box.left,
          muted:video.muted, loop:video.loop, inline:video.playsInline,
          duration:video.duration, playbackRate:video.playbackRate,
          naturalWidth:video.videoWidth, naturalHeight:video.videoHeight,
          overflow:document.documentElement.scrollWidth > document.documentElement.clientWidth,
          viewport:document.documentElement.clientWidth,
          collectionWidth:document.querySelector('#au-collection').getBoundingClientRect().width}
      })
      const mobile = width <= 768
      const expected = mobile ? 'cake-mobile-8s.mp4' : 'cake-desktop.mp4'
      check(state.src.endsWith(expected), `Hero @ ${width}: wrong responsive video`)
      check(mediaRequests.length > 0 && mediaRequests.every(url => url.endsWith(expected)), `Hero @ ${width}: downloaded another viewport's video`)
      check(state.muted && state.loop && state.inline, `Hero @ ${width}: missing quiet inline loop`)
      check(Math.abs(state.duration - (mobile ? 8 : 7)) < 0.05 && state.playbackRate === 1, `Hero @ ${width}: unexpected encoded duration`)
      if (width < 768) {
        check(Math.abs(state.width / state.height - 3/4) < 0.005 && Math.abs(state.width - state.viewport) <= 1, 'Mobile hero must retain its full-width portrait frame')
      } else {
        const expectedHeight = width < 1200 ? 420 : 520
        check(state.height === expectedHeight && Math.abs(state.left * 2 + state.width - state.viewport) <= 2, 'Desktop hero must retain its centred frame')
      }
      check(!state.overflow && state.collectionWidth <= 1441, `Hero @ ${width}: unrelated page layout expanded`)
      results.push({width, ...state})
    }
    await page.setViewportSize({width:1440,height:1000})
    await page.goto(`${origin}/`)
    await page.getByRole('button', {name:'Pause hero video', exact:true}).click()
    await page.waitForFunction(() => document.querySelector('video.rd-hero-photo').paused)
    for (const width of [390, 1440]) {
      await page.setViewportSize({width, height:1000})
      const expected = width <= 768 ? 'cake-mobile-8s.mp4' : 'cake-desktop.mp4'
      await page.waitForFunction(expected => {
        const video = document.querySelector('video.rd-hero-photo')
        return video?.currentSrc.endsWith(expected) && video.readyState >= 2
      }, expected)
      const paused = await page.locator('video.rd-hero-photo').evaluate(async video => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        return video.paused && !video.autoplay
      })
      check(paused, `Breakpoint change to ${width}px undid a user pause`)
    }
    await page.locator('#au-collection').scrollIntoViewIfNeeded()
    await page.locator('.rd-hero').scrollIntoViewIfNeeded()
    check(await page.locator('video.rd-hero-photo').evaluate(video => video.paused), 'Scrolling undid a user pause')
    await page.getByRole('button', {name:'Play hero video', exact:true}).click()
    await page.waitForFunction(() => !document.querySelector('video.rd-hero-photo').paused)
    await page.locator('#au-collection').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => document.querySelector('video.rd-hero-photo').paused)
    await page.locator('.rd-hero').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => !document.querySelector('video.rd-hero-photo').paused)
    await page.emulateMedia({reducedMotion:'reduce'})
    mediaRequests.length = 0
    await page.goto(`${origin}/`)
    await page.locator('.rd-hero-poster img').waitFor()
    check(await page.locator('video.rd-hero-photo').count() === 0, 'Reduced motion still mounts video')
    check(mediaRequests.length === 0, 'Reduced motion still downloads video')
    check(await page.locator('.rd-hero-poster img').evaluate(async image => {await image.decode(); return image.naturalWidth > 0}), 'Reduced-motion poster is broken')
    await page.emulateMedia({reducedMotion:'no-preference'})
    await page.route('**/redesign/hero/*.mp4', route => route.abort())
    const failedRequest = page.waitForEvent('requestfailed', request => /\/redesign\/hero\/.*\.mp4/.test(request.url()))
    await page.goto(`${origin}/`)
    await failedRequest
    await page.locator('.rd-hero-poster img').waitFor()
    await page.locator('video.rd-hero-photo').waitFor({state:'detached'})
    check(await page.locator('.rd-hero-poster img').evaluate(async image => {await image.decode(); return image.naturalWidth > 0}), 'Video failure removed fallback artwork')
    check(await page.locator('.rd-hero-video-toggle').count() === 0, 'Broken video still offers playback')
    return {passed:results.length, pauseResume:true, pauseAcrossResize:true, offscreenPause:true, reducedMotion:true, failurePoster:true, results}
  } finally {
    page.off('request', onRequest)
    await page.unroute('**/redesign/hero/*.mp4')
    await page.emulateMedia({reducedMotion:'no-preference'})
  }
}
