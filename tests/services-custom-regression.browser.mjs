async (page) => {
  const results = []
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const snapshots = []
    for (const [label, port] of [['baseline', 5185], ['current', 5184]]) {
      await page.goto(`http://127.0.0.1:${port}/cakes/custom-cake`)
      await page.locator('.custom-cake-detail-page').waitFor()
      const consent = page.getByRole('button', { name: 'Essential only', exact: true })
      if (await consent.isVisible()) await consent.click()
      await page.evaluate(() => document.fonts.ready)
      const main = page.locator('.custom-cake-detail-page')
      for (const image of await main.locator('img').all()) { await image.scrollIntoViewIfNeeded(); await image.evaluate(img => img.decode()) }
      await page.getByRole('button', { name: 'Triple Berry', exact: true }).click()
      await page.getByRole('button', { name: 'Nutella', exact: true }).click()
      await page.evaluate(() => scrollTo(0, 0))
      await page.mouse.move(0, 0)
      await main.screenshot({ path: `/tmp/au-services-qa/custom-${label}-${width}.png`, animations: 'disabled' })
      snapshots.push(await main.evaluate(root => ({
        html: root.innerHTML.replace(/_r_[a-z0-9]+_/g, '_REACT_ID_'),
        metrics: [...root.querySelectorAll('h1,h2,fieldset,button,input,textarea,img')].map(el => { const b=el.getBoundingClientRect(),s=getComputedStyle(el);return {tag:el.tagName,text:el.textContent,width:b.width,height:b.height,font:s.fontFamily,fontSize:s.fontSize,color:s.color,display:s.display} }),
      })))
    }
    if (JSON.stringify(snapshots[0]) !== JSON.stringify(snapshots[1])) throw Error(`Custom Cake DOM or layout changed at ${width}`)
    results.push({ width, customDomAndLayoutIdentical: true, flavourSelection: 'Nutella' })
  }
  return results
}
