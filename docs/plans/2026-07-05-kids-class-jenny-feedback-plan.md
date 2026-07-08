# AU Kids Class Jenny Feedback Implementation Plan

> For Hermes: implement this plan in small steps. Do not add the discount code until the final phase.

Goal: Update the AU kids class flow from a simple decorating class request into a clearer yellow-accent professional kids course booking flow that matches Jenny's feedback.

Architecture: Keep the current React/Vite single-page app and existing Appwrite class_reservations collection. Most changes are in `src/App.tsx`, `src/lib/class-utils.ts`, `src/lib/types.ts`, `src/index.css`, tests, and Appwrite setup/migration. Avoid changing the cake reservation flow.

Tech stack: React, TypeScript, Vite, Appwrite, node:test.

Current situation found:
- Main header already has a `Classes` nav button, but it is visually similar to `Find booking` and `Admin`, so it does not stand out.
- Kids class page currently uses green accents: `--kids-green: #2d5a27`, green buttons, green selected cards, green success/deposit styling.
- Kids form currently duplicates child details: `Child 1 Name & Age / School Year` text field plus separate `Child 1 Age` and `School Year` fields.
- Child 2 label says `(Optional)`, but Jenny wants optional removed.
- Session times are currently `10:00-11:30` and `13:00-14:30` only.
- Booking types are currently `1-child` AUD 109 and `2-friends` AUD 198.
- Deposit model is currently built into types, messages, CSV, admin payment statuses, and completion copy.
- Appwrite schema currently uses enum `bookingType: ['1-child', '2-friends']`, so adding `year-1-2` needs a schema migration/update before production submissions can work.

---

## Product decisions for this pass

1. Yellow accent
- Use yellow as the kids class highlight instead of green.
- Keep dark chocolate brown text for readability.
- Proposed colors:
  - `--kids-yellow: #f6c945`
  - `--kids-yellow-soft: #fff4c7`
  - `--kids-yellow-deep: #b88400`
  - keep `--kids-brown: #3c2f2f`
- Replace kids-class green buttons/selected states/sparkles/safety card emphasis with yellow.

2. Main navigation visibility
- Make the main `Classes` button more visible as a yellow pill.
- Rename label from `Classes` to `Kids Class` or `Kids Course`.
- Recommendation: `Kids Class` because it is short and clear in the header.

3. Course positioning copy
- Replace “decorating class” tone with “professional course / bring your imagined cake into the real world”.
- Suggested hero copy:
  - Title: `Kids Professional Cake Course`
  - Subtitle/location: `Melrose Park, Sydney`
  - Body: `A private chocolate cake course where kids learn real cake-making ideas, plan their dream cake, and bring it to life with Jenny's guidance.`
- Avoid promising formal certification. Use “professional-style” or “real cake studio experience” if the copy feels too strong.

4. Booking types/prices
- Add `year-1-2` at AUD 99.
- Keep current options unless Jenny later says to remove them:
  - `year-1-2`: `Year 1-2` / AUD 99
  - `1-child`: `Year 3-6` / AUD 109
  - `2-friends`: `2 kids / siblings / friends` / AUD 198
- If `year-1-2` is selected, only one child details block is needed.
- If `2-friends` is selected, Child 2 name, age, and school year are all required.

5. Session times
- Use exactly three start times:
  - `10:00`
  - `13:00`
  - `16:00`
- UI can display them as `10:00`, `1:00 PM`, `4:00 PM` if Jenny prefers customer-friendly text, but stored value should be stable.
- Recommendation for this implementation: store/display `10:00`, `13:00`, `16:00` to keep admin/CSV simple.

6. Payment/deposit model
- Remove customer-facing deposit wording.
- Set new class reservations to:
  - `paymentStatus: 'Fully paid'`
  - `depositAmount: 0`
- Change copy from “request/deposit later” to “booking is complete after full payment”.
- Important: this site still does not have online checkout. So wording should be realistic:
  - Customer submits request/details.
  - Jenny confirms availability and sends full payment details.
  - Booking is complete only after full payment is received.
- Do not say “paid online” unless a real payment gateway is added.

7. Discount code
- Leave for final phase only.
- First implement the core form, copy, pricing, and payment wording.
- Later add discount code field and pricing calculation only after the desired code/rule is known.

---

## Task 1: Update class utility model and tests

Objective: Add the new booking type, new session times, full-payment defaults, and remove deposit-first assumptions in utility tests.

Files:
- Modify: `/home/john/workspace/au-cake/src/lib/types.ts`
- Modify: `/home/john/workspace/au-cake/src/lib/class-utils.ts`
- Modify: `/home/john/workspace/au-cake/tests/class-utils.test.ts`

Steps:
1. Change `ClassBookingType` from:
   - `'1-child' | '2-friends'`
   to:
   - `'year-1-2' | '1-child' | '2-friends'`
2. Change `CLASS_SESSION_TIMES` to:
   - `['10:00', '13:00', '16:00'] as const`
3. Keep `CLASS_DEPOSIT_AMOUNT = 0` or remove the exported helper only if all imports are cleaned up.
   - Safer first pass: keep `getClassDepositAmount()` but return `0`, so old code does not break during refactor.
4. Update `CLASS_BOOKING_PRICES`:
   - `year-1-2: 99`
   - `1-child: 109`
   - `2-friends: 198`
5. Update `formatClassBookingType()`:
   - `year-1-2` -> `Year 1-2`
   - `1-child` -> `Year 3-6`
   - `2-friends` -> `2 kids / siblings / friends`
6. Rename or rewrite `buildClassDepositMessage()` so customer-facing text no longer says deposit.
   - Option A, minimal compatibility: keep function name but change text to full payment wording.
   - Option B, cleaner: rename to `buildClassPaymentMessage()` and update all imports/usages.
   - Recommendation: Option B, but if many admin imports are involved, do Option A first.
7. Update tests:
   - Prices include AUD 99 for `year-1-2`.
   - Deposit helper returns 0 if kept.
   - Payment message says full payment, not deposit.
   - Sample reservation uses `paymentStatus: 'Fully paid'`, `depositAmount: 0`.

Verification:
- Run `npm run test:class` if available.
- If no script exists, run the same pattern used by the repo for class tests or run full `npm test` if configured.

---

## Task 2: Update Appwrite setup/migration for the new booking type

Objective: Prevent production Appwrite submissions from failing when `year-1-2` is selected.

Files:
- Modify: `/home/john/workspace/au-cake/scripts/setup-appwrite.mjs`

Steps:
1. Update `classReservationAttributes` bookingType enum from:
   - `['1-child', '2-friends']`
   to:
   - `['year-1-2', '1-child', '2-friends']`
2. Keep payment status enum as-is because `Fully paid` already exists.
3. Keep `depositAmount` attribute for backward compatibility, but new reservations should save `0`.
4. Check whether the setup script updates existing enum attributes. Current `ensureAttribute()` likely only checks existence and skips updates, so existing production enum may not change automatically.
5. If Appwrite supports enum update through the SDK, add safe update logic for changed enum elements. If not, document the manual Appwrite console step before deploy:
   - Database: kids/class reservations database
   - Collection: `class_reservations`
   - Attribute: `bookingType`
   - Add enum element: `year-1-2`

Verification:
- After migration, create a test class reservation using `year-1-2` in production/staging Appwrite or local Appwrite if configured.

---

## Task 3: Update class reservation creation defaults

Objective: Store new bookings as full-payment-required bookings instead of deposit bookings.

Files:
- Modify: `/home/john/workspace/au-cake/src/lib/repository.ts`

Steps:
1. In `createClassReservation()`, set:
   - `paymentStatus: 'Fully paid' as ClassPaymentStatus`
   - `depositAmount: 0`
2. Keep `totalPrice: getClassBookingPrice(input.bookingType)`.
3. For `2-friends`, require/normalize Child 2 data as before, but validation will happen in UI.
4. For non-`2-friends`, set second child fields to empty/null.

Verification:
- Unit test or local booking submission confirms new reservation has `Fully paid` and `depositAmount: 0`.

---

## Task 4: Fix child detail form fields

Objective: Remove duplicated name/age/year field and remove optional wording.

Files:
- Modify: `/home/john/workspace/au-cake/src/App.tsx`

Steps:
1. In `ClassReservePage`, replace `Child 1 Name & Age / School Year` field label with `Child 1 Name`.
2. Placeholder should be just a name, e.g. `Leo`.
3. Keep separate fields:
   - `Child 1 Age`
   - `Child 1 School Year`
4. For Child 2 section, remove `(Optional)` from label.
5. Split Child 2 into separate fields:
   - `Child 2 Name`
   - `Child 2 Age`
   - `Child 2 School Year`
6. Validation rules:
   - Always require Child 1 name, age, school year.
   - If `bookingType === '2-friends'`, require Child 2 name, age, school year.
   - Do not require Child 2 for `year-1-2` or `1-child`.
7. Consider changing default child age/school year when `year-1-2` is selected:
   - age around 6 or 7
   - school year `Year 1`
   This is optional; avoid auto-overwriting if the user already typed values.

Verification:
- Browser check at 320px and 360px: no clipped labels/inputs.
- Submit validation blocks missing school year for Child 1 and Child 2 when needed.

---

## Task 5: Update booking type UI and session time UI

Objective: Show the new AUD 99 Year 1-2 option and exactly three session times.

Files:
- Modify: `/home/john/workspace/au-cake/src/App.tsx`
- Possibly modify CSS if 3 cards need layout improvement: `/home/john/workspace/au-cake/src/index.css`

Steps:
1. Replace hardcoded `(['1-child', '2-friends'] as const)` with a shared `CLASS_BOOKING_TYPES` list or explicit `(['year-1-2', '1-child', '2-friends'] as const)`.
2. Labels:
   - `year-1-2`: `Year 1-2`
   - `1-child`: `Year 3-6`
   - `2-friends`: `2 kids / siblings / friends`
3. Show prices from `getClassBookingPrice()`.
4. The session time buttons will automatically reflect `CLASS_SESSION_TIMES` after Task 1.
5. Adjust `.class-booking-grid` and `.class-time-grid` so three options look clean:
   - desktop/tablet: 3 columns if width allows
   - mobile: one or two columns without clipping

Verification:
- Browser form shows three booking cards and three time cards: `10:00`, `13:00`, `16:00`.

---

## Task 6: Remove deposit wording from form, completion, admin message copy, and CSV labels

Objective: Ensure customers and Jenny do not see the old deposit model in the new flow.

Files:
- Modify: `/home/john/workspace/au-cake/src/App.tsx`
- Modify: `/home/john/workspace/au-cake/src/lib/class-utils.ts`
- Modify: `/home/john/workspace/au-cake/tests/class-utils.test.ts`

Steps:
1. Form consent text currently says:
   - `confirmed after availability is checked and the deposit is paid.`
   Replace with:
   - `I understand my booking is completed only after availability is confirmed and full payment is received.`
2. Summary currently shows `Deposit`. Remove this row or change it to:
   - `Payment required: Full payment`
3. Submit button currently says `Submit Class Request`.
   - Use `Request booking` or `Send booking details`.
4. Submit note currently says `No deposit is charged now.`
   - Replace with `Jenny will confirm availability and send full payment details. Your booking is complete after payment is received.`
5. Complete page currently says deposit details/spot confirmed after deposit.
   - Replace with full payment wording.
6. CSV header currently includes `Deposit amount`.
   - Keep the column for backward compatibility if desired, but consider renaming to `Payment due now` or leave as `Deposit amount` with value `0` for old compatibility.
   - Recommendation: keep `Deposit amount` for now to avoid breaking old admin exports, but new records will be `0`.
7. Admin payment status options can keep old statuses for old records, but default new booking is `Fully paid`.
   - Optional UI improvement: reorder options so `Fully paid` is first or label section as `Payment status` only.

Verification:
- Search the source for `deposit`, `Deposit`, `Pending deposit`, `No deposit`, and confirm only compatibility/test references remain.

---

## Task 7: Update kids landing page copy and yellow styling

Objective: Match Jenny's “professional course / imagined cake into reality” positioning and yellow visual feedback.

Files:
- Modify: `/home/john/workspace/au-cake/src/App.tsx`
- Modify: `/home/john/workspace/au-cake/src/index.css`

Steps:
1. Update `ClassesPage` hero title and body.
2. Replace “decorating” copy in essentials/steps:
   - `One 15cm cake per child` can stay.
   - `Complete custom decorating` -> `Plan, build, and finish a real chocolate cake`.
   - `Design your cake` -> `Imagine your cake`.
   - `Decorate & personalise` -> `Build it with professional guidance`.
3. Pricing card:
   - Add `AUD 99 / Year 1-2`.
   - Keep `AUD 109 / Year 3-6`.
   - Keep `AUD 198 / two kids`.
   - Remove deposit line.
   - Note: `Booking is completed after availability and full payment are confirmed by Jenny.`
4. Safety card:
   - Remove `before deposit confirmation`; use `before booking confirmation`.
   - Remove `after deposit confirmation`; use `after booking confirmation` or `after payment confirmation`.
5. Yellow style update:
   - Add kids CSS variables for yellow.
   - Replace kids green color usages with yellow/deep yellow where appropriate.
   - Keep contrast: yellow backgrounds need brown text, not white text, for readability.

Verification:
- Browser check: kids page no longer reads like only a “decorating class”.
- Yellow is visible but not low-contrast.

---

## Task 8: Make main Kids Class button more visible

Objective: Jenny can immediately see the kids class entry point from the main page/header.

Files:
- Modify: `/home/john/workspace/au-cake/src/App.tsx`
- Modify: `/home/john/workspace/au-cake/src/index.css`

Steps:
1. In `SiteHeader`, change first nav label from `Classes` to `Kids Class`.
2. Add a CSS class or selector for the first nav button.
   - Best: explicit `className="kids-nav-button"` for the classes button.
3. Style it as a yellow pill:
   - background yellow
   - brown border/text
   - slightly stronger font weight
4. On mobile, ensure the button does not disappear or get too tiny.
   - Existing mobile CSS has special `kids class` handling only on kids pages. Check main page mobile too.

Verification:
- Browser check main page at desktop, 360px, 320px.
- `Kids Class` must be more prominent than `Find booking` and `Admin`.

---

## Task 9: Final discount code phase, do last only

Objective: Add discount code after core class booking flow is stable.

Blocked until Jenny/John confirms:
- Code text, e.g. `JENNY10`, `KIDS10`, etc.
- Discount type: fixed AUD amount or percentage.
- Applies to all class types or only specific ones.
- Whether code should be stored in Appwrite reservation/admin/CSV.

Recommended implementation later:
1. Add `discountCode` and `discountAmount` to types and Appwrite schema.
2. Add `calculateClassPrice(bookingType, discountCode)` in `class-utils.ts`.
3. Add tests for valid/invalid code.
4. Add a field near the summary in the form.
5. Store code/discount in reservation and CSV.

Do not implement this until the above values are confirmed.

---

## Full verification checklist

Run after implementation:

```bash
cd /home/john/workspace/au-cake
npm run test:class
npm run test:cake
npm run lint
npm run build
```

Manual browser checks:
- Main page desktop: `Kids Class` button is obvious.
- Main page mobile 320px/360px: header buttons do not clip badly.
- Kids page: yellow accents replace green accents.
- Kids page copy says professional course / imagined cake brought to life, not only decorating.
- Class form: booking types show Year 1-2 AUD 99, Year 3-6 AUD 109, two kids AUD 198.
- Class form: session times show 10:00, 13:00, 16:00.
- Class form: Child 1 name, age, school year are separate.
- Class form: Child 2 fields have no optional label and are required only for two-kid booking.
- Completion page: no deposit wording.
- Admin/CSV/message copy: no customer-facing deposit wording except legacy compatibility if intentionally kept.

Deployment caution:
- Before pushing/deploying production with `year-1-2`, update Appwrite `bookingType` enum. Otherwise Year 1-2 submissions will fail in production.
