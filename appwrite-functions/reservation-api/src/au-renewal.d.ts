export const RENEWAL_CONTRACT: "au-renewal.2026-10.v2";
export function isRenewalContract(value: unknown): boolean;
export const RENEWAL_MAX_BYTES: number;
export interface RenewalSelection {
  lineId: string;
  offerId: string;
  quantity: number;
  size?: string;
  finish?: string;
  chocolateType?: string;
  individualPackaging?: boolean;
  mode?: string;
  counts?: number[];
  parentLineId?: string;
}
export interface RenewalOffer {
  name: string;
  price: number | null;
  pieces: number;
  family?: string;
  sizes?: Record<string, number>;
  finishes?: Record<string, number>;
  cream?: boolean;
  chocolate?: boolean;
  newProduct?: boolean;
  provisional?: boolean;
  provisionalSizes?: string[];
  addon?: boolean;
  bundle?: boolean;
}
export interface RenewalLine {
  selection: RenewalSelection;
  productId: string;
  quantity: number;
  productName: string;
  unitPriceCents: number;
  subtotalCents: number;
  physicalQuantity: number;
  flavourTotals: number[];
  priceStatus: string;
  policyVersion: string;
  individualPackaging: boolean;
  individualPackagingPieces: number;
  individualPackagingFeeCents: number;
  packagingUnitCents: number;
  packagingMode: string;
  giftBoxCount: number;
  discountPercent: number;
  discountCents: number;
  totalPriceCents: number;
}
export interface RenewalQuote {
  version: 2;
  policyVersion: string;
  lines: RenewalLine[];
  subtotalCents: number;
  discountCents: number;
  discountBasisCents: number;
  discountPercent: number;
  individualPackagingFeeCents: number;
  individualPackagingPieces: number;
  totalPriceCents: number;
  orderItemCount: number;
}
export const RENEWAL_OFFERS: Readonly<Record<string, RenewalOffer>>;
export const MOCHI_PRICES: readonly number[];
export const MOCHI_NAMES: readonly string[];
export function safeAmount(n: number): number;
export function normalizeRenewalLines(value: unknown): RenewalSelection[];
export function priceRenewalOrder(
  value: unknown,
  options?: {
    localPreview?: boolean;
    reviewCoupon?: { rewardPercent: number };
    contractVersion?: string;
  },
): RenewalQuote;
export function renewalLineSummary(line: RenewalLine): string;
