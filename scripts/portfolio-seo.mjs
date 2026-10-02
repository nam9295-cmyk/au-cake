import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rolldown } from 'rolldown'
import content from '../src/content/au-company-portfolio.json' with { type: 'json' }

export async function getPortfolioSeoDefinition(siteUrl) {
  const directory = await mkdtemp(join(tmpdir(), 'au-portfolio-render-'))
  try {
    const bundle = await rolldown({
      input: fileURLToPath(new URL('./portfolio-static.tsx', import.meta.url)),
      platform: 'node', transform: { jsx: { runtime: 'automatic' } },
    })
    const file = join(directory, 'portfolio.mjs')
    try { await bundle.write({ file, format: 'esm', codeSplitting: false }) }
    finally { await bundle.close() }
    const { renderPortfolio } = await import(pathToFileURL(file).href)
    const image = content.boards[0].images[0].web.variants.at(-1)
    return {
      title: content.seo.title,
      description: content.seo.description,
      robots: 'index, follow',
      output: 'directory',
      extensionlessAlias: true,
      image: `${siteUrl}${image.src}`, imageType: 'image/webp', imageWidth: image.width, imageHeight: image.height,
      structuredData: [{ '@type': 'AboutPage', '@id': `${siteUrl}/portfolio#webpage`, name: content.seo.title, url: `${siteUrl}/portfolio`, inLanguage: 'en-AU', about: { '@id': `${siteUrl}/#organization` } }],
      fallbackHtml: renderPortfolio(),
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
}
