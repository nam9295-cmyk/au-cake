# Google 로그인 단독 인수 — 최소 실행 계획

> **For agentic workers:** 승인 후 `superpowers:executing-plans`로 Mac Codex가 직접 실행한다. subagent/Hermes·CUA/getApp·Playwright·자동 브라우저 제어 금지. 체크박스는 모두 후속 승인 대상이다. **이번에는 계획만 작성했으며 실제 활성화·배포를 승인받지 않았다.**

**Goal:** 사용자가 자신의 Chrome에서 기존 G/H로 Google 로그인, 세션 복원, 프로필 Preferences 저장, 로그아웃을 확인한다. 주문 Function/readiness 없이 고객 인증을 인수한다.

**Architecture:** 기존 테스트 HTTPS/Google Client/Web platform/사용자를 재사용한다. 변경된 제품 Provider·auth·AccountPage·callback을 작은 테스트 전용 entry에서 조합한다. 주문 서비스는 로컬 unavailable adapter를 주입하고 Account SDK만 실제 호출한다. 예약 Function은 계속 disabled/execute=[]/B6 active이며 배포·실행하지 않는다.

**Tech Stack:** Appwrite 1.8.1, 기존 Web SDK 23, React/Vite, 기존 test Cloudflare Pages, Mac CLI Owner/Wrangler 정식 인증, 사용자 Chrome.

**Spec:** 이번 사용자 지시, [인증/주문 분리](../../customer-account-auth-orders-separation.md), [B3 실제 SDK 검증](../../customer-account-b3-google-validation.md), [기존 수동 조작 원칙](2026-10-18-customer-account-b7-manual-chrome.md).

## 승인 상태와 고정 경계

현재 `executionApproved=false`다. 기존 V1/V2/V3 manifest·SHA·승인 증거·journal·누적 사용량은 변경하거나 초기화하지 않는다. 이 계획은 B7 주문 시험의 재실행이 아닌 별도 Google-only 인수다. 실행 승인 시 이 계획의 커밋/SHA에 연결한 별도 보호 approval proof와 append-only journal을 만들고 과거 기록을 참조한다. V3 승인 증거를 재사용하지 않는다.

| 항목 | 고정 대상 / 이번 제안 |
| --- | --- |
| Worktree / branch | `/Users/nam9295/Desktop/john_2.0/code/au-cake-customer-account` / `feat/customer-account` |
| Endpoint / project | `https://api.verygood-chocolate.com/v1` / `verygood-au-account-test` |
| HTTPS / Pages / branch | `https://au-account-test.verygood-chocolate.com` / `au-cake-account-test` / `b3-google-test` |
| 기존 사용자 | M `ca-test-admin-m-20261017`; G `6ad38e4e0ffd5f810e23` (`nam9295@gmail.com`); H `ca-test-customer-h-20261018` (`verygoutchocolate@gmail.com`) |
| 사용자 수 / 상한 | 정확히 M/G/H 3명, 기록된 `authLimit=2` 유지. 신규 사용자 생성0, M 로그인0 |
| 인증 창 제안 | 별도 승인 후 사용자 참여 확인 시 새 고정 최대900초 단일 창1회. 연장/재시작 없음 |
| Pages 제안 | 기존7/9 보존 → **8회차 OPEN 1회 + 9회차 CLOSED 복원1회**, 추가2회 이내. preview 추가 배포 없음 |
| Function | `ca-test-reservation-api`, disabled / execute=[] / active B6 `6ad41e576cb7a8f346af` 유지 |
| Function 실행 / 배포 | 각각 추가0회. 기존 누적8/120 그대로, Owner health 포함 실행 금지 |
| Function flags / 변수 | CUSTOMER_ACCOUNT_ENABLED / Renewal writes / preorders 모두 false 유지. 신규/갱신 변수0, HMAC 키0 |
| 시험 중 허용 쓸 데이터 | G/H의 인증 세션·통상 OAuth identity 갱신 및 자기 Preferences만. Google 시작 최대4회, 합성 프로필 저장 G/H 각각 최대2회 |
| 생성·변경하지 않을 자원 | 사용자·주문·쿠폰·DB/schema/ACL·Function·API Key·DNS/TLS·Google/SMTP 설정 |

사용자 상한은 1.8.1 소스에서 기존 provider identity/동일 이메일 사용자를 찾은 뒤 **신규 user를 만드는 분기**에 적용된다. 따라서 기존 G/H의 정상 재로그인을 위해 상한을3으로 올릴 필요가 없다는 판단이다. 실제 동작은 아직 NOT RUN이며 상한 오류가 나면 변경하지 않고 종료한다. [고정 버전 소스](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/account.php#L1484-L1527)

Google Testing 사용자 목록·프론트 hostname/window 검사는 Appwrite 공개 인증 API의 이메일 allowlist가 아니다. 기본 Google 로그인에는 Testing 예외가 있다. **기존 사용자만 재로그인·상한 유지·다른 인증 OFF·짧은 창·감시**로 제한하며 제3자 요청 자체를 막는다고 주장하지 않는다. 알려지지 않은 UID/예상 외 세션·설정 변화는 즉시 종료한다. [Google 공식 Audience 문서](https://support.google.com/cloud/answer/15549945?hl=en)

## 검토 중점

- Account OFF/403은 로그인 차단 상태다. 주문 unavailable과 구분하고 Google 버튼을 활성화하지 않는다.
- 주문 unavailable adapter는 UI 분리 시험이며 실제 MY ORDERS/백엔드 성공의 근거가 아니다. Function HTTP 요청은0이어야 한다.
- G→로그아웃→H 전환에서 G의 편집값/세션/개인정보가 H 화면에 남으면 FAIL이다. 운영 관리자 화면은 열지 않는다.
- 테스트 hostname 외 pages.dev/과거 preview에서도 신규 로그인·prefs 쓰기를 허용하지 않는다. CLOSED/만료/설정 fetch 실패는 fail-closed다.
- deadline/인증 실패/네트워크 단절 때 OFF가 검증되지 않으면 미복구다. 성공으로 기록하지 않고 즉시 수동 차단을 요청한다.

## 최소 변경 파일 — 아직 구현하지 않음

| 파일 | 후속 구현 내용 |
| --- | --- |
| 신규 `tools/customer-account-google-only/entry.tsx` | 실제 제품 Provider/AccountPage/CustomerAuthCallback 조합. Google-only 진입, 표시용 Account/getSession 확인, 로컬 주문 unavailable 주입. Checkout·주문 패널·카트·HMAC 없음 |
| 신규 `scripts/build-customer-account-google-only.mjs` | 기존 B3/Vite build 방식을 재사용한 격리 stage. 운영 `.env`/Vite 설정 자동 로드 금지, 테스트 공개값만 포함. OPEN/CLOSED artifact를 로컬에서 미리 생성 |
| 기존 `scripts/customer-account-google-test.mjs` | 기존 B3 API/테스트를 보존한 별도 `createGoogleOnlyTestManager()` 추가. G/H+상한2·Account 서비스 ON/OFF·최소 GET/시험 세션 정리만 허용. Function 실행/쓰기·자원 생성 경로 없음 |
| 신규 `scripts/customer-account-google-only-watchdog.mjs` | 기존 감시의 bounded deadline/heartbeat/고정 OFF·재확인 패턴을 재사용. 주문 guard/runner에 의존하지 않는 독립 프로세스, 같은 프로젝트만 OFF/CLOSED/귀속된 세션 정리 |
| 신규 `tests/customer-account-google-only.test.mjs` | SDK-only/target·예산·기한·복구 부정 테스트. 기존 인증 분리 회귀는 그대로 사용 |

제품 `src/`와 reservation backend는 수정하지 않는다. 기존 `tools/customer-account-google-smoke/`는 prefs/getSession/제품 Provider를 시험하지 않아 그대로 배포하면 부족하고, B7 entry는 HMAC/주문 패널을 요구하므로 재사용하지 않는다. 기존 B3 manager의 `enable()`은 G1명·상한2 계약이므로 G/H 시험에 그대로 사용하지 않는다. B7 runner/watchdog adapters가 가진 Function/flags mutation 경로도 호출하지 않는다.

## Task 1 — 승인 후 CLOSED 상태의 로컬 준비

- [ ] 기존 제품 테스트 `customer-account-availability`/`customer-auth`와 B3 SDK 테스트를 기준으로 RED를 먼저 확인한다. 새 entry가 Function health·JWT 생성·DB·주문 API를 호출하거나 잘못된 project/origin에서 OAuth/prefs를 시작하면 실패하는 부정 테스트를 추가한다.
- [ ] entry는 실제 `createCustomerAuth()`·`CustomerAccountProvider`·`AccountPage`·`CustomerAuthCallback`을 사용한다. 주입한 `orderService.list/detail`은 HTTP 없이 `CUSTOMER_ACCOUNT_NOT_READY`로 거부한다. 주문 UI의 unavailable과 로그인/저장이 동시에 동작해야 한다.
- [ ] 테스트에서만 Email/OTP UI를 숨기고 sendEmail/verifyEmail 경로를 차단한다. 서버의 OTP 등 다른 인증 OFF가 실질 경계이며 UI 숨김만으로 보호됐다고 주장하지 않는다.
- [ ] 허용 client 호출은 Google `createOAuth2Session`, `Account.get/getSession(current)/getPrefs/updatePrefs/deleteSession(current)`뿐이다. Account 전체 응답·session 객체·callback URL을 출력하지 않고 UID 일치/유효 만료/provider=google 등 결과 boolean만 진단한다. JWT 생성/전달·raw key·Cookie·OAuth code 출력0.
- [ ] 공개 build 값은 AU·customer frontend flag=true·reservation mode=all 및 정확한 테스트 endpoint/project/DB/Function ID다. 이는 테스트 stage에만 적용하며 전역/운영/Function flags는 OFF다. API 호출은 위 Account 경로로만 나가야 한다.
- [ ] `/`, `/account`, `/account/auth/callback`만 materialize한다. product/shop/Checkout/lookup route를 배포하지 않는다. 기존 동일 출처 CSS/시스템 폰트 방식, CSP·no-store/noindex/no-referrer·hard404를 유지한다. 외부 폰트/analytics/새 CSP 예외0.
- [ ] OPEN artifact는 정확한 hostname·새 window·기한·window GET 성공을 요구한다. callback query/fragment는 기존 제품 callback이 제거한다. 최초 유효 window 전에는 앱 인증 진입을 열지 않고 만료/닫힘 시 private UI를 제거한다. CLOSED는 앱 JS/개인정보/로그인 제어가 없는 정적 화면이다.
- [ ] 로컬 테스트에서 정상/Account OFF/주문 unavailable/잘못된 target/만료/지연 및 실패한 window GET/세션 전환/복구 실패를 GREEN으로 확인한다. 기존 자동 브라우저 조작은 사용하지 않는다. lint/TypeScript·관련 테스트·로컬 compiled artifact 경로/MIME/CSP/secret scan 후 기능별 커밋한다. 이번 계획 단계에서는 실행하지 않는다.

## Task 2 — 별도 실행 승인 후 활성화 직전 점검과 감시

- [ ] 공식 기존 Owner/Wrangler 인증을 사용한다. 추가 로그인은 사용자에게 요청하며 cookie 추출·신규 key·운영 credential 재사용 없이 진행한다. 읽기/쓰기 경로는 exact target guard가 먼저 검사한다.
- [ ] 공식 Owner GET으로 test project ID, 정확한3 UID/status, authLimit2, Google provider/platform, 다른 인증 OFF, 세션 알림 OFF, G/H 기존 세션0을 확인한다. 예상 값이 다르면 설정을 임의 수정하지 않고 중단한다. Google/SMTP와 API keys를 다시 만들지 않는다.
- [ ] 현재 Account OFF/실제 익명 `/v1/account`403, Function disabled/execute=[]/B6 active, 세 flag false, site CLOSED를 확인한다. 운영4개 현시점 의미적 구성/Function 지문과 테스트 Google/B4 SMTP/schema/ACL baseline을 비교한다. 고객/주문 document·운영 사용자·예약 화면은 조회하지 않는다. 과거 AU raw 불일치는 UNVERIFIED 유지.
- [ ] mail0 조건을 확인한다. 프로젝트 sessionAlerts OFF·Function events/webhook 등 인증 이벤트의 외부 메일 부작용 없음이 확인되지 않으면 OPEN하지 않는다. 공통/프로젝트 SMTP를 시험용으로 끄거나 바꾸지 않는다.
- [ ] Account ON/OFF·실패 시 고정 OFF·세션 귀속·CLOSED 예산을 로컬 Mock RED→GREEN으로 검증한다. 실제 OFF 권한은 **이미 OFF인 test Account에 OFF를 요청하고 GET/403을 확인하는 idempotent 사전 점검**으로 입증한다. ON은 아직 하지 않는다. 수동 Console Owner 접근도 사용자에게 확보한다.
- [ ] 사용자 G/H 참여가 확인된 뒤 새900초 절대 deadline을 고정하고 독립 watchdog을 시작한다. 1초 heartbeat와 deadline 감시, 최대5초 간격의 bounded 상태 probe를 두고 여러 주기를 관측한다. probe 실패·worker/heartbeat 상실·시계 역행·예상 외 사용자/세션·Function 새 execution1건이면 즉시 OFF한다. 기한을 늘리지 않는다.
- [ ] probe는 정확한 test Auth/session metadata·Account 상태·Function disabled/active/실행 inventory·서버 상태만 감시한다. 세션/사용자 응답은 즉시 allowlist metadata로 축소하고 secret 필드를 파일/로그로 내보내지 않는다. 운영 설정/전체 schema 지문은 시작·종료 checkpoint에서 확인하며 주문 readiness를 반복 호출하지 않는다.
- [ ] API 이상·RAM available<3GiB·disk<30GiB·새 OOM·load1>=4가5분 지속되면 종료한다. local watchdog은 Mac/네트워크 가용성에 의존한다. 잠자기 방지와 수동 Console OFF 경로를 준비하되 완전한 서버 측 TTL로 표현하지 않는다.
- [ ] CLOSED 복원 artifact와 9회차 슬롯을 미리 확보한 상태에서 **8회차 OPEN 배포를 딱1회** 한다. 실제 HTTPS/기한/routes/JS·CSS status/MIME/CSP를 CLI로 검증한다. 실패 시 Account를 열지 않고 CLOSED9를 사용해 종료한다. preview 재배포·자동 재시도 없음.
- [ ] 실제 사이트·watchdog·현재 설정 검증이 모두 통과한 경우에만 test **Account 서비스 ON 하나**를 적용한다. 사용자 상한/Google/SMTP/Function/flags는 쓰지 않는다. 사용자에게 열렸다고 알리고 `/account` 주소를 안내한다.

## Task 3 — 사용자 클릭과 인수, 종료 복구

사용자는 비밀값/명령/서명 키를 입력하지 않는다. 별도 Chrome 테스트 탭에서만 다음을 직접 수행한다.

1. `/account` → SIGN IN → **Continue with Google** → G로 로그인·2FA·동의. “G 로그인 완료”만 알린다.
2. 로그인 이메일이 G이고 session check가 성공인지 확인한다. 새로고침 후 같은 UID/로그인 상태를 확인한다. MY ORDERS는 unavailable이어야 하며 로그인/프로필을 막지 않아야 한다.
3. 이름 `Google Test G`, 주문 연락 이메일 `g-contact@example.invalid`, 전화번호 공란, 기본 언어 한국어로 저장한다. 로그인 이메일은 변경되지 않아야 한다. 새로고침 후 저장값과 기존 prefs namespace 보존을 확인한다. 잘못된 이메일/유효성 오류는 발송 시험이 아니다.
4. **Sign out** → 개인정보 제거·Account.get/getSession의401 거부를 확인한다. 별도 재검사 버튼은 safe status만 표시하며 raw 응답은 보여주지 않는다.
5. 같은 순서로 H 로그인, 기존 H UID 확인, G의 편집값/정보가 없음을 확인한다. H 합성 프로필은 `Google Test H` / `h-contact@example.invalid` / 전화 공란 / English다. 저장·새로고침·로그아웃한다.
6. 시간이 남으면 Google 취소1회 또는 G 재로그인을 진행한다. 총 OAuth 시작4회·프로필 쓰기4회를 넘기지 않는다. 시간이 부족하면 NOT RUN이며 연장하지 않는다.

- [ ] Account.get+getSession의 동일 UID/provider/미래 만료, 새로고침 세션 복원, G/H prefs 저장/readback, 공유 namespace 보존, 명시적 logout401, private UI 제거를 각각 PASS/FAIL/NOT RUN으로 기록한다. 사용자 직접 확인과 CLI metadata 근거를 구분한다.
- [ ] 첫 오류/사용자 종료/deadline이면 **Account OFF 우선**으로 신규 인증을 차단한다. 관리 GET과 실제 client403 `general_service_disabled`를 확인한다. 이미 진행 중인 OAuth의 완료 가능성도 고려해 귀속된 세션을 재확인한다.
- [ ] Owner로 이번 창에서 생성됐다고 UID·session ID·시간·사용자 로그인 intent가 일치한 G/H 세션만 정리한다. baseline 세션/M/미귀속 세션은 삭제하지 않고 예외 보고한다. 사용자·prefs·기존 주문/쿠폰을 자동 삭제/되돌리지 않는다.
- [ ] 예약 Function disabled/execute=[]/B6 active·flags false를 GET으로 확인한다. 이번에는 바꾼 적 없으므로 원래 guarded deployment 활성화/복원·변수 쓰기를 하지 않는다. 예상 밖 drift는 Account OFF 후 보고하며 임의 Function 수정은 하지 않는다.
- [ ] **9회차 CLOSED 배포** 후 root/account/callback의 로그인 진입 차단·`test-window.json.enabled=false`·앱 코드가 없는 정적 화면을 확인한다. OPEN을 시도하지 않았고 기존 CLOSED가 검증되면 Pages를 소비하지 않는다. OPEN 시도/실패는 누적에서 차감하며 자동 추가 배포를 하지 않는다.
- [ ] test users3/상한2·G/H 세션0·Google/B4 SMTP/schema/ACL·운영4개 현재 구성/Function 지문과 자원 상태를 확인한다. Function 실행8/120·Pages 사용량은 이전 journal에 이어 기록한다. 복구 실패/미확인은 PASS가 아니며 사용자에게 즉시 수동 Account OFF/CLOSED 조치를 요청한다.

## 요청할 최종 승인 범위 — 아직 미승인

아래를 **한 번에 별도 승인**받은 뒤에만 로컬 준비/실행으로 넘어간다.

1. 위 테스트 전용 entry/builder·기존 인증 manager의 분리된 Google-only 모드·작은 독립 watchdog과 로컬 테스트 작성. 제품/서버 source 변경0.
2. 동일 test Pages의 OPEN8/CLOSED9 **최대2회**, Account 서비스만 최대900초 ON/OFF. preview0, 연장0, Function execution/deployment0, 새 계정/DB/Key0.
3. 사용자 직접 G/H Google 인증(통상 OAuth identity/session 생성·갱신 포함), 자기 합성 prefs 저장 최대4회, 해당 창의 귀속된 세션 정리. 상한2 및 다른 인증 OFF 유지.
4. 기존 권한으로 읽기 전용 구성/자원/실행 metadata 감시, 사전 OFF 권한 시험과 종료/실패 Account OFF·CLOSED 복원. 추가 설정/권한/자원이 필요하면 중단.

이번에는 로컬 문서/공개 공식 소스만 확인했다. 원격 OFF/CLOSED를 새로 확인하거나 변경하지 않았으며 로그인·profile 인수와 watchdog 신규 모드 구현/검증은 **NOT RUN**이다. 이전 로컬2,046 pass는 기존 분리 구현의 근거이고 이 새 계획의 구현 완료 근거가 아니다.

**별도 후속:** D1 settings1+병렬metadata7 timeout 원인은 UNVERIFIED, backend readiness17→5 최적화는 미구현, 회원 주문/소유권/MY ORDERS 실인수는 NOT RUN이다. 이 로그인 단독 결과를 해당 항목의 PASS로 확대하지 않는다.

**B5 — DEFERRED — RELEASE BLOCKER**. native OTP OFF, 공통 SMTP·수신자/남용 방지·Gallery 예외·system credential·운영 백업/재생성/복구·실제 OTP와 Google↔OTP 동일 UID 검증 미완료. 과거 운영 AU raw 지문 차이 **UNVERIFIED** 유지. 운영 배포·main 병합·B5/B8 자동 진행 금지.
