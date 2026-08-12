import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          entryFileNames: `assets/${releaseAssetNamespace}/[name]-[hash].js`,
          chunkFileNames: `assets/${releaseAssetNamespace}/[name]-[hash].js`,
          assetFileNames: `assets/${releaseAssetNamespace}/[name]-[hash][extname]`,
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
