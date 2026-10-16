// Decoder for the immutable October contract. Never use a future active price table here.
import {
  isRenewalContract,
  RENEWAL_MAX_BYTES,
  priceRenewalOrder,
} from "./au-renewal.js";
import { ReservationApiError } from "./reservation-error.js";
function invalid() {
  throw new ReservationApiError("INVALID_STORED_ORDER", 500);
}
export function isRenewalDocument(document) {
  if (typeof document?.orderLinesJson !== "string") return false;
  try {
    return JSON.parse(document.orderLinesJson).version === 2;
  } catch {
    return false;
  }
}
export function readRenewalDocument(document) {
  try {
    if (
      typeof document.orderLinesJson !== "string" ||
      new TextEncoder().encode(document.orderLinesJson).length >
        RENEWAL_MAX_BYTES
    )
      invalid();
    const payload = JSON.parse(document.orderLinesJson);
    if (
      payload.version !== 2 ||
      !isRenewalContract(payload.policyVersion) ||
      !Array.isArray(payload.lines) ||
      Object.keys(payload).sort().join(",") !==
        "discountPercent,lines,policyVersion,version"
    )
      invalid();
    if (![0, 5, 10].includes(payload.discountPercent)) invalid();
    if (
      payload.discountPercent &&
      (!document.reviewCouponId ||
        !/^[A-Z0-9]{4}$/.test(document.appliedPromoCodeLast4 || ""))
    )
      invalid();
    const expected = priceRenewalOrder(
      payload.lines.map((l) => l.selection),
      {
        localPreview: true,
        storedOnly: true,
        contractVersion: payload.policyVersion,
        reviewCoupon: payload.discountPercent
          ? { rewardPercent: payload.discountPercent }
          : undefined,
      },
    );
    // Price facts and physical contents are checked against this frozen version only.
    if (JSON.stringify(payload.lines) !== JSON.stringify(expected.lines))
      invalid();
    for (const key of [
      "subtotalCents",
      "discountCents",
      "discountBasisCents",
      "discountPercent",
      "individualPackagingFeeCents",
      "individualPackagingPieces",
      "totalPriceCents",
      "orderItemCount",
    ])
      if (document[key] !== expected[key]) invalid();
    if (
      document.orderLineCount !== expected.lines.length ||
      document.productId !== expected.lines[0].productId ||
      document.quantity !== expected.lines[0].quantity
    )
      invalid();
    return expected;
  } catch {
    invalid();
  }
}
export function renewalReservationProjection(
  document,
  { privateFields = false } = {},
) {
  const q = readRenewalDocument(document);
  return {
    contractVersion: q.policyVersion,
    reservationNumber: document.reservationNumber,
    productId: document.productId,
    cakeSize: document.cakeSize,
    chocolateType: document.chocolateType,
    poundAddon: "none",
    cacaoPercent: document.cacaoPercent,
    quantity: document.quantity,
    pickupDate: document.pickupDate,
    pickupTime: document.pickupTime,
    status: document.status,
    paymentStatus: document.paymentStatus,
    totalPrice: q.totalPriceCents / 100,
    subtotalCents: q.subtotalCents,
    discountCents: q.discountCents,
    discountBasisCents: q.discountBasisCents,
    discountPercent: q.discountPercent,
    totalPriceCents: q.totalPriceCents,
    individualPackagingPieces: q.individualPackagingPieces,
    individualPackagingFeeCents: q.individualPackagingFeeCents,
    orderLines: q.lines,
    orderLineCount: q.lines.length,
    orderItemCount: q.orderItemCount,
    ...(document.reviewCouponId
      ? {
          reviewCouponId: document.reviewCouponId,
          appliedPromoCodeLast4: document.appliedPromoCodeLast4,
        }
      : {}),
    ...(privateFields
      ? {
          id: document.$id || document.id,
          customerName: document.customerName,
          customerPhone: document.customerPhone,
          customerEmail: document.customerEmail,
          requestNote: document.requestNote || "",
          adminMemo: document.adminMemo || "",
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        }
      : {}),
  };
}
export function parseRenewalProjection(value) {
  if (
    !value ||
    !isRenewalContract(value.contractVersion) ||
    !Array.isArray(value.orderLines)
  )
    invalid();
  const document = {
    ...value,
    orderLinesJson: JSON.stringify({
      version: 2,
      policyVersion: value.contractVersion,
      lines: value.orderLines,
      discountPercent: value.discountPercent,
    }),
  };
  readRenewalDocument(document);
  return value;
}
