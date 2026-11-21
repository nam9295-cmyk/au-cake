import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'

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
    plugins: [react(), {
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
