# VERYGOOD AU Customer Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task after the user's plan approval. Mac Codex 단독 실행이며 하위 에이전트/Hermes에 위임하지 않는다. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AU 일반 케이크·초콜릿 신규 주문에 선택형 Google/Email OTP 계정, 프로필 자동입력, OAuth 주문서 복원과 본인 주문 조회를 추가한다.

**Architecture:** 기존 Appwrite Account/Preferences와 `reservation-api`를 확장한다. 실제 AU Renewal과 기존 일반 주문은 같은 reservations collection을 사용하므로 이곳에만 optional owner를 신규 생성과 함께 저장하고, 고객 조회 액션에서 매번 JWT·owner·readiness를 검증한다. 인증과 폼 보존은 분리하여 플래그 OFF 또는 인증 장애에도 비회원 주문을 유지한다.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Web SDK `appwrite@23.0.0`, Server SDK `node-appwrite@22.1.3`, self-hosted Appwrite `1.8.1`, 기존 Node test runner/rolldown UI tests/Playwright CLI.

**Spec:** [2026-10-17-customer-account-design.md](../specs/2026-10-17-customer-account-design.md)

## 로컬 실행 상태 — 2026-10-17

Task 1–10의 승인된 로컬 구현·검증을 완료했다. 실제 공급자 검증(Task 10 Step 3)은 격리 Appwrite/Google/SMTP 환경이 제공되지 않아 미실행이며 운영 활성화를 차단한다. 단계별 커밋·실제 테스트 수·browser 증거·미검증 항목·변경 파일은 [인수 기록](../../customer-account-validation.md), 운영 적용과 rollback은 [배포 절차](../../customer-account-rollout.md)에 기록한다. 아래 구현 전 승인 문구는 최초 계획 작성 당시의 경계를 보존한다.

Task 2의 ACL 검증은 기존 `APPWRITE_ADMIN_USER_IDS`를 그대로 사용한다. 최종 보안 검증에서 미분류 project DB와 공개 settings/calendar의 broad write도 활성화 차단 대상으로 보강했다. 운영 ACL을 수정하지 않는다. 사용자 지정 단독 실행에 따라 최종 리뷰는 별도 저자 자체 리뷰이며 독립 reviewer 검증은 없다.

## Global Constraints

- 작업 위치: `/Users/nam9295/Desktop/john_2.0/code/au-cake-customer-account`.
- 작업 브랜치: `feat/customer-account`.
- 기준 커밋: `45971f4b53224a199513448128cf3d26543219f2`.
- 실행 방식: Mac Codex 단독. Hermes 이관 및 하위 에이전트 위임 없음.
- 1차는 Verygood AU의 일반 케이크·초콜릿 상품 주문으로 한정한다.
- Custom Cake와 Kids Class의 회원 소유권 저장, 신규 스키마, MY ORDERS 연결 및 OAuth 폼 복원은 2차로 보류한다.
- Frontend: `VITE_CUSTOMER_ACCOUNT_ENABLED=false` 기본값.
- Server: `CUSTOMER_ACCOUNT_ENABLED=false` 기본값.
- return 경로는 `/account`, `/cart`, `/reserve`로 한정한다.
- draft 유효기간은 30분이며 OTP 재전송 cooldown은 60초다.
- 소유권 필드는 optional string `customerUserId`, size 36, required false다.
- 인덱스 이름은 `customerUser_created_idx`, attributes는 `[customerUserId, $createdAt]`, orders는 `[ASC, DESC]`다.
- 신규 회원 연결은 server-verified Appwrite ID로만 수행하고 과거 guest row를 backfill하지 않는다.
- 기존 canonical/fingerprint/가격/쿠폰 재시도 계약에 고객 인증 상태를 섞지 않는다.
- 판매 비활성 상품, 미확정 가격, 닫힌 Class 모집, 신규 주문 계약이나 판매 플래그를 회원 기능 때문에 활성화하지 않는다.
- 다른 브랜치와 main worktree, production DB/권한/Functions/사이트, 실제 고객 데이터는 변경하지 않는다. main 병합, reset, history rewrite도 하지 않는다.
- 2026-10-17 사용자 승인으로 Task 1–10의 로컬 구현·검증·기능별 커밋을 진행한다. 실제 Appwrite 리소스·운영 환경·main 변경은 별도 승인 대상이다.

## Review Focus

1. OTP/프로필 응답이 늦게 도착하거나 logout 뒤 완료돼도 이전 사용자나 이미 편집한 연락처가 복구되지 않아야 한다 — Tasks 5–7.
2. 새 owner 필드가 있어도 `Role.users()`/public create ACL이 남아 있으면 로그인 자체가 개인정보 접근을 열 수 있다 — Task 2와 격리 환경 Task 10.
3. 쿠폰 commit 결과 불명 또는 `cake-request-v1` claim 경쟁에서 다른 사용자의 owner로 성공 응답이 반환되지 않아야 한다 — Task 3.
4. OAuth 취소·storage 실패·StrictMode·도중 플래그 OFF에서도 기존 주문서와 requestId가 보존돼야 한다 — Task 7.
5. OAuth 도중 다른 탭에서 장바구니가 바뀌면 최신 장바구니를 덮어쓰거나 과거 snapshot으로 즉시 제출하지 않아야 한다 — Task 7; Account 목록의 늦은 응답도 사용자별로 분리한다 — Task 8.

---

## A. 저장 경로 재검증과 범위

`App.tsx:renewalRoute`는 AU `/cart`·`/reserve`를 `AuRenewalShop.Bag`로 보낸다. 이 폼은 `createRenewalOrder` → `executeReservationApi('create-cake')` → `buildRenewalOrderData`를 거쳐 cake `reservations`에 저장한다. `orderLinesJson.version=2`는 Renewal 가격 snapshot이며 별도 wire `cake-order.v2`가 아니다.

기존 `ReservePage`는 일반 `createReservation`/`createCakeOrder` 경로를 갖는다. 현재 AU에서 먼저 선택되는 Renewal 경로를 우회하거나 기존 차단된 legacy 판매를 다시 열지 않는다. 기존 일반 폼의 재사용 경로에 인증/복원을 연결하고 테스트에서 실제로 렌더링하되 production route 우선순위는 유지한다. KR에서는 고객 기능을 활성화하지 않는다.

공유 legacy gate의 `cake-request-v1` claims/commits는 기존 원자성·재시도를 지원한다. 그 구조, private snapshots, Custom Cake workflow, `create-class`에는 owner를 추가하지 않는다. 회원 replay 결과는 main handler가 최종 reservations row로 검증한다.

`ownershipTargets=[cake reservations]`와 `privacyAuditTargets=[현재 구성된 기존 개인정보 자원]`를 구분한다. Class/custom ACL의 읽기 전용 점검은 고객에게 기존 데이터가 새로 노출되는 것을 막는 사전 조건이며 해당 영역의 회원 연동이 아니다.

## B. 고정 계약과 파일 구조

새 TypeScript 계약은 `src/lib/customer-account-types.ts`에 둔다. 서버 DTO는 동일 키/값으로 만들고 실제 handler 응답을 같은 frontend parser에 통과시키는 contract fixture로 검증한다. 인증 SDK를 browser mock으로 대체한 결과와 실제 공급자 검증은 구분한다.

| 계약 | 고정 형태/책임 |
| --- | --- |
| `CustomerProfile` | `{version:1,name,contactEmail,phone,language:'en'|'ko'}`; Preferences key `verygoodAuCustomer` |
| `CustomerIdentity` | `{userId,loginEmail,profile:CustomerProfile}`; loginEmail은 읽기 전용 |
| `CustomerAccountHealth` | `{enabled:boolean,ready:boolean}`; 민감 식별자·권한·사용자 데이터 없음 |
| `CustomerAuthState` | `status:'checking'|'guest'|'authenticated'|'unavailable'` 판별 union; authenticated에만 identity 존재 |
| `CustomerOrderSummary` | `{id,reservationNumber,createdAt,pickupDate,pickupTime,status,paymentStatus,totalPriceCents:number|null}` |
| `CustomerOrderDetail` | summary + `{contact:{name,phone,email},requestNote,view:CustomerOrderView}` |
| `CustomerOrderView` | `format:'legacy'|'renewal'` 판별 union. legacy는 기존 `PublicReservation`의 허용 키; renewal은 기존 projection의 예약/픽업/상태/금액/packaging/`RenewalLine[]` 허용 키만 명시적으로 정의한다. 두 형식 모두 coupon/owner/admin/internal 키는 제외한다 |
| `CustomerOrdersPage` | `{orders:CustomerOrderSummary[],nextCursor:string|null}`; 최대 25건, reservations만 |
| `CustomerCheckoutDraft` | `{version:1,kind:'renewal'|'legacy',flowId,savedAt,returnTo,requestId,form,dirtyFields,checkoutContext,cartSnapshot,cartSignature}`; 일반 주문에 필요한 구조만 타입별 명시, 최대 JSON 64 KiB |

Frontend 전송 envelope는 기존 `{action,data}`에 `create-cake` 회원 요청일 때만 `customerAccount:'link'`를 추가한다. guest는 이 키를 생략한다. 이 값은 연결 의도이며 ID가 아니다. `data`나 input type에 `customerUserId`를 추가하지 않는다. 고객 read 액션은 검증된 JWT만으로 본인 ID를 결정한다.

고객 read 오류는 `CUSTOMER_ACCOUNT_DISABLED`(503), `CUSTOMER_ACCOUNT_NOT_READY`(503), `CUSTOMER_UNAUTHORIZED`(401), `INVALID_CUSTOMER_REQUEST`(400), `CUSTOMER_ORDER_NOT_FOUND`(404), `CUSTOMER_ORDERS_UNAVAILABLE`(503)로 제한한다. 유효한 인증으로 다른 owner의 생성 requestId를 재사용하면 기존 `REQUEST_ID_CONFLICT`(409)다. 상세/커서의 없는·guest·타인 row는 동일 404를 반환한다. 모든 계정 read/health 응답은 no-store이며 진단 세부사항은 고정 코드로만 서버 로그에 남긴다.

새 frontend config는 `src/lib/customer-account-config.ts`, browser SDK adapter는 `customer-auth.ts`, 프로필 검증은 `customer-profile.ts`, API/DTO parser는 `customer-orders.ts`, draft는 `customer-checkout-draft.ts`로 분리한다. React context 정의/hook은 `src/lib/customer-account-context.ts`, provider 구현은 `src/CustomerAccountProvider.tsx`로 나누어 기존 react-refresh lint 규칙을 만족시킨다. 새 전용 UI/CSS와 backend 파일은 해당 Task Files에 기재한다.

## C. 단계·의존성·커밋

| Task | 산출물 | 선행 | 예정 커밋 |
| --- | --- | --- | --- |
| 1 | 기본 OFF 플래그·DTO·테스트 실행 경계 | 계획 승인 | `feat(account): define disabled customer account contracts` |
| 2 | 읽기 전용 ACL readiness·reservations 전용 migration | 1 | `feat(account): add guarded additive ownership schema` |
| 3 | JWT 검증·일반 주문 owner 원자 저장·replay 검사 | 1,2 | `feat(account): bind new cake orders to verified customers` |
| 4 | 본인 주문 목록·상세 API | 2,3 | `feat(account): add private customer order reads` |
| 5 | Google/OTP SDK adapter·Preferences 계약 | 1 | `feat(account): add Google and email OTP authentication` |
| 6 | 세션 provider·통합 로그인 UI | 2,5 | `feat(account): add optional customer sign in state and UI` |
| 7 | 실제 AU/기존 일반 Checkout 자동입력·OAuth 복원 | 3,6 | `feat(account): preserve checkout through customer sign in` |
| 8 | `/account`·헤더·프로필·내 주문·삭제 안내 | 4,6,7 | `feat(account): add bilingual my account and order views` |
| 9 | 관리자 검사와 명시적 계정 전환 | 5,6 | `fix(auth): preserve customer sessions during admin checks` |
| 10 | 보안/회귀·격리 공급자/브라우저 검증·release 문서 | 2–9 | `test(account): verify security and prepare controlled rollout` |

번호 순서로 Mac Codex가 직접 실행한다. 각 Task에서 먼저 테스트의 RED를 확인하고 해당 책임만 구현한 뒤 GREEN/영향받는 기존 테스트를 확인하여 커밋한다. 전체 테스트·빌드의 최종 gate는 Task 10이다. 모든 중간 커밋의 feature flag 기본값은 OFF다.

구현 승인 후 Task 1 전에 `pwd`, `git branch --show-current`, `git status --short`, `git rev-parse HEAD`, `node --version`, `npm --version`으로 승인된 위치·상태를 확인한다. package install lifecycle을 확인하고 이 worktree에서만 `npm ci`로 lockfile의 dependencies를 설치한다. 다른 worktree의 node_modules를 symlink하거나 기존 설치를 바꾸지 않는다. 설치 뒤 tracked package/lockfile diff가 없어야 한다. 현재 문서 작성 단계에서는 이 setup을 실행하지 않는다.

### Task 1: 플래그·계약·테스트 경계

**Files:** Create `src/lib/customer-account-config.ts`, `src/lib/customer-account-types.ts`, `src/lib/customer-orders.ts`, `tests/customer-account-contract.test.ts`, `tests/run-customer-account-tests.mjs`, `tests/fixtures/customer-account/orders.json`; Modify `src/lib/appwrite.ts`, `.env.example`, `package.json`.

**Interfaces:** Produces `resolveCustomerAccountConfig({market,configured,frontendEnabled,reservationApiMode}):{enabled:boolean}`, B의 타입들, `CUSTOMER_AUTH_CHANGED_EVENT='verygood:auth-changed'`. `customer-orders.ts`는 `parseCustomerAccountHealth(value):CustomerAccountHealth`, `parseCustomerOrdersPage(value):CustomerOrdersPage`, `parseCustomerOrderDetail(value):CustomerOrderDetail`, `getCustomerAccountHealth(execute=executeReservationApi):Promise<CustomerAccountHealth>`를 제공한다. `appwriteConfig.customerAccountEnabled`는 pure resolver를 호출하며 customer 모듈에서 SDK client를 재생성하지 않는다.

- [x] **Step 1 — RED 테스트 작성:** AU/정확한 true/configured/API all 조합만 enabled; false/누락/KR/lookup/off는 disabled. flag OFF 렌더에서 Account SDK 호출 0회. fixture에는 A/B/guest와 legacy/Renewal, 취소/완료/미래 픽업을 구분한다. 공개 계약에 owner/token/adminMemo가 없음을 실제 parser의 거부/제거 결과로 검증할 입력을 정의한다.

  대표 assertion: `assert.equal(resolveCustomerAccountConfig({market:'KR',configured:true,frontendEnabled:'true',reservationApiMode:'all'}).enabled,false)`; `assert.equal(accountCalls.length,0)`.
- [x] **Step 2 — RED 실행:** `VITE_MARKET=AU node scripts/run-bundled-tests.mjs tests/customer-account-contract.test.ts`. 모듈 import 오류만으로 끝내지 않고 missing-export를 안전하게 읽어 `typeof resolver === 'function'` assertion 실패를 먼저 확인한다.
- [x] **Step 3 — 최소 구현:** resolver/타입/strict DTO parser/health transport와 `.env.example`의 false 기본값을 추가한다. 이 단계의 API client에는 목록·상세 fetch 함수를 아직 추가하지 않는다. Node/TS/SSR UI tests를 기존 rolldown 방식으로 실행할 전용 runner를 만들고 `npm run test:customer-account`와 전체 `npm test`에 연결한다. 새 runner는 테스트별 env를 지정하며 기존 UI runner의 기본 flag를 true로 바꾸지 않는다. dependency 버전/lockfile은 변경하지 않는다.
- [x] **Step 4 — GREEN 실행:** `npm run test:customer-account`; `VITE_MARKET=AU node scripts/run-bundled-tests.mjs tests/app-routes.test.ts`; `git diff --check`. 미래 Task의 아직 없는 test glob은 현재 task 완료를 막는 placeholder 실행 목록에 넣지 않고 파일이 추가될 때 등록한다.
- [x] **Step 5 — 커밋:** Task Files만 stage하고 위 Task 1 메시지로 커밋한다.

### Task 2: ACL readiness와 additive migration

**Files:** Create `appwrite-functions/reservation-api/src/customer-account-readiness.js`, `scripts/customer-account-schema.mjs`, `scripts/migrate-customer-account-schema.mjs`, `tests/customer-account-readiness.test.mjs`, `tests/customer-account-migration.test.mjs`; Modify `scripts/setup-appwrite.mjs`, `scripts/reservation-api-deploy-config.mjs`, `appwrite-functions/reservation-api/src/main.js`, `tests/reservation-api-deploy.test.mjs`, `package.json`.

**Interfaces:** Produces `resolveCustomerAccountResources(env)` with `ownershipTarget`/`privacyAuditTargets`; `checkCustomerAccountReadiness(databases,env):Promise<{enabled,ready}>`; `buildCustomerAccountMigrationPlan(env,metadata)` and `runCustomerAccountMigration({env,apply,client,sleep})`. Reads only metadata via existing SDK; no new production scope. Migration CLI defaults to dry-run and requires explicit `--apply` for future approved writes.

- [x] **Step 1 — RED 테스트 작성:** flag false는 DB 호출 0회. broad `read("users")`/`create("any")`, unknown admin, documentSecurity=true, active private resource 매핑 누락, owner/index mismatch/processing/failed는 not-ready. Class/custom owner 컬럼이 없어도 그 ACL이 안전하면 통과한다. migration transport spy에서 dry-run은 GET만, apply는 reservations의 누락 string/index만 생성하고 ACL update/delete/backfill 호출은 0회여야 한다.

  대표 assertion: `assert.equal(health.ready,false)` for a `read("users")` fixture; `assert.ok(dryRunRequests.every(request=>request.method==='GET'))`; `assert.deepEqual(schemaWriteTargets,['cake-db/reservations'])` after the apply fixture. ACL 관리자 allowlist는 기존 `scripts/review-schema.mjs:parseAdminUserIds()`와 동일한 `APPWRITE_ADMIN_USER_IDS`만 사용한다.
- [x] **Step 2 — RED 실행:** `node --test tests/customer-account-readiness.test.mjs tests/customer-account-migration.test.mjs`. 요구된 검사 함수/행동의 assertion 실패를 확인한다.
- [x] **Step 3 — 최소 구현:** owner/index는 `APPWRITE_CAKE_DATABASE_ID`/`APPWRITE_CAKE_RESERVATIONS_TABLE_ID`만 대상으로 한다. server-only HTTPS `/v1` endpoint, `CUSTOMER_ACCOUNT_MIGRATION_MARKET=AU`, project/DB/collection 매핑, Appwrite 1.8.1을 검증하고 redirect/credential URL을 거부한다. `APPWRITE_ADMIN_USER_IDS`의 정확한 IDs로 privacy ACL을 검사한다. 현재 사용하는 기존 Class/custom private 자원의 ACL은 읽기만 하며 자원/owner schema를 만들지 않는다. 미분류/확인 불가한 실제 개인정보 자원이 있으면 ready를 내지 않는다. attribute/index 생성 후 최대 30회×1초 polling, unknown/failed/timeout은 실패한다. setup은 AU이며 `CUSTOMER_ACCOUNT_ENABLED==='true'`인 신규 설치 때만 동일 정의를 포함하고 비어 있는 `APPWRITE_ADMIN_USER_IDS`를 거부한다. OFF 설치 동작은 유지한다. main의 고객 health dispatch는 기존 쓰기용 coupon 설정 resolution보다 먼저 분리해 flag OFF에 새 DB/Auth 호출이 없도록 한다. deploy config의 runtime/dry-run 양쪽에 기본 false 변수를 포함하고 새 고정 액션 이름만 log allowlist에 추가한다.
- [x] **Step 4 — GREEN 실행:** 새 테스트, `node --test tests/reservation-api-deploy.test.mjs tests/au-email-schema-migration.test.mjs tests/custom-cake-schema.test.mjs`. stub metadata로 idempotent 재실행, 다른 target 정의, async 실패를 확인한다. 실제 `.env.local`이나 production endpoint로 migration을 실행하지 않는다.
- [x] **Step 5 — 커밋:** Task 2 파일만 커밋하고 schema/ACL의 보호 조건을 diff로 확인한다.

### Task 3: 서버 인증과 신규 reservations owner

**Files:** Create `appwrite-functions/reservation-api/src/customer-identity.js`, `tests/customer-order-ownership.test.mjs`; Modify `appwrite-functions/reservation-api/src/main.js`, `tests/au-renewal-api.test.mjs`, `tests/reservation-api-deploy.test.mjs`.

**Interfaces:** Produces `resolveCustomerIdentity({headers,env,accountForJwt}):Promise<{userId:string}>`, `assertCustomerOrderReplayOwner(document,verifiedUserId):void`. Extend server-only `createCake` options with `verifiedCustomerUserId?:string`. Existing function runtime constructs `Account(new Client().setEndpoint(...).setProject(...).setJWT(jwt))`; it never verifies a customer with `.setKey(...)`.

- [x] **Step 1 — RED 테스트 작성:** forged body ID/email/header, missing/expired/mismatched JWT, blocked user, server flag OFF/not-ready link request fail before write. Valid A creates legacy/Renewal with owner A; guest omits field. Same A replay is identical; guest→A replay never backfills; B replay of A is 409. Race two actors at the same requestId, ambiguous coupon commit, shared `cake-request-v1` replay must use the final row's owner. Existing Class/custom create requests receive no new owner and retain their exact response envelopes.

  대표 assertion: `assert.equal(saved.customerUserId,'customer-a')`; `assert.equal(Object.hasOwn(guestSaved,'customerUserId'),false)`; `assert.equal(customerBReplay.status,409)`; `assert.equal(ownerAfterGuestReplay,undefined)`.
- [x] **Step 2 — RED 실행:** `node --test tests/customer-order-ownership.test.mjs tests/au-renewal-api.test.mjs`. Fixture service injection must exercise the real handler and createCake, not only a mocked auth helper.
- [x] **Step 3 — 최소 구현:** parse `customerAccount:'link'` only on `create-cake`. With no marker preserve the current guest path and do not call auth/readiness. Member marker requires flag/readiness/JWT and a valid requestId. Add verified owner to the new row outside build/canonical/fingerprint inputs. Check raw existing/final rows in initial replay, ordinary conflict, legacyGate response and coupon reconciliation before returning a member success. Do not update an existing owner or claim payload, or add ownership to snapshots. Reject client-supplied owner at the member transport boundary; creation responses retain the existing business DTO.
- [x] **Step 4 — GREEN 실행:** new ownership tests plus `node --test tests/reservation-api.test.mjs tests/reservation-review-coupon.test.mjs tests/reservation-api-customer-email-cutover.test.mjs tests/custom-cake-cutover.test.mjs tests/order-core-golden.test.mjs tests/order-contract-artifacts.test.mjs`. Extract checkpoint/full archives with `createReservationApiArchive` and import new auth modules from extracted source; existing recursive `src/**` packaging already includes them, so do not edit the archive builder without a failing dependency-inclusion test.
- [x] **Step 5 — 커밋:** backend ownership와 해당 테스트만 Task 3 메시지로 커밋한다.

### Task 4: 본인 주문 목록·상세 API

**Files:** Create `appwrite-functions/reservation-api/src/customer-orders.js`, `tests/customer-orders-api.test.mjs`; Modify `appwrite-functions/reservation-api/src/main.js`, `tests/fixtures/customer-account/orders.json`, `tests/customer-account-contract.test.ts`.

**Interfaces:** Produces `listCustomerOrders(databases,{userId,cursor?,limit?},resources):Promise<CustomerOrdersPage>`, `getCustomerOrder(databases,{userId,id},resources):Promise<CustomerOrderDetail>`. Bind only `customer-orders` with `{cursor?,limit?}` and `customer-order` with `{id}`; internal userId is never request data.

- [x] **Step 1 — RED 테스트 작성:** A/B/guest fixtures prove list equality query is fixed to authenticated A and only reservations is queried. Foreign/guest/missing detail and foreign cursor have identical 404. Arbitrary userId/query/source/collection, limit>25 and malformed cursor fail. 동일한 timestamp의 26개 row를 두 페이지로 읽을 때 누락/중복이 없어야 한다. Cookie/JWT loss is 401; invalid stored envelope fails closed; nested coupon/admin/fingerprint/owner/credential fields never appear. Legacy and Renewal stored prices match their original fixtures even if current catalog configuration differs.

  대표 assertion: `assert.deepEqual(result.orders.map(order=>order.id),['a-renewal','a-legacy'])`; `assert.deepEqual(foreignResponse,missingResponse)`; `assert.equal(JSON.stringify(detail).includes('reviewCouponId'),false)`.
- [x] **Step 2 — RED 실행:** `node --test tests/customer-orders-api.test.mjs`; `VITE_MARKET=AU node scripts/run-bundled-tests.mjs tests/customer-account-contract.test.ts`. Contract test imports the real server read/project function and passes its fixture result through Task 1's frontend parser; it must fail until the real server DTO satisfies the allowlist.
- [x] **Step 3 — 최소 구현:** readiness and identity precede DB reads. Use Query.equal(customerUserId,userId), Query.orderDesc('$createdAt'), bounded limit and SDK document cursor; validate cursor ownership before pagination. Detail rechecks row owner before projection. Use existing stored readers to validate saved order data, then explicitly copy safe fields. In particular `renewalReservationProjection` can include reviewCouponId, so never return its object wholesale or spread `privateFields:true`. Return fixed no-store responses and no PII diagnostic strings. No Class/custom sources or customer mutations. Dispatch customer reads through their own config rather than requiring an unrelated coupon secret.
- [x] **Step 4 — GREEN 실행:** new API and contract tests; `VITE_MARKET=AU node scripts/run-bundled-tests.mjs tests/stored-order-compatibility.test.ts`; `node --test tests/au-renewal-storage.test.mjs`.
- [x] **Step 5 — 커밋:** Task 4 변경만 커밋한다.

### Task 5: Google/OTP SDK adapter와 Preferences

**Files:** Create `src/lib/customer-auth.ts`, `src/lib/customer-profile.ts`, `tests/customer-auth.test.ts`, `tests/customer-auth-sdk.test.mjs`, `tests/customer-profile.test.ts`.

**Interfaces:** Produces `createCustomerAuth({account,idFactory,now,origin})` with `restore():Promise<CustomerIdentity|null>`, `sendEmail(email):Promise<{userId:string,expire:string,retryAt:number}>`, `verifyEmail({userId,code}):Promise<CustomerIdentity>`, `startGoogle({flowId}):Promise<void>`, `signOut():Promise<void>`, `saveProfile(profile):Promise<CustomerIdentity>`. Profile helpers: `readCustomerProfile(accountRecord):CustomerProfile`, `validateCustomerProfile(input):CustomerProfile`, `mergeCustomerPreferences(prefs,profile):Record<string,unknown>`.

- [x] **Step 1 — RED 테스트 작성:** new/existing OTP response IDs drive createSession; exactly 6 digits; 60초 cooldown and concurrent send/verify suppression; expired/429/network errors preserve editable state. Existing session never triggers another Google identity link or deleteSession. read profile defaults from Account, preserves unrelated prefs and separates loginEmail/contactEmail. name 2–80, contactEmail≤120, phone blank or normalized AU mobile, language en/ko; invalid profile sends no update. Old profile/contact snapshot fixture remains unchanged.

  대표 assertion: `assert.equal(sessionRequest.userId,emailTokenResponse.userId)`; `assert.equal(merged.unrelatedPreference,'keep')`; `assert.equal(profile.contactEmail,'orders@example.invalid')` while loginEmail remains the Account email.
- [x] **Step 2 — RED 실행:** `VITE_MARKET=AU node scripts/run-bundled-tests.mjs tests/customer-auth.test.ts tests/customer-profile.test.ts`; SDK contract `node --test tests/customer-auth-sdk.test.mjs` uses a local HTTP endpoint and real SDK requests.
- [x] **Step 3 — 최소 구현:** Account.createEmailToken({userId:ID.unique(),email}) → response.userId → Account.createSession({userId,secret}). Normalize email before send, use the token's expiry, and serialize relevant requests. Google callbacks are same-origin `/account/auth/callback` with a random flowId only; provider state remains Appwrite-owned. Account.get()/getSession('current') restore/expiry, deleteSession only on explicit sign-out. Preferences updates read/merge namespace without changing Account login email/phone via password APIs. Do not store/log OTP/JWT/provider tokens. Local HTTP tests pin method/route/body for SDK 23 against the 1.8.1 contract; no dependency upgrades.
- [x] **Step 4 — GREEN 실행:** above tests and `npm run test:customer-account`. Mark real Google/SMTP account reuse as an isolated-provider gate in Task 10; fake account methods do not prove provider reuse.
- [x] **Step 5 — 커밋:** auth/profile 모듈·테스트만 커밋한다.

### Task 6: 세션 provider와 선택형 로그인 UI

**Files:** Create `src/lib/customer-account-context.ts`, `src/CustomerAccountProvider.tsx`, `src/components/CustomerSignInDialog.tsx`, `src/lib/customer-account-copy.ts`, `src/styles/customer-account.css`, `tests/customer-account-ui.test.tsx`; Modify `src/main.tsx`, `src/index.css`, `tests/run-customer-account-tests.mjs`.

**Interfaces:** Produces `useCustomerAccount()` returning `{enabled,state,openSignIn,refresh,saveProfile,signOut}`. Dialog uses adapter from Task 5. Provider accepts injectable auth/health services for tests and wraps App outside all conditional/early-return routes; disabled context is inert and usable by existing SSR tests without a provider.

- [x] **Step 1 — RED 테스트 작성:** render exact Google/Email/Guest choices in EN/KO; empty/invalid OTP, busy/cooldown/resend/error/focus/Escape paths. delayed restore/profile/OTP after logout or unmount is discarded. health false/KR/flag OFF yields zero Account calls. Network failure exposes guest continuation while retaining typed form. pageshow/focus and an auth-changed event update session state without clearing cart; identity change discards old read cache.

  대표 assertion: after resolving a stale login promise, `assert.equal(currentState.status,'guest')`; `assert.equal(cartStorageAfter,cartStorageBefore)`; rendered guest continuation remains enabled on auth network failure.
- [x] **Step 2 — RED 실행:** `VITE_MARKET=AU node tests/run-customer-account-tests.mjs tests/customer-account-ui.test.tsx`. Use real rendered components with transport doubles; do not test a duplicate reducer in place of provider behavior.
- [x] **Step 3 — 최소 구현:** implement checking/guest/authenticated/unavailable, bounded restore and user-triggered retry. Consume Task 1's health client before calling the auth adapter. Never erase customer session on admin-check failure. Login dialog is optional and does not require leaving a mounted Checkout for OTP. Use native dialog/focus return, labelled inputs/inputMode/one-time-code, aria-live and existing buttons/tokens. Style only customer-account selectors; no navigation/catalog redesign. Cross-tab auth notification contains no ID/email/token; focus refresh is fallback. New functions/exports follow react-refresh lint boundaries.
- [x] **Step 4 — GREEN 실행:** new UI tests, `npm run test:customer-account`, `npm run lint`, `npx tsc -b --pretty false`. Existing root App/CartProvider ownership is unchanged apart from the added outer provider.
- [x] **Step 5 — 커밋:** Task 6 모듈과 provider 연결만 커밋한다.

### Task 7: 실제 Checkout 자동입력·OAuth 복원

**Files:** Create `src/lib/customer-checkout-draft.ts`, `src/components/CheckoutAccountPrompt.tsx`, `src/components/CustomerAuthCallback.tsx`, `tests/customer-checkout-draft.test.ts`, `tests/customer-checkout-ui.test.tsx`; Modify `src/pages/AuRenewalShop.tsx`, `src/pages/ReservePage.tsx`, `src/App.tsx`, `src/lib/app-routes.ts`, `src/lib/repository.ts`, `src/lib/renewal-client.ts`, `src/CustomerAccountProvider.tsx`, `src/lib/customer-account-context.ts`, `tests/au-renewal-pickup-ui.test.tsx`, `tests/cart-multiline-submit-contract.test.mjs`.

**Interfaces:** Produces `saveCheckoutDraft(storage,draft):{ok:true}|{ok:false}`, `restoreCheckoutDraft(storage,{flowId,now,cartSignature}):{status:'restored'|'cart-changed'|'missing'|'invalid',draft?}`, `clearCheckoutDraft(storage,flowId)`, `fillUntouchedContact(form,dirtyFields,profile)`. Provider adds `registerCheckout(capture:()=>CustomerCheckoutDraft):()=>void`. Extend `executeReservationApi<T>(action,data?,parser?,options?:{customerAccount?:'link'})`; createRenewalOrder/createReservation/createCakeOrder accept the same optional transport options outside their input.

- [x] **Step 1 — RED 테스트 작성:** 30분/64 KiB limits, malformed/prototype/unknown route/nonmatching flow/open redirect fail safely; storage write failure prevents Google navigation and preserves the form. SSR+browser assertions capture actual AU name/phone/email/date/time/options/note/promo/privacy/requestId/cart and legacy handoff. OTP success/failure, OAuth success/cancel, StrictMode remount and flag OFF callback preserve values/IDs and never auto-check consent. Delayed profile fills blank untouched fields only. A two-tab cart change preserves current cart and blocks stale submission until explicit review; only that changed-order confirmation rotates requestId.

  대표 assertion: `assert.equal(restored.draft.requestId,before.requestId)`; `assert.equal(filled.customerName,'Already typed')`; `assert.equal(storage.getItem(RENEWAL_CART_KEY),latestOtherTabCart)`; `assert.equal(submitEnabled,false)` for cart-changed.
- [x] **Step 2 — RED 실행:** `VITE_MARKET=AU node scripts/run-bundled-tests.mjs tests/customer-checkout-draft.test.ts`; `VITE_MARKET=AU node tests/run-customer-account-tests.mjs tests/customer-checkout-ui.test.tsx`. Browser portion is repeated in Task 10 against actual Bag DOM, not only a copied form fixture.
- [x] **Step 3 — 최소 구현:** capture actual Bag FormData, date/time, requestId, quote/cart identity before any OAuth leave; control only contact fields needed for async fill. Register the account callback page in app-routes and mount `CustomerAuthCallback`; validate its flow without consuming the stored draft. Return to the allowed path with only a random `customerResume` flow token. The target Checkout restores form/context and acknowledges consumption after state application, including StrictMode; revalidate slots/prices without silently replacing saved inputs. Exclude account/callback from analytics page/event payloads. Legacy path also preserves initial selection/orderLines/promo reward/cartOrigin snapshot. Never copy snapshot over a changed persistent cart. Submit `customerAccount:'link'` only with confirmed identity; an explicit guest path omits it even if the shared cookie exists. Authentication errors keep inputs and allow guest continuation. Unknown/ambiguous order commit errors must not trigger an automatic guest resubmission; keep requestId and original submission to resolve replay. Existing guest and flag-OFF requests remain byte-for-byte on the old payload path. Do not edit Custom Cake/Class forms, sale flags or Cart storage key/format.
- [x] **Step 4 — GREEN 실행:** new tests plus `npm run test:renewal`, `npm run test:smore-reserve`, `node --test tests/cart-multiline-submit-contract.test.mjs tests/cart-provider-contract.test.mjs tests/cart-ui-contract.test.mjs`. Confirm new typed transport options do not change fingerprints/golden fixtures or coupon payloads.
- [x] **Step 5 — 커밋:** Checkout/transport/복원 테스트만 커밋하며 backend/schema 변경을 섞지 않는다.

### Task 8: MY ACCOUNT·내 주문 UI·정적 경로

**Files:** Create `src/pages/AccountPage.tsx`, `src/components/CustomerOrderDetail.tsx`, `tests/customer-account-page.test.tsx`, `tests/customer-orders-client.test.ts`, `tests/customer-account-static.test.mjs`; Modify `src/lib/customer-orders.ts`, `src/App.tsx`, `src/lib/app-routes.ts`, `src/components/AuNavigation.tsx`, `src/lib/seo.ts`, `scripts/generate-seo-pages.mjs`, `src/lib/customer-account-copy.ts`, `src/styles/customer-account.css`, `tests/app-routes.test.ts`, `tests/robots-policy.test.mjs`.

**Interfaces:** Consumes Task 1's `parseCustomerOrdersPage(value)`/`parseCustomerOrderDetail(value)` and Task 6 context. Produces `getCustomerOrders({cursor?}):Promise<CustomerOrdersPage>`, `getCustomerOrder(id):Promise<CustomerOrderDetail>`, `classifyCustomerOrder(summary,now):'upcoming'|'past'`. React page uses existing label/currency/order display conventions.

- [x] **Step 1 — RED 테스트 작성:** disabled/guest/checking/profile-edit/saved/error/logged-in views in EN/KO. loginEmail read-only and contactEmail editable; save doesn't mutate order fixture. Saved default language applies after restore only if the customer has not explicitly changed language during this visit/Checkout; late profile data cannot reverse that choice. Own detail only, 401 clears old identity data, delayed A result cannot appear after login B. Sydney midnight/DST and completed/cancelled classification; nextCursor presence prevents a false globally empty group. safe legacy/Renewal payloads render stored prices/options, internal fields fail the parser. `/account` and callback load directly with 200/noindex; unknown route still 404 and neither account URL enters sitemap. KR account stays unavailable.

  대표 assertion: `assert.equal(classifyCustomerOrder(cancelledOrder,now),'past')`; `assert.equal(loginEmailInput.readOnly,true)`; `assert.equal(renderedOrders.includes('Customer A'),false)` after switching to B; `assert.equal(accountHttpStatus,200)` with noindex metadata.
- [x] **Step 2 — RED 실행:** `VITE_MARKET=AU node tests/run-customer-account-tests.mjs tests/customer-account-page.test.tsx`; `VITE_MARKET=AU node scripts/run-bundled-tests.mjs tests/customer-orders-client.test.ts tests/app-routes.test.ts`; static test fails on missing direct-load artifacts before adding routes.
- [x] **Step 3 — 최소 구현:** lazy AccountPage and reuse Task 7's callback route; keep callback restoration independent of active auth flag. Add SIGN IN/ACCOUNT to actual AuNavigation desktop/mobile without changing BAG/locale/menu. Member page has name, loginEmail, contactEmail, phone, default language, loaded upcoming/past pages, read-only detail and logout. Apply the profile language once per restored identity unless a current explicit language choice takes precedence; never apply customer language in KR. Keep profile/contact edits separate from submitted order snapshots. Include exact EN/KO account deletion notice from spec §13 using existing Contact Us; no delete API/button that implies immediate deletion. Define static account/callback fallback with noindex/nofollow and no PII; preserve hard 404 and avoid a global SPA fallback. Do not extend Custom Cake/Class OAuth return allowlist.
- [x] **Step 4 — GREEN 실행:** new parser/UI/static tests plus `npm run test:seo`, `npm run lint`, `npx tsc -b --pretty false`. Build AU before static tests; then build KR and confirm customer routes/UI do not activate. Existing menu keyboard/focus/geometry is checked again in Task 10.
- [x] **Step 5 — 커밋:** account route/UI/read client and static SEO changes together as Task 8.

### Task 9: 관리자 세션 충돌 방지

**Files:** Create `tests/customer-admin-session.test.ts`; Modify `src/lib/repository.ts`, `src/AdminLoginPage.tsx`, `src/CustomerAccountProvider.tsx`, `tests/customer-account-ui.test.tsx`. Existing `appwrite-functions/reservation-api/src/custom-cake-security.js` is a regression target and remains unchanged.

**Interfaces:** `isAdminLoggedIn():Promise<boolean>` becomes read-only. Existing `loginAdmin(email,password)` and `loginAdminWithGoogle()` return `ACCOUNT_SWITCH_REQUIRED` when a different normal session is active, rather than deleting or linking it. Explicit logout publishes `CUSTOMER_AUTH_CHANGED_EVENT`; provider listens only when enabled.

- [x] **Step 1 — RED 테스트 작성:** real repository methods with Account transport double prove checking a customer returns false and deleteSession count stays 0; unauthorized/admin Google callback also keeps customer session. Allowed admin remains authorized, existing password/Google start behavior remains, and only a clicked logout switches accounts. Customer JWT is denied by existing admin server actions despite client query/body manipulation; membership never grants admin.

  대표 assertion: `assert.equal(await isAdminLoggedIn(),false)`; `assert.equal(deleteSessionCalls,0)` for a customer; `assert.equal(customerAdminMutation.status,403)`.
- [x] **Step 2 — RED 실행:** `VITE_MARKET=AU node scripts/run-bundled-tests.mjs tests/customer-admin-session.test.ts`; ensure old isAdminLoggedIn delete behavior causes the intended failure.
- [x] **Step 3 — 최소 구현:** remove session deletion from checks. Before admin credential/OAuth initiation inspect the current session; preserve allowed admin handling and show an explicit account-switch/logout action for a normal customer. AdminLoginPage handles async Google errors, displays a clear message and does not auto-retry OAuth. No change to server administrator allowlists, email/password transport, private API permission checks or demo-mode admin behavior. Clear customer memory state when explicit admin logout succeeds, without touching cart/draft.
- [x] **Step 4 — GREEN 실행:** new tests, `node --test tests/custom-cake-security.test.mjs tests/admin-review-reward-api.test.mjs tests/admin-photo-preview-api.test.mjs`, `npm run test:admin-reservation`, `npm run lint`.
- [x] **Step 5 — 커밋:** 관리자 세션 수정으로 독립 검토할 수 있도록 Task 9 파일만 커밋한다.

### Task 10: 전체 검증·공급자/브라우저 증거·운영 문서

**Files:** Create `tests/customer-account.browser.mjs`, `docs/customer-account-rollout.md`, `docs/customer-account-privacy.md`; Modify `tests/run-customer-account-tests.mjs`, `package.json` only if the new verification entry point needs registration. Add a failing security/regression case to its owning Task test file before any fix; do not weaken existing expectations.

**Interfaces:** Produces a release evidence record with exact HEAD, command/exit/result counts, environment type and unexecuted checks. Rollout guide separates local offline validation, isolated provider tests, production approval/apply and rollback. Privacy guide implements spec §13 as an operator procedure and includes the user-facing notice; no automatic deletion feature or production command is run here.

- [x] **Step 1 — 테스트 시나리오 작성:** browser script follows existing repo's `async(page)=>...` Playwright CLI format. At 360/390/768/1440px in EN/KO, exercise guest and member Bag, OTP error→guest, Google cancel→restore, dropdown/focus/scroll/overflow, real displayed options/promo/requestId, A/B accounts and account details. Intercept/deny all production Appwrite/Resend traffic. Add a test that retained reservations with null owner are absent from a freshly created same-email/same-ID fixture, and that deleted/blocked session identity is denied; document this as evidence for the manual unlink-before-delete procedure, not an implemented deletion service.

  대표 assertion: after simulated OAuth cancellation, `assert.equal(restoredRequest.requestId,originalRequest.requestId)` and `assert.deepEqual(restoredRequest.orderLines,originalRequest.orderLines)`; after approved-unlink fixture, `assert.deepEqual(reusedIdOrders,[])`.

- [x] **Step 2 — 실행 경계 확인:** reuse the worktree-local locked install prepared before Task 1. Existing browser runner is CLI-based; `npx` is available. Inspect `/Users/nam9295/.codex/skills/playwright/scripts/playwright_cli.sh --help` and `open --help` for the installed CLI's engine options. Use the same wrapper's `--session au-account open http://localhost:4173/cart`, followed by `--session au-account run-code --filename tests/customer-account.browser.mjs`, against a local preview built with test-only Appwrite mapping. Save screenshots/trace under ignored `output/playwright/customer-account/`. Run Chromium and WebKit using the verified engine option; record engine/version. If an engine cannot run, record it as unexecuted and keep the release gate open. Record real Safari/Chrome separately rather than treating emulation as an iOS device result.
- [ ] **Step 3 — 격리 공급자 검사:** a designated nonproduction Appwrite 1.8.1 project, SMTP test inbox and Google test users must be provided through local-only secure configuration. Refuse production host/project IDs in this test configuration. Create known test accounts and confirm Google→logout→OTP and OTP→logout→Google keep the same `$id` and owned fixture order. Also test different email, remaining session, concurrent initial sign-in, expiry/logout and browser cookie restrictions. Use real Functions execution to verify platform JWT and direct DB denial. Test records in this isolated project only may be cleaned up; inability to run these checks blocks production activation and is reported explicitly.
- [x] **Step 4 — 최종 GREEN:** run the validation matrix D on the final code candidate, including the unchanged Custom Cake/Class suites. Run source diff/scope checks against the baseline; no private snapshot/Class source/schema changes or sale policy changes are permitted. Document exact skip reasons, warnings, failed/unexecuted provider/device checks. Do not claim 1,771+ pass solely from the old baseline.
- [x] **Step 5 — release 기록 커밋:** new tests/docs and any review fixes receive separately understandable commits. Record the final resulting SHA with `git rev-parse HEAD` in the handoff; do not amend merely to insert a self-referential SHA into the same commit. Stop with the implementation report and a separate production approval request. No main merge/push/deploy, migration apply or operational account deletion.

## D. 검증 명령과 성공 조건

아래는 구현 승인 후의 명령이다. 현재 문서 작업에서 dependencies/제품 테스트/외부 provider를 실행하지 않는다.

| 단계 | 명령 | 성공 조건 |
| --- | --- | --- |
| 신규 계약/인증/서버/UI | `npm run test:customer-account` | 등록된 모든 신규 offline tests pass; 실제 SDK request contract 포함 |
| 영향 기존 주문/쿠폰 | `npm run test:renewal`; `npm run test:reservation-api`; `npm run test:smore-reserve`; `npm run test:manual-coupon` | guest/member price/coupon/idempotency와 기존 차단 정책 동일 |
| 2차 범위 회귀 | `npm run test:custom-cake-integration`; `npm run test:class`; `npm run test:custom-cake-actions` | 신규 회원 연동 없이 기존 기능 pass |
| 관리자/메일/아카이브 | 기존 admin-reservation/admin-reviews, reservation notification, booking reminder, reservation-api-deploy 및 order-contract-artifacts suites | admin allowlist 유지, 알림/쿠폰/저장 reader/추출 archive 회귀 0 |
| lint/타입 | `npm run lint`; `npx tsc -b --pretty false` | exit 0 |
| 전체 | `npm test` | 기존 1,771 pass 기준에 신규 fail 없음; 추가 test 수/skip/취소를 실제 로그에서 집계 |
| KR build | `VITE_MARKET=KR npm run build`; `VITE_MARKET=KR node --test tests/chocolate-static-direct-access.test.mjs` | 기존 KR artifacts 유지, 고객 기능 미노출; 시장별 의도된 skip 별도 기록 |
| AU build | `VITE_MARKET=AU npm run build`; `node --test tests/customer-account-static.test.mjs` | account/callback direct-load noindex, 기존 static routes/404 유지 |
| 브라우저 | Task 10 CLI + local/test endpoint; 실제 Safari/Chrome 별도 | mobile/desktop screenshot, page error 0, 외부 production 요청 0, draft/cart/owner 시나리오 통과 |
| 범위 | `git diff --check`; `git diff --name-status 45971f4..HEAD`; `git status --short --branch` | 승인된 경로만 변경, staged/unstaged 잔여 설명, main/다른 worktree 미수정 |

## E. DB 마이그레이션과 배포 전제조건

미래 release guide는 `node scripts/migrate-customer-account-schema.mjs --dry-run`과 별도 승인 후의 `--apply`를 설명한다. 현재는 파일과 명령을 계획할 뿐 생성/실행하지 않는다. 환경값은 승인된 대상의 server-only endpoint/project/collection/credential 매핑을 사용하고 일반 setup 전체를 migration으로 실행하지 않는다.

1. 계획 승인 후 로컬 구현을 시작한다. 버전/route/storage path가 바뀌었으면 먼저 차이를 보고한다.
2. actual privacy ACL inventory, 관리자 ID allowlist와 guest API all 모드가 안전해야 한다. broad ACL이나 확인 불가한 개인정보 자원이 있으면 고객 Auth/owner 기능은 OFF를 유지하고 원인만 보고한다. 승인 없이 기존 ACL을 수정하지 않는다.
3. metadata dry-run에서 기존 정의·권한 보존과 reservations 한 곳의 정확한 owner/index 추가만 확인한다. Class/custom migration은 생성하지 않는다.
4. SMTP/Email OTP와 Google callback/플랫폼 설정, 격리 공급자 동일-ID/세션/Functions 검증과 모바일 검증 증거를 확보한다. 이 준비가 없다고 로컬 unit/UI 구현을 막지는 않지만 production readiness로 보고하지 않는다.
5. 개인정보 요청 담당자/안전한 본인 확인 경로·기록별 보존 정책을 확정하고 사용자 안내를 검토한다. 자동 탈퇴는 1차에 추가하지 않는다.

인증 장애 fallback은 reservation-api와 DB가 정상인 경우를 검증한다. Appwrite/DB 전체 장애에는 별도 주문 저장소를 도입하지 않고, 기존 실패 안내와 draft/cart/requestId 보존을 검증한다.

## F. Production 및 rollback — 실행 전 별도 승인

1. 최종 diff/commits, offline·격리 검증, dry-run, 실제 targets/권한, 현재 배포·변수의 checkpoint와 호환 저장 주문 reader를 보고하고 production 승인 범위를 확인한다.
2. 승인된 전용 migration으로 reservations optional column/index만 생성하고 available/ACL 불변을 확인한다. 실제 권한이 부적합하면 여기서 멈추며 account flag를 켜지 않는다.
3. 호환 backend를 고객 flag OFF로 배포하고 기존 guest 생성/lookup/관리자/reader를 검증한다. 새 backend가 예전 payload와 원래 판매·가격 플래그를 유지하는지 확인한다.
4. 승인된 AU frontend를 계정 flag OFF 상태로 검증한 뒤, 검증된 account backend/health와 frontend를 순차 활성화한다. Appwrite 1.8.1 변수 변경이 재배포를 요구하면 해당 deployment checkpoint를 새로 기록한다. SMTP/Google 또는 거래성 production smoke를 이 계획 승인에 포함시키지 않는다.
5. 실패하면 회원 frontend를 OFF로 전환하고 backend customer 기능을 OFF로 전환한다. callback은 저장 draft를 비회원으로 복원하고, guest 경로는 계정 readiness와 독립적으로 작동해야 한다. 필요한 경우 호환 checkpoint로만 코드 롤백한다.
6. rollback은 owner 컬럼/index/사용자/preferences/원장/주문을 삭제하지 않는다. 과거 guest 주문을 backfill하거나 owner를 바꾸지 않는다. 정상적인 계정 삭제 요청은 별도 승인·본인 확인·quiescence·owner unlink·Account 삭제 절차로 취급하며 배포 rollback과 섞지 않는다.

## G. 문서 검증 및 인수 기준

이번 단계에서는 설계와 이 계획만 변경·커밋한다. 파일 참조가 실제 파일 또는 각 Task의 Create 목록으로 해석되는지, 범위 표에 Class/custom owner 변경이 남지 않았는지, 모든 spec 요구가 Task/테스트/운영 gate에 대응하는지 자체 점검한다. `git diff --check`, 문서 링크/placeholder/경로/커밋 범위 검사를 수행한다.

| 설계 요구 | 구현·검증 대응 |
| --- | --- |
| §1–2 1차 경계·실제 저장 경로 | A, Tasks 3/7, Class/custom 무변경 회귀 |
| §3–5 버전·최소 API 확장·플래그·인증 | Tasks 1–6, Task 10 격리 공급자 gate |
| §6 프로필·자동입력·폼/장바구니 복원 | Tasks 5/7/8, Review Focus 1/4/5 |
| §7–9 권한·소유권·MY ORDERS·additive schema | Tasks 2–4/8, Review Focus 2/3, E |
| §10–11 파일 경계·단계 커밋·회귀/브라우저 | C, Tasks 1–10, 검증 matrix D |
| §12–14 production/rollback·개인정보·중단점 | Tasks 8/10, E/F/G; 운영 변경은 별도 승인 |

사용자가 이 계획을 검토·승인하기 전에는 dependency 설치, 신규 src/test/script 생성, 제품 코드 변경, 기능 테스트 구현이나 배포를 시작하지 않는다. 설계 수정 커밋과 계획 추가 커밋을 구분하고 마지막에 실제 SHA, 깨끗한 worktree 상태 및 main 불변을 보고한다.
