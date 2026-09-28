// Run against a local AU preview with Playwright CLI's run-code --filename.
async (page) => {
  const origin = await page.evaluate(() => location.origin)
  const failures = []

  async function verify(name, run) {
    const probe = await page.context().newPage()
    try {
      await probe.setViewportSize({ width: 390, height: 844 })
      await probe.emulateMedia({ reducedMotion: 'no-preference' })
      await run(probe)
    } catch (error) {
      failures.push(`${name}: ${error.message}`)
    } finally {
      await probe.close()
    }
  }

  await verify('canplay during a pending attempt is retried once after rejection', async probe => {
    await probe.addInitScript(() => {
      window.__heroCalls = 0
      window.__rejectFirstHeroPlay = () => {}
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (!this.matches('video.rd-hero-photo')) return originalPlay.call(this)
        window.__heroCalls += 1
        if (window.__heroCalls !== 1) return originalPlay.call(this)
        return new Promise((_resolve, reject) => { window.__rejectFirstHeroPlay = reject })
      }
    })
    await probe.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await probe.waitForFunction(() => window.__heroCalls === 1)
    await probe.locator('video.rd-hero-photo').evaluate(video => video.dispatchEvent(new Event('canplay')))
    if (await probe.evaluate(() => window.__heroCalls) !== 1) {
      throw new Error('A second play request started while the first was pending')
    }
    await probe.evaluate(() => window.__rejectFirstHeroPlay(new DOMException('Media not ready', 'InvalidStateError')))
    await probe.waitForFunction(() => window.__heroCalls === 2, null, { timeout: 3000 })
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback === 'playing')
    if (await probe.evaluate(() => window.__heroCalls) !== 2) {
      throw new Error('The canplay recovery used more than one new play request')
    }
  })

  await verify('unexpected pause clears playing and starts one recovery', async probe => {
    await probe.addInitScript(() => {
      window.__heroCalls = 0
      window.__heroPauseEvents = 0
      window.__holdHeroRecovery = false
      window.__releaseHeroRecovery = () => {}
      document.addEventListener('pause', event => {
        if (event.target?.matches?.('video.rd-hero-photo')) window.__heroPauseEvents += 1
      }, true)
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (!this.matches('video.rd-hero-photo')) return originalPlay.call(this)
        window.__heroCalls += 1
        if (!window.__holdHeroRecovery) return originalPlay.call(this)
        return new Promise((resolve, reject) => {
          window.__releaseHeroRecovery = () => originalPlay.call(this).then(resolve, reject)
        })
      }
    })
    await probe.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback === 'playing')
    await probe.evaluate(() => { window.__holdHeroRecovery = true })
    await probe.locator('video.rd-hero-photo').evaluate(video => video.pause())
    await probe.waitForFunction(() => window.__heroPauseEvents === 1)
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback !== 'playing',
      null, { timeout: 3000 })
    if (await probe.getByRole('button', { name: 'Pause hero video' }).count()) {
      throw new Error('A paused video still showed the Pause control')
    }
    await probe.waitForFunction(() => window.__heroCalls === 2, null, { timeout: 3000 })
    await probe.evaluate(() => window.__releaseHeroRecovery())
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback === 'playing')
    if (await probe.evaluate(() => window.__heroCalls) !== 2) {
      throw new Error('The interruption recovery made duplicate play requests')
    }
  })

  await verify('denied interruption recovery exposes Play without another automatic retry', async probe => {
    await probe.addInitScript(() => {
      window.__heroCalls = 0
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (!this.matches('video.rd-hero-photo')) return originalPlay.call(this)
        window.__heroCalls += 1
        if (window.__heroCalls === 2) return Promise.reject(new DOMException('Autoplay denied', 'NotAllowedError'))
        return originalPlay.call(this)
      }
    })
    await probe.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback === 'playing')
    await probe.locator('video.rd-hero-photo').evaluate(video => video.pause())
    await probe.getByRole('button', { name: 'Play hero video' }).waitFor({ timeout: 3000 })
    if (await probe.locator('.rd-hero-photo-wrap').getAttribute('data-playback') !== 'blocked') {
      throw new Error('A denied interruption recovery did not enter blocked state')
    }
    await probe.locator('video.rd-hero-photo').evaluate(video => video.dispatchEvent(new Event('canplay')))
    if (await probe.evaluate(() => window.__heroCalls) !== 2) {
      throw new Error('Policy denial caused another automatic play request')
    }
    await probe.getByRole('button', { name: 'Play hero video' }).click()
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback === 'playing')
    if (await probe.evaluate(() => window.__heroCalls) !== 3) {
      throw new Error('The manual Play request did not start exactly once')
    }
  })

  await verify('manual pause stays paused until the user presses Play', async probe => {
    await probe.addInitScript(() => {
      window.__heroCalls = 0
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (this.matches('video.rd-hero-photo')) window.__heroCalls += 1
        return originalPlay.call(this)
      }
    })
    await probe.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback === 'playing')
    await probe.getByRole('button', { name: 'Pause hero video' }).click()
    await probe.waitForFunction(() => document.querySelector('video.rd-hero-photo')?.paused)
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback !== 'playing',
      null, { timeout: 3000 })
    const pausedCalls = await probe.evaluate(() => window.__heroCalls)
    await probe.waitForTimeout(150)
    if (await probe.evaluate(() => window.__heroCalls) !== pausedCalls) {
      throw new Error('Manual pause triggered automatic recovery')
    }
    await probe.getByRole('button', { name: 'Play hero video' }).click()
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback === 'playing')
    if (await probe.evaluate(() => window.__heroCalls) !== pausedCalls + 1) {
      throw new Error('Manual Play made duplicate playback requests')
    }
  })

  await verify('a failed canplay recovery cannot start a third automatic request', async probe => {
    await probe.addInitScript(() => {
      window.__heroCalls = 0
      window.__rejectHeroAttempts = []
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (!this.matches('video.rd-hero-photo')) return originalPlay.call(this)
        window.__heroCalls += 1
        return new Promise((_resolve, reject) => { window.__rejectHeroAttempts.push(reject) })
      }
    })
    await probe.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await probe.waitForFunction(() => window.__heroCalls === 1)
    await probe.locator('video.rd-hero-photo').evaluate(video => video.dispatchEvent(new Event('canplay')))
    await probe.evaluate(() => window.__rejectHeroAttempts[0](new DOMException('Media not ready', 'InvalidStateError')))
    await probe.waitForFunction(() => window.__heroCalls === 2, null, { timeout: 3000 })
    await probe.locator('video.rd-hero-photo').evaluate(video => video.dispatchEvent(new Event('canplay')))
    await probe.evaluate(() => window.__rejectHeroAttempts[1](new DOMException('Media not ready', 'InvalidStateError')))
    await probe.getByRole('button', { name: 'Play hero video' }).waitFor({ timeout: 3000 })
    if (await probe.evaluate(() => window.__heroCalls) !== 2) {
      throw new Error('A second autoplay failure caused more than one readiness retry')
    }
  })

  await verify('hidden playback pauses without a false failure or automatic loop', async probe => {
    await probe.addInitScript(() => {
      window.__heroCalls = 0
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (this.matches('video.rd-hero-photo')) window.__heroCalls += 1
        return originalPlay.call(this)
      }
    })
    await probe.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback === 'playing')
    await probe.evaluate(() => {
      window.__heroHidden = true
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__heroHidden })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await probe.waitForFunction(() => document.querySelector('video.rd-hero-photo')?.paused)
    if (await probe.locator('.rd-hero-photo-wrap').getAttribute('data-playback') === 'blocked') {
      throw new Error('Intentional hidden pause was treated as autoplay denial')
    }
    const hiddenCalls = await probe.evaluate(() => window.__heroCalls)
    await probe.waitForTimeout(150)
    if (await probe.evaluate(() => window.__heroCalls) !== hiddenCalls) {
      throw new Error('Hero retried playback while the document was hidden')
    }
    await probe.evaluate(() => {
      window.__heroHidden = false
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback === 'playing')
    if (await probe.evaluate(() => window.__heroCalls) !== hiddenCalls + 1) {
      throw new Error('Visibility resume made duplicate playback requests')
    }
  })

  await verify('a late intentional pause does not invalidate a resumed play promise', async probe => {
    await probe.addInitScript(() => {
      window.__heroCalls = 0
      window.__holdResume = false
      window.__rejectResume = () => {}
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (!this.matches('video.rd-hero-photo')) return originalPlay.call(this)
        window.__heroCalls += 1
        if (!window.__holdResume) return originalPlay.call(this)
        return new Promise((_resolve, reject) => { window.__rejectResume = reject })
      }
    })
    await probe.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback === 'playing')
    await probe.evaluate(() => {
      window.__holdResume = true
      window.__heroHidden = true
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__heroHidden })
      document.dispatchEvent(new Event('visibilitychange'))
      window.__heroHidden = false
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await probe.waitForFunction(() => window.__heroCalls === 2)
    await probe.waitForTimeout(100)
    await probe.evaluate(() => window.__rejectResume(new DOMException('Autoplay denied', 'NotAllowedError')))
    await probe.getByRole('button', { name: 'Play hero video' }).waitFor({ timeout: 3000 })
    if (await probe.locator('.rd-hero-photo-wrap').getAttribute('data-playback') !== 'blocked') {
      throw new Error('A late intentional pause hid the resumed request failure')
    }
  })

  await verify('a stale unexpected pause cannot invalidate a newer pending request', async probe => {
    await probe.addInitScript(() => {
      window.__heroCalls = 0
      window.__rejectHeroAttempts = []
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (!this.matches('video.rd-hero-photo')) return originalPlay.call(this)
        window.__heroCalls += 1
        return new Promise((_resolve, reject) => { window.__rejectHeroAttempts.push(reject) })
      }
    })
    await probe.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await probe.waitForFunction(() => window.__heroCalls === 1)
    await probe.evaluate(() => window.__rejectHeroAttempts[0](new DOMException('Interrupted', 'AbortError')))
    await probe.waitForFunction(() => window.__heroCalls === 2, null, { timeout: 3000 })
    await probe.locator('video.rd-hero-photo').evaluate(video => {
      Object.defineProperty(video, 'paused', { configurable: true, get: () => false })
      video.dispatchEvent(new Event('pause'))
      delete video.paused
    })
    await probe.evaluate(() => window.__rejectHeroAttempts[1](new DOMException('Autoplay denied', 'NotAllowedError')))
    await probe.getByRole('button', { name: 'Play hero video' }).waitFor({ timeout: 3000 })
    if (await probe.locator('.rd-hero-photo-wrap').getAttribute('data-playback') !== 'blocked') {
      throw new Error('A stale pause swallowed the newer policy rejection')
    }
  })

  await verify('an interrupted initial pending play receives one recovery attempt', async probe => {
    await probe.addInitScript(() => {
      window.__heroCalls = 0
      window.__rejectFirstHeroPlay = () => {}
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (!this.matches('video.rd-hero-photo')) return originalPlay.call(this)
        window.__heroCalls += 1
        if (window.__heroCalls !== 1) return originalPlay.call(this)
        return new Promise((_resolve, reject) => { window.__rejectFirstHeroPlay = reject })
      }
    })
    await probe.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await probe.waitForFunction(() => window.__heroCalls === 1)
    await probe.locator('video.rd-hero-photo').evaluate(video => video.dispatchEvent(new Event('pause')))
    await probe.evaluate(() => window.__rejectFirstHeroPlay(new DOMException('Interrupted', 'AbortError')))
    await probe.waitForFunction(() => window.__heroCalls === 2, null, { timeout: 3000 })
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback === 'playing')
    if (await probe.evaluate(() => window.__heroCalls) !== 2) {
      throw new Error('Initial playback interruption caused duplicate retries')
    }
  })

  await verify('a late pause cannot hide the fallback after the retry is exhausted', async probe => {
    await probe.addInitScript(() => {
      window.__heroCalls = 0
      window.__rejectHeroAttempts = []
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (!this.matches('video.rd-hero-photo')) return originalPlay.call(this)
        window.__heroCalls += 1
        return new Promise((_resolve, reject) => { window.__rejectHeroAttempts.push(reject) })
      }
    })
    await probe.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await probe.waitForFunction(() => window.__heroCalls === 1)
    await probe.evaluate(() => window.__rejectHeroAttempts[0](new DOMException('Interrupted', 'AbortError')))
    await probe.waitForFunction(() => window.__heroCalls === 2, null, { timeout: 3000 })
    await probe.evaluate(() => window.__rejectHeroAttempts[1](new DOMException('Interrupted', 'AbortError')))
    await probe.getByRole('button', { name: 'Play hero video' }).waitFor({ timeout: 3000 })
    await probe.locator('video.rd-hero-photo').evaluate(video => video.dispatchEvent(new Event('pause')))
    if (await probe.locator('.rd-hero-photo-wrap').getAttribute('data-playback') !== 'blocked') {
      throw new Error('A late pause removed the exhausted-retry Play fallback')
    }
    if (await probe.evaluate(() => window.__heroCalls) !== 2) {
      throw new Error('An exhausted retry started a third play request')
    }
  })

  await verify('a mobile play promise cannot change desktop state after variant replacement', async probe => {
    await probe.addInitScript(() => {
      window.__rejectMobileHero = () => {}
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (!this.matches('video.rd-hero-photo')) return originalPlay.call(this)
        if (this.getAttribute('src')?.endsWith('cake-mobile.mp4')) {
          return new Promise((_resolve, reject) => { window.__rejectMobileHero = reject })
        }
        return originalPlay.call(this)
      }
    })
    await probe.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await probe.waitForFunction(() => document.querySelector('video.rd-hero-photo')?.getAttribute('src')?.endsWith('cake-mobile.mp4'))
    await probe.setViewportSize({ width: 1440, height: 900 })
    await probe.waitForFunction(() => document.querySelector('video.rd-hero-photo')?.getAttribute('src')?.endsWith('cake-desktop.mp4'))
    await probe.waitForFunction(() => document.querySelector('.rd-hero-photo-wrap')?.dataset.playback === 'playing')
    await probe.evaluate(() => window.__rejectMobileHero(new DOMException('Stale mobile play', 'NotAllowedError')))
    await probe.waitForTimeout(100)
    if (await probe.locator('.rd-hero-photo-wrap').getAttribute('data-playback') !== 'playing') {
      throw new Error('A stale mobile promise changed the desktop playback state')
    }
  })

  if (failures.length) throw new Error(failures.join('\n'))
  return { pendingCanplayRetry: true, unexpectedPauseRecovery: true,
    deniedRecoveryFallback: true, manualPause: true, singleRetryBudget: true,
    hiddenPause: true, lateIntentionalPause: true, staleUnexpectedPause: true,
    initialPendingPause: true, exhaustedRetryFallback: true, staleVariantPromise: true }
}
