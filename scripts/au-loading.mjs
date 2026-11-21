import { readFileSync } from 'node:fs'
import home from '../src/content/au-home-v02.json' with { type: 'json' }

// Inline the home artwork so a slow first visit doesn't need another request.
const heart = readFileSync(new URL('../src/loading/heart.webp', import.meta.url)).toString('base64')
const indicatorCss = readFileSync(new URL('../src/loading/indicator.css', import.meta.url), 'utf8')
  .replace('url(./heart.webp)', `url("data:image/webp;base64,${heart}")`)

const bootIndicator = `<script>
(() => {
  if (location.pathname !== '/') return;
  try {
    if (sessionStorage.getItem('au-home-visited')) return;
    sessionStorage.setItem('au-home-visited', '1');
  } catch { /* Navigation type and referrer still distinguish returns without storage. */ }
  const navigation = performance.getEntriesByType('navigation')[0];
  if ((navigation && navigation.type !== 'navigate') || document.referrer.startsWith(location.origin + '/')) return;

  const root = document.documentElement;
  const pending = 'data-au-boot-pending';
  const remaining = 500 - performance.now();
  if (remaining <= -15000) return;
  root.setAttribute(pending, remaining <= 0 ? 'visible' : '');
  if (remaining > 0) setTimeout(() => {
    if (root.hasAttribute(pending)) root.setAttribute(pending, 'visible');
  }, remaining);
  const clear = () => root.removeAttribute(pending);
  setTimeout(clear, 15000 + remaining);
  addEventListener('pagehide', clear, { once: true });
  addEventListener('error', event => {
    if (event.target instanceof HTMLScriptElement && event.target.type === 'module') clear();
  }, true);
})();
</script>`

const homeHeroPreloads = [
  [home.hero.mobileQuery, home.hero.mobile],
  [`not all and ${home.hero.mobileQuery}`, home.hero.desktop],
].map(([media, src]) => `<link rel="preload" as="image" media="${media}" href="${src}.webp" fetchpriority="high">`).join('\n')

export function addHomeLoading(html) {
  const anchor = html.match(/<meta\s+name="viewport"[^>]*>/i)?.[0] ?? '<head>'
  return html.replace(anchor, `${anchor}\n${homeHeroPreloads}\n${bootIndicator}<style>${indicatorCss}</style>`)
    .replace('<body>', '<body><div id="au-page-loading" role="status" aria-label="Loading page"><span aria-hidden="true"></span></div>')
}
