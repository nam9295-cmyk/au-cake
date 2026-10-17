const card = (id, en, ko, href, offers, image = "") => ({
  id,
  en,
  ko,
  href,
  offers,
  image,
});
export const RENEWAL_NAV = Object.freeze([
  { en: "Cake & Bake", ko: "Cake & Bake", href: "/cakes" },
  { en: "Chocolate", ko: "Chocolate", href: "/chocolates" },
  { en: "Celebrate", ko: "Celebrate", href: "/celebrate" },
  { en: "Custom Cake", ko: "Custom Cake", href: "/custom-cakes" },
  { en: "Business", ko: "Business", href: "/business" },
]);
export const RENEWAL_CARDS = Object.freeze({
  cakes: [
    card(
      "pave",
      "Pavé Whole Cake",
      "파베 홀케이크",
      "/cakes/pave-chocolate-cake",
      ["pave-cake"],
      "/products/pave-chocolate-cake-sydney.webp",
    ),
    card(
      "gateau-loaf",
      "Signature Gâteau Loaf",
      "시그니처 갸또 로프 파운드",
      "/cakes/signature-gateau-au-chocolat",
      ["pound-cake"],
      "/products/signature-gateau-au-chocolat-sydney.webp",
    ),
    card(
      "brownie-whole",
      "Brownie Basque Whole Cake",
      "브라우니 바스크 홀케이크",
      "/cakes/brownie-cheesecake?form=whole",
      ["brownie-whole"],
      "/products/details/brownie-cheesecake/hero-1080.webp",
    ),
    card(
      "brownie-loaf",
      "Brownie Basque Loaf",
      "브라우니 바스크 로프 파운드",
      "/cakes/brownie-cheesecake?form=loaf",
      ["brownie-loaf"],
      "/products/renewal-photos/cheese-pound-hero.webp",
    ),
    card(
      "cookies",
      "Levain Cookies · Six",
      "르뱅쿠키 6개 세트",
      "/cakes/levain-cookies",
      ["cookie-six"],
      "/products/renewal-photos/cookies-hero_v2.webp",
    ),
  ],
  chocolates: [
    card(
      "mochi",
      "Pavé Mochi",
      "파베 모찌",
      "/chocolates/chocolate-mochi",
      ["mochi"],
      "/products/renewal-photos/mochi-mochi-hero.webp",
    ),
    card(
      "almond",
      "Almond Chocolate",
      "아몬드초콜릿",
      "/chocolates/almond-chocoball",
      [
        "almond-chocoball-80g",
        "almond-chocoball-6pack",
        "almond-chocoball-black-tub-2x80g",
      ],
      "/products/chocolates/almond-chocoball.webp",
    ),
    card(
      "pave-chocolate",
      "Pavé Chocolate · Heart Tin 100g",
      "파베초콜릿 · 하트 통 100g",
      "/chocolates/pave-chocolate",
      ["pave-chocolate-100g", "pave-six-plus-one"],
      "/products/renewal-photos/pave-heart-cutout.webp",
    ),
    card(
      "eiffel",
      "Eiffel Tower Chocolate",
      "에펠탑초콜릿",
      "/chocolates/eiffel-tower-chocolate",
      ["eiffel-tower-chocolate-6", "eiffel-six-plus-one"],
      "/products/chocolates/eiffel-tower-chocolate.webp",
    ),
  ],
  celebrate: [
    card(
      "gateau-cupcakes",
      "Gâteau Cupcakes",
      "갸또쇼콜라컵케이크",
      "/cakes/chocolate-cupcakes",
      ["cupcake-half-dozen", "cupcake-dozen"],
      "/products/details/cupcakes/packaging-480.webp",
    ),
    card(
      "brownie-cupcakes",
      "Brownie Basque Cupcakes",
      "브라우니 바스크 컵케이크",
      "/cakes/brownie-cupcakes",
      ["brownie-cupcakes-6", "brownie-cupcakes-12"],
      "/products/renewal-photos/cheese-cupcake-hero.webp",
    ),
    card(
      "smore",
      "S’more Sticks",
      "스모어스틱",
      "/cakes/smore-stick",
      ["smore-6", "smore-12"],
      "/products/details/smore/packaging-480.webp",
    ),
  ],
});
export function renewalCardForPath(path, search = "") {
  path = path.replace(/\/+$/, "") || "/";
  const form = new URLSearchParams(search).get("form");
  return (
    Object.values(RENEWAL_CARDS)
      .flat()
      .find(
        (c) =>
          c.href.split("?")[0] === path &&
          (c.id === "brownie-loaf"
            ? form === "loaf"
            : c.id === "brownie-whole"
              ? form !== "loaf"
              : true),
      ) || null
  );
}
