import { ReservationDrawer } from "../src/ReservationDrawer";
import { DEFAULT_SETTINGS } from "../src/lib/constants";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuPickupNotice } from "../src/components/AuPickupNotice";
import { OrderDetailRows } from "../src/components/ProductDetailRows";
import { cakeCopy } from "../src/lib/i18n";
import { buildRenewalOrderData } from "../appwrite-functions/reservation-api/src/au-renewal-storage.js";
import { toReservation } from "../src/lib/stored-order-reader";
import {
  renewalPickupCopy,
  RENEWAL_PICKUP_POLICY_VERSION,
} from "../appwrite-functions/reservation-api/src/au-renewal-pickup-policy.js";
import { renewalCapabilities } from "../src/lib/renewal-client";
import { functions } from "../src/lib/appwrite";

test("AU public copy and common notice match the approved calendar in both languages", () => {
  for (const language of ["en", "ko"] as const) {
    const copy = renewalPickupCopy(language),
      html = renderToStaticMarkup(
        <AuPickupNotice language={language} driver />,
      );
    assert.ok(html.includes("09:00–16:00"));
    assert.ok(html.includes("09:00–12:00"));
    assert.equal(cakeCopy(language).pickupHours[0], copy.hours);
    assert.doesNotMatch(html, /08:00|18:00|20:00/);
  }
});
test("new order detail rendering retains actual product and size without altering a stored pickup appointment", () => {
  const doc = buildRenewalOrderData(
    {
      contractVersion: "au-renewal.2026-10.v2",
      customerName: "Test Buyer",
      customerPhone: "0412345678",
      customerEmail: "buyer@example.com",
      pickupDate: "2026-10-24",
      pickupTime: "12:00",
      privacyConsent: true,
      orderLines: [
        { lineId: "b", offerId: "brownie-whole", size: "6in", quantity: 1 },
      ],
    },
    { now: new Date("2026-10-20T00:00:00Z"), reservationNumber: "TEST" },
  );
  // The read path must preserve previously approved/operator-arranged appointments too.
  doc.pickupDate = "2026-10-26";
  doc.pickupTime = "18:30";
  const original = JSON.stringify(doc),
    reservation = toReservation({ ...doc, $id: "test" } as never);
  const html = renderToStaticMarkup(
    <dl>
      <OrderDetailRows reservation={reservation} language="en" />
    </dl>,
  );
  const drawer = renderToStaticMarkup(
    <ReservationDrawer
      reservation={reservation}
      settings={DEFAULT_SETTINGS}
      onClose={() => {}}
      onSave={async () => {}}
      onCopy={async () => {}}
    />,
  );
  assert.match(drawer, /18:30/);
  assert.match(drawer, /09:00–12:00/);
  assert.match(html, /Brownie Basque Whole Cake/);
  assert.match(html, /6in/);
  assert.doesNotMatch(html, /Pave Chocolate Cake/);
  assert.equal(reservation.pickupDate, "2026-10-26");
  assert.equal(reservation.pickupTime, "18:30");
  assert.equal(JSON.stringify(doc), original);
});
test("frontend refuses capabilities from a server with a different pickup policy; no request is submitted", async () => {
  const original = functions.createExecution;
  try {
    functions.createExecution = (async () => ({
      responseStatusCode: 200,
      responseBody: JSON.stringify({
        ok: true,
        result: {
          contractVersion: "au-renewal.2026-10.v2",
          enabled: true,
          preordersEnabled: false,
          weekendApproved: true,
        },
      }),
    })) as never;
    await assert.rejects(renewalCapabilities(), /RENEWAL_UNAVAILABLE/);
    functions.createExecution = (async () => ({
      responseStatusCode: 200,
      responseBody: JSON.stringify({
        ok: true,
        result: {
          contractVersion: "au-renewal.2026-10.v2",
          pickupPolicyVersion: RENEWAL_PICKUP_POLICY_VERSION,
          enabled: false,
          preordersEnabled: false,
          weekendApproved: true,
        },
      }),
    })) as never;
    assert.equal((await renewalCapabilities()).enabled, false);
  } finally {
    functions.createExecution = original;
  }
});
