import { readFileSync } from 'node:fs'
import postcss, { type Plugin as PostcssPlugin } from 'postcss'
import { defineConfig, loadEnv, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { storefrontReading } from './scripts/journal-relations.mjs'
import { addHomeLoading } from './scripts/au-loading.mjs'

// Only the AU storefront replaces the two legacy web font stylesheets.
function auStorefrontFonts(): PostcssPlugin {
  const faces = readFileSync(new URL('./src/styles/au-fonts.css', import.meta.url), 'utf8')
  return {
    postcssPlugin: 'au-storefront-fonts',
    Once(root) {
      root.walkAtRules('import', rule => {
        if (rule.params.includes('fonts.googleapis.com/css2?family=Work+Sans:')) {
          rule.replaceWith(postcss.parse(faces).nodes)
        } else if (rule.params.includes('/SUIT-Variable.css')) rule.remove()
      })
    },
  }
}

// Vite does not read the exact permanent asset redirects that Pages uses.
function serveLocalAssetRedirects(server: Pick<ViteDevServer, 'middlewares'>) {
  const redirects = new Map<string, string>()
  const rules = readFileSync(new URL('./public/_redirects', import.meta.url), 'utf8')
  for (const line of rules.split(/\r?\n/)) {
    const [from, to, status] = line.trim().split(/\s+/)
    if (status === '301') redirects.set(from, to)
  }
  server.middlewares.use((request, response, next) => {
    const url = request.url || ''
    const path = url.split('?', 1)[0]
    const target = redirects.get(path)
    if (!target) return next()
    response.writeHead(301, { Location: target + url.slice(path.length) }).end()
  })
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const au = (process.env.VITE_MARKET || env.VITE_MARKET || '').toUpperCase() === 'AU'
  const releaseAssetNamespace = (process.env.CF_PAGES_COMMIT_SHA || 'local').slice(0, 12)
  const appwriteEndpoint = env.VITE_APPWRITE_ENDPOINT || env.APPWRITE_ENDPOINT
  const appwriteProxyTarget = (() => {
    try {
      return appwriteEndpoint ? new URL(appwriteEndpoint).origin : ''
    } catch {
      return ''
    }
  })()

  return {
    define: { __AU_JOURNAL_LINKS__: JSON.stringify(au ? storefrontReading() : {}) },
    css: au ? { postcss: { plugins: [auStorefrontFonts()] } } : undefined,
    plugins: [react(), {
      name: 'au-storefront-html',
      transformIndexHtml(html, context) {
        if (!au) return html
        if (context.server) {
          return (context.originalUrl || context.path).split('?')[0] === '/' ? addHomeLoading(html) : html
        }
        // The static page generator keeps this hint only on pages that render the catalogue.
        const catalog = Object.values(context.bundle ?? {}).find(
          file => file.type === 'chunk' && file.facadeModuleId?.endsWith('/src/pages/AuRenewalCatalog.tsx'),
        )
        if (!catalog) return html
        return [{
          tag: 'link',
          attrs: { rel: 'modulepreload', crossorigin: true, href: `/${catalog.fileName}`, 'data-au-catalog': true },
          injectTo: 'head',
        }]
      },
    }, {
      name: 'local-asset-redirects',
      configureServer: serveLocalAssetRedirects,
      configurePreviewServer: serveLocalAssetRedirects,
    }],
    build: {
      rolldownOptions: {
        output: {
          entryFileNames: `assets/${releaseAssetNamespace}/[name]-[hash].js`,
          chunkFileNames: `assets/${releaseAssetNamespace}/[name]-[hash].js`,
          assetFileNames: `assets/${releaseAssetNamespace}/[name]-[hash][extname]`,
          // Bundle frequently shared modules together instead of preloading dozens of tiny route dependencies.
          codeSplitting: {
            groups: [{ name: 'shared', minShareCount: 6, includeDependenciesRecursively: false }],
          },
        },
      },
    },
    server: appwriteProxyTarget
      ? {
          proxy: {
            '^/appwrite(?:/|$)': {
              target: appwriteProxyTarget,
              changeOrigin: true,
              cookieDomainRewrite: '',
              rewrite: (path) => path.replace(/^\/appwrite(?=\/|$)/, ''),
              configure: (proxy) => {
                proxy.on('proxyReq', (proxyRequest) => {
                  // Appwrite only allows configured browser origins. Local Tailscale/IP
                  // previews use this same-origin, dev-only proxy without any API key.
                  proxyRequest.removeHeader('origin')
                  proxyRequest.removeHeader('referer')
                })
              },
            },
          },
        }
      : undefined,
  }
})
