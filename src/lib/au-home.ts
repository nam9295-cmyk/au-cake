import { RENEWAL_CARDS } from "../../appwrite-functions/reservation-api/src/au-renewal-catalog.js";
import { RENEWAL_OFFERS } from "../../appwrite-functions/reservation-api/src/au-renewal.js";
import type { Language } from "./i18n";
export type HomeCollectionId = "whole" | "sharing" | "chocolates";
export interface HomeProduct {
  id: string;
  name: string;
  description: string;
  image: string;
  imageAlt: string;
  price: string;
  href: string | null;
  comingSoon?: boolean;
}
export function getAuHomeCollections(language: Language) {
  return (["cakes", "chocolates", "celebrate"] as const).map((category) => ({
    id: (
      {
        cakes: "whole",
        chocolates: "chocolates",
        celebrate: "sharing",
      } as const
    )[category],
    label: {
      cakes: "Cake & Bake",
      chocolates: "Chocolate",
      celebrate: "Celebrate",
    }[category],
    products: RENEWAL_CARDS[category].map((card) => ({
      id: card.id,
      name: language === "ko" ? card.ko : card.en,
      description: "",
      image: card.image,
      imageAlt: language === "ko" ? card.ko : card.en,
      href: card.href,
      price:
        card.id === "mochi"
          ? (language === "ko" ? "개당 AUD 8.00부터" : "From AUD 8.00 each")
          : RENEWAL_OFFERS[card.offers[0]].price === null ||
              RENEWAL_OFFERS[card.offers[0]].provisional
            ? ""
            : `AUD ${(RENEWAL_OFFERS[card.offers[0]].price! / 100).toFixed(2)}`,
    })),
  }));
}
export function getAuHomeBest(language: Language) {
  const collections = getAuHomeCollections(language);
  const mochi = collections[1].products.find((product) => product.id === "mochi")!;
  return [...collections[0].products.slice(0, 3), mochi];
}
