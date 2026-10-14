import type { RenewalQuote } from "./au-renewal.js";
export function isRenewalDocument(value: unknown): boolean;
export function readRenewalDocument(value: unknown): RenewalQuote;
export function renewalReservationProjection(
  value: unknown,
  options?: { privateFields?: boolean },
): Record<string, unknown>;
export function parseRenewalProjection(value: unknown): Record<string, unknown>;
