import { renewalPickupCopy } from "./au-renewal-pickup-policy.js";
import { RENEWAL_OFFERS } from "./au-renewal.js";
import { RENEWAL_NAV, RENEWAL_CARDS } from "./au-renewal-catalog.js";
export function renewalSeoPages(siteUrl, content) {
  const pages = {};
  const description = `Made-to-order cakes and chocolate in Melrose Park, Sydney. ${renewalPickupCopy("en").hours} Reservation requests are confirmed by our team.`;
  const nav = RENEWAL_NAV.map(
    (n) => `<a href="${n.href}">${n.en.replace("&", "&amp;")}</a>`,
  ).join(" · ");
  const cards = Object.values(RENEWAL_CARDS).flat();
  for (const item of [
    { href: "/", en: "VERYGOOD Sydney" },
    ...RENEWAL_NAV,
    ...cards,
  ]) {
    const path = item.href.split("?")[0];
    if (pages[path]) continue;
    const category = RENEWAL_CARDS[path.slice(1)];
    const list = category || (path === "/" ? cards : []);
    pages[path] = {
      title: `${item.en} | verygood chocolate`,
      description,
      canonical: `${siteUrl}${path === "/" ? "" : path}`,
      output: "directory",
      extensionlessAlias: path !== "/",
      ...(item.image
        ? { image: `${siteUrl}${item.image}` }
        : { omitImage: true }),
      structuredData: [
        {
          "@type": list.length ? "CollectionPage" : "WebPage",
          name: item.en,
          url: `${siteUrl}${path}`,
          ...(list.length
            ? {
                mainEntity: {
                  "@type": "ItemList",
                  itemListElement: list.map((c, i) => ({
                    "@type": "ListItem",
                    position: i + 1,
                    name: c.en,
                    url: `${siteUrl}${c.href}`,
                  })),
                },
              }
            : {}),
        },
      ],
      fallbackHtml: `<main><nav>${nav}</nav><h1>${item.en.replace("&", "&amp;")}</h1><p>${description}</p>${list.map((c) => `<p><a href="${c.href}">${c.en}</a></p>`).join("")}<p>Mochi pre-orders from 16 October 2026, subject to readiness checks and manual opening. Minimum 24 hours preparation. Cookie reservations await price approval.</p></main>`,
    };
  }
  if (content) {
    for (const [path, page] of Object.entries(pages)) {
      const old =
        path === "/"
          ? content.home
          : path === "/cakes"
            ? content.cakes
            : content.cakePages[path.split("/").at(-1)];
      if (old) {
        page.title = old.title;
        page.description =
          path === "/"
            ? "Made-to-order cakes and chocolate creations in Sydney. Explore our menu, custom cakes and business enquiries."
            : old.description;
        if (old.imagePath) {
          page.image = siteUrl + old.imagePath;
          delete page.omitImage;
          page.imageType = old.imageType;
          page.imageWidth = old.imageWidth;
          page.imageHeight = old.imageHeight;
        }
      }
    }
    pages["/"].structuredData = [
      {
        "@type": "Organization",
        name: "verygood chocolate",
        url: siteUrl,
        sameAs: content.site.socialProfiles,
      },
      { "@type": "WebSite", name: "verygood chocolate", url: siteUrl },
      {
        "@type": "ItemList",
        itemListElement: cards.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.en,
          url: siteUrl + c.href,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: content.home.faq.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
    ];
  }
  return pages;
}

export function renderRenewalLlms(siteUrl, additionalEntries = []) {
  return [
    "# verygood chocolate Sydney",
    "",
    "Official Instagram: https://www.instagram.com/verygood_syd/",
    `Made-to-order cakes and treats with chocolatier-grade couverture chocolate. Pickup in Melrose Park, Sydney. ${renewalPickupCopy("en").hours} Requests are confirmed by our team after availability and payment checks.`,
    "Mochi pre-orders from 16 October 2026, subject to readiness checks and manual opening, with at least 24 hours preparation. Cookie reservations await price approval.",
    ...RENEWAL_NAV.map((n) => `- ${n.en}: ${siteUrl}${n.href}`),
    ...Object.entries(RENEWAL_CARDS).flatMap(([category, cards]) => [
      "",
      `## ${RENEWAL_NAV.find((n) => n.href === `/${category}`).en}`,
      ...cards.map((c) => {
        const p = RENEWAL_OFFERS[c.offers[0]];
        const price =
          c.id === "mochi"
            ? "Six flavours from AUD 8.00 each. Build a four-piece gift box at the sum of your selections, with free box packaging, or buy singles; optional individual packaging AUD 0.50 per piece."
            : p.price === null || p.provisional
              ? "Price to be confirmed."
              : `From AUD ${(p.price / 100).toFixed(2)}.`;
        return `- ${c.en}: ${price} ${siteUrl}${c.href}`;
      }),
    ]),
    "",
    `Class archive and enquiries: ${siteUrl}/classes`,
    ...additionalEntries,
    "",
  ].join("\n");
}
