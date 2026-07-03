# AU Kids Class Implementation Plan

> **For Hermes:** Implement directly in `/home/john/workspace/au-cake` and verify with build/lint/browser checks.

**Goal:** Add a safe AU kids cake class booking flow beside the existing AU cake reservation flow.

**Architecture:** Keep cake reservations and class reservations separate. Reuse the existing Vite/React/Appwrite/Auth app, add a separate `class_reservations` collection, local demo fallback, customer pages, and admin page. Do not reuse Firebase or hardcoded admin password from the Korean partner repo.

**Tech Stack:** React 19, Vite, TypeScript, Appwrite, existing CSS system.

---

## Task 1: Add planning/design docs

**Objective:** Provide John and frontend/design work with clear product and visual direction.

**Files:**

- Create: `docs/planning/AU_KIDS_CLASS_PRODUCT_PLAN.md`
- Create: `docs/design/AU_KIDS_CLASS_FRONTEND_DESIGN_BRIEF.md`
- Create: `docs/planning/AU_KIDS_CLASS_IMPLEMENTATION_PLAN.md`

**Verification:** Files exist and include routes, fields, admin requirements, safety copy, and mobile checks.

## Task 2: Add class reservation domain types and utilities

**Objective:** Define class booking data independent from cake order data.

**Files:**

- Modify: `src/lib/types.ts`
- Create: `src/lib/class-utils.ts`
- Create: `tests/class-utils.test.ts`

**Behaviors to test first:**

- booking price is A$109 for one child and A$198 for two children
- deposit is A$50
- class reservation numbers use `VG-KC-AU-YYYYMMDD-...`
- CSV includes safety/consent/admin fields
- copied messages include parent name, child name, session, deposit, and safety notes

## Task 3: Add Appwrite/local repository methods

**Objective:** Store and manage class reservations with the same safety model as existing reservations.

**Files:**

- Modify: `src/lib/appwrite.ts`
- Modify: `src/lib/repository.ts`

**Functions:**

- `createClassReservation(input)`
- `listClassReservations(filters?)`
- `updateClassReservation(id, updates)`

**Local fallback:** Use `localStorage` key scoped by market: `verygood-class-reservations-au`.

## Task 4: Update Appwrite setup script and env example

**Objective:** Create `class_reservations` collection automatically.

**Files:**

- Modify: `scripts/setup-appwrite.mjs`
- Modify: `.env.example`

**Collection:** `class_reservations` by default.

**Permissions:**

- Anyone can create.
- Only admin user ids / authenticated admins can read/update/delete.
- Do not grant public read.

## Task 5: Add customer routes

**Objective:** Add public landing and reservation form.

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Routes:**

- `/classes`
- `/class-reserve`

**Form:** Must include parent, child, booking type, session, allergy, emergency contact, pickup person, consent, cancellation, photo consent.

## Task 6: Add admin route

**Objective:** Let Jenny manage class requests.

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Route:** `/admin/classes`

**Features:**

- list class reservations
- update status/payment/admin memo
- copy deposit message
- copy confirmation message
- download CSV

## Task 7: Verify

**Commands:**

```bash
npm run test:class
npm run lint
VITE_MARKET=AU npm run build
```

**Browser checks:**

- `/classes`
- `/class-reserve`
- `/admin/classes`
- mobile 320/360/375px after design pass

## Non-goals today

- Online payment
- Automated SMS/email to customer
- Public address display
- Firebase migration
- Fake viewer count
- Teen class product page
- Birthday party product page
