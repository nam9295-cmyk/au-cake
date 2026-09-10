# Custom Cake semantic integration implementation plan

> For agentic workers: use superpowers:subagent-driven-development, one implementation worker followed by task review and final integration review.

**Goal:** Integrate approved frontend86993bfe7895b9aa1381d9d1c14ebec77ce419ea into local integration d465ad4352301009ac82ace738b3c7f0663daa6a, retaining authoritative backend6579f96 and wirea42f82f.
**Architecture:** Backend wire parser/repository remain production boundary. Presentation helpers move to custom-cake-ui.ts; mock is test/DEV-only and absent from production graph. A focused submission-intent module owns in-memory stable IDs, immutable retry payload and photo session/upload state; existing customer/admin views consume real snapshots.
**Tech Stack:** React19/TypeScript/Vite, node:test/esbuild, Appwrite Functions adapter.
**Spec:** docs/custom-cake-api-contract.md and original erased wire types/static fixtures; latest user explicitly approves admin requestNumber+customerPhone search instead of new list API. User's semantic integration requirements are recorded below.

## Global Constraints

- Only ssh very /home/john/workspace/au-cake/.worktrees/custom-cake-integration, branch integration/custom-cake. No push/main merge/migration/deployment/operational calls. Remote Node24 /home/john/.nvm/versions/node/v24.14.0/bin; root node_modules shared symlink MUST NOT npm install/ci into it. Existing function-local deps installed.
- Merge already initiated --no-ff --no-commit from exact frontend86993bf. Actual unresolved conflict only src/lib/custom-cake-client.ts(add/add); package.json automerged but must preserve both suites. Do not abort/restart or discard nonconflict frontend changes. All changed tree is task-owned merge, initial tree was clean.
- Backend src/lib/custom-cake-client.ts from d465ad4 authoritative, preserve ALL parser exports/behavior byte-for-byte if practical. Wire doc/types/staticfixtures, stored-order and golden17 untouched. Do not change runtime backend policy/actions. Real contract defects escalate, never invent wire.
- Preserve Antigravity Custom Cake CakeDetail styling, /cakes05,Homewidecard,image/Bento,PickupContactUs,@verygood_syd,desktop/mobile. No catalog dedup/designrefactor. UI skill applies only to avoid new styling, not overwrite approved design.
- Admin initial screen search by requestNumber+customerPhone, no automatic list. Search proof only component/session memory, never URL/localStorage. Successful lookup retains existing quote/photo/lifecycle UI. Admin mutations+adminphoto uses independently authenticated admin JWT through getCakeWireRepository. State/version conflicts refetch using original successful search proof. No new admin list API.

## Task 1 — Atomic frontend/backend semantic merge

Files: resolve src/lib/custom-cake-client.ts; combine package.json; create src/lib/custom-cake-ui.ts and focused submission module (e.g.custom-cake-submission.ts); optionally isolate mock in tests/dev; update src/pages/CustomCakePage.tsx,CustomCakeCompletePage.tsx,LookupPage.tsx,src/components/CustomCakeLookupResult.tsx,AdminCustomCakesSection.tsx; preserve other design files. Tests tests/custom-cake-frontend.test.ts plus integration behavior tests.

Interfaces consumed: getCakeWireRepository() async returns exact custom-cake-repository.ts methods; createCustomCakeRequest(data, credential?), createPhotoSession(data), uploadPhoto(data,credential), getCustomCakeRequest(data), updateCustomCakeQuote,recordCustomCakeAcceptance,confirmCustomCakeRequest,completeCustomCakeRequest,cancelCustomCakeRequest,readPhoto,deletePhoto. Responses: create distinct from lookup; only server snapshot cents are display source.

- [ ] Read relevant source, full approved doc/types, frontend tests. Extract UI-only formatCents/formatExtraCents/getStatusInfo and catalog display constants. Keep mock behavior tests relocated if needed, no production graph import. Keep test:custom-cake-frontend and ALL backend test scripts; include integration suite in npm test. Do not weaken existing assertions to hide real regressions; intentional mock imports can point to isolated test/DEV module.
- [ ] Add RED tests before production changes: compiled production import graph excludes mock/localStorage service; UI uses actual parser/repository boundary; SSR or existing real component harness renders literal server amounts unchanged. Do not solely grep source: execute submission/session flow against controlled repository boundary, inspect production build graph, exercise actual UI handlers where possible.
- [ ] Implement create intent IDs once via crypto.randomUUID or getRandomValues RFC4122v4, lowercase; absentsecureentropy failclosed. IDs stable through retry; never generated inside submit. Stable per-selected-file uploadId and immutable bytes. Freeze submitted contact/options/IDs at first send and prevent edits mutating in-flight retry; explicit new intent required for edits. No auto merge distinct lines.
- [ ] Pre-submit photos are local selection/preview/validation only. Remove only selection/revoke preview, zero attached-delete calls. Submit issues/reuses30min session, uploads only selected files with stable uploadId/bytes, creates exact request with resulting refs and SAME credential in transport headers. Never token in body/canonical/localStorage/log/URL. Reuse valid session; expiry before create renews/reuploads selectedfiles percontract. Ambiguous create must replay SAME immutable request+refs before replacing session/refs (server replay precedes session checks). Do not silently generate new requestId/duplicate on timeout. If renewal conflicts quota, surface safe error; never delete staged via attachedendpoint.
- [ ] Remove dynamic client baseTotal/5%/paidSmore/gift/estimatedKnown totals from transaction source. Precreate show From/catalog and unit copy only, no dynamic total. Aftercreate/lookup show server quote fields directly. Completion must not trust LocalStorage fabricated quote; maintain real response in memory or authenticated lookup. Unknowncapability disables newsubmit, no mock fallback.
- [ ] Connect lookup/photo/admin using real repository. Customer photo access needs requestNumber+normalizedphone; admin requests existingJWT via repository. Admin search explicit, no listAdminRequests production. Capture successful search proof, conflict refetch same proof; guard stale async results from earlier search. Both QUOTE_VERSION_CONFLICT and QUOTE_STATE_CONFLICT covered for all lifecycle mutations. Do not persist searchphone.
- [ ] Run focused RED/GREEN behavioral tests covering UUIDfailclosed, stable request/line/upload IDs, byteidentical retry, sessionexpiry+ambiguouscreate, pre-remove, samecredential attach, serverrender, auth selector/JWT, conflictrefetch, productionmockexclusion,frontendcontracts. Run golden17/contract and builds. Complete semantic merge with git add exact owned files then git commit; no broken mechanical merge checkpoint needed.
- [ ] Run full npm test before task completion; record failures and fix in scope with tests. Do not weaken unrelated tests. Parent independently reruns final gates. Report to .superpowers/sdd/custom-cake-semantic-integration-plan/task-1-report.md: conflicts, modules, TDD commands/outputs, commits, limitations. Return short DONE/SHA/tests/concerns only. No subagents.

Example required behavior assertions (implement in project's executable TS/bundled harness, no production test-only API):
```ts
assert.match(sent[0].requestId,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
assert.deepEqual(sent[1],sent[0]) // actual submission controller after transport timeout
assert.equal(createCredential.uploadSessionId,uploadCredential.uploadSessionId)
assert.equal(createCredential.uploadToken,uploadCredential.uploadToken)
assert.equal(JSON.stringify(sent[0]).includes(uploadCredential.uploadToken),false)
assert.deepEqual(refetchArgs,{contractVersion:'custom-cake.v1',requestNumber:originalNumber,customerPhone:originalPhone})
```

## Task 2 — Independent final gates and integration review

Controller owns fresh npm test, test:custom-cake-frontend, test:custom-cake-contract, test:smore,test:smore-reserve,lint,AUbuild,KRbuild,diffcheck, Node22golden+fourarchive+photoarchive. Actual tar extracted ownlockednpmci independent import/fixture. Read-only final semantic review compares d465ad4 and frontend86993bf to candidate, preserving backendparser and designs. No new production writes. Record remaining adminautolist/catalogduplication debt and existing operationalblockers; report exact integrationSHA. Localintegrationnotpushed.
