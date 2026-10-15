import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuRenewalShop } from "../src/pages/AuRenewalShop";
import { CartProvider } from "../src/CartProvider";
import { AuLanguageContext } from "../src/lib/au-language";
import { RENEWAL_CARDS } from "../appwrite-functions/reservation-api/src/au-renewal-catalog.js";

function render(href: string, language: "en" | "ko" = "en") {
  const url = new URL(href, "http://localhost");
  Object.assign(globalThis, {
    window: { location: url, localStorage: { getItem: () => null } },
    localStorage: { getItem: () => null },
  });
  return renderToStaticMarkup(
    <AuLanguageContext.Provider value={{ language, setLanguage() {} }}>
      <CartProvider>
        <AuRenewalShop path={url.pathname} />
      </CartProvider>
    </AuLanguageContext.Provider>,
  );
}
test("all twelve AU product details expose click options, output steppers and a mobile purchase bar in both languages", () => {
  for (const card of Object.values(RENEWAL_CARDS).flat())
    for (const language of ["en", "ko"] as const) {
      const html = render(card.href, language);
      assert.doesNotMatch(html, /<select|type="number"/, card.id);
      assert.match(html, /<output/, card.id);
      assert.match(html, /au-pave-sticky-order/, card.id);
      assert.doesNotMatch(html, /Chocolate Extra Set|Signature 4.*35/);
    }
});
test("size tiles use current prices, approved servings and only eligible cakes have four independent extras", () => {
  const pave = render("/cakes/pave-chocolate-cake");
  for (const price of ["75.00", "107.00", "159.00", "11.40", "6.65", "9.50"])
    assert.ok(pave.includes(price), price);
  assert.match(pave, /8–10/);
  const brownie = render("/cakes/brownie-cheesecake");
  for (const price of ["82.00", "117.00", "168.00"])
    assert.ok(brownie.includes(price), price);
  assert.doesNotMatch(brownie, /serves approx/);
  for (const card of Object.values(RENEWAL_CARDS).flat()) {
    const html = render(card.href);
    assert.equal(
      html.includes('data-extra="addon-cream"'),
      ["pave", "gateau-loaf", "brownie-whole", "brownie-loaf"].includes(
        card.id,
      ),
      card.id,
    );
  }
});
test("cupcake finish cards are product specific and unavailable prices cannot be ordered", () => {
  assert.match(render("/cakes/chocolate-cupcakes"), /Chocolate Buttercream/);
  assert.doesNotMatch(
    render("/cakes/brownie-cupcakes"),
    /Chocolate Buttercream/,
  );
  const cookie = render("/cakes/levain-cookies");
  assert.match(cookie, /disabled=""/);
  assert.doesNotMatch(cookie, /AUD 0\.00/);
});

test("pack choices reserve a separate photo area for each sales configuration", () => {
  for (const card of [...RENEWAL_CARDS.chocolates.filter(c => c.id !== 'mochi'), RENEWAL_CARDS.celebrate[2]]) {
    const html = render(card.href);
    assert.equal((html.match(/class="renewal-option-photo"/g) || []).length, card.offers.length, card.id);
  }
});

test("Oct16 product information distinguishes missing photos from unavailable offers", () => {
 const mochi=render('/chocolates/chocolate-mochi');
 assert.match(mochi,/16 October 2026/);
 assert.doesNotMatch(mochi,/19 October 2026/);
 assert.match(mochi,/PHOTO COMING SOON/);
 assert.match(mochi,/80[–-]100g/);
 assert.match(mochi,/refrigerated/i);
 assert.match(mochi,/3 days/);
 assert.match(mochi,/Contains milk, almonds and soy/);
 assert.match(mochi,/wheat, eggs, sesame and peanuts/);
 const korean=render('/chocolates/chocolate-mochi','ko');
 assert.match(korean,/80[–-]100g/);
 assert.match(korean,/최대 3일/);
 const cookies=render('/cakes/levain-cookies');
 assert.match(cookies,/sale price is approved/);
 assert.doesNotMatch(cookies,/19 October 2026/);
});
