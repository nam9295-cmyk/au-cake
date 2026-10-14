import type { RenewalSelection } from "./au-renewal.js";
export const RENEWAL_PREORDER_DATE: string;
export interface RenewalPickupPolicy {
  preordersEnabled?: boolean;
  closedDates?: string[];
  closedIntervals?: Record<string, { start: string; end: string }[]>;
}
export function validateRenewalPickup(
  lines: RenewalSelection[],
  date: string,
  time: string,
  now: Date,
  policy?: RenewalPickupPolicy,
): number;
export function renewalPickupSlots(
  lines: RenewalSelection[],
  date: string,
  now: Date,
  policy?: RenewalPickupPolicy,
): string[];
