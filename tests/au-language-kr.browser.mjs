// KR baseline archive on 5185, KR implementation preview on 5186.
async (page) => {
  const results = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const language of ['en', 'ko']) {
      for (const path of ['/', '/cakes', '/cakes/pave-chocolate-cake', '/cakes/custom-cake']) {
        const samples = []
        for (const port of [5185, 5186]) {
          await page.goto(`http://127.0.0.1:${port}${path}`)
          await page.evaluate(value => {
            localStorage.setItem('au-cake-language', value)
            // Consent is unrelated to language and must start identically in
            // both origins, which have independent browser storage.
            localStorage.removeItem('vg-analytics-consent')
          }, language)
          await page.reload()
          await page.locator('h1').first().waitFor()
          await page.evaluate(() => document.fonts.ready)
          if (await page.locator('.au-language-control').count()) throw Error('AU language UI leaked into KR')
          samples.push(await page.locator('.app-shell').evaluate(root => ({
            text: root.innerText,
            controls: [...root.querySelectorAll('h1,h2,header,fieldset,button,input,textarea')].filter(el => el.getClientRects().length).map(el => {
              const b = el.getBoundingClientRect(), s = getComputedStyle(el)
              return { tag: el.tagName, text: el.textContent, width: b.width, height: b.height, font: s.fontFamily, fontSize: s.fontSize, color: s.color }
            }),
          })))
        }
        if (JSON.stringify(samples[0]) !== JSON.stringify(samples[1])) {
          const differences = samples[0].controls.flatMap((control, i) => JSON.stringify(control) === JSON.stringify(samples[1].controls[i]) ? [] : [{ baseline: control, current: samples[1].controls[i] }])
          throw Error(`KR language/layout regression: ${path}/${width}/${language}; ${JSON.stringify({ textIdentical: samples[0].text === samples[1].text, textTail: samples.map(s => s.text.slice(-600)), differences: differences.slice(0, 5) })}`)
        }
        results.push({ width, language, path, contentAndLayoutIdentical: true })
      }
    }
  }
  return results
}
