export interface RenewalCard {
  id: string;
  en: string;
  ko: string;
  href: string;
  offers: string[];
  image: string;
}
export const RENEWAL_NAV: readonly { en: string; ko: string; href: string }[];
export const RENEWAL_CARDS: Readonly<
  Record<"cakes" | "chocolates" | "celebrate", RenewalCard[]>
>;
export function renewalCardForPath(
  path: string,
  search?: string,
): RenewalCard | null;

export const HALLOWEEN_MERINGUE_CARD: RenewalCard;
export const HALLOWEEN_LAST_PICKUP: string;
export const HALLOWEEN_ORDER_DEADLINE: string;
export function halloweenMeringueAvailable(now?: Date | string | number): boolean;
export function isHalloweenMeringue(offerId: string): boolean;
