import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const siteUrl = 'https://au.verygood-chocolate.com'
const distDir = join(process.cwd(), 'dist')
const defaultSocialImage = `${siteUrl}/og-image.jpg`

const organization = {
  '@type': 'Organization',
  '@id': `${siteUrl}/#organization`,
  name: 'Verygood Chocolate',
  alternateName: 'Very Good Chocolate Sydney',
  url: siteUrl,
  logo: `${siteUrl}/favicon.png`,
  description: 'Small-batch, made-to-order cakes for pre-arranged pick-up in Melrose Park, Sydney.',
  areaServed: { '@type': 'City', name: 'Sydney' },
}

const cakeDetails = [
  {
    slug: 'chocolate-pound-cake-and-cupcakes',
    name: 'Chocolate Pound Cake & Cupcakes',
    description: 'Choose the pound cake, or make it a dozen cupcakes for AUD 10 more.',
    image: `${siteUrl}/products/chocolate-pound-cake.jpg`,
    prices: [45, 55, 67],
    priceSummary: 'Chocolate Pound Cake AUD 45; Chocolate Cupcakes (1 dozen) AUD 55.',
    optionSummary: 'Choose a pound cake or one dozen cupcakes, then choose the available finish. Paid finishes can increase the final price.',
  },
  {
    slug: 'pave-chocolate-cake',
    name: 'Pave Chocolate Cake',
    description: 'A round chocolate cake layered with soft pave ganache and chocolate sponge. Dense, smooth and made for serious chocolate flavour.',
    image: `${siteUrl}/products/pave-chocolate-cake.jpg`,
    prices: [75, 95, 115],
    priceSummary: '6 inch, serves 8: AUD 75; 7.5 inch, serves 14: AUD 95; 9 inch, serves 22: AUD 115.',
    optionSummary: 'Choose a size and dark or milk chocolate.',
  },
  {
    slug: 'chocolatiers-basque-cheesecake',
    name: "Chocolatier's Basque Cheesecake",
    description: 'Choose classic, pave chocolate on top, or a full pave chocolate finish with one Eiffel Tower chocolate.',
    image: `${siteUrl}/products/chocolatiers-basque-cheesecake.jpg`,
    prices: [55, 65, 75],
    priceSummary: 'Classic AUD 55; pave chocolate on top AUD 65; full pave chocolate finish with one Eiffel Tower chocolate AUD 75.',
    optionSummary: 'One gluten-free 6 inch cake serving about 8, with three finishing options.',
  },
  {
    slug: 'lemon-cake',
    name: 'Lemon Cake',
    description: 'Lemon-shaped cakes filled with fresh lemon cream and finished with a floral decoration.',
    image: `${siteUrl}/products/lemon-cake.jpg`,
    prices: [36, 45, 65, 85, 93],
    priceSummary: '6 pieces AUD 36; 8 pieces AUD 45; 12 pieces AUD 65; 16 pieces AUD 85.',
    optionSummary: 'Boxes of 6, 8, 12 or 16. The 12-piece box is Most Popular. Choose the finishing mix.',
  },
  {
    slug: 'vanilla-fresh-cream-cake',
    name: 'Vanilla Fresh Cream Cake',
    description: 'Choose vanilla or chocolate cake sheet with vanilla fresh cream, then Triple berry or Nutella chocolate chip flavour.',
    prices: [75, 98, 139],
    priceSummary: '6 inch, serves 8: AUD 75; 7.5 inch, serves 14: AUD 98; 9 inch, serves 22: AUD 139.',
    optionSummary: 'Choose a size, vanilla or chocolate cake sheet, and Triple berry or Nutella chocolate chip flavour. Product photo is coming soon.',
  },
]

const cakeListItems = cakeDetails.map((cake, index) => ({
  '@type': 'ListItem',
  position: index + 1,
  name: cake.name,
  url: `${siteUrl}/cakes/${cake.slug}`,
}))

const cakeItemList = {
  '@type': 'ItemList',
  '@id': `${siteUrl}/cakes#item-list`,
  name: 'Verygood Chocolate Sydney cake catalogue',
  numberOfItems: cakeListItems.length,
  itemListElement: cakeListItems,
}

function breadcrumb(path, name) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${siteUrl}${path}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Cakes', item: `${siteUrl}/cakes` },
      { '@type': 'ListItem', position: 3, name, item: `${siteUrl}${path}` },
    ],
  }
}

function productSchema(cake, path) {
  const lowPrice = Math.min(...cake.prices)
  const highPrice = Math.max(...cake.prices)
  return {
    '@type': 'Product',
    '@id': `${siteUrl}${path}#product`,
    name: cake.name,
    description: cake.description,
    ...(cake.image ? { image: cake.image } : {}),
    brand: { '@id': `${siteUrl}/#organization` },
    category: 'Made-to-order cake',
    offers: {
      '@type': lowPrice === highPrice ? 'Offer' : 'AggregateOffer',
      url: `${siteUrl}${path}`,
      priceCurrency: 'AUD',
      ...(lowPrice === highPrice
        ? { price: lowPrice }
        : { lowPrice, highPrice }),
      seller: { '@id': `${siteUrl}/#organization` },
    },
  }
}

const cakeRoutePages = Object.fromEntries(cakeDetails.map((cake) => {
  const path = `/cakes/${cake.slug}`
  return [path, {
    title: `${cake.name} Sydney | Verygood Chocolate`,
    description: cake.description,
    robots: 'index, follow',
    ogType: 'product',
    image: cake.image,
    structuredData: [organization, productSchema(cake, path), breadcrumb(path, cake.name)],
    fallbackHtml: `
      <main class="seo-fallback">
        <p><a href="/cakes">View all cakes</a></p>
        <h1>${cake.name}</h1>
        <p>${cake.description}</p>
        <p><strong>Price guide:</strong> ${cake.priceSummary}</p>
        <p><strong>Options:</strong> ${cake.optionSummary}</p>
        <p>Made to order for pre-arranged pick-up in Melrose Park, Sydney. Jenny confirms availability and payment details after your request.</p>
        <p><a href="/reserve" rel="nofollow">Request this cake</a></p>
      </main>`,
  }]
}))

const pages = {
  '/cakes': {
    title: 'Made-to-Order Cakes Sydney | Verygood Chocolate',
    description: 'Browse five small-batch cakes and request confirmed pick-up in Melrose Park, Sydney.',
    robots: 'index, follow',
    structuredData: [
      organization,
      {
        '@type': 'CollectionPage',
        '@id': `${siteUrl}/cakes#collection`,
        name: 'Made-to-Order Cakes Sydney',
        description: 'Browse five small-batch cakes and request confirmed pick-up in Melrose Park, Sydney.',
        url: `${siteUrl}/cakes`,
        mainEntity: `${siteUrl}/cakes#item-list`,
      },
      cakeItemList,
    ],
    fallbackHtml: `
      <main class="seo-fallback">
        <h1>Choose Your Cake</h1>
        <p>Browse five made-to-order cakes for pre-arranged pick-up in Melrose Park, Sydney.</p>
        <ul>
          ${cakeDetails.map((cake) => `<li><a href="/cakes/${cake.slug}">${cake.name}</a> — ${cake.priceSummary}</li>`).join('\n          ')}
        </ul>
      </main>`,
  },
  ...cakeRoutePages,
  '/': {
    title: 'Made-to-Order Chocolate Cakes Sydney | Verygood Chocolate',
    description: 'Order small-batch chocolate, Basque, lemon and fresh cream cakes for pre-arranged pick-up in Melrose Park, Sydney.',
    robots: 'index, follow',
    structuredData: [
      organization,
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: 'Verygood Chocolate Sydney',
        publisher: { '@id': `${siteUrl}/#organization` },
        inLanguage: 'en-AU',
      },
      cakeItemList,
    ],
    fallbackHtml: `
      <main class="seo-fallback">
        <h1>Sydney Made-to-Order Cakes</h1>
        <p>Verygood Chocolate makes small-batch cakes for confirmed, pre-arranged pick-up in Melrose Park, Sydney. This is a home-baking service without a walk-in shop or delivery.</p>
        <section>
          <h2>Cakes available to request</h2>
          <ul>
            ${cakeDetails.map((cake) => `<li><a href="/cakes/${cake.slug}">${cake.name}</a> — ${cake.priceSummary}</li>`).join('\n            ')}
          </ul>
        </section>
        <section>
          <h2>How Sydney cake pick-up works</h2>
          <p>Choose a cake and request a pick-up time. Jenny checks availability and sends payment details. The order is confirmed after payment, and the exact Melrose Park meeting point is shared with the confirmation.</p>
          <p><a href="/cakes">Browse cakes</a> or view the <a href="/classes">kids cake decorating classes</a>.</p>
        </section>
      </main>`,
  },
  '/classes': {
    title: 'Kids Cake Decorating Classes Sydney | Verygood Chocolate',
    description: 'Private weekend cake decorating classes in Melrose Park, Sydney: Basic from Kindy to Year 6 and Advanced for Years 2–6.',
    robots: 'index, follow',
    structuredData: [
      organization,
      {
        '@type': 'Course',
        '@id': `${siteUrl}/classes#course`,
        name: 'Kids Professional Chocolate Cake Course',
        description: 'Private weekend cake courses with Basic classes from Kindy to Year 6 and Advanced 2-Tier classes for Years 2–6.',
        url: `${siteUrl}/classes`,
        provider: { '@id': `${siteUrl}/#organization` },
        educationalLevel: 'Basic: Kindy–Year 6; Advanced: Years 2–6',
        inLanguage: 'en-AU',
        offers: {
          '@type': 'AggregateOffer',
          url: `${siteUrl}/class-reserve`,
          priceCurrency: 'AUD',
          lowPrice: 99,
          highPrice: 198,
        },
      },
    ],
    fallbackHtml: `
      <main class="seo-fallback">
        <h1>Kids Cake Decorating Classes Sydney</h1>
        <p>Private, hands-on cake classes held in Melrose Park, Sydney on Saturdays and Sundays. Basic welcomes children from Kindy to Year 6; Advanced starts from Year 2.</p>
        <section>
          <h2>Basic and Advanced weekend classes</h2>
          <article><h3>Basic Cake Class</h3><p>A 90-minute private session for Kindy–Year 6 where children decorate one 15cm chocolate cake. A Basic Cupcakes &amp; Chocolate Class is also available.</p></article>
          <article><h3>Advanced 2-Tier Cake Class</h3><p>A 120-minute one-child class for Years 2–6, focused on building and finishing a two-tier cake.</p></article>
          <p>Each class may be extended by 30 minutes. Basic and Advanced can also be requested as two separate weekend sessions in one package.</p>
        </section>
        <section>
          <h2>Price Guide</h2>
          <p>Basic is AUD 99 for Kindy–Year 2, AUD 109 for Years 3–6, or AUD 198 for two children. Advanced is AUD 159 for one child. A Basic + Advanced package receives 5% off the base class fees. A 30-minute extension is AUD 20 per participant per class and is not discounted.</p>
          <p>Availability and full payment must be confirmed before the booking is complete. Parents must declare allergies and dietary requirements before confirmation.</p>
          <p><a href="/class-reserve" rel="nofollow">Request a kids cake class</a> or return to <a href="/">Sydney cake orders</a>.</p>
        </section>
      </main>`,
  },
  '/reviews': {
    title: 'Customer Reviews | Verygood Chocolate Sydney',
    description: 'Read verified customer reviews from Verygood Chocolate cake orders and kids cake class bookings in Sydney.',
    robots: 'index, follow',
    structuredData: [organization],
    fallbackHtml: `
      <main class="seo-fallback">
        <h1>Verified Customer Reviews</h1>
        <p>Read reviews shared with permission after verified Verygood Chocolate cake orders and kids cake class bookings in Sydney.</p>
        <p><a href="/cakes">View our cakes</a> or learn about <a href="/classes">kids cake decorating classes</a>.</p>
      </main>`,
  },
  '/cart': {
    title: 'Your Cart | Verygood Chocolate',
    description: 'Review your selected cakes before sending one cake request to Verygood Chocolate Sydney.',
    robots: 'noindex, nofollow',
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
  '/review': {
    title: 'Share Your Review | Verygood Chocolate',
    description: 'Share private feedback about your Verygood Chocolate experience.',
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
  '/admin/reviews': {
    title: 'Review Moderation Admin | Verygood Chocolate',
    description: 'Private review moderation administration.',
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

function upsertHeadTag(html, pattern, tag) {
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`)
}

function renderPage(template, path, config) {
  const canonical = `${siteUrl}${path}`
  const title = escapeHtml(config.title)
  const description = escapeHtml(config.description)
  const image = config.image || defaultSocialImage

  let rendered = template
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta name="robots" content="[^"]*"\s*\/>/, `<meta name="robots" content="${config.robots}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${description}" />`)

  rendered = upsertHeadTag(rendered, /<meta property="og:type" content="[^"]*"\s*\/>/, `<meta property="og:type" content="${config.ogType || 'website'}" />`)
  rendered = upsertHeadTag(rendered, /<meta property="og:image" content="[^"]*"\s*\/>/, `<meta property="og:image" content="${image}" />`)
  rendered = upsertHeadTag(rendered, /<meta property="og:image:type" content="[^"]*"\s*\/>/, '<meta property="og:image:type" content="image/jpeg" />')
  rendered = upsertHeadTag(rendered, /<meta property="og:image:width" content="[^"]*"\s*\/>/, '<meta property="og:image:width" content="1200" />')
  rendered = upsertHeadTag(rendered, /<meta property="og:image:height" content="[^"]*"\s*\/>/, '<meta property="og:image:height" content="630" />')
  rendered = upsertHeadTag(rendered, /<meta name="twitter:image" content="[^"]*"\s*\/>/, `<meta name="twitter:image" content="${image}" />`)

  if (config.structuredData?.length) {
    const scripts = config.structuredData
      .map((data) => `<script type="application/ld+json" data-vg-structured-data="static">${JSON.stringify({ '@context': 'https://schema.org', ...data })}</script>`)
      .join('\n    ')
    rendered = rendered.replace('</head>', `    ${scripts}\n  </head>`)
  }

  if (!config.fallbackHtml) return rendered
  return rendered.replace('<div id="root"></div>', `<div id="root">${config.fallbackHtml}</div>`)
}

const template = await readFile(join(distDir, 'index.html'), 'utf8')

for (const [path, config] of Object.entries(pages)) {
  const outputPath = path === '/' ? join(distDir, 'index.html') : join(distDir, `${path.slice(1)}.html`)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, renderPage(template, path, config))
}

const indexablePaths = [
  '/',
  '/cakes',
  ...cakeDetails.map((cake) => `/cakes/${cake.slug}`),
  '/classes',
  '/reviews',
]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexablePaths.map((path) => `  <url><loc>${siteUrl}${path}</loc></url>`).join('\n')}
</urlset>
`
await writeFile(join(distDir, 'sitemap.xml'), sitemap)

console.log(`Generated ${Object.keys(pages).length} route-specific SEO pages and ${indexablePaths.length} sitemap URLs.`)
