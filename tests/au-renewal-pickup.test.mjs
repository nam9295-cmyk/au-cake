import test from "node:test";
import assert from "node:assert/strict";
import {
  renewalPickupSlots,
  validateRenewalPickup,
} from "../appwrite-functions/reservation-api/src/au-renewal-pickup.js";
const p =
  await import("../appwrite-functions/reservation-api/src/au-renewal-pickup-policy.js").catch(
    () => ({}),
  );
const cake = [{ offerId: "pave-cake" }],
  mochi = [{ offerId: "mochi" }],
  open = { preordersEnabled: true };
const now = new Date("2026-10-18T23:00:00Z"); // Monday10:00 Sydney
for (const [date, close, count] of [
  ["2026-10-21", "16:00", 29],
  ["2026-10-23", "16:00", 29],
  ["2026-10-24", "12:00", 13],
  ["2026-10-25", "12:00", 13],
]) {
  test(`${date} opens09:00 through inclusive${close} in15-minute steps`, () => {
    const slots = renewalPickupSlots(cake, date, now);
    assert.equal(slots[0], "09:00");
    assert.equal(slots.at(-1), close);
    assert.equal(slots.length, count);
    for (const slot of slots)
      assert.doesNotThrow(() => validateRenewalPickup(cake, date, slot, now));
    for (const time of [
      "08:45",
      "09:01",
      close === "16:00" ? "16:15" : "12:15",
      "20:00",
    ])
      assert.throws(
        () => validateRenewalPickup(cake, date, time, now),
        /PICKUP_TIME_UNAVAILABLE/,
      );
  });
}
test("Monday Tuesday Thursday reject general pickup; technical date/time and closure checks remain", () => {
  for (const date of ["2026-10-26", "2026-10-20", "2026-10-22"]) {
    assert.deepEqual(renewalPickupSlots(cake, date, now), []);
    assert.throws(
      () => validateRenewalPickup(cake, date, "09:00", now),
      /PICKUP_TIME_UNAVAILABLE/,
    );
  }
  for (const [date, time] of [
    ["2026-02-30", "09:00"],
    ["2026-10-24", "09:60"],
    ["2026-10-24", 900],
  ])
    assert.throws(() => validateRenewalPickup(cake, date, time, now));
  assert.deepEqual(
    renewalPickupSlots(cake, "2026-10-24", now, {
      closedDates: ["2026-10-24"],
    }),
    [],
  );
  assert.ok(
    !renewalPickupSlots(cake, "2026-10-24", now, {
      closedIntervals: { "2026-10-24": [{ start: "09:00", end: "10:00" }] },
    }).includes("09:45"),
  );
});
test("D02 is fixed independently of obsolete weekend approval flag and does not open preorder writes", () => {
  assert.equal(
    p.RENEWAL_PICKUP_POLICY_VERSION,
    "au-renewal-pickup.2026-10-14.v2",
  );
  assert.equal(
    renewalPickupSlots(cake, "2026-10-24", now, { weekendApproved: false }).at(
      -1,
    ),
    "12:00",
  );
  assert.throws(
    () => validateRenewalPickup(mochi, "2026-10-24", "09:00", now, {}),
    /PREORDER_NOT_OPEN/,
  );
  assert.throws(
    () =>
      validateRenewalPickup(
        mochi,
        "2026-10-24",
        "09:00",
        new Date("2026-10-15T12:59:59Z"),
        open,
      ),
    /PREORDER_NOT_OPEN/,
  );
});
test("24-hour real-time boundary and first approved pickup slot are independent from opening date", () => {
  assert.throws(
    () =>
      validateRenewalPickup(
        mochi,
        "2026-10-24",
        "09:00",
        new Date("2026-10-22T22:00:01Z"),
        open,
      ),
    /PICKUP_TIME_TOO_SOON/,
  );
  assert.doesNotThrow(() =>
    validateRenewalPickup(
      mochi,
      "2026-10-24",
      "09:00",
      new Date("2026-10-22T22:00:00Z"),
      open,
    ),
  );
  assert.equal(renewalPickupSlots(mochi, "2026-10-21", now, open)[0], "09:00");
  assert.deepEqual(renewalPickupSlots(mochi, "2026-10-20", now, open), []);
  assert.throws(
    () =>
      validateRenewalPickup(
        [...cake, ...mochi],
        "2026-10-24",
        "09:00",
        new Date("2026-10-23T00:00:00Z"),
        open,
      ),
    /PICKUP_TIME_TOO_SOON/,
  );
  // Ordinary product prep policy stays intact: next-day before noon after20:00 remains blocked.
  assert.throws(
    () =>
      validateRenewalPickup(
        cake,
        "2026-10-24",
        "09:00",
        new Date("2026-10-23T10:00:00Z"),
      ),
    /PICKUP_TIME_TOO_SOON/,
  );
});
test("Sydney DST uses actual elapsed hours across daylight-saving start and end", () => {
  // Oct4 2026 Sunday09:00 AEDT = Oct3 22:00Z. Apr4 2027 Sunday09:00 AEST = Apr3 23:00Z.
  for (const [date, at, before] of [
    ["2026-10-04", "2026-10-03T22:00:00Z", "2026-10-02T22:00:00Z"],
    ["2027-04-04", "2027-04-03T23:00:00Z", "2027-04-02T23:00:00Z"],
  ]) {
    assert.equal(
      validateRenewalPickup(cake, date, "09:00", new Date(before)),
      Date.parse(at),
    );
  }
  // Future DST starts Oct3 2027 after preorders are open; same local clock on prior date is only23h.
  assert.throws(
    () =>
      validateRenewalPickup(
        mochi,
        "2027-10-03",
        "09:00",
        new Date("2027-10-01T23:00:00Z"),
        open,
      ),
    /PICKUP_TIME_TOO_SOON/,
  );
  assert.doesNotThrow(() =>
    validateRenewalPickup(
      mochi,
      "2027-10-03",
      "09:00",
      new Date("2027-10-01T22:00:00Z"),
      open,
    ),
  );
  assert.doesNotThrow(() =>
    validateRenewalPickup(
      mochi,
      "2027-04-04",
      "09:00",
      new Date("2027-04-02T23:00:00Z"),
      open,
    ),
  );
});
test("public copy and service slots derive from the same approved week", () => {
  assert.equal(typeof p.renewalPickupCopy, "function");
  const english = p.renewalPickupCopy("en"),
    korean = p.renewalPickupCopy("ko");
  assert.match(
    english.hours,
    /Wednesday.*Friday.*09:00–16:00.*Saturday.*Sunday.*09:00–12:00/,
  );
  assert.match(korean.hours, /수·금.*09:00–16:00.*토·일.*09:00–12:00/);
  assert.match(english.driver, /prior.*approval|approval.*prior/i);
  for (let day = 0; day < 7; day++) {
    const date = `2026-10-${String(25 + day).padStart(2, "0")}`;
    assert.deepEqual(
      p.renewalServiceSlots(date),
      renewalPickupSlots(cake, date, now),
    );
  }
});

test("Oct16 launch remains manual and intersects actual24h with approved pickup slots", () => {
  const receipt = new Date("2026-10-15T23:20:00Z"); // Friday Oct16 10:20 Sydney
  assert.throws(() => validateRenewalPickup(mochi, "2026-10-17", "10:30", receipt), /PREORDER_NOT_OPEN/);
  assert.doesNotThrow(() => validateRenewalPickup(mochi, "2026-10-17", "10:30", receipt, open));
  assert.throws(() => validateRenewalPickup(mochi, "2026-10-17", "10:15", receipt, open), /PICKUP_TIME_TOO_SOON/);
  assert.throws(() => validateRenewalPickup(mochi, "2026-10-16", "16:00", receipt, open), /PICKUP_TIME_TOO_SOON/);
  assert.deepEqual(renewalPickupSlots(mochi,"2026-10-17",receipt,open),["10:30","10:45","11:00","11:15","11:30","11:45","12:00"]);
});
