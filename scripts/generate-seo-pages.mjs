import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const siteUrl = 'https://au.verygood-chocolate.com'
const distDir = join(process.cwd(), 'dist')

const pages = {
  '/': {
    title: 'Made-to-Order Chocolate Cakes Sydney | Verygood Chocolate',
    description: 'Order small-batch chocolate cakes, gâteau au chocolat and cupcakes for pre-arranged pick-up in Melrose Park, Sydney.',
    robots: 'index, follow',
    fallbackHtml: `
      <main class="seo-fallback">
        <h1>Sydney Made-to-Order Chocolate Cakes</h1>
        <p>Verygood Chocolate makes small-batch chocolate cakes for confirmed, pre-arranged pick-up in Melrose Park, Sydney. This is a home-baking service without a walk-in shop or delivery.</p>
        <section>
          <h2>Chocolate cakes available to order</h2>
          <article><h3>Pave Chocolate Cake</h3><p>Layered chocolate sponge and smooth pave ganache. Available in 15cm, 19cm and 22cm sizes from AUD 75.</p></article>
          <article><h3>Gâteau au Chocolat</h3><p>A rich rectangular chocolate cake finished with dark chocolate, from AUD 45.</p></article>
          <article><h3>Chocolate Cupcakes</h3><p>One dozen small-batch chocolate cupcakes for parties, sharing or gifting, from AUD 55.</p></article>
        </section>
        <section>
          <h2>How Sydney cake pick-up works</h2>
          <p>Choose a cake and request a pick-up time. Jenny checks availability and sends payment details. The order is confirmed after payment, and the exact Melrose Park meeting point is shared with the confirmation.</p>
          <p><a href="/reserve" rel="nofollow">Request a chocolate cake</a> or view the <a href="/classes">kids cake decorating classes</a>.</p>
        </section>
      </main>`,
  },
  '/classes': {
    title: 'Kids Cake Decorating Classes Sydney | Verygood Chocolate',
    description: 'Private, hands-on chocolate cake decorating classes for primary school children in Melrose Park, Sydney. Limited school holiday sessions.',
    robots: 'index, follow',
    fallbackHtml: `
      <main class="seo-fallback">
        <h1>Kids Cake Decorating Classes Sydney</h1>
        <p>Private, hands-on chocolate cake classes for primary school children in Years 1-6, held in Melrose Park, Sydney during selected school holiday sessions.</p>
        <section>
          <h2>Kids professional chocolate cake course</h2>
          <p>Each child plans, builds and finishes one 15cm chocolate cake with Jenny's guidance, then boxes the finished cake to take home. Sessions have a maximum of two children.</p>
          <p>Launch prices are AUD 99 for Years 1-2, AUD 109 for Years 3-6, or AUD 198 for two children. Availability and full payment must be confirmed before the booking is complete.</p>
          <p>Parents must declare allergies and dietary requirements before confirmation. This is a short private class, not childcare.</p>
          <p><a href="/class-reserve" rel="nofollow">Request a kids cake class</a> or return to <a href="/">Sydney chocolate cake orders</a>.</p>
        </section>
      </main>`,
  },
  '/reserve': {
    title: 'Request a Chocolate Cake | Verygood Chocolate',
    description: 'Submit a cake booking request to Verygood Chocolate Sydney.',
    robots: 'noindex, nofollow',
  },
  '/complete': {
    title: 'Cake Request Received | Verygood Chocolate',
    description: 'Your cake request has been received.',
    robots: 'noindex, nofollow',
  },
  '/lookup': {
    title: 'Find Your Booking | Verygood Chocolate',
    description: 'Look up an existing Verygood Chocolate booking.',
    robots: 'noindex, nofollow',
  },
  '/class-reserve': {
    title: 'Request a Kids Cake Class | Verygood Chocolate',
    description: 'Submit a private kids cake class booking request.',
    robots: 'noindex, nofollow',
  },
  '/class-complete': {
    title: 'Class Request Received | Verygood Chocolate',
    description: 'Your kids cake class request has been received.',
    robots: 'noindex, nofollow',
  },
  '/calendar': {
    title: 'Private Schedule | Verygood Chocolate',
    description: 'Private read-only booking schedule.',
    robots: 'noindex, nofollow',
  },
  '/admin': {
    title: 'Admin | Verygood Chocolate',
    description: 'Verygood Chocolate administration.',
    robots: 'noindex, nofollow',
  },
  '/admin/login': {
    title: 'Admin Login | Verygood Chocolate',
    description: 'Verygood Chocolate administration login.',
    robots: 'noindex, nofollow',
  },
  '/admin/reservations': {
    title: 'Cake Reservations Admin | Verygood Chocolate',
    description: 'Verygood Chocolate cake reservation administration.',
    robots: 'noindex, nofollow',
  },
  '/admin/classes': {
    title: 'Class Reservations Admin | Verygood Chocolate',
    description: 'Verygood Chocolate class reservation administration.',
    robots: 'noindex, nofollow',
  },
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function renderPage(template, path, config) {
  const canonical = `${siteUrl}${path}`
  const title = escapeHtml(config.title)
  const description = escapeHtml(config.description)

  const rendered = template
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta name="robots" content="[^"]*"\s*\/>/, `<meta name="robots" content="${config.robots}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${description}" />`)

  if (!config.fallbackHtml) return rendered
  return rendered.replace('<div id="root"></div>', `<div id="root">${config.fallbackHtml}</div>`)
}

const template = await readFile(join(distDir, 'index.html'), 'utf8')

for (const [path, config] of Object.entries(pages)) {
  const outputPath = path === '/' ? join(distDir, 'index.html') : join(distDir, `${path.slice(1)}.html`)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, renderPage(template, path, config))
}

console.log(`Generated ${Object.keys(pages).length} route-specific SEO pages.`)
