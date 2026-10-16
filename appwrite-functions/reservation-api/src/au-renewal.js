// AU October pricing contracts. V1 and September snapshots remain immutable.
import { ReservationApiError } from "./reservation-error.js";
export const RENEWAL_CONTRACT = "au-renewal.2026-10.v2";
const HISTORICAL_CONTRACT = "au-renewal.2026-10.v1";
export function isRenewalContract(value) {
  return value === RENEWAL_CONTRACT || value === HISTORICAL_CONTRACT;
}
export const RENEWAL_MAX_BYTES = 60000;
const fail = (code) => {
  throw new ReservationApiError(code, 400);
};
export function safeAmount(n) {
  if (!Number.isSafeInteger(n) || n < 0 || Object.is(n, -0))
    fail("ORDER_AMOUNT_OVERFLOW");
  return n;
}
const sum = (values) =>
  values.reduce((a, b) => safeAmount(a + safeAmount(b)), 0);
const offer = (name, price, pieces = 1, extra = {}) =>
  Object.freeze({ name, price, pieces, ...extra });
export const RENEWAL_OFFERS = Object.freeze({
  "pave-cake": offer("Pavé Whole Cake", 7500, 1, {
    family: "cake",
    sizes: { "6in": 7500, "8in": 10700, "10in": 15900 },
    chocolate: true,
  }),
  "pound-cake": offer("Signature Gâteau Loaf", 4500, 1, {
    family: "cake",
    finishes: {
      basic: 4500,
      "extra-chocolate": 5200,
      "vanilla-fresh-cream": 5500,
    },
  }),
  "brownie-whole": offer("Brownie Basque Whole Cake", 8200, 1, {
    family: "cake",
    sizes: { "6in": 8200, "8in": 11700, "10in": 16800 },
    cream: true,
  }),
  "brownie-loaf": offer("Brownie Basque Loaf", 5800, 1, {
    family: "cake",
    cream: true,
  }),
  "cookie-six": offer(
    "Levain Cookies · 3 Chocolate Chip + 3 Double Chocolate",
    null,
    6,
    { family: "cookie", newProduct: true },
  ),
  "cupcake-half-dozen": offer("Gâteau Cupcakes · 6", 3100, 6, {
    family: "cupcake",
    finishes: {
      basic: 3100,
      "vanilla-fresh-cream": 3600,
      "chocolate-buttercream": 4100,
    },
  }),
  "cupcake-dozen": offer("Gâteau Cupcakes · 12", 5500, 12, {
    family: "cupcake",
    finishes: {
      basic: 5500,
      "vanilla-fresh-cream": 6400,
      "chocolate-buttercream": 7300,
    },
  }),
  "brownie-cupcakes-6": offer("Brownie Basque Cupcakes · 6", 3600, 6, {
    family: "cupcake",
    provisional: true,
    finishes: { basic: 3600, "vanilla-fresh-cream": 4200 },
  }),
  "brownie-cupcakes-12": offer("Brownie Basque Cupcakes · 12", 6600, 12, {
    family: "cupcake",
    provisional: true,
    finishes: { basic: 6600, "vanilla-fresh-cream": 7800 },
  }),
  mochi: offer("Chocolate Mochi", null, 1, {
    family: "mochi",
    newProduct: true,
  }),
  "almond-chocoball-80g": offer("Almond Chocolate · 80g", 1200),
  "almond-chocoball-6pack": offer("Almond Chocolate · 80g × 6 (5+1)", 6000, 6, {
    bundle: true,
  }),
  "almond-chocoball-black-tub-2x80g": offer(
    "Almond Chocolate · Black Tub 2 × 80g",
    2500,
    2,
  ),
  "pave-chocolate-100g": offer("Pavé Chocolate · Heart Tin 100g", 1200),
  "pave-six-plus-one": offer("Pavé Chocolate · 100g × 6 (5+1)", 6000, 6, {
    bundle: true,
  }),
  "eiffel-tower-chocolate-6": offer(
    "Eiffel Tower Chocolate · 6 pieces",
    1000,
    6,
  ),
  "eiffel-six-plus-one": offer(
    "Eiffel Tower Chocolate · 6 packs / 36 pieces (5+1)",
    5000,
    36,
    { bundle: true },
  ),
  "smore-6": offer("S’more Sticks · 6", 2500, 6, { family: "smore" }),
  "smore-12": offer("S’more Sticks · 12", 4500, 12, { family: "smore" }),
  "addon-pave": offer("Pavé Chocolate · 100g", 1200, 1, { addon: true }),
  "addon-cream": offer("Separate Vanilla Cream · 100g box", 700, 1, {
    addon: true,
  }),
  "addon-almond": offer("Almond Chocolate · 80g", 1200, 1, { addon: true }),
  "addon-eiffel": offer("Eiffel Tower Chocolate · 6 pieces", 1000, 6, {
    addon: true,
  }),
});
const HISTORICAL_MOCHI_FLAVOURS = Object.freeze([
  { id: "strawberry", en: "Strawberry", ko: "딸기", priceCents: 1000 },
  { id: "green_grape", en: "Green Grape", ko: "청포도", priceCents: 950 },
  { id: "mandarin", en: "Mandarin", ko: "귤", priceCents: 900 },
  { id: "amande", en: "Amande Chocolat", ko: "아망드", priceCents: 950 },
  { id: "butter_redbean", en: "Butter & Red Bean", ko: "앙버터", priceCents: 850 },
  { id: "nama_chocolate", en: "Nama Chocolate", ko: "생초콜릿", priceCents: 800 },
].map(Object.freeze));
// Stable IDs distinguish stored almond selections from the current banana assortment.
export const MOCHI_FLAVOURS = Object.freeze(HISTORICAL_MOCHI_FLAVOURS.map(f =>
  f.id === "amande" ? Object.freeze({ id: "banana", en: "Banana", ko: "바나나", priceCents: 900 }) : f));
function mochiFlavours(selection, storedOnly = false) {
  return storedOnly && Object.hasOwn(selection.flavourCounts || {}, "amande")
    ? HISTORICAL_MOCHI_FLAVOURS : MOCHI_FLAVOURS;
}
export const MOCHI_NAMES = Object.freeze(MOCHI_FLAVOURS.map((f) => f.en));
const idPattern = /^[A-Za-z0-9_-]{1,64}$/;
const allowedFields = new Set([
  "lineId",
  "offerId",
  "quantity",
  "size",
  "finish",
  "chocolateType",
  "individualPackaging",
  "mode",
  "flavourCounts",
  "parentLineId",
]);
export function normalizeRenewalLines(value, { storedOnly = false } = {}) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    new TextEncoder().encode(JSON.stringify(value)).length > RENEWAL_MAX_BYTES
  )
    fail("INVALID_ORDER_LINE");
  const ids = new Set();
  const quantities = new Map();
  return value.map((input) => {
    if (
      !input ||
      Object.getPrototypeOf(input) !== Object.prototype ||
      Object.keys(input).some((k) => !allowedFields.has(k))
    )
      fail("INVALID_ORDER_LINE");
    for (const field of [
      "lineId",
      "offerId",
      "size",
      "finish",
      "chocolateType",
      "mode",
      "parentLineId",
    ]) {
      if (
        (field === "lineId" ||
          field === "offerId" ||
          input[field] !== undefined) &&
        typeof input[field] !== "string"
      )
        fail("INVALID_ORDER_LINE");
    }
    if (!idPattern.test(input.lineId || "") || ids.has(input.lineId))
      fail("INVALID_LINE_ID");
    ids.add(input.lineId);
    const p = RENEWAL_OFFERS[input.offerId];
    if (!Object.hasOwn(RENEWAL_OFFERS, input.offerId) || !p)
      fail("INVALID_PRODUCT");
    if (!Number.isSafeInteger(input.quantity) || input.quantity < 1)
      fail("INVALID_QUANTITY");
    const aggregate = safeAmount(
      (quantities.get(input.offerId) || 0) + input.quantity,
    );
    quantities.set(input.offerId, aggregate);
    if (!p.newProduct && !p.addon && p.family !== "smore" && aggregate > 5)
      fail("INVALID_QUANTITY");
    const line = {
      lineId: input.lineId,
      offerId: input.offerId,
      quantity: input.quantity,
    };
    if (p.sizes) {
      if (!Object.hasOwn(p.sizes, input.size)) fail("INVALID_SIZE");
      line.size = input.size;
    } else if (input.size !== undefined) fail("INVALID_SIZE");
    const finish = input.finish ?? "basic";
    if (
      p.finishes
        ? !Object.hasOwn(p.finishes, finish)
        : p.cream
          ? !["basic", "vanilla-fresh-cream"].includes(finish)
          : finish !== "basic"
    )
      fail("INVALID_FINISH");
    line.finish = finish;
    if (
      input.chocolateType !== undefined &&
      (!["dark", "milk"].includes(input.chocolateType) ||
        !(
          p.chocolate ||
          (input.offerId === "pound-cake" && finish === "extra-chocolate")
        ))
    )
      fail("INVALID_CHOCOLATE_TYPE");
    if (
      p.chocolate ||
      (input.offerId === "pound-cake" && finish === "extra-chocolate")
    )
      line.chocolateType = input.chocolateType ?? "dark";
    if (
      input.individualPackaging !== undefined &&
      typeof input.individualPackaging !== "boolean"
    )
      fail("INVALID_PACKAGING");
    line.individualPackaging = input.individualPackaging === true;
    if (p.family === "mochi") {
      if (!["gift-four", "singles"].includes(input.mode))
        fail("INVALID_MOCHI_MODE");
      const counts = input.flavourCounts;
      if (!counts || Object.getPrototypeOf(counts) !== Object.prototype ||
          Object.keys(counts).length !== mochiFlavours(input, storedOnly).length ||
          mochiFlavours(input, storedOnly).some(({ id }) => !Object.hasOwn(counts, id) ||
            !Number.isSafeInteger(counts[id]) || counts[id] < 0))
        fail("INVALID_MOCHI_COUNTS");
      line.mode = input.mode;
      line.flavourCounts = Object.fromEntries(mochiFlavours(input, storedOnly).map(({ id }) => [id, counts[id]]));
      const count = sum(Object.values(line.flavourCounts));
      if ((input.mode === "gift-four" && count !== 4) || count === 0)
        fail("INVALID_MOCHI_COUNTS");
      if (input.mode === "singles" && input.quantity !== 1)
        fail("INVALID_QUANTITY");
      if (input.mode === "gift-four" && line.individualPackaging)
        fail("INVALID_PACKAGING");
    } else if (input.mode !== undefined || input.flavourCounts !== undefined)
      fail("INVALID_MOCHI_MODE");
    if (line.individualPackaging && !["mochi", "cupcake"].includes(p.family))
      fail("INVALID_PACKAGING");
    if (p.addon) {
      const parent = value.find((l) => l.lineId === input.parentLineId);
      if (!parent || RENEWAL_OFFERS[parent.offerId]?.family !== "cake")
        fail("INVALID_ADDON_PARENT");
      line.parentLineId = input.parentLineId;
    } else if (input.parentLineId !== undefined) fail("INVALID_ADDON_PARENT");
    return line;
  });
}
export function priceRenewalOrder(
  value,
  { localPreview = false, reviewCoupon, contractVersion = RENEWAL_CONTRACT, storedOnly = false } = {},
) {
  if (!isRenewalContract(contractVersion)) fail("UNSUPPORTED_CONTRACT");
  const normalized = normalizeRenewalLines(value, { storedOnly });
  const base = normalized.map((selection) => {
    // V1 snapshots retain their original amounts and approval status forever.
    const current = RENEWAL_OFFERS[selection.offerId];
    const p =
      contractVersion === HISTORICAL_CONTRACT && selection.offerId === "brownie-whole"
        ? {
            ...current,
            sizes: { "6in": 8200, "8in": 11500, "10in": 15500 },
            provisionalSizes: ["8in", "10in"],
          }
        : current;
    const provisional =
      p.provisional === true ||
      p.provisionalSizes?.includes(selection.size) === true;
    if (provisional && !localPreview) fail("PROVISIONAL_PRICE");
    let unitPriceCents = p.sizes
      ? p.sizes[selection.size]
      : p.finishes
        ? p.finishes[selection.finish]
        : p.price;
    if (p.cream && selection.finish === "vanilla-fresh-cream")
      unitPriceCents += 1000;
    let physicalQuantity = safeAmount(p.pieces * selection.quantity);
    let flavourTotals = [];
    if (p.family === "mochi") {
      unitPriceCents = sum(mochiFlavours(selection, storedOnly).map(({ id, priceCents }) =>
        safeAmount(selection.flavourCounts[id] * priceCents)));
      flavourTotals = mochiFlavours(selection, storedOnly).map(({ id }) =>
        safeAmount(selection.flavourCounts[id] * selection.quantity));
      physicalQuantity = sum(flavourTotals);
    }
    if (unitPriceCents === null) fail("PRICE_UNAVAILABLE");
    const subtotalCents = safeAmount(unitPriceCents * selection.quantity);
    return {
      selection,
      productId: selection.offerId,
      quantity: selection.quantity,
      productName: p.name,
      unitPriceCents,
      subtotalCents,
      physicalQuantity,
      flavourTotals,
      priceStatus: provisional ? "provisional" : "confirmed",
      policyVersion: contractVersion,
      individualPackaging: selection.individualPackaging,
      individualPackagingPieces: selection.individualPackaging
        ? physicalQuantity
        : 0,
      packagingUnitCents: selection.individualPackaging ? 50 : 0,
      packagingMode:
        p.family === "mochi" && selection.mode === "gift-four"
          ? "gift4"
          : selection.individualPackaging
            ? "individual"
            : "standard",
      giftBoxCount:
        p.family === "mochi" && selection.mode === "gift-four"
          ? selection.quantity
          : 0,
      discountPercent: p.addon ? 5 : 0,
      discountCents: p.addon ? safeAmount(subtotalCents / 20) : 0,
      individualPackagingFeeCents: 0,
      totalPriceCents: 0,
    };
  });
  const eligibleSubtotal = sum(
    base
      .filter(
        (l) =>
          l.individualPackaging &&
          RENEWAL_OFFERS[l.productId].family === "cupcake",
      )
      .map((l) => l.subtotalCents),
  );
  // Existing review/manual coupons apply only to ordinary eligible products, never bundles/addons/mochi/smore.
  const eligible = base.filter((l) => {
    const p = offerForLine(l);
    return (
      !p.addon && !p.bundle && !["mochi", "smore", "cookie"].includes(p.family)
    );
  });
  let discountBasisCents = 0;
  if (reviewCoupon) {
    if (![5, 10].includes(reviewCoupon.rewardPercent) || !eligible.length)
      fail("PROMO_CODE_INVALID");
    discountBasisCents = sum(eligible.map((l) => l.subtotalCents));
    const totalDiscount = Math.round(
      safeAmount(discountBasisCents * reviewCoupon.rewardPercent) / 100,
    );
    let allocated = 0;
    const ranked = eligible
      .map((l) => {
        const numerator = safeAmount(
          l.subtotalCents * reviewCoupon.rewardPercent,
        );
        l.discountCents = Math.floor(numerator / 100);
        l.discountPercent = reviewCoupon.rewardPercent;
        allocated += l.discountCents;
        return { l, remainder: numerator % 100 };
      })
      .sort(
        (a, b) =>
          b.remainder - a.remainder ||
          a.l.selection.lineId.localeCompare(b.l.selection.lineId),
      );
    for (let i = 0; i < totalDiscount - allocated; i++)
      ranked[i].l.discountCents++;
  }
  const lines = base.map((l) => {
    const p = RENEWAL_OFFERS[l.productId];
    l.individualPackagingFeeCents =
      l.individualPackaging &&
      !(p.family === "cupcake" && eligibleSubtotal >= 10000)
        ? safeAmount(l.physicalQuantity * 50)
        : 0;
    l.totalPriceCents = safeAmount(
      l.subtotalCents - l.discountCents + l.individualPackagingFeeCents,
    );
    return l;
  });
  const subtotalCents = sum(lines.map((l) => l.subtotalCents)),
    discountCents = sum(lines.map((l) => l.discountCents));
  const individualPackagingFeeCents = sum(
    lines.map((l) => l.individualPackagingFeeCents),
  );
  return {
    version: 2,
    policyVersion: contractVersion,
    lines,
    subtotalCents,
    discountCents,
    discountBasisCents,
    discountPercent: reviewCoupon?.rewardPercent ?? 0,
    individualPackagingFeeCents,
    individualPackagingPieces: sum(
      lines.map((l) => l.individualPackagingPieces),
    ),
    totalPriceCents: safeAmount(
      subtotalCents - discountCents + individualPackagingFeeCents,
    ),
    orderItemCount: sum(lines.map((l) => l.quantity)),
  };
}
function offerForLine(line) {
  return RENEWAL_OFFERS[line.productId];
}
export function renewalLineSummary(line) {
  const s = line.selection;
  const details = [
    `Item ${s.lineId}`,
    line.productName,
    s.size,
    s.finish === "basic" ? null : s.finish,
    s.chocolateType,
    `${s.quantity} ${s.mode === "singles" ? "selection" : "pack(s)"}`,
    `${line.physicalQuantity} pieces`,
  ];
  if (s.mode)
    details.push(
      s.mode,
      ...(s.mode === "gift-four" ? ["Per box: " + mochiFlavours(s, true)
        .filter(({ id }) => s.flavourCounts[id] > 0)
        .map(({ id, en }) => `${en} ${s.flavourCounts[id]}`).join(", ")] : []),
      "Total: " + mochiFlavours(s, true).map(({ en }, i) => `${en} ${line.flavourTotals[i]}`).join(
        ", ",
      ),
    );
  if (s.parentLineId) details.push(`Add-on for ${s.parentLineId}`);
  if (line.giftBoxCount)
    details.push(`${line.giftBoxCount} free 4-piece gift box(es)`);
  if (line.individualPackaging)
    details.push(
      `Individual packaging ${line.individualPackagingPieces} × AUD 0.50; fee AUD ${(line.individualPackagingFeeCents / 100).toFixed(2)}`,
    );
  details.push(`AUD ${(line.totalPriceCents / 100).toFixed(2)}`);
  return details.filter(Boolean).join(" · ");
}
