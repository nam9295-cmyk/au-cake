import { RENEWAL_CARDS } from "../../appwrite-functions/reservation-api/src/au-renewal-catalog.js";
import {
  normalizeRenewalLines,
  MOCHI_FLAVOURS,
  type MochiCounts,
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
      (l) => identity(l) === identity(line) && l.mode !== "singles",
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
export const MOCHI_RESELECTION_KEY = "verygood-au-mochi-reselection";
export function inspectRenewalCart(raw: string | null): {
  lines: RenewalSelection[]; retiredMochi: unknown[]; retiredPave: RenewalSelection[];
} {
  const empty = { lines: [], retiredMochi: [], retiredPave: [] };
  try {
    const value = JSON.parse(raw || "null");
    if (value?.version !== 1 || !Array.isArray(value.lines)) return empty;
    const retiredMochi = value.lines.filter((line: RenewalSelection) =>
      line?.offerId === "mochi" && (!["gift-four", "singles"].includes(line.mode || "") || "counts" in line || Object.hasOwn(line.flavourCounts || {}, "amande")));
    const retiredPave = value.lines.filter((line: RenewalSelection) => line?.offerId === "pave-cake" && line.chocolateType === "milk");
    const retiredIds = new Set(retiredPave.map((line: RenewalSelection) => line.lineId));
    const available = value.lines.filter((line: RenewalSelection) => !retiredMochi.includes(line) && !retiredPave.includes(line) && !retiredIds.has(line?.parentLineId));
    const lines = available.length ? normalizeRenewalLines(available) : [];
    if (lines.length) priceRenewalOrder(lines, { localPreview: true });
    return { lines, retiredMochi, retiredPave };
  } catch { return empty; }
}
// Re-selection links restore options for review at current prices; they never submit an order.
export function renewalSelectionHref(line: RenewalSelection, editId?: string): string | null {
  const card = Object.values(RENEWAL_CARDS).flat().find(card => card.offers.includes(line.offerId));
  if (!card || !["pave-cake", "brownie-whole", "brownie-loaf", "pound-cake", "almond-chocoball-80g", "almond-chocoball-black-tub-2x80g"].includes(line.offerId)) return null;
  const url = new URL(card.href, "https://local.invalid");
  url.searchParams.set("offer", line.offerId);
  for (const key of ["size", "finish", "chocolateType", "almondPackaging"] as const) if (line[key]) url.searchParams.set(key, line[key]);
  url.searchParams.set("quantity", String(line.quantity));
  if (editId) url.searchParams.set("edit", editId);
  return url.pathname + url.search;
}
export function parseRenewalCart(raw: string | null): RenewalSelection[] {
  return inspectRenewalCart(raw).lines;
}
export function replaceRenewalLines(current: readonly RenewalSelection[], id: string, incoming: RenewalSelection[]) {
  return addRenewalLines(removeRenewalLine(current, id), incoming);
}
export function splitMochiSingles(line: RenewalSelection, counts: MochiCounts, boxId: string) {
  const source = normalizeRenewalLines([line])[0];
  if (source.offerId !== "mochi" || source.mode !== "singles" || source.lineId === boxId) throw new Error("INVALID_MOCHI_MODE");
  const box: RenewalSelection = { lineId: boxId, offerId: "mochi", mode: "gift-four", flavourCounts: counts, quantity: 1, individualPackaging: false };
  priceRenewalOrder([source, box]);
  const rest = Object.fromEntries(MOCHI_FLAVOURS.map(({ id }) => {
    if (counts[id] > source.flavourCounts![id]) throw new Error("INVALID_MOCHI_COUNTS");
    return [id, source.flavourCounts![id] - counts[id]];
  })) as MochiCounts;
  const remaining = Object.values(rest).some(n => n > 0) ? { ...source, flavourCounts: rest } : null;
  return { box, remaining };
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
