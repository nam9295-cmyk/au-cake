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
    assert.ok(html.includes("09:00–13:00"));
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
  assert.match(drawer, /09:00–13:00/);
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

test('Mochi lookup details show per-box contents separately from total pieces without irrelevant finish', () => {
 const doc=buildRenewalOrderData({contractVersion:'au-renewal.2026-10.v2',customerName:'Test Buyer',customerPhone:'0412345678',customerEmail:'buyer@example.com',pickupDate:'2026-10-23',pickupTime:'09:00',privacyConsent:true,orderLines:[{lineId:'private-line-id',offerId:'mochi',mode:'gift-four',quantity:2,flavourCounts:{strawberry:2,green_grape:0,mandarin:0,banana:0,butter_redbean:0,nama_chocolate:2}}]},{now:new Date('2026-10-20T00:00:00Z'),reservationNumber:'VG-TEST',renewalPolicy:{preordersEnabled:true}})
 const reservation=toReservation({...doc,$id:'fixture'} as never)
 const html=renderToStaticMarkup(<OrderDetailRows reservation={reservation} language="en" />)
 assert.match(html,/Each box/);assert.match(html,/Strawberry ×2, Original ×2/)
 assert.match(html,/four-piece gift box/);assert.match(html,/8/)
 assert.doesNotMatch(html,/private-line-id|gift-four|Green Grape|<dt>Finish<\/dt>/)
})


test("admin retains an approved 12:40 appointment alongside weekend slots through 13:00", () => {
  const doc = buildRenewalOrderData({
    contractVersion: "au-renewal.2026-10.v2", customerName: "Test Buyer",
    customerPhone: "0412345678", customerEmail: "buyer@example.com",
    pickupDate: "2026-10-24", pickupTime: "12:00", privacyConsent: true,
    orderLines: [{ lineId: "fixture", offerId: "brownie-whole", size: "6in", quantity: 1 }],
  }, { now: new Date("2026-10-20T00:00:00Z"), reservationNumber: "TEST" });
  doc.pickupTime = "12:40";
  const original = JSON.stringify(doc);
  const reservation = toReservation({ ...doc, $id: "fixture" } as never);
  const html = renderToStaticMarkup(<ReservationDrawer reservation={reservation} settings={DEFAULT_SETTINGS}
    onClose={() => {}} onSave={async () => {}} onCopy={async () => {}} />);
  assert.match(html, /12:40 \(기존 승인 시각\)/);
  assert.match(html, /<option value="13:00"/);
  assert.doesNotMatch(html, /<option value="13:15"/);
  assert.equal(JSON.stringify(doc), original);
});
