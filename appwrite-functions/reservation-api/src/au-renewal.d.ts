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
  flavourCounts?: MochiCounts;
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
export type MochiFlavourId = "strawberry" | "green_grape" | "mandarin" | "banana" | "butter_redbean" | "nama_chocolate";
export type MochiCounts = Record<MochiFlavourId, number>;
export const MOCHI_FLAVOURS: readonly Readonly<{ id: MochiFlavourId; en: string; ko: string; priceCents: number }>[];
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

export const MOCHI_DISPLAY_FLAVOURS: typeof MOCHI_FLAVOURS;
export function mochiFlavourName(id: string, language?: string): string;
export function renewalProductName(line: { productId: string; productName: string }, language?: string): string;
