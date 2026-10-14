import {
  isRenewalServiceTime,
  renewalServiceSlots,
} from "./au-renewal-pickup-policy.js";
import {
  fail,
  isValidDateValue,
  zonedTimestamp,
  sydneyDateValue,
  zonedDateParts,
  addDaysToDateValue,
} from "./reservation-input-policy.js";
export const RENEWAL_PREORDER_DATE = "2026-10-19";
// D02 resolved: approved hours are fixed; activation flags do not redefine the schedule.
export function validateRenewalPickup(
  lines,
  date,
  time,
  now,
  { preordersEnabled = false, closedDates = [], closedIntervals = {} } = {},
) {
  if (
    !isValidDateValue(date) ||
    typeof time !== "string" ||
    !/^\d{2}:\d{2}$/.test(time)
  )
    fail("INVALID_PICKUP_DATE");
  const instant = zonedTimestamp(date, time),
    timestamp = new Date(now).getTime();
  if (instant === null || !Number.isFinite(timestamp))
    fail("INVALID_PICKUP_DATE");
  const fresh = lines.some((l) => ["mochi", "cookie-six"].includes(l.offerId));
  if (
    fresh &&
    (!preordersEnabled || sydneyDateValue(now) < RENEWAL_PREORDER_DATE)
  )
    fail("PREORDER_NOT_OPEN");
  if (fresh && instant - timestamp < 86400000) fail("PICKUP_TIME_TOO_SOON");
  const existing = lines.some(
    (l) => !["mochi", "cookie-six"].includes(l.offerId),
  );
  if (existing) {
    const today = sydneyDateValue(now);
    if (
      date <= today ||
      (date === addDaysToDateValue(today, 1) &&
        zonedDateParts(now).hour >= 20 &&
        time < "12:00")
    )
      fail("PICKUP_TIME_TOO_SOON");
  }
  if (!isRenewalServiceTime(date, time, { closedDates, closedIntervals }))
    fail("PICKUP_TIME_UNAVAILABLE");
  return instant;
}
export function renewalPickupSlots(lines, date, now, policy = {}) {
  const slots = [];
  for (const time of renewalServiceSlots(date, policy)) {
    try {
      validateRenewalPickup(lines, date, time, now, policy);
      slots.push(time);
    } catch {
      /* unavailable slot */
    }
  }
  return slots;
}
