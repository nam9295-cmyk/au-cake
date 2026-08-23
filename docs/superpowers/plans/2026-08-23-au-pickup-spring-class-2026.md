# AU Pickup Schedule and Spring Class 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand AU cake pickup to Friday evening and Saturday–Sunday with 15-minute slots, and limit new Spring Vacation class bookings to 3 and 10 October 2026 while adding an accessible seasonal campaign.

**Architecture:** Keep AU pickup rules in a small client module and a matching self-contained Reservation API definition, with a behavioral contract test proving the two definitions agree. Keep the Spring campaign dates, visibility window, bilingual copy, session key, and date helpers in one client module; mirror only the authoritative date allow-list in the Reservation API and contract-test it. Generalize the existing date picker with optional weekday, note, month, and maximum-date inputs without changing the class/history persistence model.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Node test runner, Appwrite Reservation API, Cloudflare Pages

**Spec:** `/home/john/.codex/attachments/13de49a9-5dc8-46c8-bf5a-a8bcd5230df0/pasted-text-1.txt`

## Global Constraints

- Work only in `feat/au-pickup-spring-class-2026`, based on production `origin/main` commit `6ad9d8263afc665a71ce9754f118cf90b7cfa157`.
- Do not edit `src/CakeDetailPage.tsx`, cake-detail layout/CSS, product photos, product prices/copy/options, Individual Packaging, Father’s Day, the seven-product catalogue, or the existing Pencil.dev handoff content.
- AU pickup is Friday 18:00–20:00 and Saturday–Sunday 08:00–20:00, inclusive, every 15 minutes. Monday–Thursday are closed.
- Preserve today-disabled, Sydney 20:00 cutoff, class-collision, and exact admin-opening override behavior.
- Keep KR scheduling behavior unchanged.
- New class reservations allow only `2026-10-03` and `2026-10-10`, at `10:00`, `13:00`, or `16:00`; historical reservations remain readable without mutation.
- Do not add Appwrite attributes or change schemas.
- Do not deploy Reservation Notification unless its source actually changes.
- Follow RED → GREEN for every behavior change. Make one final commit only after the complete verification set is green, as required by the user specification.

---

### Task 1: AU Pickup Schedule Domain Module

**Files:**
- Create: `src/lib/pickup-schedule.ts`
- Modify: `src/lib/utils.ts:97-255`
- Modify: `tests/cake-options.test.ts:430-690`
- Modify: `package.json:test:cake`

**Interfaces:**
- Produces: `AU_CAKE_PICKUP_SCHEDULE`, `AU_CAKE_PICKUP_ALLOWED_WEEKDAYS`, `getAuCakePickupTimeOptions(dateValue: string): string[]`, and `isAuCakePickupServiceTime(dateValue: string, timeValue: string): boolean`.
- Consumes: ISO `YYYY-MM-DD` date strings and `HH:mm` time strings only.

- [ ] **Step 1: Write failing client pickup schedule tests**

Add literal expectations that catch a wrong day, boundary, or interval:

```ts
test('AU pickup exposes Friday evening and weekend 15-minute slots', () => {
  const friday = timeOptionsForDate('2026-08-28', DEFAULT_SETTINGS)
  const saturday = timeOptionsForDate('2026-08-29', DEFAULT_SETTINGS)
  const sunday = timeOptionsForDate('2026-08-30', DEFAULT_SETTINGS)

  assert.equal(friday.length, 9)
  assert.deepEqual(friday.slice(0, 3), ['18:00', '18:15', '18:30'])
  assert.equal(friday.at(-1), '20:00')
  assert.equal(saturday.length, 49)
  assert.equal(saturday[0], '08:00')
  assert.equal(saturday.at(-1), '20:00')
  assert.deepEqual(sunday, saturday)
  assert.deepEqual(timeOptionsForDate('2026-08-27', DEFAULT_SETTINGS), [])
})

test('AU pickup rejects closed days, outside boundaries, and off-grid minutes', () => {
  for (const [date, time] of [
    ['2026-08-28', '17:45'],
    ['2026-08-28', '20:15'],
    ['2026-08-29', '07:45'],
    ['2026-08-29', '20:15'],
    ['2026-08-29', '18:07'],
    ['2026-08-27', '18:00'],
  ]) assert.equal(isCakePickupServiceTime(date, time), false, `${date} ${time}`)

  for (const [date, time] of [
    ['2026-08-28', '18:00'],
    ['2026-08-28', '20:00'],
    ['2026-08-29', '08:00'],
    ['2026-08-29', '20:00'],
    ['2026-08-30', '08:00'],
    ['2026-08-30', '20:00'],
  ]) assert.equal(isCakePickupServiceTime(date, time), true, `${date} ${time}`)
})
```

- [ ] **Step 2: Run the client tests and confirm RED**

Run: `npm run test:cake`

Expected: the existing 30-minute weekend-only implementation fails the Friday, 08:00, 15-minute, and slot-count assertions.

- [ ] **Step 3: Implement the minimal AU schedule module**

Define one immutable client schedule:

```ts
export const AU_CAKE_PICKUP_SCHEDULE = Object.freeze({
  timezone: 'Australia/Sydney',
  intervalMinutes: 15,
  weekdays: Object.freeze({
    5: Object.freeze({ open: '18:00', close: '20:00' }),
    6: Object.freeze({ open: '08:00', close: '20:00' }),
    0: Object.freeze({ open: '08:00', close: '20:00' }),
  }),
})
```

Strictly parse ISO dates in UTC, strictly parse `HH:mm`, generate inclusive slots using `intervalMinutes`, and require `(minutes - openMinutes) % intervalMinutes === 0` in the service-time validator.

In `utils.ts`, use the new helper only when `marketConfig.market === 'AU'`; preserve the existing settings-based 30-minute generator for KR.

- [ ] **Step 4: Run client pickup tests and confirm GREEN**

Run: `npm run test:cake`

Expected: the pickup schedule tests pass, including the existing Sydney cutoff tests after their expected opening-time literals are updated to 08:00/15-minute values.

---

### Task 2: Pickup Calendar, Copy, and Collision Regression

**Files:**
- Modify: `src/components/WeekendDatePicker.tsx`
- Modify: `src/pages/ReservePage.tsx:1165-1215`
- Modify: `src/lib/i18n.ts:199-370`
- Modify: `tests/cake-options.test.ts`
- Modify: `tests/cake-calendar-contract.test.mjs`
- Modify: `tests/cart-multiline-submit-contract.test.mjs`

**Interfaces:**
- Extends `SharedDatePickerProps` with optional `allowedWeekdays?: readonly number[]`, `availabilityNote?: string`, `initialVisibleMonth?: string`, and `maxDate?: string`.
- `WeekendDatePicker` preserves its Saturday/Sunday default. `PickupDatePicker` supplies Friday/Saturday/Sunday (`[5, 6, 0]`) without embedding hours in the calendar component.

- [ ] **Step 1: Write failing calendar and stale-copy tests**

Cover the customer-visible and collision behavior:

```ts
test('a 10:00 basic class blocks every 15-minute pickup through 11:30 inclusive', () => {
  const slots = [{ classDate: '2026-10-03', classTime: '10:00', durationMinutes: 90 }]
  for (const time of ['10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30']) {
    assert.equal(isCakePickupBlockedByClass('2026-10-03', time, slots), true, time)
  }
  assert.equal(isCakePickupBlockedByClass('2026-10-03', '11:45', slots), false)
})
```

In the calendar contract test, assert that pickup uses allowed weekdays `[5, 6, 0]`, `WeekendDatePicker` remains weekends-only, and the AU source no longer contains the four stale 10:00–17:00 strings named in the specification.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm run test:cake`

Expected: calendar configuration/copy assertions fail while the existing collision implementation demonstrates its inclusive boundary behavior.

- [ ] **Step 3: Generalize the date picker minimally**

Apply `allowedWeekdays`, `maxDate`, and `isDateDisabled` as combined disable predicates. Use `initialVisibleMonth` only for initial state and allow `availabilityNote` to replace the built-in note. Keep the existing outside-click, Escape, focus return, and Saturday/Sunday behavior.

Pass this note from `ReservePage`:

```tsx
availabilityNote={language === 'ko'
  ? '케이크 픽업은 금요일 저녁과 토·일요일에 가능합니다.'
  : 'Cake pick-up is available Friday evening and Saturday–Sunday.'}
```

- [ ] **Step 4: Update all current pickup copy**

Use exactly:

```text
Cake pick-up · Fri 18:00–20:00 · Sat–Sun 08:00–20:00
케이크 픽업 · 금 18:00–20:00 · 토·일 08:00–20:00
```

Update `announcement`, `pickupHours`, and `pickupLeadTimeHelp` while preserving the after-20:00 next-day noon explanation.

- [ ] **Step 5: Run pickup/UI regression tests and confirm GREEN**

Run: `npm run test:cake`

Expected: all AU cake tests pass and the KR market boundary test still passes.

---

### Task 3: Reservation API Authoritative Pickup Validation

**Files:**
- Modify: `appwrite-functions/reservation-api/src/business.js:82-96,315-431`
- Modify: `tests/reservation-api.test.mjs:580-650`
- Create: `tests/seasonal-schedule-contract.test.ts`
- Modify: `package.json:test:cake`

**Interfaces:**
- Produces server export `AU_CAKE_PICKUP_SCHEDULE` with the same serializable shape as the client constant.
- `isCakePickupServiceTime(dateValue, timeValue)` and `buildCakeReservation()` remain public server APIs but enforce the new per-weekday 15-minute rule.

- [ ] **Step 1: Write failing server boundary and contract tests**

Use literal allow/deny cases and a tampered request:

```js
test('cake API authoritatively enforces the AU Friday and weekend schedule', () => {
  for (const [pickupDate, pickupTime] of [
    ['2026-08-28', '18:00'], ['2026-08-28', '20:00'],
    ['2026-08-29', '08:00'], ['2026-08-29', '20:00'],
    ['2026-08-30', '08:00'], ['2026-08-30', '20:00'],
  ]) assert.doesNotThrow(() => buildCakeReservation(
    { ...cakeInput, pickupDate, pickupTime },
    { now, reservationNumber: 'VALID-PICKUP' },
  ))

  for (const [pickupDate, pickupTime] of [
    ['2026-08-27', '18:00'], ['2026-08-28', '17:45'],
    ['2026-08-28', '20:15'], ['2026-08-29', '07:45'],
    ['2026-08-29', '20:15'], ['2026-08-29', '18:07'],
  ]) assertApiError(
    pickupTime === '18:07' ? 'INVALID_PICKUP_TIME' : 'PICKUP_TIME_UNAVAILABLE',
    () => buildCakeReservation({ ...cakeInput, pickupDate, pickupTime }, { now }),
  )
})
```

The TS contract test imports both constants and asserts `deepEqual(server, client)`.

- [ ] **Step 2: Run server and contract tests and confirm RED**

Run: `npm run test:reservation-api && npm run test:cake`

Expected: the current server rejects Friday/15-minute slots, accepts old boundaries, and has no matching exported schedule.

- [ ] **Step 3: Implement authoritative schedule validation**

Replace the single open/close constants with the exported weekday schedule. Make `validatePickupDateTime` accept only minutes divisible by 15, then call the service-time validator. Preserve invalid-date, today, Sydney cutoff, school-window, class-collision, and admin-opening semantics.

- [ ] **Step 4: Run server and client contract tests and confirm GREEN**

Run: `npm run test:reservation-api && npm run test:cake`

Expected: both suites pass and the serialized client/server schedule definitions are equal.

---

### Task 4: Spring Class Campaign Domain and Server Allow-list

**Files:**
- Create: `src/lib/class-campaign.ts`
- Modify: `src/lib/class-utils.ts`
- Modify: `appwrite-functions/reservation-api/src/business.js:89-97,921-989`
- Modify: `tests/class-utils.test.ts`
- Modify: `tests/reservation-api.test.mjs`
- Modify: `tests/seasonal-schedule-contract.test.ts`
- Modify: `package.json:test:class`

**Interfaces:**
- Produces client `SPRING_CLASS_CAMPAIGN_2026`, `getSpringClassCampaignCopy(language)`, `isSpringClassCampaignActive(now, campaign?)`, `isSpringClassBookingDateAllowed(dateValue, now, campaign?)`, and `getNextSpringClassDate(now, campaign?): string | null`.
- Produces server `SPRING_CLASS_CAMPAIGN_2026` and `isSpringClassBookingDateAllowed(dateValue, now)`.
- Campaign object fields: `enabled`, `timezone`, `allowedDates`, `sessionTimes`, `visibleThrough`, and `sessionStorageKey` on the client; the server contract compares the authoritative shared fields only.

- [ ] **Step 1: Write failing campaign helper and server tests**

Cover date boundaries independently from the implementation:

```ts
test('Spring class chooses only the next non-past campaign date', () => {
  assert.equal(getNextSpringClassDate(new Date('2026-08-23T00:00:00Z')), '2026-10-03')
  assert.equal(getNextSpringClassDate(new Date('2026-10-03T14:01:00Z')), '2026-10-10')
  assert.equal(getNextSpringClassDate(new Date('2026-10-10T13:01:00Z')), null)
})

test('Spring class allow-list rejects every other weekend date', () => {
  const now = new Date('2026-08-23T00:00:00Z')
  assert.equal(isSpringClassBookingDateAllowed('2026-10-03', now), true)
  assert.equal(isSpringClassBookingDateAllowed('2026-10-10', now), true)
  for (const value of ['2026-09-26', '2026-10-04', '2026-10-11']) {
    assert.equal(isSpringClassBookingDateAllowed(value, now), false, value)
  }
})
```

Add Reservation API tests that primary dates outside the allow-list throw `INVALID_CLASS_DATE`, and package advanced dates outside it throw `INVALID_PACKAGE_SESSION`.
Keep or extend the existing class utility fixture so a July 2026 historical reservation still filters, formats, and exports without campaign-date validation; the allow-list applies only inside new-reservation construction.

- [ ] **Step 2: Run class and API tests and confirm RED**

Run: `npm run test:class && npm run test:reservation-api`

Expected: helpers do not exist and the existing server still accepts arbitrary future weekends.

- [ ] **Step 3: Implement the client campaign module**

Use exact ISO dates and bilingual copy from the specification. Sydney-date conversion must use `Intl.DateTimeFormat` with `Australia/Sydney`. `isSpringClassCampaignActive` is true only when enabled and Sydney today is on or before `2026-10-10`. Date allowance additionally requires an exact allow-list entry that is not before Sydney today.

- [ ] **Step 4: Implement the server allow-list**

Replace weekend validation in `buildClassReservation` with the exact campaign-date helper for both the primary and package advanced sessions. Keep `CLASS_SESSION_TIMES`, prices, extension rules, collision documents, response parsing, admin, CSV, and notification code unchanged.

- [ ] **Step 5: Run class/API/contract tests and confirm GREEN**

Run: `npm run test:class && npm run test:reservation-api && npm run test:cake`

Expected: only 3 and 10 October pass for new requests, both package sessions are validated, and client/server campaign dates and session times match.

---

### Task 5: Class Date Picker, Closed State, and Classes Callout

**Files:**
- Modify: `src/pages/ClassReservePage.tsx`
- Modify: `src/pages/ClassesPage.tsx`
- Modify: `src/App.tsx:247-260`
- Modify: `src/components/WeekendDatePicker.tsx`
- Modify: `src/index.css` only with campaign/class-page selectors
- Modify: `tests/class-component-contract.test.mjs`
- Modify: `tests/class-pages-module-contract.test.mjs`

**Interfaces:**
- `ClassReservePage` receives `language: Language` and `setLanguage: (language: Language) => void` in addition to existing props.
- Both basic and advanced calendars receive `initialVisibleMonth="2026-10"`, `maxDate="2026-10-10"`, and `isDateDisabled={(date) => !isSpringClassBookingDateAllowed(date, now) || isClassDateBooked(...)}`.

- [ ] **Step 1: Write failing component contract tests**

Assert both calendars use the campaign helper, both default to October 2026, the form contains the exact two-date note, and the closed state includes both English and Korean messages. Assert the landing no longer contains `Saturday and Sunday sessions with Jenny` or `Saturday and Sunday only`.

- [ ] **Step 2: Run class component tests and confirm RED**

Run: `npm run test:class`

Expected: current weekend defaults, stale text, and missing closed state fail.

- [ ] **Step 3: Bind ClassReservePage to the campaign**

Initialize both class dates from `getNextSpringClassDate(new Date()) || ''`. Re-evaluate from the Sydney `today` value so 3 October advances to 10 October after it passes. Validate both fields with the campaign helper before submission. Preserve the exact date/time duplicate rule and availability filtering.

After both dates pass, render the normal header plus:

```tsx
<main className="class-reserve-page class-campaign-closed">
  <h1>{language === 'ko'
    ? '봄방학 클래스 예약이 마감되었습니다.'
    : 'Spring vacation class bookings are now closed.'}</h1>
</main>
```

- [ ] **Step 4: Add the bilingual ClassesPage callout**

Place a compact callout beside the existing hero CTA. Use the exact campaign copy and route the CTA through `navigate('class-reserve')`. Replace general Saturday/Sunday sales copy with `Limited Saturday classes` or the exact dates, but do not redesign the page.

- [ ] **Step 5: Run class tests and confirm GREEN**

Run: `npm run test:class`

Expected: both date pickers enforce only the two dates, closed state and language props compile, and historical/admin class tests remain green.

---

### Task 6: Accessible Once-per-Session Home Popup

**Files:**
- Create: `src/components/SpringClassPopup.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/index.css` with `.spring-class-popup-*` selectors only
- Modify: `tests/class-utils.test.ts`
- Create: `tests/spring-class-popup-contract.test.mjs`
- Modify: `package.json:test:class`

**Interfaces:**
- `SpringClassPopup({ language, onBook }: { language: Language; onBook: () => void })` owns open/dismiss state but receives navigation.
- Campaign storage helpers accept a minimal `{ getItem(key): string | null; setItem(key, value): void }` interface, catch storage errors, and never break rendering.

- [ ] **Step 1: Write failing visibility and dismissal tests**

Use a real in-memory storage object and literal dates:

```ts
test('Spring popup is active through 10 October and respects enabled false', () => {
  assert.equal(isSpringClassCampaignActive(new Date('2026-10-10T12:59:59Z')), true)
  assert.equal(isSpringClassCampaignActive(new Date('2026-10-10T13:00:00Z')), false)
  assert.equal(isSpringClassCampaignActive(
    new Date('2026-08-23T00:00:00Z'),
    { ...SPRING_CLASS_CAMPAIGN_2026, enabled: false },
  ), false)
})

test('Spring popup dismissal survives the same browser session only', () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value) } }
  assert.equal(isSpringClassPopupDismissed(storage), false)
  dismissSpringClassPopup(storage)
  assert.equal(isSpringClassPopupDismissed(storage), true)
  assert.equal(isSpringClassPopupDismissed({ getItem: () => null, setItem: () => undefined }), false)
})
```

- [ ] **Step 2: Run class tests and confirm RED**

Run: `npm run test:class`

Expected: popup visibility/storage helpers and component do not exist.

- [ ] **Step 3: Implement the accessible modal**

Render only while active and not dismissed. Include `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, close button, primary CTA, and secondary dismiss action. On open, store the prior focused element, focus the close button, lock body scrolling, listen for Escape, and restore focus to the prior element or `.brand-button` on cleanup. Catch all `sessionStorage` access failures. Use no animation when `prefers-reduced-motion: reduce` and constrain the panel within the mobile viewport.

- [ ] **Step 4: Mount only on HomePage**

Render the component at the end of `HomePage` only for the AU market. `onBook` dismisses the current session and calls `navigate('class-reserve')`. Do not mount it in `App`, private pages, or admin routes.

- [ ] **Step 5: Run popup and class tests and confirm GREEN**

Run: `npm run test:class`

Expected: active/expired/disabled/session cases pass, the contract confirms role/modal/Escape/CTA/copy, and no private module imports the popup.

---

### Task 7: Public Class Content and Static SEO Consistency

**Files:**
- Modify: `src/content/au-public-pages.json:56-70`
- Modify: `scripts/generate-seo-pages.mjs:255-295`
- Modify: `tests/au-public-content.test.mjs`
- Modify: `tests/cake-seo-generator.test.mjs`
- Generated by build: `public/llms.txt`, `dist/classes.html`, and the standard static route artifacts

**Interfaces:**
- Public class SEO copy describes the two limited Saturday dates without changing course pricing/schema fields.

- [ ] **Step 1: Write failing public/static copy tests**

Assert that `/classes` public content and generated HTML contain `Saturday 3 & Saturday 10 October` and the three session times, and do not contain `Saturdays and Sundays` or `Basic and Advanced weekend classes`.

- [ ] **Step 2: Run the SEO/content tests and confirm RED**

Run: `npm run test:cake`

Expected: current public content and static generator contain generic weekend wording.

- [ ] **Step 3: Update canonical class content and generator heading**

Use the campaign dates in `description`, `intro`, and `courseDescription`; keep `baseLowPrice`, `baseHighPrice`, package pricing, and extension pricing unchanged. Rename the generator heading to `Basic and Advanced Spring Vacation classes` and add a semantic date/session paragraph sourced from public content.

- [ ] **Step 4: Build and confirm generated output**

Run: `npm run build`

Expected: `dist/classes.html` and regenerated `public/llms.txt` carry current class dates, while sitemap routes and noindex rules remain unchanged.

---

### Task 8: Read-only Audit, Full Verification, Integration, and Production Deployment

**Files:**
- Review all changed files with `git diff`
- Do not create or modify Appwrite schema files
- Do not modify Reservation Notification files

**Interfaces:**
- Deployment uses the repository’s existing Reservation API deployment script and Cloudflare Pages production project/configuration.
- Audit output contains only aggregate date/status counts, never names, phones, emails, reservation numbers, or notes.

- [ ] **Step 1: Perform the read-only future class reservation audit**

Load existing local production environment configuration without printing values. Query the configured class reservation collection for future rows with status `Requested` or `Confirmed`, aggregate only by `classDate` and `status`, and record whether any date other than `2026-10-03`/`2026-10-10` exists. Do not update or delete any document.

- [ ] **Step 2: Run the complete fresh verification set**

Run, in this order:

```bash
npm run test:cake
npm run test:class
npm run test:reservation-api
npm run build
npm run lint
npm test
git diff --check
```

Expected: every command exits 0 with no test failures or whitespace errors.

- [ ] **Step 3: Audit scope and forbidden changes**

Run:

```bash
git status --short
git diff --stat
git diff --name-only
git diff -- src/CakeDetailPage.tsx public/products docs/au-cake-pencil-detail-handoff.md
rg -n "Cake pick-up Sat–Sun · 10:00–17:00|Saturday–Sunday pick-up · 10:00–17:00|Saturday and Sunday sessions with Jenny|Saturday and Sunday only" src public scripts
```

Expected: the forbidden diff is empty, the stale-string search is empty, no product/price/packaging/Father’s Day changes exist, and no Appwrite schema diff exists.

- [ ] **Step 4: Commit and push the feature branch**

```bash
git add \
  docs/superpowers/plans/2026-08-23-au-pickup-spring-class-2026.md \
  package.json \
  src/App.tsx \
  src/components/SpringClassPopup.tsx \
  src/components/WeekendDatePicker.tsx \
  src/content/au-public-pages.json \
  src/index.css \
  src/lib/class-campaign.ts \
  src/lib/i18n.ts \
  src/lib/pickup-schedule.ts \
  src/lib/utils.ts \
  src/pages/ClassReservePage.tsx \
  src/pages/ClassesPage.tsx \
  src/pages/HomePage.tsx \
  appwrite-functions/reservation-api/src/business.js \
  scripts/generate-seo-pages.mjs \
  public/llms.txt \
  tests/au-public-content.test.mjs \
  tests/cake-calendar-contract.test.mjs \
  tests/cake-options.test.ts \
  tests/cake-seo-generator.test.mjs \
  tests/class-component-contract.test.mjs \
  tests/class-pages-module-contract.test.mjs \
  tests/class-utils.test.ts \
  tests/reservation-api.test.mjs \
  tests/seasonal-schedule-contract.test.ts \
  tests/spring-class-popup-contract.test.mjs
git commit -m "feat(au): expand pickup hours and open spring classes"
git push -u origin feat/au-pickup-spring-class-2026
```

Never force-push.

- [ ] **Step 5: Reconcile with the latest origin/main and integrate safely**

Fetch again, verify no unexpected upstream conflict, merge the reviewed feature branch into `main` using the established production integration workflow, and push `main`. If upstream moved incompatibly, stop before mutating production.

- [ ] **Step 6: Deploy Reservation API and frontend**

Run the repository Reservation API deploy command and wait for `ready` plus its read-only health check. Build AU frontend from the integrated commit, deploy `dist` to the existing Cloudflare Pages production project, and verify the deployed HTML references that exact commit asset prefix. Do not deploy Reservation Notification because its source is unchanged.

- [ ] **Step 7: Perform production smoke checks without creating a reservation**

Verify live HTML/assets and safe public/availability endpoints for:

```text
Pickup: Fri 18:00–20:00 (9 slots), Sat/Sun 08:00–20:00 (49 slots), 15-minute spacing
Calendar: Friday/Saturday/Sunday enabled; Monday–Thursday disabled
Class: popup active, dismiss/CTA paths present, ClassesPage dates visible, ClassReservePage October 2026 with only 3/10 enabled
Server: a non-persistent validator/health path rejects a non-campaign class date
```

Do not create a production class reservation. If a non-persistent endpoint cannot exercise one case, use the deployed function’s read-only health plus exact deployed source/contract evidence and state that limitation rather than writing customer data.

- [ ] **Step 8: Report the exact deployed state**

Report production status, branch/SHA, slot counts/boundaries, server 15-minute validation, class allowed/rejected dates, popup/session behavior, Classes and ClassReserve UI, historical audit aggregates, Reservation API/notification/frontend deployment states, every verification command, schema unchanged, forbidden areas unchanged, and any remaining issue.
