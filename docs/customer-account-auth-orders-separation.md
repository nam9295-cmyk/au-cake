# 고객 인증과 주문 준비 상태 분리 — 로컬 개선

2026-10-18. Worktree `au-cake-customer-account`, branch `feat/customer-account`, 시작 HEAD `0fcb3a7`. 사용자 승인에 따라 기존 제품 구조만 로컬 수정했다. **Appwrite Account 인증이 reservation Function의 health를 기다리지 않도록 분리했다. 실제 Google/MY ORDERS 인수는 NOT RUN이다.** 원격 API·배포·인증 창을 사용하지 않았다.

## 제품 동작과 상태

| 구분 | 근거와 상태 | 다른 서비스 오류의 영향 |
| --- | --- | --- |
| 로그인/프로필 | Account.get/getSession 및 기존 Account/preferences 경로. checking / guest / authenticated / unavailable | 주문 서비스 실패로 인증/프로필을 지우지 않음 |
| Google 시작 | 주문서/카트 복원 정보 저장 → 기존 Account 재확인 → Appwrite Google OAuth | reservation health 호출0. Account OFF/403이면 OAuth 시작 차단 |
| MY ORDERS | 실제 목록/상세 API 결과. idle / checking / ready / unavailable | 실패 시 주문 영역만 unavailable, 재시도 제공 |
| 주문 소유권/권한 | 원래 서버의 readiness·검증된 JWT·owner·private ACL | UI의 ready 상태로 서버 검증을 생략하지 않음 |

`CustomerAccountProvider`의 인증 refresh에서 `getCustomerAccountHealth()`를 제거했다. focus/pageshow·명시적 인증 변경도 Account 세션만 다시 확인한다. 로그인 dialog 활성 여부는 인증 상태만 사용한다. `createCustomerAuth.startGoogle()`의 새 Account 검사와 중복 요청 차단은 유지하며, Account가 꺼진 상태를 guest로 오인해 OAuth를 시작하지 않는다.

Provider는 별도 `ordersStatus`와 `getOrders/getOrder`를 제공한다. 목록/상세를 요청할 때만 실제 주문 API를 호출하고, 그 응답이 준비 상태의 근거다. **별도 frontend health를 먼저 보내고 실제 주문 조회에서 같은 검사를 반복하는 경로는 없앴다.** ready는 화면 상태이며 인증·권한·조회 결과의 캐시가 아니다.

인증과 주문 요청의10초 UI 제한은 올리지 않았다. 주문 요청의 timeout/503은 주문 unavailable로 처리하며 인증은 유지한다. 늦은 응답은 ready로 상태를 되돌리지 못한다. 이 UI deadline은 이미 시작된 서버 실행을 취소하는 보장이 아니다. 서버의20초 제한과 원래 검증도 그대로다.

MY ACCOUNT의 회원정보 편집·로그인 이메일·주문 연락 이메일 분리·로그아웃은 유지한다. 주문이 불가능하면 EN/KO로 명확히 안내하고 주문 목록/상세를 숨긴다. 조회 실패를 빈 주문목록으로 표시하지 않는다. 본인 주문을 찾지 못한404는 기존 상세 오류로 처리하며 다른 고객 정보나 존재 여부를 노출하지 않는다.

동일 UID focus 재확인은 기존 hidden/inert panel과 key를 유지해 저장 전 프로필/열린 상세를 불필요하게 초기화하지 않는다. UID 전환·로그아웃·세션 상실·명시적 인증 변경은 별도 intent를 무효화하고 과거 계정의 늦은 주문 응답을 거부한다. 주문 API의 CUSTOMER_UNAUTHORIZED는 공유 세션을 삭제하지 않고 private UI를 무효화한다.

## 변경 범위와 유지한 계약

- `src/CustomerAccountProvider.tsx`: 인증/주문 상태 분리, 불필요한 health 제거, 주문 결과·오류·시간초과 및 stale 응답 처리.
- `src/lib/customer-account-context.ts`, `customer-account-types.ts`: 모호한 ready 대신 ordersStatus, 실제 주문 조회 함수와 주입 가능한 서비스 타입.
- `src/pages/AccountPage.tsx`, `src/lib/customer-account-copy.ts`: 실제 조회로 상태 판단, 프로필과 주문 unavailable 분리, EN/KO 안내·기존 UI 재사용. CSS/디자인 시스템 변경0.
- `tests/customer-account-availability.test.tsx`, `tests/customer-auth.test.ts`: 독립 인증·Account OFF·주문 오류/timeout·계정 전환/로그아웃·fail-closed·EN/KO 회귀.
- 기존 SSR 테스트와 browser Mock fixture/scenario는 새 계약으로 갱신했다. Account OFF에서 Google 차단, 세션 상실 시 과거 개인정보 제거, stale OTP/UID/프로필 회귀를 유지했다. 이번에는 브라우저 자동 조작을 실행하지 않았다.

일반 Checkout/장바구니/자동입력/Google 복원 helper/requestId/body·비회원 생성/조회·가격/쿠폰/멱등성/결제/알림 source를 바꾸지 않았다. 주문 capability health도 기존 주문 정책에 그대로 남아 있다. 로그인 후 주문 서버가 불가능하다고 회원 주문을 비회원으로 자동 재시도하지 않는다. 고객이 기존 Continue as Guest를 명시적으로 선택할 수 있다.

서버 JWT/owner/관리자 allowlist/private ACL/readiness source·DB·마이그레이션·Function runtime/scope·endpoint·Google/SMTP 설정·dependency/lockfile·기본 OFF feature flag는 변경하지 않았다. 기존 AU/all API 모드의 feature flag 활성 조건도 유지했다. Custom Cake/Kids 회원 연동은 추가하지 않았다.

## 호출 비용: 이번 변경과 후속 설계

현재2 DB/12 Collection/Custom 미활성 구성을 기준으로 한다. 서버 호출 수와 브라우저 Function execution 수를 구분한다.

| 동작 | 변경 전 | 이번 로컬 구현 |
| --- | --- | --- |
| 최초 인증 확인·로그인 dialog·focus 인증 재확인 | Account 전에 customer-health Function1회, 내부 metadata17회 | **Function0회**, Account SDK만 사용 |
| 첫 MY ORDERS 목록 | 위 health + 실제 목록 Function: 최소2 executions | **목록1 execution**, 원래 readiness/JWT/owner 검사 포함 |
| 상세/다음 페이지 | 실제 주문 API + 서버 readiness | 동일. 서버 검사를 건너뛰지 않음 |
| 주문 API 내부 readiness | metadata17회 순차 | **17회 그대로**, 이번에 backend 최적화 미구현 |

현재 원래 MY ORDERS 첫 목록/상세는 readiness17 + Account JWT1 + 데이터1 =19회, cursor는20회다. B7 test guard가 추가하는 identity 확인을 포함하면 각각20/21회다. 이번 frontend 변경은 인증에서 이 부담을 떼어냈지만 실제 주문 API의 지연을 해결했다고 주장하지 않는다. 과거17.46초 readiness 성공과10초 UI 제한 때문에 MY ORDERS unavailable이 계속 발생할 수 있다.

### 제안: 같은 요청의 Collection metadata 재사용 — backend 미구현

지금은 DB inventory1 + Collection 목록2를 얻은 뒤, 이미 목록에 있는12개 Collection을 ACL 검증용으로 각각 다시 GET한다. 설치 SDK22.1.3의 Collection 모델에는 `$permissions`, `enabled`, `documentSecurity`가 있다. **해당 목록 객체의 완전성을 확인하고 같은 ACL 검증에 재사용하면**, 새 positive cache 없이 다음 구조가 가능하다.

| 검증 | 기존 | 제안 |
| --- | ---: | ---: |
| 프로젝트 DB inventory | 1 | 1 |
| 두 DB의 Collection inventory | 2 | 2 |
| private9/public3 ACL | 별도 GET12 | 위 목록 객체12개를 전부 검증, 별도 GET0 |
| owner attribute/index의 정확한 상태 | 2 | 2 |
| 합계 | **17** | **5** |

DB inventory 이후 두 목록을 bounded 병렬 조회하고, ACL 검증 뒤 owner attribute/index2개를 병렬 조회하면 왕복 단계도 줄일 수 있다. 호출 수 절감은 설계 계산이며 실제 Appwrite 성능 결과가 아니다. endpoint/DNS/TLS 문제를 고친 것으로 표시하지 않는다.

필수 보호 조건:

- 매 주문 요청에서 fresh metadata를 읽는다. 프로세스 간/사용자 간 positive readiness TTL cache, client ready 신뢰, 관리자 key 우회는 도입하지 않는다.
- inventory total/길이/100개 제한·정확한 DB/Collection IDs·중복/누락/알 수 없는 리소스를 검증한다. 필요한 객체가 하나라도 없거나 부분 응답이면 fail-closed다.
- 모든 private9/public3의 기존 enabled/documentSecurity/permissions 검사를 그대로 실행한다. 실제 APPWRITE_ADMIN_USER_IDS allowlist만 사용하며 public 쓰기 권한은 거부한다.
- owner optional attribute/index 정의·상태·순서·encrypt/default 검사 및 JWT/사용자 ID/owner/cursor 검증을 그대로 유지한다.
- 1.8.1의 test Function 권한으로 listCollections가 실제 전체 ACL 모델을 반환하는지 **격리된 GET-only 확인**이 선행돼야 한다. SDK 타입만으로 실제 서버 계약을 확정하지 않는다.
- 기존17회 검증과 제안5회 검증의 정상/unsafe ACL·누락/중복/잘림·unclassified DB·owner schema drift 결과를 로컬에서 대조하고, ACL 변경이 다음 요청에서 즉시 거부되는지 검증해야 한다.

이 최적화는 이번 source에 적용하지 않았다. 승인된 후속 로컬 구현·검토가 필요하며 Function 배포/실제 실행은 별도 승인이 필요하다. 실제 실행 전에는 최신 key/window/변수를 고정한 새 deployment 계약도 따른다.

## 로컬 검증 결과

- 새 분리 회귀10개는 원래 Provider/AccountPage source를 불변 baseline으로 대입했을 때 **10 FAIL**을 확인한 뒤, 수정 제품에서 GREEN을 확인했다. 테스트 harness의 cleanup 순서를 먼저 고친 뒤 이 RED 증거를 다시 남겼다.
- 집중 UI/auth **24 PASS**, 계정 묶음 `npm run test:customer-account` **269 PASS / 0 FAIL / 0 SKIP**.
- 전체 `npm test` **2,046 PASS / 0 FAIL / 기존 SKIP1**, 총2,047. 기존 기준2,035 pass에서 새 테스트11개가 추가됐다. 회귀 테스트를 삭제하거나 assertion을 느슨하게 만들지 않았다. 바뀐 readiness Mock 기대값과 함께 Account OFF의 별도 차단 시나리오를 유지했다.
- ESLint·제품 TypeScript `tsc -b` PASS. KR→AU 순차 build PASS, 기존 bundle-size 경고 유지. UI는 기존 CSS와 디자인을 사용한다.
- 신규 테스트/Mock fixture의 별도 TypeScript 검사와 오프라인 fixture bundle도 PASS. 보조 검증 명령의 존재하지 않는 env 선언 경로와 CSS loader 설정을 바로잡아 재확인했다. 제품 build의 실패는 없었다.
- Git 후보 파일·AU build 산출물·이번 로컬 evidence 총2,992개에서 알려진 보호값5개와 신규 파일의 credential 패턴을 검사해 발견0을 확인했다. V1/V2/V3 manifest SHA·이전 승인 journal·D1 archive SHA는 불변이다. evidence는 Git 제외0700 폴더/0600 파일에 보관한다.
- Google/MY ORDERS 실제 provider·브라우저 인수 **NOT RUN**. CLI hook/SSR·Mock 검증과 실제 공급자 성공을 구분한다. Chrome/CUA·Playwright·실기기 자동 조작0.

제품·회귀 테스트 커밋은 `fe42566` (`fix(account): decouple sign-in from order readiness`)이다. 로컬 RED/GREEN·전체 테스트·검사·build·비밀정보 검사 evidence는 Git 제외 `.superpowers/sdd/2026-10-18-customer-auth-orders-separation/`에 보관한다. 배포나 원격 실행 증거로 사용하지 않는다.

## D1 지연 조사와 출시 경계

[기존 D1 조사](customer-account-b7-d1-timeout-investigation.md)의 settings1 + 병렬 metadata7 대기는 별도 미해결이다. 이번에는 해당 health·SDK·통신 경로·timeout·계측/배포 도구를 수정하지 않았고 진단 배포나 health execution을 추가하지 않았다. settings/metadata의 정확한 대기 지점과 transport 원인은 UNVERIFIED다.

원격 작업0이므로 B7 누적8/120·Pages7/9를 소비하지 않았다. 직전 확인된 Account OFF403/Function disabled·execute=[]/flagsfalse/B6 active/CLOSED에 변경을 가하지 않았다. 이번 세션의 원격 상태 신규 확인·실제 Google 로그인·MY ORDERS/주문 인수는 **NOT RUN**이다. main/운영 프로젝트/고객 데이터 변경0이다.

**B5 — DEFERRED — RELEASE BLOCKER**. native OTP OFF, 공통 SMTP·수신자/남용 통제·Gallery 예외·system credential·운영 백업/재생성/복구·실제 OTP와 Google↔OTP 동일 UID는 미완료다. 과거 AU raw 설정 차이는 **UNVERIFIED** 유지. 이번 로컬 인증 분리는 Google+OTP 출시 승인이나 B5 완료가 아니다.
