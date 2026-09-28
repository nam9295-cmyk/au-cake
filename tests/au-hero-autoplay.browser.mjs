// Run against a local AU preview with Playwright CLI's run-code --filename.
// The held media request makes the initial poster and autoplay state observable.
async (page) => {
  const origin = await page.evaluate(() => location.origin)
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  let releaseVideo
  const heldVideo = new Promise(resolve => { releaseVideo = resolve })
  let videoRequested
  const requested = new Promise(resolve => { videoRequested = resolve })
  let videoHandled
  const handled = new Promise(resolve => { videoHandled = resolve })
  await page.route('**/redesign/hero/cake-mobile.mp4', async route => {
    videoRequested()
    await heldVideo
    await route.continue()
    videoHandled()
  })

  try {
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await page.locator('video.rd-hero-photo').waitFor()
    await requested
    await page.locator('.rd-hero-poster img').evaluate(image => image.decode())

    const loading = await page.evaluate(() => {
      const video = document.querySelector('video.rd-hero-photo')
      const poster = document.querySelector('.rd-hero-poster img')
      return {
        videoOpacity: getComputedStyle(video).opacity,
        posterVisible: poster.complete && poster.naturalWidth > 0,
        controlCount: document.querySelectorAll('.rd-hero-video-toggle').length,
        muted: video.muted,
        defaultMuted: video.defaultMuted,
      }
    })
    check(loading.posterVisible, 'The first-frame poster did not load while video was pending')
    check(loading.controlCount === 0, 'Play control appeared before autoplay was rejected')
    check(loading.videoOpacity === '0', 'Video obscured the poster before playing')
    check(loading.muted && loading.defaultMuted, 'Video was not muted before the first play attempt')

    releaseVideo()
    await handled
    await page.waitForFunction(() => {
      const video = document.querySelector('video.rd-hero-photo')
      return video && !video.paused && video.currentTime > 0.1
    })
    await page.waitForFunction(() => getComputedStyle(document.querySelector('video.rd-hero-photo')).opacity === '1')
    const playing = await page.evaluate(() => {
      const video = document.querySelector('video.rd-hero-photo')
      return {
        control: document.querySelector('.rd-hero-video-toggle')?.getAttribute('aria-label'),
        opacityTransition: getComputedStyle(video).transitionProperty,
      }
    })
    check(playing.control === 'Pause hero video', 'Pause control is missing after playback begins')
    check(playing.opacityTransition.includes('opacity'), 'Poster-to-video fade is missing')
    const firstVideoDownloads = await page.evaluate(() => performance.getEntriesByType('resource')
      .filter(entry => entry.name.endsWith('/redesign/hero/cake-mobile.mp4')).length)
    await page.locator('.rd-collection-section').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => document.querySelector('video.rd-hero-photo')?.paused)
    await page.locator('.rd-hero').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => !document.querySelector('video.rd-hero-photo')?.paused)
    const resumedVideoDownloads = await page.evaluate(() => performance.getEntriesByType('resource')
      .filter(entry => entry.name.endsWith('/redesign/hero/cake-mobile.mp4')).length)
    check(firstVideoDownloads === 1 && resumedVideoDownloads === 1,
      'Visibility resume downloaded the mobile video again')

    const blockedPage = await page.context().newPage()
    try {
      await blockedPage.setViewportSize({ width: 390, height: 844 })
      await blockedPage.addInitScript(() => {
        window.__heroPlayAttempts = []
        window.__heroRejectors = []
        window.__heroAutoReject = false
        window.__rejectHeroPlay = () => {
          window.__heroAutoReject = true
          window.__heroRejectors.forEach(reject => reject(new DOMException('Autoplay denied', 'NotAllowedError')))
          window.__heroRejectors = []
        }
        const originalPlay = HTMLMediaElement.prototype.play
        HTMLMediaElement.prototype.play = function () {
          if (!this.matches('video.rd-hero-photo')) return originalPlay.call(this)
          window.__heroPlayAttempts.push({ muted: this.muted, defaultMuted: this.defaultMuted })
          if (window.__allowHeroPlay) return originalPlay.call(this)
          if (window.__heroAutoReject) return Promise.reject(new DOMException('Autoplay denied', 'NotAllowedError'))
          return new Promise((_resolve, reject) => { window.__heroRejectors.push(reject) })
        }
      })
      await blockedPage.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
      await blockedPage.locator('video.rd-hero-photo').waitFor()
      await blockedPage.waitForFunction(() => window.__heroPlayAttempts.length > 0)
      check(await blockedPage.locator('.rd-hero-video-toggle').count() === 0,
        'Play control appeared while autoplay was still pending')
      const firstAttempt = await blockedPage.evaluate(() => window.__heroPlayAttempts[0])
      check(firstAttempt.muted && firstAttempt.defaultMuted, 'Autoplay was requested before muting')
      await blockedPage.evaluate(() => window.__rejectHeroPlay())
      await blockedPage.getByRole('button', { name: 'Play hero video' }).waitFor()
      check(await blockedPage.locator('video.rd-hero-photo').evaluate(video => getComputedStyle(video).opacity === '0'),
        'Rejected autoplay revealed an unplayed video frame')
      await blockedPage.evaluate(() => { window.__allowHeroPlay = true })
      await blockedPage.getByRole('button', { name: 'Play hero video' }).click()
      await blockedPage.waitForFunction(() => !document.querySelector('video.rd-hero-photo')?.paused)
      await blockedPage.evaluate(() => { window.__allowHeroPlay = false })
      await blockedPage.setViewportSize({ width: 1440, height: 900 })
      await blockedPage.getByRole('button', { name: 'Play hero video' }).waitFor()
      check(await blockedPage.locator('video.rd-hero-photo').evaluate(video =>
        video.currentSrc.endsWith('/cake-desktop.mp4') && getComputedStyle(video).opacity === '0'),
      'Desktop autoplay denial did not retain its poster and Play fallback')
    } finally {
      await blockedPage.close()
    }

    const retryPage = await page.context().newPage()
    try {
      await retryPage.setViewportSize({ width: 390, height: 844 })
      await retryPage.addInitScript(() => {
        window.__heroDenied = true
        window.__heroPlayCalls = 0
        const originalPlay = HTMLMediaElement.prototype.play
        HTMLMediaElement.prototype.play = function () {
          if (!this.matches('video.rd-hero-photo')) return originalPlay.call(this)
          window.__heroPlayCalls += 1
          return window.__heroDenied
            ? Promise.reject(new DOMException('Autoplay denied', 'NotAllowedError'))
            : originalPlay.call(this)
        }
      })
      await retryPage.goto(`${origin}/`, { waitUntil: 'networkidle' })
      await retryPage.getByRole('button', { name: 'Play hero video' }).waitFor()
      const callsAfterLoad = await retryPage.evaluate(() => window.__heroPlayCalls)
      await retryPage.waitForTimeout(150)
      check(await retryPage.evaluate(() => window.__heroPlayCalls) === callsAfterLoad,
        'Blocked autoplay kept retrying without a visibility or readiness change')
      await retryPage.evaluate(() => {
        window.__heroDenied = false
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await retryPage.waitForFunction(() => !document.querySelector('video.rd-hero-photo')?.paused)
      check(await retryPage.evaluate(() => window.__heroPlayCalls) === callsAfterLoad + 1,
        'Visibility retry did not make exactly one new play attempt')
    } finally {
      await retryPage.close()
    }

    const canPlayPage = await page.context().newPage()
    try {
      await canPlayPage.setViewportSize({ width: 390, height: 844 })
      await canPlayPage.addInitScript(() => {
        window.__heroReady = false
        window.__heroPlayCalls = 0
        document.addEventListener('canplay', event => {
          if (event.target?.matches?.('video.rd-hero-photo')) window.__heroReady = true
        }, true)
        const originalPlay = HTMLMediaElement.prototype.play
        HTMLMediaElement.prototype.play = function () {
          if (!this.matches('video.rd-hero-photo')) return originalPlay.call(this)
          window.__heroPlayCalls += 1
          return window.__heroReady
            ? originalPlay.call(this)
            : Promise.reject(new DOMException('Autoplay denied', 'NotAllowedError'))
        }
      })
      await canPlayPage.goto(`${origin}/`, { waitUntil: 'networkidle' })
      await canPlayPage.waitForFunction(() => !document.querySelector('video.rd-hero-photo')?.paused)
      check(await canPlayPage.evaluate(() => window.__heroPlayCalls) >= 2,
        'Canplay did not retry after an initial playback rejection')
    } finally {
      await canPlayPage.close()
    }

    const interruptedPage = await page.context().newPage()
    try {
      await interruptedPage.setViewportSize({ width: 390, height: 844 })
      await interruptedPage.addInitScript(() => {
        window.__heroAbortPending = true
        window.__heroAbortRejectors = []
        const originalPlay = HTMLMediaElement.prototype.play
        HTMLMediaElement.prototype.play = function () {
          if (!this.matches('video.rd-hero-photo')) return originalPlay.call(this)
          if (!window.__heroAbortPending) return originalPlay.call(this)
          return new Promise((_resolve, reject) => { window.__heroAbortRejectors.push(reject) })
        }
      })
      await interruptedPage.goto(`${origin}/`, { waitUntil: 'networkidle' })
      await interruptedPage.waitForFunction(() => document.querySelector('video.rd-hero-photo')?.readyState >= 3)
      await interruptedPage.evaluate(() => {
        window.__heroAbortPending = false
        window.__heroAbortRejectors.forEach(reject => reject(new DOMException('Playback interrupted', 'AbortError')))
      })
      await interruptedPage.waitForFunction(() => !document.querySelector('video.rd-hero-photo')?.paused,
        null, { timeout: 3000 })
      check(await interruptedPage.locator('.rd-hero-video-toggle[aria-label="Play hero video"]').count() === 0,
        'An interrupted autoplay request showed the policy-denied fallback')
    } finally {
      await interruptedPage.close()
    }
    return { loadingPoster: true, fadeAfterPlaying: true, blockedManualFallback: true,
      visibilityRetry: true, canPlayRetry: true, interruptedRetry: true, noRepeatDownload: true }
  } finally {
    releaseVideo()
    await handled
    await page.unroute('**/redesign/hero/cake-mobile.mp4')
  }
}
