import {
  normalizeRenewalLines,
  priceRenewalOrder,
  type RenewalSelection,
} from "../../appwrite-functions/reservation-api/src/au-renewal.js";
export const RENEWAL_CART_KEY = "verygood-au-renewal-cart-v1";
function identity(line: RenewalSelection) {
  const { lineId, quantity, ...options } = line;
  void lineId;
  void quantity;
  return JSON.stringify(options);
}
export function addRenewalLines(
  current: readonly RenewalSelection[],
  incoming: RenewalSelection[],
): RenewalSelection[] {
  const normalized = normalizeRenewalLines([...current, ...incoming]);
  const merged: RenewalSelection[] = [];
  const aliases = new Map<string, string>();
  for (const original of normalized) {
    const line = {
      ...original,
      ...(original.parentLineId
        ? {
            parentLineId:
              aliases.get(original.parentLineId) || original.parentLineId,
          }
        : {}),
    };
    const existing = merged.find(
      (l) => identity(l) === identity(line) && l.mode !== "quantity",
    );
    if (existing) {
      existing.quantity += line.quantity;
      aliases.set(line.lineId, existing.lineId);
    } else merged.push(line);
  }
  priceRenewalOrder(merged, { localPreview: true });
  return merged;
}
export function removeRenewalLine(
  lines: readonly RenewalSelection[],
  lineId: string,
) {
  return lines.filter((l) => l.lineId !== lineId && l.parentLineId !== lineId);
}
export function parseRenewalCart(raw: string | null): RenewalSelection[] {
  try {
    const value = JSON.parse(raw || "null");
    if (value?.version !== 1) return [];
    const lines = normalizeRenewalLines(value.lines);
    priceRenewalOrder(lines, { localPreview: true });
    return lines;
  } catch {
    return [];
  }
}
export function subtractRenewalSubmission(
  current: readonly RenewalSelection[],
  submitted: readonly RenewalSelection[],
): RenewalSelection[] {
  const remaining = current.flatMap((line) => {
    const sent = submitted.find(
      (s) => s.lineId === line.lineId && identity(s) === identity(line),
    );
    if (!sent) return [line];
    const quantity = line.quantity - sent.quantity;
    return quantity > 0 ? [{ ...line, quantity }] : [];
  });
  return remaining.filter(
    (l) =>
      !l.parentLineId || remaining.some((p) => p.lineId === l.parentLineId),
  );
}
