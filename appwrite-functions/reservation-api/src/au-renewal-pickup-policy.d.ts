export const RENEWAL_PICKUP_POLICY_VERSION: "au-renewal-pickup.2026-10-14.v2";
export const RENEWAL_PICKUP_SCHEDULE: Readonly<{
  timezone: "Australia/Sydney";
  intervalMinutes: 15;
  weekdays: Readonly<Record<number, Readonly<{ open: string; close: string }>>>;
}>;
export interface RenewalServicePolicy {
  closedDates?: readonly string[];
  closedIntervals?: Readonly<
    Record<string, readonly { start: string; end: string }[]>
  >;
}
export function renewalServiceSlots(
  date: string,
  policy?: RenewalServicePolicy,
): string[];
export function isRenewalServiceTime(
  date: string,
  time: string,
  policy?: RenewalServicePolicy,
): boolean;
export function renewalPickupCopy(language?: "en" | "ko"): {
  hours: string;
  driver: string;
};
