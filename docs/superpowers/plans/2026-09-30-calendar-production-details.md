# Calendar Production Details Implementation Plan

Goal: Jenny sees Custom Cake flavour in compact schedules and separate design/additional requests after selecting an event using the existing PIN token.
Spec: User-approved final design in this session (2026-09-30).
Architecture: Monthly sanitizer adds only exact-prefix flavour to its existing label. A separate read-only `calendar-production-detail` action validates the unchanged calendar:read token before any snapshot read, and projects only production fields from the immutable request and current lifecycle snapshot. A typed client parser protects the rendering boundary.
Constraints: No new login, token scope/TTL changes, schema migration, backfill, server checkout changes or production writes. Phone/email/customer identity/photos/internal history remain absent. Free inputs render as plain text.

- [x] Write and observe failing monthly projection, detail authorization/privacy and rendering tests.
- [x] Parse only anchored `[Flavour: ...]` prefixes; preserve legacy design notes and show Not specified when absent.
- [x] Implement token-authenticated read-only detail projection including all custom lines and original requestNote.
- [x] Add compact month/agenda labels and inline accessible production details with stale-request protection.
- [x] Verify API, UI, desktop/mobile browser checks, full suite, lint, AU/KR builds, packaging and routing; commit `Calendar production details`.

Review focus: detail arrival after logout or switching dates; unknown/duplicate lookup identity; multiple custom lines; malformed prefix preservation; customer HTML strings never becoming markup.
