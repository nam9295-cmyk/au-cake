# AU menu and packaging implementation

Approved scope: match /custom-cakes to /cakes, replace home Mochi notice with mini whole cake launch, retain all almond offers/prices and add pouch/triangle-box choice only to 80g singles. Black tub always contains pouches; six-pack unchanged.

- [x] Reuse renewal collection CSS for custom cake/class cards; retain tier links, class enquiry focus, paused kids classes and home cards.
- [x] Replace notice component, bilingual text, image and destination; separate dismissal keys. User-supplied basques-4inch and pave-4inch photos now appear in two equal columns, including mobile. Each CTA opens its own 4-inch product. One shared close dismisses both.
- [x] Add validated almondPackaging selection, same-price calculation, cart identity/persistence/edit URL, summary and order-detail rendering.
- [x] Preserve omitted packaging in historical stored snapshots. Keep existing offer IDs and immutable price facts.
- [x] Verify backend, UI, browser cart flow and responsive presentation.

## Release requirements
Owner authorized release on 2026-11-12. Notification, reminder and reservation API archives built ready and were activated in that order without changing function configuration or variables. Public health and renewal-health returned 200/ready. Review API does not import the renewal reader and needs no deployment.
Deploy the reservation API and every function bundling the renewal reader (notification and reminder) before the frontend: older deployed readers reject the new selection field. No DB schema migration is needed because the field lives in orderLinesJson. Verify backend/consumer readiness before exposing the UI, and verify live checkout after release without submitting a real order.

## Verification
Backend renewal suites: 71 tests passed. UI suites: 20 tests passed. AU production build passed after npm ci restored missing parse5. UI suites include bilingual custom menus and popup, private-class navigation, single/tub packaging, separate cart lines and restore links. Ego Lite verified AUD 12 triangle-box single plus AUD 25 pouch tub gives AUD 37, and inspected 390px popup and desktop collection layout.

Follow-up: two-panel launch popup verified in Ego Lite at 390px and desktop; home tests (8) and AU build passed. Supplied PNGs converted to optimized WebP without cropping.

Release verification: 82 backend/deployment tests, 31 UI tests and account-enabled AU build passed. Active deployments: notification 6af57dc0708d24dc00bc; reminder 6af57dc2df4aae03ecdb; API 6af57dc75d34fe40bfdb. No customer order or email was created by verification.
