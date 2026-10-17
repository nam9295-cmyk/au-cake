# Pavé Mochi — local rebranding, 2026-10-17

Base: fetched origin/main 577aec4. Branch: codex/pave-mochi-rebrand-20261017. No push or deployment authorized for this change.

## Public presentation

Public product name is Pavé Mochi / 파베 모찌. Selector and public offer display order:

| Stable ID | English | Korean | AUD |
| --- | --- | --- | --- |
| nama_chocolate | Original Pavé Chocolate | 오리지널 생초콜릿 | 8.00 |
| strawberry | Strawberry Pavé Chocolate | 딸기 생초콜릿 | 10.00 |
| green_grape | Green Grape Pavé Chocolate | 청포도 생초콜릿 | 9.50 |
| mandarin | Mandarin Pavé Chocolate | 만다린 생초콜릿 | 9.00 |
| banana | Banana Pavé Chocolate | 바나나 생초콜릿 | 9.00 |
| butter_redbean | Butter & Red Bean Pavé Chocolate | 앙버터 생초콜릿 | 8.50 |

The existing core MOCHI_FLAVOURS order, flavourCounts serialization, flavourTotals indexes, quote productName, policy version and stored snapshots remain unchanged. Presentation helpers translate labels at rendering time. Historical amande remains almond; it is never mapped to banana. Historical summary ordering is retained. No database migration or repricing is needed.

Catalogue/detail/selector/cart/order detail/operational summaries use the new public names. SEO initial HTML and React share the same catalogue: title, description, Product/Offer, BreadcrumbList, image alt and llms are synchronized. Canonical and sitemap paths stay unchanged (25 AU URLs). All photo assets remain unchanged.

## Home announcement

AU HomePage only. One display per tab session via sessionStorage, with memory fallback if storage is blocked. Dismissible non-modal aside; no autofocus or focus trap. Escape while focus is within the card dismisses it and restores focus to the home heading. Close button has a 44px target. Tab reaches the CTA; Enter opens the existing Mochi URL. Desktop is a small floating card; at <=600px it is an inline compact card above the hero, so it cannot overlay mobile content. Not mounted on cart/checkout/reservation/detail or KR HomePage.

## Verification completed

- New branding regression tests first failed, then passed.
- npm run test:renewal passed, including stored orders, gift boxes, single packaging, consumers and bilingual UI.
- npm test passed, including SEO, historical orders, notification/reminder, admin/PIN/CSV and Function packaging tests.
- npm run lint passed.
- KR production build and AU production build passed; AU built last. Existing chunk-size/dynamic-import warnings remain.
- git diff --check passed.
- Additional comparison: 12 Mochi quotes (six flavours × gift/singles) are byte-identical to baseline main 577aec4, including stored names/indexes/prices/packaging.
- Chrome 390px: EN/KO selector order, unchanged prices, gift selection Original + Strawberry + Banana + Butter/Red Bean = AUD35.50 with free box; cart shows new names. No horizontal overflow (scrollWidth = innerWidth =390).
- Chrome home: compact card, bilingual text, Escape/focus return, no notice after reload, Tab/Enter CTA; desktop 1440px reviewed. No notice in cart/checkout.
- Script-disabled initial HTML and JavaScript-rendered product both show Pavé Mochi, identical six offers/prices, unchanged canonical and updated image alt.
- Local screenshots: output/playwright/pave-rebrand-20261017/ (ignored, not committed).

No customer data or production account was accessed for this implementation. No order/notification sent. The local demo cart was used only for browser QA.

## Future deployment dependency — not executed

Frontend alone updates customer pages and SEO. For complete operational name synchronization, Reservation API (lookup/PIN summaries), Reservation Notification and Booking Reminder must also receive the updated shared au-renewal.js presentation code. Existing official packaging copies this module; shared import stubs need no edit. Tests cover these packaged consumers.

On separate approval: capture current deployment checkpoints, deploy the compatible operational packages, verify summaries using non-sending fixtures, then deploy AU frontend and verify names/SEO. Keep existing DB/schema, IDs, quote snapshots, prices, pickup validation, intake flags and reminder delivery mode unchanged. Reverting this presentation-only change does not require any data conversion. No Function deployment was performed here.
