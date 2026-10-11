import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rolldown } from 'rolldown'
import routes from '../src/content/au-service-routes.json' with { type: 'json' }

export async function getServiceSeoDefinitions(siteUrl) {
  const directory = await mkdtemp(join(tmpdir(), 'au-services-render-'))
  try {
    const bundle = await rolldown({
      input: fileURLToPath(new URL('./services-static.tsx', import.meta.url)),
      platform: 'node',
      transform: { jsx: { runtime: 'automatic' } },
      plugins: [
        {
          name: 'static-css',
          load(id) {
            if (id.endsWith('.css')) return { code: '', moduleType: 'js' }
          },
        },
      ],
    })
    const file = join(directory, 'services.mjs')
    try {
      await bundle.write({ file, format: 'esm', codeSplitting: false })
    } finally {
      await bundle.close()
    }
    const { renderServicePage } = await import(pathToFileURL(file).href)
    return Object.fromEntries(
      routes.map((route) => [
        route.path,
        {
          title: route.title,
          description: route.description,
          robots: 'index, follow',
          output: 'directory',
          extensionlessAlias: true,
          structuredData: [
            {
              '@type': 'WebPage',
              name: route.title,
              url: `${siteUrl}${route.path}`,
              inLanguage: 'en-AU',
            },
          ],
          fallbackHtml: renderServicePage(route.path),
        },
      ]),
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
