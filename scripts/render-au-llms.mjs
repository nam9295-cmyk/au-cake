function formatAud(value) {
  return 'AUD ' + value.toFixed(2)
}

export function renderAuLlms(content) {
  const { site, home, classes, cakePages } = content
  const cakes = Object.entries(cakePages).map(([slug, cake]) =>
    '- ' + cake.name + ': ' + cake.description + ' ' + cake.priceSummary + ' '
      + cake.optionSummary + ' ' + site.url + '/cakes/' + slug,
  )

  return [
    '# ' + site.brand + ' Sydney',
    '',
    '> ' + home.hero + ' ' + home.pickup,
    '',
    'Official AU website: ' + site.url,
    'Primary service area: ' + site.pickupArea,
    ...site.socialProfiles.map((url) => 'Official Instagram: ' + url),
    '',
    '## Cakes',
    ...cakes,
    '',
    '## Kids cake classes',
    '- ' + classes.intro,
    '- Base course/package prices: ' + formatAud(classes.baseLowPrice)
      + '–' + formatAud(classes.baseHighPrice).replace('AUD ', '') + '.',
    '- ' + classes.packageSummary,
    '- ' + classes.extensionSummary,
    '- ' + site.url + '/classes',
    '',
  ].join('\n')
}
