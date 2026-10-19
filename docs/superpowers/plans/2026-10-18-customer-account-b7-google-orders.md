# Customer Account B7 Google Order Acceptance Implementation Plan

> **2026-10-18 B7 조건부 실행 중단:** 승인 SHA는 일치하지만 Renewal writes ON에서 신규 legacy fixture 3건이 원본 서버의 `409 RENEWAL_CONTRACT_REQUIRED`로 거부된다. guard 구현/시험 창 개방 전 중단했으며 Account·Function은 OFF다. [실패 근거와 재개 조건](../../customer-account-b7-validation.md). 승인 manifest는 보존했다. 아래 기존 계획은 이 충돌을 해결하기 전 실행하지 않는다.

> **For agentic workers:** 승인 후 `superpowers:executing-plans`로 Mac Codex가 단독 실행한다. 이번에는 조사·설계·실행 명세만 작성했다. 아래 코드·배포·데이터·활성화 작업은 아직 실행하지 않았으며, 최종 승인이 선행되어야 한다. subagent/Hermes 위임 없음. 단계는 checkbox로 추적한다.

**Goal:** 기존 G와 별도 H가 실제 Google 세션/플랫폼 JWT로 일반 케이크·초콜릿 합성 주문을 만들고 원래 제품 코드의 소유권·조회·guest 분리·복원을 검증한다.

**Architecture:** 기존 test project/DB/Function과 별도 test Pages site를 재사용한다. 운영 코드는 그대로 호출하는 test-only Function entrypoint와 test-only browser overlay를 준비한다. 사전에 채운 사용자 상한, 서버 서명·시간·fixture guard와 15분 창을 조합한다. 이것은 Google-only 인수 실험이며 출시 승인이 아니다.

**Tech Stack:** Appwrite 1.8.1, SDK23/node-appwrite22.1.3, 기존 Linux x64 node-22/sharp0.35.5, Vite/React, Cloudflare Pages, Node crypto/WebCrypto, Chrome/Safari 및 로컬 Chromium/WebKit 회귀.

**Spec:** 사용자의 B7 준비 승인(2026-10-18), [기존 제품 설계](../specs/2026-10-17-customer-account-design.md), [B안](2026-10-17-customer-account-very-server-test.md), [B6 결과](../../customer-account-b6-function-validation.md), [제안 실행 manifest](../../customer-account-b7-execution-manifest.json).

## Global Constraints

- Worktree `/Users/nam9295/Desktop/john_2.0/code/au-cake-customer-account`, branch `feat/customer-account`만 수정한다. 시작 `ec6470c`, clean. main/다른 worktree/운영 project 4개를 변경하지 않는다.
- 정확한 endpoint `https://api.verygood-chocolate.com/v1`, project `verygood-au-account-test`, Function `ca-test-reservation-api`, DB `ca_test_cake_au`/`ca_test_kids_au`만 허용한다. 고객 주문 owner는 cake DB reservations에만 연결한다.
- **B5 DEFERRED — RELEASE BLOCKER.** 공통 SMTP/서비스 재시작/OTP/Google↔OTP 검증을 실행하지 않는다. B4 SMTP·Google Client/Secret/callback·DB/ACL을 보존한다.
- **Account ON, execute 공개 허용, customer flags ON, H 생성·쿠폰·주문 쓰기 및 site/Function 배포는 최종 승인 전 금지한다.** 새 DB/Collection/schema/ACL/Function/API Key/host/Compose는 제안하지 않는다.
- Custom Cake/Kids Class 회원 연동, provisional/판매 중지/new-product 활성화, 가격·할인 정책 변경 없음. `CUSTOM_CAKE_*` 활성화 금지. test-only Renewal writes는 실제 AU Bag 경로 검증을 위해 별도 명시한다. preorders는 false다.
- 주문 연락처는 `B7 TEST ONLY` 이름/합성 AU 전화번호/`example.invalid` 이메일만 사용한다. OAuth identity 이메일은 별도다. 기존 고객·주문·메시지 본문은 조회·복사하지 않는다. 결제·외부 이메일 0건.
- user 한도3·15분·전체 execution120·동시1·고유 주문6·쿠폰2가 제안 상한이다. 요청량/동시성은 Appwrite의 별도 hard cap으로 주장하지 않는다. 종료·실패 때 먼저 차단하고 자료는 보존한다.

## Review Focus

1. readiness가 로그인 전에 호출된다. UID-only execute ACL은 실제 로그인/guest Checkout을 막는다. Task2/3은 비로그인 SDK health와 guest 생성 경로를 원본 transport로 검증한다.
2. test wrapper가 원본 ownership/JWT 결함을 가리지 않아야 한다. G→H 상세/cursor/replay는 wrapper 통과 후 원래 business code가 404/409를 반환해야 한다(Task1/4).
3. OAuth 복원 시험에서 UUID/날짜/장바구니를 테스트 도구가 고치면 회귀를 숨긴다. 원래 requestId를 관찰·동결하고 다시 쓰지 않는다(Task2/4).
4. Mac sleep/인증 만료 시 OFF watchdog이 서버에 도달하지 못할 수 있다. 서버 deadline은 주문을 막지만 Account 자체를 OFF하지는 않는다. 종료 확인 실패를 성공으로 보고하지 않는다(Task3/5).
5. `live=false` 배너·동적 변수/실제 실행 차이를 구분한다. 실제 guarded artifact와 native/readiness를 검증하고 배너 제거 목적 배포는 하지 않는다(Task3/5).

## 1. 현 상태와 source 검토

이번 읽기 전용 점검에서 Account403/general_service_disabled, site test-window enabled=false를 확인했다. test M+G2/DB2/Collection12/Function1/variables23/key3, Function enabled0/execute[]/live0, active `6ad41e576cb7a8f346af`, deployment ready, entrypoint src/main.js다. Console 새로고침도 같은 ID·Node22·배너를 표시했다. 재배포/설정 저장/실행을 하지 않았다. B6의 실제 실행·native 증거를 보존하며 이번에 재실행했다고 주장하지 않는다.

시작 host available RAM 약8.323GiB, disk82.995GiB, load1 .40, core5와 기존4의 metadata를 보관했다. 이는 실행 시점 보장이 아니므로 ON 직전 다시 읽는다.

`src/CustomerAccountProvider.tsx`는 `health()` 성공 뒤 auth.restore()와 sign-in available을 결정한다. `src/lib/repository.ts:executeReservationApi`는 실제 Appwrite Functions.createExecution(session cookie, synchronous) 경로다. 원본 server `resolveCustomerIdentity`는 Appwrite가 넣은 user-id/JWT를 JWT-only Account.get()으로 확인한다. 임의 client UID/email로 owner를 지정하지 않는다.

고정 1.8.1 [execution source](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Functions/Http/Executions/Create.php)는 활성 세션에서 execution JWT를 만들고 client의 x-appwrite-user-id/JWT를 덮어쓴다. [공식 header 계약](https://appwrite.io/docs/products/functions/develop#headers)도 같다. 따라서 별도 Account.createJWT를 호출하지 않고 현재 authJWT=false를 유지해 시험한다. 실제 검증이 실패하면 임의로 JWT method를 ON하지 않고 중단한다.

고정 [OAuth callback source](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/account.php)는 provider identity/같은 이메일의 기존 user를 먼저 찾고, 새 user 생성 때 users count와 auth limit을 검사한다. H를 OFF 상태에서 미리 만들면 신규 가입 빈 슬롯을 남기지 않을 수 있다. 이것은 **Auth identity 연결**이며 과거 guest 주문을 이메일로 귀속시키는 작업이 아니다. 실제 H OAuth→예정 UID 연결은 승인 후 검증한다.

## 2. 접근 방식과 잔여 위험

| 안 | 효과와 한계 | 결정 |
| --- | --- | --- |
| execute G/H UID만 | 외부 Function 실행은 좁아지지만 guest health/로그인/실제 guest Checkout이 막힌다. Owner로 guest를 대신 호출하면 전체 browser 인수가 아니다. | 전체 범위의 기본안에서 제외 |
| **서버 guard + filled auth cap + 15분** | 원래 SDK·guest 경로를 유지하고 미서명/외부 UID/미승인 주문/기한 후 business 요청을 서버에서 차단한다. any 역할로 인해 무서명 요청도 Appwrite execution metadata/초기 runtime 자원을 소비할 수 있다. | **잔여 위험을 명시적으로 승인한 경우 추천** |
| project 전용 private ingress/Access+relay | Appwrite 도달 전 차단까지 강화할 수 있다. 프론트에만 Access를 붙여서는 부족하며 native Auth/Function 직접 경로, Pages alias, API secret·JWT 전달을 별도로 설계해야 한다. 새 자원·권한 승인이 필요하다. | 위 잔여 위험을 수용하지 않으면 활성화 보류 후 별도 설계 |

Google Testing 목록·CORS·숨긴 페이지·URL 비공개는 native API 통제가 아니다. H 사전 생성 뒤 **users 정확히 M/G/H3, cap3**인 것을 읽어 확인한 후에만 Account를 연다. Google Client/redirect/secret은 변경하지 않는다. H의 test audience 추가1건은 목록 정리를 위한 별도 test project 변경이며 보안 allowlist로 취급하지 않는다.

Function은 시험 창에만 enabled=true/execute=[any]로 제안한다. 서명 key는 test-only 새32byte 무작위 값이며 공개 bundle/env/Git/보고서/URL에 넣지 않는다. 지정 브라우저의 masked test gate에 직접 입력해 해당 탭 sessionStorage에서만 사용한다. 서버에는 secret variable로만 저장한다. XSS/탭 노출·서명 replay·native endpoint 자원 공격 위험을 없앴다고 주장하지 않는다. 누출/미승인 실행/의심 자원 증가 때 즉시 닫는다. HMAC key 자체 대신 body에 묶인 단기 signature만 request headers에 넣는다.

## 3. 파일 및 guard 계약 — 아직 미구현

| 새 파일 | 역할 |
| --- | --- |
| `scripts/customer-account-b7-contract.mjs` | manifest SHA/승인 proof/정확한 target·resource·상태 전이·요청 상한 검증. dotenv/process.env target 자동 상속 없음 |
| `tools/customer-account-b7/function-entry.mjs` | B7 archive에만 넣는 서버 entrypoint. guard 통과 시 원래 reservation handler를 그대로 호출 |
| `scripts/build-customer-account-b7-site.mjs` | 격리 임시 checkout/빈 envDir에서 실제 App·Checkout을 빌드. 기존 production/staging 빌드 설정 불변 |
| `tools/customer-account-b7/browser-entry.ts` | masked gate, WebCrypto request signer, 원래 SDK createExecution의 test-only headers 확장, 안전한 requestId 관찰 panel |
| `tools/customer-account-b7/analytics-disabled.ts` | test build에서 get/setAnalyticsConsent/initializeAnalytics/trackPageView/trackEvent의 외부 전송 차단 |
| `tools/customer-account-b7/google-only.css` | 기존 스타일을 사용하는 test banner·OTP 입력 비노출. native OTP OFF가 실제 발송 차단선 |
| `scripts/customer-account-b7-runner.mjs` | 기존 Owner 공식 API의 승인된 test 변경만 실행. B3/B6 helper의 고정 제한을 풀지 않고 별도 B7 상태 전이 사용 |
| `scripts/customer-account-b7-watchdog.mjs` | 독립 Mac process의 기한/자원/metadata 감시 및 fail-closed OFF/복구 |
| `tests/customer-account-b7-{contract,guard,artifact,watchdog}.test.mjs` | target/write0·서명/만료·fixture·패키징·복구 실패 검증 |

원래 `src/` 회원/Checkout/auth/orders와 Function business/가격/쿠폰 모듈은 이 준비에서 변경하지 않는다. 실행 시 발견한 제품 결함은 별도 RED→GREEN 커밋과 전체 회귀를 거친다. 새 schema·권한으로 우회하지 않는다.

`assertB7Run({manifestBytes,approvalProof,derivedFixtureManifest,phase,now}) -> validatedRun`은 공개 manifest SHA와 승인 proof를 비교한다. executionApproved=false라는 제안 문서를 몰래 true로 고치지 않는다. 승인 proof는 별도 비추적 파일로 남긴다. phase는 prepare/armed/open/closing/closed만, expired 상태는 closing만 허용한다. 운영 target/기타 route/예상 외 자원/미승인 scope는 network 이전 write0으로 실패한다.

`createB7GuardedHandler({handler,env,fixtureManifest,clock,verifyIdentity}) -> contextHandler`의 필수 조건:

- exact project/function/run, 별도 B7 key·startsAt/endsAt, window≤900초, 서버 현재 시각이 창 안이어야 한다. 기본값/설정 누락은 closed다.
- 서명 원문은 `B7v1\nprojectId\nfunctionId\nrunId\ntimestampMs\nnonce\nsha256(bodyText)`의 UTF-8, HMAC-SHA256/base64url이다. timestamp 최대30초/미래오차5초, UUIDv4 nonce, constant-time 비교, nonce 중복 거부. 재시도는 **같은 body/requestId + 새 nonce**로 원래 business 멱등성을 검증한다.
- 인증된 caller는 G/H UID만, 실제 플랫폼 JWT로 Account.get() 일치·status를 확인한다. M은 고객 allowlist에 넣지 않는다. guest와 서명된 부정 시험은 원래 handler의 인증 거부를 확인하도록 통과시킨다. 외부 client가 전달한 UID/email은 권한 근거가 아니다.
- action은 manifest의7개만, create는 **동결된 고유 requestId6개/합성 연락처/확정 SKU/수량1**만 허용한다. Custom/Class/calendar/메일/결제 action은 거부한다. body 크기20KB 상한. test contact 제한은 ownership 판정이 아니다.
- G/H 모두에게 6개 fixture의 detail/cursor 및 교차 replay 입력을 통과시킨다. wrapper가 다른 고객의 ID를 먼저 막아 원래 ownership 결함을 가리지 않는다. 성공 근거는 inner handler의 CUSTOMER_ORDER_NOT_FOUND404 / REQUEST_ID_CONFLICT409다.
- nonce/counter/semaphore는 warm runtime 범위다. runner 동시1/전체120 및5초 감시를 운영 상한으로 사용하며 분산 hard cap으로 주장하지 않는다. cold restart 시에도 서명·서버 deadline·고유 requestId6개·정확한 fixture 입력 제한은 남는다.
- 실행 때마다 현재 env의 window/flags를 읽고 초기 module import의 과거 시각을 캐시하지 않는다. guard 설정/manifest 해시가 어긋나면 closed다. signed health/readiness는 private data를 반환하지 않으므로 지정된 Owner 사전 점검에도 사용한다.
- 요청/JWT/Cookie/key/header/body를 로그에 출력하지 않는다. 증거는 case명·상태·반환code·합성 UID/orderID·불변 boolean만 남긴다.

## Task 1: guard와 승인 계약을 로컬에서 검증

**Files:** 위 contract/guard 및 대응 tests. **Consumes:** manifest·B6 source. **Produces:** assertB7Run/createB7GuardedHandler.

- [ ] target/project/Function/DB/SHA/미승인/만료/과도한 권한 입력에서 transport write count0 테스트를 먼저 작성하고 RED를 확인한다.
- [ ] 서명 없음·잘못된 body/nonce/clock/key, 기간 전후, unknown UID, 새 requestId, 비승인 SKU/action을 원래 handler 호출0으로 거부하는 테스트 RED→GREEN.
- [ ] G→H detail/cursor와 타인 requestId replay는 원래 handler까지 도달하고 원래 404/409가 나오는 실제 business 결합 테스트를 추가한다. guard의403을 소유권 통과로 세지 않는다.
- [ ] `node --test tests/customer-account-b7-contract.test.mjs tests/customer-account-b7-guard.test.mjs` PASS 후 전체 npm test, lint/TS를 통과하고 guard 커밋한다. B3/B6 helper를 완화하지 않는다.

## Task 2: 닫힌 테스트 사이트와 불변 fixture 준비

**Files:** site builder/browser overlay/analytics/CSS/artifact test. **Consumes:** Task1 manifest/서명 계약. **Produces:** closed site artifact, derived private fixture manifest.

- [ ] artifact test RED→GREEN: 환경 상속0, resolved target/config의 prod project·DB·Function 사용0/secret 유출0/GA·chat 외부 전송0, native OTP 호출0, 원래 route/callback/Checkout 모듈 포함. target public 설정만 포함한다. 원래 소스의 비활성 fallback 문자열을 단순 검색해 동작 검증을 대신하지 않으며, test transport는 다른 Function ID 호출을 HTTP 이전에 거부한다.
- [ ] backend 관련 frontend env는 manifest대로 명시한다. 기존 Vite loadEnv가 운영 .env를 읽지 못하도록 git tracked source만 별도 임시 경로에 복사하고 빈 envDir·whitelist child env를 사용한다. flag 기본 OFF는 제품에서 유지하며 test artifact에만 true를 지정한다.
- [ ] HMAC secret을 빌드하지 않는다. browser overlay는 test-window closed면 sign-in/submit 네트워크를 막고 준비용 합성 form/cart만 편집 가능하게 한다. analytics alias와 test HTML transform/CSP로 GA/채팅/외부 전송을 차단한다. blank GA env만으로 default 측정 ID가 꺼진다고 가정하지 않는다.
- [ ] 승인 후 첫 Pages deployment는 닫힌 preview다. **원래 Chrome/Safari Renewal Checkout에서 생성된 requestId2개를 관찰 panel로 읽어** derived private fixture manifest에 동결한다. SDK용4개 UUID와 합해 정확히6개다. UUID factory/global crypto를 교체하거나 OAuth 이후 wire body의 ID를 다시 쓰지 않는다. 실제 서명 및 guard archive는 이6개에 고정한다. 복원에서 ID가 달라지면 회귀로 중단한다.
- [ ] 형식/계약 RED→GREEN 후 local Chrome/WebKit Mock 회귀, KR→AU 빌드(전체 테스트와 병행 금지), artifact 검사를 완료하고 커밋한다. 아직 ON하지 않는다.

## Task 3: 승인된 test 자원과 watchdog을 준비하고 15분 창 열기

**Files:** runner/watchdog/tests. **Consumes:** Tasks1/2 artifacts·manifest/승인 proof. **Produces:** verified armed/open run + private evidence.

- [ ] 실패·partial activation·시간 초과·Mac 재개·닫기 요청 실패·서명 오류·공개 역할 복구의 RED→GREEN tests. close는 최대3회 제한된 idempotent 재시도 후 미확인 실패를 보고한다. create/배포 실패는 자동 삭제/덮어쓰기/재시도하지 않는다.
- [ ] 최종 승인과 정식 Owner CLI/Cloudflare 로그인 후 exact Settings ID, 기존4 의미적/metadata 지문·schema/ACL·M/G·B6 배포·host를 다시 확인한다. browser credential 추출/운영 Key/SQL write 금지.
- [ ] Account OFF에서 H `ca-test-customer-h-20261018` 1명을 지정 이메일로 생성한다. password/phone/labels/관리자 권한/메일 없음. 원문 이메일은 private actor 파일에만 보관하고 공개 manifest의 hash와 비교한다. H의 예상 UID 연결이 다르면 Account를 열지 않는다.
- [ ] test 사용자 정확히 M+G+H3 확인 후 cap2→3. 빈 가입 슬롯을 남긴 채 Account를 켜지 않는다. test Google audience에 H1 추가 필요 시 지정 test Google project에서만 적용한다. provider client/secret/callback 변경 없음.
- [ ] existing test collections에 manual5%/review10% coupon 각1건 create-only, admin M ACL로 만든다. review coupon의 sourceReviewId는 합성 reference이고 reviews/invites/메일을 생성하지 않는다. code는 existing pattern·test HMAC를 사용하며 외부에 노출하지 않는다. 운영 쿠폰/발급 스크립트 전체 setup 실행 없음.
- [ ] Task1 guard를 포함한 **새 test deployment1개**를 customer true/Renewal writes true/preorders false, 기존 scopes7/spec/일정 없음으로 구축한다. B6 source/lock 및 native-smoke를 유지하고 B7_TEST_HMAC_SECRET은 항상 secret=true로 저장한다. Account OFF·Function disabled/execute[]에서 준비하고 ready 확인 후 activate한다. B6 배포는 rollback용으로 보존한다. 배너 제거 목적 배포가 아니다.
- [ ] 독립 watchdog을 대화 turn/브라우저와 분리한 Mac process로 시작한다. local dry-run에서 OFF 경로를 검증하고, 공식 GET으로 Owner session expiry가 창+복구 여유를 넘는지/stop 경로가 허용되는지 검증한다. Mac sleep 방지 프로세스를 run에만 결합한다. Secret을 argv/history/서버 host에 복사하지 않는다.
- [ ] guarded build는 아직 유효한 실행 창이 없는 closed 설정으로 완료한다. 이후 startsAt/endAt를 **실제 ON 직전 단 한 번 확정**하고 signed Owner health/customer-readiness로 현재 env의 expected flags·guard를 검증한다. 이 사전 점검부터15분에 포함하며 Account/Function은 아직 client 차단이다. 1.8.1 execution source가 매번 vars를 전달하더라도 실제 반영을 추정하지 않고 검증한다. 불일치 시 추가 재배포로 우회하지 않는다. 기한은 늘리지 않는다. 시작 시각 guard/preview/새 artifact가 일치하지 않으면 닫는다. 필요 site open deployment1건(총2번째)을 적용한다.
- [ ] guard negative tests·artifact/public secret scan·schema·Google 외7auth OFF·cap3·watchdog 증거가 모두 일치할 때에만 Function enabled=true/execute=[any], Account ON을 순서대로 수행한다. 서버 deadline 시작부터 전체≤15분이다. 새 preview alias도 서명 없이는 backend를 사용할 수 없어야 한다.

## Task 4: 실제 시나리오 — 우선순위와 통과 기준

**Files:** 기존 product 모듈, `tests/customer-account*.browser.mjs` 및 test overlay case driver. **Consumes:** open run·6 fixtures. **Produces:** case별 PASS/FAIL/NOT RUN evidence.

- [ ] **P0 G Google 로그인:** 사용자 직접 Google/2FA/consent. Account.get() UID=기존 G, Function 플랫폼 JWT를 사용해 회원 주문 성공 후 stored customerUserId=G. 실제 로그인 이메일과 합성 주문 연락 이메일을 구분한다.
- [ ] **P0 실제 Renewal cake/chocolate UI:** 일반 확정 Pavé6in dark×1, Pavé Chocolate100g×1, 2026-10-23 10:00. 정상 주문가격은 각각75/12 AUD이며 소스 정책을 변경하지 않는다. HMAC/approved requestId guard 외 원래 App/Bag/Checkout/SDK/server/parser를 사용한다. disabled/provisional 상품 활성화 없음.
- [ ] **P0 H 로그인:** G 명시적 로그아웃→H Google, expected UID=미리 만든 H. 원래 legacy cake/chocolate request로2건 생성하며 한 건에 manual5%, 다른 한 건에 review10%를 적용한다. 쿠폰 차감/예약 snapshot은 원래 가격계산과 transaction 계약으로 대조한다.
- [ ] **P0 본인/타인:** G 목록2건·상세2건, H 목록2건·상세2건. G/H 교차 상세·cursor는 CUSTOMER_ORDER_NOT_FOUND404, 응답에 타인 contact 없음. client owner/email 필드 위조는 INVALID_CUSTOMER_REQUEST 계열로 거부한다. 플랫폼 header overwrite와 JWT-only 재검증을 실제 저장 owner로 입증하고 JWT 자체를 기록하지 않는다.
- [ ] **P0 guest2건:** 실제 session 없는 SDK(browser incognito/격리 context)로 Renewal/legacy 각각1건을 만든다. API Key/Owner 호출로 대신하고 전체 guest 인수로 세지 않는다. guest6번째 주문의 합성 연락처를 G와 같게 해도 customerUserId 없음, 로그인 후 G/H 목록에 표시0. 예약번호+정확한 phone lookup200·잘못된 phone null 유지.
- [ ] **P0 멱등성:** 같은 body/requestId + 새 서명 nonce로 순차2회 재시도→동일 orderID/예약번호, document/쿠폰 차감1회. payload/쿠폰 변경409, G가 H requestId를 replay409. guest 주문을 G로 link replay해도 owner가 새로 붙지 않아야 한다. 실제 병렬 경쟁 시험은 동시1 제한 때문에 미실행으로 남기고 local transaction 회귀와 구분한다.
- [ ] **P1 상태/복원:** Google 성공·취소·실패 뒤 typed 이름/phone/contact email/date/options/coupon/requestId/cart 보존, 기본정보 자동입력이 dirty값을 덮지 않음, 다른 탭 최신 cart 경고·미제출 주문서 유지, focus가 profile dirty값/열린 상세를 초기화하지 않음. 취소 뒤 guest 진행1건은 위 guest fixture를 재사용하고 새7번째 주문을 만들지 않는다.
- [ ] **P1 로그아웃:** private account/order view는 즉시 비우고 G→H에서 G 정보가 남지 않음. cart의 상품·작성 중인 합성 폼은 요구된 복원 정책으로 보존한다. 전 사용자 saved profile을 새 고객 자동입력으로 잘못 사용하지 않는다. profile 변경 후 기존 order contact snapshot 불변. 과거 주문 취소/수정 없음.
- [ ] **P1 관리자/권한:** G/H는 관리자 allowlist M이 아니며 test 관리자 API/직접 private DB 접근 거부. M은 기존 UID/ACL 그대로다. M의 새 Google/password 자격증명은 만들지 않으므로 실제 M 로그인 positive는 이번 검증으로 주장하지 않는다. 기존 관리자 세션 회귀는 local suite와 운영 metadata 보존으로 구분한다.
- [ ] **P2 브라우저:** actual Chrome 및 가능하면 Mac Safari(CUA/user assist), 실제 Safari가 WebKit 공급자 시험임을 별도 기록한다. 기존 자동 Chromium/WebKit Mock suite는 실제 공급자 인수의 대체가 아니다. 실기기 iPhone/Android는 준비된 기기·소유자 조작이 있을 때만, 기한 부족/제3자 Cookie 차단/계정 미준비면 NOT RUN. 남은 시험을 위해 창을 연장하지 않는다.

## Task 5: 즉시 차단·복구·검증

**Consumes:** opened/partial run, saved B6 target/deployment/config. **Produces:** closed proof + final report.

- [ ] deadline·실패·미예상 UID/owner/deployment·새 email 시도·자원 임계·요청120·승인되지 않은 execution1건 중 먼저 오는 조건에 즉시 stop한다. 5초마다 aggregate health/RAM/disk/OOM/load와 test execution/user metadata만 읽는다. 메시지/메일 payload 및 운영 고객 자료는 읽지 않는다.
- [ ] 우선 새 test site 진입을 로컬 overlay와 서버 guard에서 차단한다. 별도 관리 경로로 **Account OFF 및 Function enabled=false/execute=[]**를 각각 확인한다. customer/Renewal/preorders false로 복원하고 B7 signing key를 무효화한다. 새 UI 링크만 숨겨 종료했다고 보지 않는다.
- [ ] 기존 B6 deployment `6ad41e576cb7a8f346af`를 공개 차단 상태에서 재활성화한다. OFF 변수와 active ID 및 server read-only health가 맞는지 확인한다. 세 번째 Pages 배포는 기존 닫힌 B3 smoke/닫힌 표지이며 credentials를 넣지 않는다. test frontend customer entry false를 확인한다.
- [ ] authLimit를2로 원복하고 H/쿠폰/주문은 보존한다. 사용자3>limit2는 계정 삭제나 슬롯 비우기를 뜻하지 않는다. G/H는 명시적 logout하고, 이번 run이 만든 두 test 사용자의 남은 session만 승인된 관리 경로로 revoke한다. M/Console browser/다른 세션·사용자는 건드리지 않는다. H/주문/쿠폰 자동 삭제 없음.
- [ ] Mac/watchdog 네트워크/인증 실패 시 server deadline은 business 요청을 closed로 거부하지만 **native Account OFF까지 보장하지 못한다**. 최대3회 OFF 후 읽기 확인 불가면 사용자에게 즉시 Console 수동 OFF를 요청하고 미확인 상태로 보고한다. 새 운영 Key/권한 우회/서버 kill을 하지 않는다.
- [ ] 기존4의 canonical semantic/config/schema/ACL/Function/배포 지문·core5, test DB/schema/ACL/SMTP/Google 불변을 비교한다. Gallery B5 예외는 별도 계속 미완료다. Owner CLI 현재 run session만 revoke/local clear, Browser Owner 보존.
- [ ] 전체 npm test/account·lint/TS·KR→AU build·local browser 결과와 actual case count/NOT RUN, 생성 자원·실제시간·최소여유·최대샘플·잔여 위험을 문서화하고 기능별 커밋한다. production/main/B5/B8로 진행하지 않는다.

## B5 — DEFERRED — RELEASE BLOCKER

- [ ] 기존 운영4+Console 공통 SMTP 영향 승인
- [ ] OTP 수신자 접근·남용 방지
- [ ] Gallery 의미적 지문 예외 검토
- [ ] System SMTP 전용 Key·sender
- [ ] 운영 보호 백업/root 인증/API·mail-worker 재생성 및 복구
- [ ] 실제 OTP·Google↔OTP 동일 UID

native OTP OFF, Google+OTP 최종 출시 준비 미완료. Google-only 제품 출시도 별도 승인 대상이다.

## 이번 준비 결과 및 승인 지점

이번에는 문서·제안 manifest·읽기 전용 evidence만 작성했다. **위 guard/overlay/runner/watchdog은 계획이며 구현·부정 시험·실제 보호 효과는 아직 미검증이다.** 다음 승인이 있더라도 이 선행조건의 RED→GREEN·전체 회귀·닫힌 검증을 통과하기 전에는 활성화하지 않는다. 소스/환경이 예상과 다르거나 필요한 권한/자원이 늘면 중단하고 다시 보고한다.

승인 요청 범위는 manifest의 test H1/Google test audience1/쿠폰2/고유 주문6, 기존 test Function guarded deployment1·변수추가최대5·임시 공개 실행, test Pages 최대3배포, Account/cap/flags의 15분 한정 변경과 지정된 stop/session 정리다. 새 Appwrite API Key0/DB·schema·ACL·Function0, SMTP/이메일/결제/운영/main 변경0이다. 공개 execution의 초기 자원 소비 위험을 수용하지 않으면 이 안은 실행하지 않는다.

제안 manifest SHA-256: `f71da5a2f768e9789086548d9af5c12c06b25e2f4480d5762daf1c781af27a43`. 실행 시 이 digest와 승인 proof를 검증하고, UI의 native UUID2개를 포함한 파생 private fixture manifest를 ON 전에 별도로 동결한다.
