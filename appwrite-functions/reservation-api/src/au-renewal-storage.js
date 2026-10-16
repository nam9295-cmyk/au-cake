import {
  RENEWAL_CONTRACT,
  isRenewalContract,
  RENEWAL_MAX_BYTES,
  normalizeRenewalLines,
  priceRenewalOrder,
} from "./au-renewal.js";
import {
  fail,
  requiredText,
  optionalText,
  validateAustralianMobile,
  validateEmail,
} from "./reservation-input-policy.js";
import { validateRenewalPickup } from "./au-renewal-pickup.js";
const requestKeys = new Set([
  "contractVersion",
  "customerName",
  "customerPhone",
  "customerEmail",
  "pickupDate",
  "pickupTime",
  "requestNote",
  "promoCode",
  "privacyConsent",
  "requestId",
  "website",
  "orderLines",
]);
export function canonicalRenewalRequest(input, { allowHistorical = false } = {}) {
  if (
    !input ||
    (allowHistorical ? !isRenewalContract(input.contractVersion) : input.contractVersion !== RENEWAL_CONTRACT) ||
    Object.keys(input).some((k) => !requestKeys.has(k)) ||
    new TextEncoder().encode(JSON.stringify(input)).length > RENEWAL_MAX_BYTES
  )
    fail("INVALID_REQUEST");
  if (input.privacyConsent !== true || input.website) fail("CONSENT_REQUIRED");
  const promoCode = optionalText(input.promoCode, {
    max: 80,
    code: "PROMO_CODE_INVALID",
  }).toUpperCase();
  if (promoCode && !/^(?:VG|JENNIE|[A-Z]+)[A-Z0-9]+$/.test(promoCode))
    fail("PROMO_CODE_INVALID");
  return {
    contractVersion: input.contractVersion,
    customerName: requiredText(input.customerName, {
      min: 2,
      max: 80,
      code: "INVALID_NAME",
    }),
    customerPhone: validateAustralianMobile(input.customerPhone),
    customerEmail: validateEmail(input.customerEmail),
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    requestNote: optionalText(input.requestNote, {
      max: 1000,
      code: "REQUEST_NOTE_TOO_LONG",
    }),
    promoCode,
    orderLines: normalizeRenewalLines(input.orderLines, { storedOnly: allowHistorical }).sort((a, b) =>
      a.lineId.localeCompare(b.lineId),
    ),
  };
}
export function buildRenewalOrderData(
  input,
  { now, reservationNumber, reviewCoupon, renewalPolicy = {} },
) {
  const request = canonicalRenewalRequest(input);
  validateRenewalPickup(
    request.orderLines,
    request.pickupDate,
    request.pickupTime,
    now,
    renewalPolicy,
  );
  if (request.promoCode && !reviewCoupon) fail("PROMO_CODE_INVALID");
  const quote = priceRenewalOrder(request.orderLines, { reviewCoupon });
  const first = quote.lines[0];
  const { lines, version, policyVersion, ...totals } = quote;
  const orderLinesJson = JSON.stringify({
    version,
    policyVersion,
    lines,
    discountPercent: quote.discountPercent,
  });
  if (new TextEncoder().encode(orderLinesJson).length > RENEWAL_MAX_BYTES)
    fail("ORDER_TOO_LARGE");
  return {
    reservationNumber,
    customerName: request.customerName,
    customerPhone: request.customerPhone,
    customerEmail: request.customerEmail,
    productId: first.productId,
    cakeSize: first.selection.size || "15cm",
    chocolateType: first.selection.chocolateType || "dark",
    poundAddon: "none",
    cupcakeFinish: "basic",
    chocolateIcingCount: 0,
    vanillaCreamCount: 0,
    partyDecorationCount: 0,
    vanillaCakeSheet: "vanilla",
    vanillaCakeFlavor: "triple-berry",
    quantity: first.quantity,
    pickupDate: request.pickupDate,
    pickupTime: request.pickupTime,
    cacaoPercent: "기본",
    requestNote: request.requestNote,
    status: "예약신청",
    paymentStatus: "입금대기",
    ...totals,
    totalPrice: quote.totalPriceCents / 100,
    orderLineCount: lines.length,
    orderLinesJson,
    adminMemo: "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...(reviewCoupon
      ? {
          reviewCouponId: reviewCoupon.id,
          appliedPromoCodeLast4: reviewCoupon.codeLast4,
        }
      : {}),
  };
}
