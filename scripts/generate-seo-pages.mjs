import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import auPublicPages from '../src/content/au-public-pages.json' with { type: 'json' }
import { renderAuLlms } from './render-au-llms.mjs'

const siteUrl = auPublicPages.site.url
const distDir = join(process.cwd(), 'dist')
const brand = auPublicPages.site.brand
const defaultSocialImage = auPublicPages.site.defaultSocialImage
const defaultSocialImageUrl = `${siteUrl}${defaultSocialImage.path}`

const organization = {
  '@type': 'Organization',
  '@id': `${siteUrl}/#organization`,
  name: brand,
  url: siteUrl,
  logo: `${siteUrl}/favicon.png`,
  description: auPublicPages.site.organizationDescription,
  sameAs: auPublicPages.site.socialProfiles,
  areaServed: { '@type': 'City', name: 'Sydney' },
}

const cakeEntries = Object.entries(auPublicPages.cakePages).map(([slug, page]) => ({ slug, ...page }))
const legacyCakeEntries = Object.entries(auPublicPages.legacyCakePages).map(([slug, page]) => ({ slug, ...page }))
const cakeListItems = cakeEntries.map((cake, index) => ({
  '@type': 'ListItem',
  position: index + 1,
  name: cake.name,
  url: `${siteUrl}/cakes/${cake.slug}`,
}))
const cakeItemList = {
  '@type': 'ItemList',
  '@id': `${siteUrl}/cakes#item-list`,
  name: `${brand} Sydney cake catalogue`,
  numberOfItems: cakeListItems.length,
  itemListElement: cakeListItems,
}

const homeFaqPage = {
  '@type': 'FAQPage',
  '@id': `${siteUrl}/#faq`,
  mainEntity: auPublicPages.home.faq.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}

function canonicalFor(path) {
  return path === '/' ? siteUrl : `${siteUrl}${path}`
}

function imageFor(page) {
  return page.imagePath ? `${siteUrl}${page.imagePath}` : undefined
}

function breadcrumb(path, name) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalFor(path)}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Cakes', item: `${siteUrl}/cakes` },
      { '@type': 'ListItem', position: 3, name, item: canonicalFor(path) },
    ],
  }
}

function productSchema(cake, path) {
  return {
    '@type': 'Product',
    '@id': `${canonicalFor(path)}#product`,
    name: cake.name,
    description: cake.description,
    ...(imageFor(cake) ? { image: imageFor(cake) } : {}),
    brand: { '@type': 'Brand', name: brand },
    category: 'Made-to-order cake',
    offers: {
      '@type': 'Offer',
      url: canonicalFor(path),
      priceCurrency: 'AUD',
      price: cake.startingPrice,
      seller: { '@type': 'Organization', name: brand, url: siteUrl },
    },
  }
}

function cakeFallback(cake, path) {
  const image = imageFor(cake)
  const legacyActions = cake.slug === 'chocolate-pound-cake-and-cupcakes'
    ? '<p><a href="/cakes/signature-gateau-au-chocolat">Signature Gâteau au Chocolat</a> · <a href="/cakes/chocolate-cupcakes">Chocolate Cupcakes</a></p>'
    : cake.slug === 'chocolatiers-basque-cheesecake'
      ? '<p><a href="/cakes">View current cakes</a></p>'
      : '<p><a href="/reserve">Request this cake</a></p>'
  return `
      <main class="seo-fallback">
        <p><a href="/cakes">View all cakes</a></p>
        <h1>${escapeHtml(cake.name)}</h1>
        ${image ? `<p><img src="${image}" alt="${escapeHtml(cake.imageAlt)}" width="${cake.imageWidth}" height="${cake.imageHeight}" loading="eager" decoding="async" /></p>` : ''}
        <p>${escapeHtml(cake.description)}</p>
        <p><strong>Price guide:</strong> ${escapeHtml(cake.priceSummary)}</p>
        <p><strong>Options:</strong> ${escapeHtml(cake.optionSummary)}</p>
        <p>Made to order for pre-arranged pickup in Melrose Park, Sydney. Availability is checked after your request and payment is confirmed separately.</p>
        ${legacyActions}
      </main>`
}

function cakePageConfig(cake, robots = 'index, follow') {
  const path = `/cakes/${cake.slug}`
  const image = imageFor(cake)
  const isWebPageOnly = cake.schema === 'webpage-only'
  return {
    title: cake.title,
    description: cake.description,
    robots,
    ogType: isWebPageOnly ? 'website' : 'product',
    ...(image ? { image, imageType: cake.imageType, imageWidth: cake.imageWidth, imageHeight: cake.imageHeight } : {}),
    structuredData: isWebPageOnly
      ? [
          {
            '@type': 'WebPage',
            '@id': `${canonicalFor(path)}#webpage`,
            name: cake.name,
            description: cake.description,
            url: canonicalFor(path),
          },
          breadcrumb(path, cake.name),
        ]
      : [productSchema(cake, path), breadcrumb(path, cake.name)],
    fallbackHtml: cakeFallback(cake, path),
  }
}

const privatePages = {
  '/cart': {
    title: `Your Cart | ${brand}`,
    description: `Review your selected cakes before sending one cake request to ${brand} Sydney.`,
  },
  '/reserve': {
    title: `Request a Chocolate Cake | ${brand}`,
    description: `Submit a cake booking request to ${brand} Sydney.`,
  },
  '/complete': {
    title: `Cake Request Received | ${brand}`,
    description: 'Your cake request has been received.',
  },
  '/lookup': {
    title: `Find Your Booking | ${brand}`,
    description: `Look up an existing ${brand} booking.`,
  },
  '/class-reserve': {
    title: `Request a Kids Cake Class | ${brand}`,
    description: 'Submit a private kids cake class booking request.',
  },
  '/class-complete': {
    title: `Class Request Received | ${brand}`,
    description: 'Your kids cake class request has been received.',
  },
  '/calendar': {
    title: `Private Schedule | ${brand}`,
    description: 'Private read-only booking schedule.',
  },
  '/review': {
    title: `Share Your Review | ${brand}`,
    description: `Share private feedback about your ${brand} experience.`,
  },
  '/admin': {
    title: `Admin | ${brand}`,
    description: `${brand} administration.`,
  },
  '/admin/login': {
    title: `Admin Login | ${brand}`,
    description: `${brand} administration login.`,
  },
  '/admin/reservations': {
    title: `Cake Reservations Admin | ${brand}`,
    description: `${brand} cake reservation administration.`,
  },
  '/admin/classes': {
    title: `Class Reservations Admin | ${brand}`,
    description: `${brand} class reservation administration.`,
  },
  '/admin/reviews': {
    title: `Review Moderation Admin | ${brand}`,
    description: 'Private review moderation administration.',
  },
}

const homeFallback = `
      <main class="seo-fallback">
        <h1>${escapeHtml(auPublicPages.home.h1)}</h1>
        <p>${escapeHtml(auPublicPages.home.hero)}</p>
        <p><strong>${escapeHtml(auPublicPages.home.pickup)}</strong></p>
        <p><a href="/cakes">Browse Chocolate Cakes</a></p>
        <section id="how-ordering-works">
          <h2>How ordering works</h2>
          <ol>${auPublicPages.home.orderingSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
        </section>
        <section>
          <h2>Chocolate cakes available to request</h2>
          <ul>${cakeEntries.map((cake) => `<li><a href="/cakes/${cake.slug}">${escapeHtml(cake.name)}</a> — ${escapeHtml(cake.priceSummary)}</li>`).join('')}</ul>
        </section>
        <section>
          <h2>Sydney cake order FAQ</h2>
          ${auPublicPages.home.faq.map((item) => `<article><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p></article>`).join('')}
        </section>
      </main>`

const pages = {
  '/': {
    title: auPublicPages.home.title,
    description: auPublicPages.home.description,
    robots: 'index, follow',
    structuredData: [
      organization,
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: `${brand} Sydney`,
        publisher: { '@id': `${siteUrl}/#organization` },
        inLanguage: auPublicPages.site.language,
      },
      cakeItemList,
      homeFaqPage,
    ],
    fallbackHtml: homeFallback,
  },
  '/cakes': {
    title: auPublicPages.catalogue.title,
    description: auPublicPages.catalogue.description,
    robots: 'index, follow',
    structuredData: [
      organization,
      {
        '@type': 'CollectionPage',
        '@id': `${siteUrl}/cakes#collection`,
        name: auPublicPages.catalogue.collectionName,
        description: auPublicPages.catalogue.description,
        url: `${siteUrl}/cakes`,
        mainEntity: `${siteUrl}/cakes#item-list`,
      },
      cakeItemList,
    ],
    fallbackHtml: `
      <main class="seo-fallback">
        <h1>${escapeHtml(auPublicPages.catalogue.h1)}</h1>
        <p>${escapeHtml(auPublicPages.catalogue.intro)}</p>
        <ul>${cakeEntries.map((cake) => `<li><a href="/cakes/${cake.slug}">${escapeHtml(cake.name)}</a> — ${escapeHtml(cake.priceSummary)}</li>`).join('')}</ul>
      </main>`,
  },
  '/classes': {
    title: auPublicPages.classes.title,
    description: auPublicPages.classes.description,
    robots: 'index, follow',
    structuredData: [
      organization,
      {
        '@type': 'Course',
        '@id': `${siteUrl}/classes#course`,
        name: auPublicPages.classes.courseName,
        description: auPublicPages.classes.courseDescription,
        url: `${siteUrl}/classes`,
        provider: { '@id': `${siteUrl}/#organization` },
        educationalLevel: auPublicPages.classes.educationalLevel,
        inLanguage: auPublicPages.site.language,
        offers: {
          '@type': 'AggregateOffer',
          url: `${siteUrl}/class-reserve`,
          priceCurrency: 'AUD',
          lowPrice: auPublicPages.classes.baseLowPrice,
          highPrice: auPublicPages.classes.baseHighPrice,
        },
      },
    ],
    fallbackHtml: `
      <main class="seo-fallback">
        <h1>${escapeHtml(auPublicPages.classes.h1)}</h1>
        <p>${escapeHtml(auPublicPages.classes.intro)}</p>
        <section>
          <h2>Basic and Advanced Spring Vacation classes</h2>
          <p>${escapeHtml(auPublicPages.classes.courseDescription)}</p>
        </section>
        <section>
          <h2>Price Guide</h2>
          <p>Base course/package range: AUD ${auPublicPages.classes.baseLowPrice}–${auPublicPages.classes.baseHighPrice.toFixed(2)}.</p>
          <p>${escapeHtml(auPublicPages.classes.packageSummary)}</p>
          <p>${escapeHtml(auPublicPages.classes.extensionSummary)}</p>
          <p>Availability and full payment must be confirmed before the booking is complete. Parents must declare allergies and dietary requirements before confirmation.</p>
          <p><a href="/class-reserve" rel="nofollow">Request a kids cake class</a> or return to <a href="/">Sydney cake orders</a>.</p>
        </section>
      </main>`,
  },
  '/reviews': {
    title: auPublicPages.reviews.title,
    description: auPublicPages.reviews.description,
    robots: 'index, follow',
    structuredData: [organization],
    fallbackHtml: `
      <main class="seo-fallback">
        <h1>${escapeHtml(auPublicPages.reviews.h1)}</h1>
        <p>${escapeHtml(auPublicPages.reviews.intro)}</p>
        <p><a href="/cakes">View our cakes</a> or learn about <a href="/classes">kids cake decorating classes</a>.</p>
      </main>`,
  },
  ...Object.fromEntries(cakeEntries.map(cake => [`/cakes/${cake.slug}`, cakePageConfig(cake)])),
  ...Object.fromEntries(legacyCakeEntries.map(cake => [`/cakes/${cake.slug}`, cakePageConfig(cake, 'noindex, nofollow')])),
  ...Object.fromEntries(Object.entries(privatePages).map(([path, page]) => [path, { ...page, robots: 'noindex, nofollow' }])),
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function upsertHeadTag(html, pattern, tag) {
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

function renderPage(template, path, config) {
  const canonical = canonicalFor(path)
  const title = escapeHtml(config.title)
  const description = escapeHtml(config.description)
  const image = config.image || defaultSocialImageUrl
  const imageType = config.imageType || defaultSocialImage.type
  const imageWidth = config.imageWidth || defaultSocialImage.width
  const imageHeight = config.imageHeight || defaultSocialImage.height

  let rendered = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta\s+name="robots"[\s\S]*?\/>/, `<meta name="robots" content="${config.robots}" />`)
    .replace(/<link\s+rel="canonical"[\s\S]*?\/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta\s+property="og:title"[\s\S]*?\/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta\s+property="og:description"[\s\S]*?\/>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta\s+property="og:url"[\s\S]*?\/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta\s+name="twitter:title"[\s\S]*?\/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta\s+name="twitter:description"[\s\S]*?\/>/, `<meta name="twitter:description" content="${description}" />`)

  rendered = upsertHeadTag(rendered, /<meta\s+property="og:type"[\s\S]*?\/>/, `<meta property="og:type" content="${config.ogType || 'website'}" />`)
  rendered = upsertHeadTag(rendered, /<meta\s+property="og:site_name"[\s\S]*?\/>/, `<meta property="og:site_name" content="${brand}" />`)
  rendered = upsertHeadTag(rendered, /<meta\s+property="og:image"[\s\S]*?\/>/, `<meta property="og:image" content="${image}" />`)
  rendered = upsertHeadTag(rendered, /<meta\s+property="og:image:type"[\s\S]*?\/>/, `<meta property="og:image:type" content="${imageType}" />`)
  rendered = upsertHeadTag(rendered, /<meta\s+property="og:image:width"[\s\S]*?\/>/, `<meta property="og:image:width" content="${imageWidth}" />`)
  rendered = upsertHeadTag(rendered, /<meta\s+property="og:image:height"[\s\S]*?\/>/, `<meta property="og:image:height" content="${imageHeight}" />`)
  rendered = upsertHeadTag(rendered, /<meta\s+name="twitter:image"[\s\S]*?\/>/, `<meta name="twitter:image" content="${image}" />`)
  rendered = upsertHeadTag(rendered, /<meta\s+name="twitter:card"[\s\S]*?\/>/, '<meta name="twitter:card" content="summary_large_image" />')

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

const indexablePaths = ['/', '/cakes', ...cakeEntries.map((cake) => `/cakes/${cake.slug}`), '/classes', '/reviews']
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexablePaths.map((path) => `  <url><loc>${canonicalFor(path)}</loc></url>`).join('\n')}
</urlset>
`
await writeFile(join(distDir, 'sitemap.xml'), sitemap)
try {
  await writeFile(join(process.cwd(), 'public', 'sitemap.xml'), sitemap)
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

const llms = renderAuLlms(auPublicPages)
await writeFile(join(distDir, 'llms.txt'), llms)
try {
  await writeFile(join(process.cwd(), 'public', 'llms.txt'), llms)
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

console.log(`Generated ${Object.keys(pages).length} route-specific SEO pages and ${indexablePaths.length} sitemap URLs.`)
