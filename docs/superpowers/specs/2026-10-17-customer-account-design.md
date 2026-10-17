# VERYGOOD AU Customer Account 설계

작성일: 2026-10-17
상태: 사용자 설계 검토 및 1차 범위 수정 승인 반영. 상세 구현 계획 작성까지 승인됐으며 제품 코드 구현은 별도 계획 승인 대기.
작업 위치: `/Users/nam9295/Desktop/john_2.0/code/au-cake-customer-account`
작업 브랜치: `feat/customer-account`
기준 커밋: `45971f4b53224a199513448128cf3d26543219f2`
실행 방식: Mac Codex 단독. Hermes 이관 및 하위 에이전트 위임 없음.

## 1. 확정된 목적과 경계

회원가입을 강제하지 않고 재방문 고객에게 Google OAuth2 또는 이메일 6자리 OTP 로그인을 제공한다. 가입/로그인을 한 화면으로 통합하고, 로그인 고객의 기본 정보를 다음 주문에 자동입력하며 `/account`에서 본인 주문을 조회한다. 비회원 주문과 예약번호+전화번호 조회는 유지한다.

최신 사용자 지시가 이전 전체 주문 범위 확인을 대체한다. 1차는 Verygood AU의 일반 케이크·초콜릿 상품 주문으로 한정한다. 실제 `AuRenewalShop`의 Bag/Checkout과 현재 사용되는 기존 일반 케이크·초콜릿 Checkout의 자동입력, Google OAuth 후 주문서·장바구니 복원, 회원 소유권 저장과 MY ACCOUNT 조회를 포함한다. 로그인한 상태에서 생성한 신규 기록부터 연결하고 과거 비회원 기록은 이메일·전화번호 일치 여부와 관계없이 연결하지 않는다.

Custom Cake와 Kids Class의 회원 소유권 저장, 신규 스키마, MY ORDERS 연결 및 OAuth 폼 복원은 2차로 보류한다. 해당 제품 코드와 wire 계약은 수정하지 않고 기존 주문·예약 동작의 회귀 검증만 한다. 일반 케이크·초콜릿 UI의 인증 진입점에서도 두 영역을 지원한다고 안내하지 않는다. 기존 운영 기능의 개인정보 노출을 막기 위한 읽기 전용 ACL 점검은 범위에서 제외하지 않는다. 판매 비활성 상품, 미확정 가격, 닫힌 Class 모집, 신규 주문 계약이나 판매 플래그를 회원 기능 때문에 활성화하지 않는다.

계정 페이지에서는 주문 조회만 제공한다. 고객 주문 수정·취소, Magic Link, Apple, Passkey, 고객 비밀번호 가입은 제외한다. 기존 관리자 비밀번호/Google 로그인과 서버 관리자 권한 검사는 유지한다. 디자인은 현행 AU 컴포넌트와 토큰을 재사용하고 신규 CSS는 계정 전용 파일에 둔다.

다른 브랜치와 기존 main worktree를 수정하지 않는다. production 스키마/Function/사이트 변경, 실제 고객 데이터 수정, main 병합, 원격 브랜치 삭제, reset, history rewrite를 하지 않는다. 배포는 별도 승인 단계다.

## 2. 실제 코드 분석 결과

| 영역 | 현재 경로와 동작 | 변경의 의미 |
| --- | --- | --- |
| Appwrite 클라이언트 | `src/lib/appwrite.ts`: Account/Databases/Functions/Storage가 같은 Client와 프로젝트 세션을 사용 | 고객과 관리자는 같은 브라우저의 동일 Appwrite principal을 공유한다 |
| 실제 AU Checkout | `src/App.tsx`의 `renewalRoute` 조기 반환 → `src/pages/AuRenewalShop.tsx`의 `Bag` → `createRenewalOrder` | AU `/cart`·`/reserve`는 먼저 이 경로로 진입한다. `ReservePage`만 고치면 실제 구매 흐름에 적용되지 않는다 |
| AU 폼 상태 | `Bag`의 이름·전화·이메일·메모·쿠폰·동의는 uncontrolled form, 날짜/시간은 React state, requestId는 ref | OAuth 페이지 이동 후 DOM/state/requestId를 모두 복원해야 한다 |
| 기존 예약 폼 | `src/pages/ReservePage.tsx`의 form state와 App의 initialSelection/orderLines/cartOrigin refs | 기존 흐름의 초기 선택·재시도·제출된 장바구니 차감도 함께 보존해야 한다 |
| 일반 주문 API | `repository.executeReservationApi` → `Functions.createExecution` → `reservation-api`의 `create-cake` | 회원 소유권은 기존 pricing/fingerprint 입력 밖에서 연결한다 |
| 실제 Renewal 저장 | `createRenewalOrder` → `create-cake` → `buildRenewalOrderData` → cake `reservations` | `orderLinesJson.version=2`는 Renewal 가격 snapshot 형식이다. private `cake-order.v2` 계약과 다르다 |
| 공유 claim 경계 | `create-cake`의 legacy gate가 `cake-request-v1` claim/commit을 사용할 수 있음 | 일반 주문의 idempotency 지원 기록이다. private snapshots에 Renewal 주문이 저장된다는 뜻이 아니며 claim의 wire/owner를 바꾸지 않는다 |
| 2차 저장 경로 | `create-class`는 Class collection, Custom Cake와 별도 `cake-order.v2`는 private snapshots/claims | 1차 소유권 컬럼·인덱스는 cake `reservations` 한 곳만 추가한다. Class/custom snapshot schema와 workflow는 변경하지 않는다 |
| 관리자 검사 | `repository.isAdminLoggedIn()`은 허용되지 않은 이메일의 정상 세션도 `deleteSession('current')`로 삭제 | 권한 확인은 읽기 동작으로 바꾸고 명시적 로그아웃만 세션을 삭제해야 한다 |
| 관리자 서버 권한 | `custom-cake-security.resolveCustomCakeAdmin`은 allowlist와 user JWT를 검증 | 일반 고객 세션이 생겨도 이 검사를 유지해야 한다 |
| 고객 정보 | 각 주문에 연락처 snapshot 저장, 별도 고객 프로필 없음 | Appwrite Preferences를 추가하고 과거 주문 snapshot은 변경하지 않는다 |
| 장바구니 | `CartProvider`가 일반/renewal 장바구니를 기존 localStorage에 저장 | 기존 저장 구조를 유지하고 인증 때문에 비우거나 새 ID로 바꾸지 않는다 |
| 기존 조회 | `LookupPage`는 기존 조회 API와 Custom Cake lookup을 사용 | 회원 조회 액션과 구분해 계약을 유지한다 |
| 스키마 setup | `setup-appwrite.mjs`는 collection 권한/다른 자원도 갱신 | 운영 마이그레이션에는 사용하지 않고 전용 additive 스크립트를 작성한다 |
| 테스트 | Node test runner, TS bundling/실제 UI 렌더링, Function SDK doubles, 브라우저 시나리오, 배포 아카이브 검사 | 같은 패턴으로 인증·소유권·실제 AU Checkout 회귀 검증을 추가한다 |

현재 문서 작성 단계에는 dependencies를 설치하지 않았다. 이전 기준 검증은 1,771 pass, 0 fail, AU 모드의 KR 전용 검사 1 skip이며 그 검사는 KR 빌드 후 별도로 통과한 기록이다. 새 기능의 검증 결과로 이를 재사용하거나 주장하지 않는다. 실제 일반 주문 저장 위치가 이후 기준 커밋에서 바뀌면 구현을 시작하지 않고 경로·영향을 다시 보고한다.

## 3. 버전 및 공급자 호환성 근거

- 2026-10-17 공개 GET `https://api.verygood-chocolate.com/v1/health/version` 응답은 `{"version":"1.8.1"}`였다. 이 조회 외에 production Auth·DB·Function 리소스를 조회/변경하거나 인증 메일을 발송하지 않았다.
- lockfile Web SDK는 `appwrite@23.0.0`, Server SDK는 `node-appwrite@22.1.3`이다. reservation-api도 Server SDK `22.1.3`을 고정한다. Server SDK의 해당 release README는 1.8.x 호환을 명시한다. Web SDK release README의 호환 표기는 `latest`이므로 전체 SDK의 1.8.1 호환을 추정하지 않는다.
- 공식 1.8.1 Account 소스와 Web SDK 23 Account 소스를 대조하면 OTP 발송은 `POST /account/tokens/email`, 세션 생성은 `POST /account/sessions/token`이며 `userId`·`email`·`secret` 필드가 대응한다. Google OAuth, Account get/prefs, Functions 실행도 사용하는 endpoint/필드에 한정해 실제 SDK의 로컬 HTTP contract test로 확인한다. 의존성 업그레이드는 계획하지 않는다.
- 1.8.1 OTP는 기존 users.email을 찾으면 기존 사용자 ID를 사용한다. 로그인하지 않은 OAuth callback도 provider identity 또는 users.email로 기존 계정을 찾는다. 따라서 동일한 실제 로그인 이메일의 Google→OTP 및 OTP→Google을 모두 시험하고, client에서 계정을 생성/병합하거나 이메일로 주문을 재귀속시키지 않는다.
- 로그인된 상태의 OAuth는 identity 연결/세션 교체 경로를 탄다. 이미 정상 로그인된 사용자는 고객 로그인 시작 버튼을 다시 실행하지 않는다. 관리자/고객 계정 변경에는 명시적 로그아웃을 요구하며 자동 세션 삭제로 전환하지 않는다.
- 1.8.1 Functions 실행 소스는 인증 세션으로부터 user JWT를 생성하고 `x-appwrite-user-id`/`x-appwrite-user-jwt`를 주입한다. 서버는 이 JWT로 Account.get()을 수행하고 반환된 `$id`와 주입 ID를 대조한다. API key로 고객 신원을 대신 확인하지 않는다.
- 1.8.1 index Create 소스는 `$createdAt`을 인덱스 대상 system attribute로 제공한다. 새 소유권 조회 인덱스는 `customerUserId` + `$createdAt` DESC를 사용한다.
- OTP는 Appwrite SMTP와 프로젝트 Email OTP 활성화가 필요하다. 기존 예약 알림의 Resend 설정이 이를 대체한다고 가정하지 않는다. 운영 SMTP·Google 설정과 실제 공급자 계정 병합은 아직 실행 검증하지 않았다.

공식 근거:

- [Email OTP](https://appwrite.io/docs/products/auth/email-otp), [OAuth2](https://appwrite.io/docs/products/auth/oauth2)
- [Appwrite 1.8.1 Account](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/account.php)
- [Appwrite 1.8.1 Functions 실행](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Functions/Http/Executions/Create.php)
- [Appwrite 1.8.1 인덱스 생성](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Databases/Http/Databases/Collections/Indexes/Create.php)
- [Web SDK 23 Account](https://github.com/appwrite/sdk-for-web/blob/23.0.0/src/services/account.ts), [Server SDK 22.1.3](https://github.com/appwrite/sdk-for-node/blob/22.1.3/README.md)

## 4. 접근 방식 선택

권장안은 기존 `reservation-api`에 고객 신원 검증과 읽기 전용 `customer-orders`/`customer-order` 액션을 추가하는 것이다. 별도 모듈에서 인증/조회/응답 projection을 담당하고 기존 handler에서 명시적으로 연결한다. 현재 Functions 호출과 저장 주문 reader를 재사용할 수 있고 새 Function이나 고객 테이블이 필요 없다. 기존 공개 생성 액션의 execute 권한을 유지하되 고객 조회 액션마다 독립적으로 인증을 강제한다.

대안은 별도 `customer-account-api` Function이다. read-only scope로 격리할 수 있지만 별도 Function 설정, 배포 아카이브와 공유 reader 포함, 환경값의 중복 관리가 필요하다. 현재 규모에서는 자원을 늘리지 않는 권장안을 선택한다. 실제 코드 검토에서 기존 Function의 권한 경계로 안전하게 분리할 수 없다는 근거가 생기면 설계를 재검토한다.

브라우저가 예약 DB를 직접 조회하는 방식은 사용하지 않는다. 기존 DB 권한 공개나 고객별 document ACL 재작성, 기존 주문의 backfill을 요구하기 때문이다.

## 5. 플래그와 클라이언트 인증

- Frontend: `VITE_CUSTOMER_ACCOUNT_ENABLED=false` 기본값. AU에서 값이 정확히 `true`인 경우만 고객 provider, 링크, 로그인, 자동입력과 계정 페이지를 활성화한다. KR에서는 해당 기능을 노출/실행하지 않는다.
- Server: `CUSTOMER_ACCOUNT_ENABLED=false` 기본값. 고객 조회와 소유권 연결을 제어하며 비회원 생성 경로를 변경하지 않는다.
- 공개 `customer-account-health`는 enabled/ready 여부만 반환하고 DB ID·권한 목록·사용자 정보를 노출하지 않는다. frontend는 이 readiness를 확인한 뒤에만 고객 인증을 시작한다. 소유권 schema/index 검사는 cake reservations에만 적용하고, 아래의 기존 개인정보 자원 ACL 검사는 회원 연동 범위와 구분한다.
- 플래그가 꺼진 환경에서 고객 기능 때문에 Appwrite 인증 요청을 추가하지 않는다. `/account`는 noindex 비활성 안내와 기존 주문/조회 경로를 제공한다.
- 고객 provider는 확인 중/비회원/로그인/일시적 오류를 구분한다. Account.get()으로 복원하고 앱 재진입·focus·인증 API의 401에서 최신 상태를 확인한다. 네트워크 오류를 로그아웃 성공으로 처리하지 않는다.
- 로그인 화면은 Continue with Google, Continue with Email, Continue as Guest만 제공한다. OTP는 6자리 숫자, 진행 중 요청 잠금, 최신 요청만 반영, 만료/실패/429 안내와 60초 재전송 cooldown을 처리한다. Appwrite 서버의 email/IP rate limit이 최종 제한이며 UI cooldown을 보안 통제로 간주하지 않는다.
- 이메일 정규화 후 `ID.unique()`로 OTP를 요청하고 반드시 발송 응답의 userId로 세션을 생성한다. OTP secret/JWT/세션 정보를 URL·영구 저장소·analytics·로그에 저장하지 않는다.
- Google은 Appwrite OAuth2 session API를 사용한다. callback은 `/account/auth/callback`, 성공/실패와 관계없이 저장된 동일 출처 continuation으로 돌아갈 수 있다. return 경로는 `/account`, `/cart`, `/reserve`로 한정하며 Appwrite의 OAuth state 검증을 대체하지 않는다. 이 allowlist에 Custom Cake/Class 경로를 추가하지 않는다.
- 기존 정상 세션이 있으면 새 로그인 시도를 시작하지 않고 계정 화면을 제공한다. 관리자 검사 실패나 계정 페이지 진입으로 세션을 삭제하지 않는다. 로그아웃은 사용자 동작으로만 수행하고 본인 주문의 메모리 캐시를 폐기한다.

## 6. 프로필과 폼 보존

고객용 새 table 없이 `Account.get()`과 Preferences의 `verygoodAuCustomer` namespace를 사용한다. 버전, 이름, 주문 연락 이메일, 호주 전화번호, 기본 언어를 저장하고 다른 preferences는 병합 보존한다. Google 이름/로그인 이메일은 저장된 프로필이 없을 때의 초기값이다.

로그인 이메일과 주문 연락 이메일을 구분한다. 로그인 principal의 이메일은 임의로 변경하지 않고 계정 화면에 읽기 전용으로 표시한다. 편집 가능한 프로필 이메일은 주문 연락 이메일이다. OTP/Google 계정에는 비밀번호를 요구하는 Account.updateEmail/updatePhone을 사용하지 않는다. 주문 소유권은 연락 이메일과 무관한 Appwrite `$id`다.

프로필 수정은 다음 주문의 기본값만 바꾼다. Checkout에서 바꾼 연락처를 자동으로 프로필에 저장하지 않으며, 과거 주문의 고객 snapshot도 갱신하지 않는다.

자동입력은 비어 있고 고객이 아직 건드리지 않은 필드에만 적용한다. 비동기 세션 복원, 프로필 갱신, 언어 변경, 로그인 후 callback으로 이미 작성한 값을 덮어쓰지 않는다. 수정/삭제한 연락처 필드의 dirty 상태도 복원한다.

Google로 이동하기 전에 주문 종류별 draft를 versioned sessionStorage에 저장한다. 유효기간은 30분이며 크기·타입·허용 경로를 검사하고 한번 소비한다. 저장할 수 없으면 이동 전에 안내하여 작성 중 폼을 잃지 않도록 한다. 세션 만료나 인증 실패에도 draft를 복원하고 비회원으로 계속할 수 있다.

보존 대상은 실제 AU Bag의 모든 form 값, 날짜/시간, requestId와 해당 장바구니의 제출 기준 snapshot이다. 기존 일반 ReservePage의 product/options/orderLines/promo handoff도 포함한다. Custom Cake/Class draft를 저장하거나 복원하지 않는다. CartProvider의 기존 storage key/형식과 line ID는 변경하지 않는다. callback 복원만으로 새 requestId를 만들거나 장바구니를 제거하지 않는다. callback에서는 draft를 검증만 하고, 목적 Checkout에 폼 상태가 반영된 뒤 handoff draft를 한 번 소비한다. 복원 확인 전에 성공·실패·취소 callback에서 먼저 삭제하지 않는다. 주문 성공 시에는 해당 flow의 남은 draft와 실제 제출한 cart line만 정리한다.

다른 탭에서 장바구니가 바뀌었으면 오래된 snapshot으로 최신 장바구니를 덮어쓰지 않는다. 연락처·메모를 복원하면서 변경 안내와 재검토를 요구하고, 고객이 변경된 주문을 확정할 때만 새 requestId를 만든다. StrictMode 재마운트에서 draft를 두 번 소비하지 않는다. frontend 플래그가 OAuth 도중 OFF로 바뀌어도 callback은 인증 API 없이 유효한 draft를 비회원 상태로 복원한다.

## 7. 서버 소유권 계약

고객 Auth 활성화 전 DB 권한 검증은 필수다. 현재 setup 소스는 관리자 ID 목록이 없을 때 `Role.users()`를 관리자 권한으로 fallback할 수 있고 direct 모드에서는 `create(Role.any())`를 허용한다. 이런 설정에서 단순히 고객 로그인을 추가하면 일반 고객이 DB를 직접 읽거나 임의 owner가 든 row를 생성할 수 있다. 실제 production collection 권한은 아직 인증된 조회로 확인하지 않았으며, 안전하다고 가정하지 않는다.

검증 대상은 분리한다. `ownershipTargets`는 cake reservations 하나로, `documentSecurity=false`, optional owner schema와 available index를 확인한다. `privacyAuditTargets`는 같은 프로젝트에서 이미 사용하는 cake/class 예약 및 구성된 기존 private Custom Cake 자원으로, 회원 연결 없이 collection 권한 metadata만 점검한다. 존재하지 않는 Class/custom 자원을 생성하거나 owner schema를 요구하지 않는다. 실제 사용 중인 개인정보 자원의 매핑·권한을 확인할 수 없으면 활성화하지 않는다.

각 개인정보 collection의 `documentSecurity=false`와, 권한이 비어 있거나 명시적인 기존 관리자 user ID에만 제한됐음을 확인한다. `any`, `users`, guest 또는 allowlist 밖의 principal에 예약 read/create/update/delete가 열려 있으면 고객 기능을 비활성 상태로 유지하고 실패한다. frontend API 모드도 `all`이어야 한다. 기존 API key의 collection metadata read scope를 사용하므로 추가 권한 확대가 필요하지 않다. 고객 조회/회원 주문 연결 시 서버에서 이 조건을 다시 확인한다.

이번 additive migration은 발견한 기존 ACL을 자동으로 변경하지 않는다. 안전한 권한 상태가 아니면 production 활성화의 차단 사유로 보고하며, 권한 전환이 필요하면 대상·기존 비회원 경로·관리자 allowlist를 별도 검토/승인한다. Email OTP 활성화 자체도 이 권한 검증 이후에만 수행한다. 신규 설치 setup에서 고객 기능을 활성화하는 경우 관리자 ID 없는 broad fallback을 거부한다.

주문 body의 `customerUserId`, 이메일 일치 또는 클라이언트가 보낸 user 객체를 신뢰하지 않는다. 회원 연결 의도는 pricing/canonical payload와 분리된 transport envelope에서만 전달한다. 그 의도는 신원 증명이 아니며 서버에서 검증한 Account ID만 저장한다.

신규 회원 주문은 유효한 platform user JWT와 일치하는 user ID가 필요하다. 인증 정보가 일부만 있거나 잘못됐으면 회원 주문을 조용히 비회원으로 낮추지 않고 인증 오류로 처리한다. 폼을 유지하고 사용자가 비회원 진행을 선택할 수 있게 한다. 비회원 요청에는 소유권 필드를 기록하지 않는다.

인증 장애 시 비회원 진행 보장은 Auth/provider에 문제가 있지만 기존 reservation-api와 DB는 정상인 상황을 대상으로 한다. Appwrite/DB 전체 장애를 우회하는 별도 주문 저장소는 만들지 않는다. 전체 인프라 장애에는 기존 방식처럼 실패를 안내하되 장바구니·폼·requestId를 보존한다.

일반/renewal 주문은 기존 `create-cake`의 새 reservations row에 optional `customerUserId`를 원래 생성과 함께 기록한다. 쿠폰이 있는 경우 기존 쿠폰 트랜잭션, 공유 claim이 있는 경우 기존 legacy-gate 트랜잭션에 함께 포함한다. 기존 canonical/fingerprint/가격/쿠폰 재시도 계약에 고객 인증 상태를 섞지 않는다. 인증 실패가 비회원 주문 자체의 readiness 검사나 저장 경로를 차단해서는 안 된다.

현재 저장 경로 재확인 결과 private snapshots 또는 별도 `cake-order.v2`에 대한 소유권 변경은 1차에 필요하지 않다. 그 schema/persistence/workflow/claim wire를 변경하지 않는다. 일반 Renewal의 JSON version 2와 wire `cake-order.v2`를 이름만으로 같은 대상으로 취급하지 않는다.

기존 requestId 재시도는 기존 owner를 유지한다. 비회원으로 생성된 주문을 로그인 뒤 재시도해도 owner를 추가하지 않는다. 이미 다른 사용자에게 연결된 requestId를 새 회원 주문으로 재사용하면 충돌을 반환한다. 쿠폰 commit reconciliation, 일반 주문의 `cake-request-v1` claim replay와 동시 생성 경쟁에서 최종 reservations row의 owner를 검증한 뒤 응답한다. 고객용 API에는 owner 수정·삭제 액션을 만들지 않는다.

## 8. MY ACCOUNT / MY ORDERS

`/account`에서 프로필, Upcoming Orders, Past Orders, 상세와 로그아웃을 제공한다. 헤더/모바일 메뉴는 로그인 상태에 따라 SIGN IN / ACCOUNT를 표시하고 기존 BAG/언어/메뉴 동작을 유지한다. 고객 화면에는 주문 수정·취소 버튼을 추가하지 않는다.

`customer-orders`는 cake reservations만 조회하고 owner equality와 생성시각 정렬을 서버에서 고정한다. 클라이언트는 조회 대상 userId, 임의 DB query, collection ID나 Custom Cake/Class source를 지정할 수 없다. 페이지 크기는 최대 25이고 다음 cursor 하나를 반환한다. cursor 문서도 본인 소유인지 검증한다. 전체 고객 기록을 스캔해서 브라우저에서 필터링하지 않는다.

`customer-order`는 reservations 문서 식별자만 받아 서버에서 다시 owner를 대조한다. 없는 주문, 소유권이 없는 주문, 다른 사용자 주문은 같은 NOT_FOUND 응답을 사용한다. 인증이 없으면 401이며 고객 읽기 응답은 모두 `Cache-Control: no-store`다.

상세는 기존 저장 주문 reader/가격 snapshot을 사용한 명시적 allowlist projection으로 반환한다. adminMemo, 내부 쿠폰/원장 ID, fingerprint, 사진 credential, Function key, audit/outbox 등 내부 필드는 제외한다. 고객 계정 조회를 기존 번호+전화 lookup의 지름길로 구현하지 않는다.

Upcoming/Past는 Australia/Sydney의 픽업 날짜·시간과 완료/취소 상태를 기준으로 구분한다. 현재 페이지의 주문을 나눠 보여주고 다음 cursor가 남아 있으면 아직 전체 목록이 아니라는 안내와 추가 불러오기를 제공한다. 다음 페이지를 확인하지 않고 특정 그룹에 주문이 전혀 없다고 단정하지 않는다. Class/custom 기록은 반환·표시하지 않는다. 화면에는 로딩·빈 목록·오류·세션 만료·추가 불러오기 상태를 EN/KO로 제공한다. 데이터는 현재 사용자 ID별 메모리 캐시로만 유지하고 계정 전환/로그아웃 때 폐기한다.

## 9. Additive 스키마와 배포 자원

새 고객 테이블과 새 Function은 필요 없다. 기존 `reservation-api`에 모듈/액션/변수와 배포 아카이브 manifest를 추가한다. 기존 Function의 runtime, execute roles, scopes, schedule, events와 다른 플래그는 유지한다.

| 저장 자원 | 추가만 허용하는 항목 |
| --- | --- |
| cake reservations | optional string `customerUserId`, size 36, required false; `customerUserId`/`$createdAt` 복합 key index |

회원 기능을 위해 Class reservations와 private custom snapshots/claims/history/outbox의 컬럼·인덱스·데이터를 추가하거나 갱신하지 않는다. 기존 일반 주문이 현행 shared gate를 통해 만드는 `cake-request-v1` claim/commit은 그대로 유지하며 새 owner metadata를 넣지 않는다.

인덱스 이름은 `customerUser_created_idx`, attributes는 `[customerUserId, $createdAt]`, orders는 `[ASC, DESC]`다. 과거 데이터 backfill, required 변경, collection/document/storage 권한 갱신, 새 public ACL, 기존 인덱스 삭제는 하지 않는다.

전용 `scripts/migrate-customer-account-schema.mjs`와 schema contract를 작성한다. 기본 dry-run은 읽기만 수행하고 server-only endpoint/project/database/collection 매핑, AU 대상, 버전, 기존 정의와 권한을 검증한다. `--apply`일 때만 누락된 optional 컬럼/인덱스를 추가하고 bounded polling으로 available 상태를 확인한다. 이미 다른 정의가 있으면 덮어쓰지 않고 실패한다. 중간 실패 후 재실행은 idempotent하다. 실제 production 실행은 승인 후 별도 단계다.

신규 설치용 setup에는 동일 additive 정의를 반영하되 기존 setup 전체를 운영 migration에 사용하지 않는다. 스크립트/문서에는 비밀값이나 실제 고객 데이터를 추가하지 않는다.

## 10. 구현 파일 경계와 검토 단위

Frontend 신규 모듈은 `src/lib/customer-auth.ts`(SDK adapter), `customer-profile.ts`(프로필 계약), `customer-checkout-draft.ts`(복원 계약), `customer-orders.ts`(API/응답 파서), `src/CustomerAccountProvider.tsx`, `src/components/CustomerSignInDialog.tsx`, `src/pages/AccountPage.tsx`, `src/styles/customer-account.css`로 나눈다. 기존 Appwrite 설정, route/SEO/static generation, main provider, AuNavigation, 실제 AuRenewalShop Bag와 일반 ReservePage에 연결한다. Custom Cake/Class 폼은 변경하지 않는다.

Backend는 reservation-api 내부의 `customer-identity.js`, `customer-account-readiness.js`, `customer-orders.js`에 새 책임을 분리하고 기존 main의 일반 `create-cake`/고객 조회 액션에만 연결한다. Custom Cake persistence/workflow 및 Class 생성은 변경하지 않는다. 기존 shared gate를 이용한 일반 주문 replay는 main에서 최종 reservations owner를 검증한다. 공통 주문 core/가격 정책은 리팩터링하지 않는다.

각 검토 단위는 별도 커밋으로 남긴다: 분석·설계 → 플래그/계약/테스트 도구 → 고객 상태와 로그인 UI → Google/OTP adapter → 프로필과 폼 복원/자동입력 → 서버 소유권/마이그레이션 → 내 주문 API → 계정 화면 → 관리자 충돌 수정 → 전체 회귀 검증/배포 문서. 각 제품 기능 단위에서 실패 테스트를 확인한 후 구현한다. 새 기능은 플래그 기본 off인 상태로 통합한다.

## 11. 검증 기준

- OTP 신규/기존 계정, 6자리 입력, 실패/만료/429/재전송 cooldown/중복 요청/늦게 도착한 응답, 복원/로그아웃/계정 전환을 검증한다.
- 실제 SDK가 보내는 endpoint/body를 로컬 HTTP 서버에서 검증한다. Google→OTP 및 OTP→Google의 동일 이메일은 별도 격리 Appwrite 프로젝트에서 동일 `$id`와 기존 owner 유지까지 확인한다. 서로 다른 이메일/기존 세션/동시 첫 로그인 충돌도 포함한다. mock 검증을 실제 provider 검증으로 보고하지 않는다.
- 두 사용자와 guest fixture로 목록/상세/커서/위조 body·headers·JWT·이메일/플래그 off/직접 DB 거절/기존 비회원 재시도 미귀속을 검증한다. broad read/write ACL, direct mode, documentSecurity=true, 누락된 reservations owner schema/index에서 인증/회원 연결이 열리지 않는지 검증한다. 일반 케이크·초콜릿과 Renewal의 원자적 owner 저장, 경쟁/쿠폰 reconciliation을 포함한다. Class/custom schema·생성·조회가 변경되지 않음을 확인한다.
- 실제 AU Bag와 기존 일반 예약 폼의 입력/동의/쿠폰/옵션/requestId/장바구니가 OTP와 Google 성공·취소·실패 후 보존되는지 검증한다. 비동기 자동입력이 dirty 값을 덮어쓰지 않는지 확인한다. 다른 탭의 장바구니 변경, StrictMode 재마운트와 인증 중 플래그 OFF도 포함한다. Custom Cake/Class의 회원 OAuth 복원을 검증 대상으로 추가하지 않는다.
- 기존 번호+전화 조회, 관리자 Google/비밀번호/allowlist/서버 권한, 가격·결제·쿠폰·메일·reminder·출고 reader·배포 아카이브를 회귀 검증한다.
- mobile Chromium/WebKit와 Safari/Chrome의 확인 범위를 분리 기록한다. 로컬 WebKit emulation을 실제 iOS Safari 기기 검사로 보고하지 않는다.
- lint, TypeScript, AU/KR build, 전체 npm test를 최종 커밋에서 실행한다. 이전 1,771 pass 기준에 새 실패가 없어야 하며 조건부 skip과 미실행 외부 통합 검사를 따로 보고한다.

## 12. Production 적용 및 rollback 순서

1. 로컬 구현/테스트/검토를 마치고 변경 파일·커밋·마이그레이션 dry-run 계획·남은 외부 검증을 보고한다. 이 단계에서 배포 승인 요청을 별도로 한다.
2. 승인 후 지정된 격리 환경에서 SMTP/Email OTP/Google redirect, 공급자 간 동일 사용자 ID, 세션 쿠키와 실제 JWT Functions 실행을 확인한다. production 고객으로 시험하지 않는다.
3. 승인된 production 대상의 기존 권한/플래그/배포 checkpoint를 기록하고 전용 migration dry-run을 검토한다. 별도 승인 범위에서 additive schema를 적용하고 available을 확인한다.
4. 기능 플래그 off로 호환 backend를 배포하고 guest/기존 stored-order readers를 검증한다. 이후 승인된 계정 플래그와 frontend를 단계적으로 활성화한다. 기존 예약·쿠폰·결제·메일을 변경하는 smoke는 별도 승인 없이는 실행하지 않는다.
5. 장애 시 고객 frontend 플래그를 끄고 고객 backend 플래그를 끈다. 기존 비회원 주문/조회와 관리자 기능을 검증한다. 필요 시 검증된 호환 코드 checkpoint로만 되돌린다. owner 컬럼/인덱스/기존 owner 값/preferences/계정/원장/고객 기록을 삭제하거나 backfill하지 않는다.

## 13. 계정 삭제·개인정보 요청 운영 절차

1차에는 자동 회원탈퇴 API/버튼·데이터 삭제 배치를 구현하지 않는다. `/account`에 기존 Contact Us를 이용한 삭제 요청 안내를 EN/KO로 제공한다. 안내 문구는 다음과 같다.

- EN: "To request account deletion or help with your personal information, please use Contact Us. Some order and accounting records may need to be retained."
- KO: "계정 삭제 또는 개인정보 관련 요청은 Contact Us로 문의해 주세요. 일부 주문·회계 기록은 필요한 기간 동안 보관될 수 있습니다."

계정 삭제 요청과 주문 기록의 보존 여부는 분리한다. Appwrite 프로필/preferences와 OAuth identities/세션은 인증·재방문 편의를 위한 데이터이고, 주문의 연락처·가격·결제·알림 원장은 각 처리 목적과 적용되는 보존 의무를 검토해야 하는 별도 기록이다. 계정 삭제를 주문 취소·환불 또는 과거 주문 전체 삭제로 처리하지 않는다.

운영 책임자는 삭제 요청을 받으면 아래 절차를 적용한다. 이 문서는 수행 승인이나 자동 실행 코드를 제공하지 않는다.

1. 기존 문의 채널에서 접수하되 비밀번호·OTP·JWT·신분증을 공개 댓글/DM으로 요구하지 않는다. 주문 연락 이메일만으로 본인임을 판정하지 않고 인증 계정의 소유를 안전한 비공개 절차로 확인한다. 담당자, 요청 종류와 확인된 Appwrite user ID를 제한된 접근의 작업 기록으로 남긴다.
2. 해당 사업자에 적용되는 법령·회계 보존 기준, 진행 중인 주문/분쟁/환불, 예약 알림 처리 목적을 검토한다. 필요한 최소 주문·회계 기록과 삭제/비식별화할 프로필·부수 정보의 범위를 승인한다. 모든 개인 정보에 일률적인 보존 기간을 적용하지 않으며 운영 책임자와 회계 담당자가 대상별 기간·기산점·재검토일을 확정한다.
3. 실제 운영 변경 승인을 받은 담당자만 해당 계정을 차단하고 모든 세션을 철회한다. 새 요청이 인증되지 않음을 확인하고 이미 실행 중인 Function/트랜잭션이 종료·정리될 때까지 해당 리소스의 최대 실행/재조정 기간을 기준으로 기다린다. 비회원 주문 기능은 유지한다.
4. 계정을 물리적으로 삭제하기 전, 확인된 user ID의 일반 reservations 소유권 연결을 별도 승인된 관리자 절차로 제거하고 재조회 결과가 0건인지 확인한다. 이메일·전화번호로 다른 주문을 찾거나 guest 주문을 수정하지 않는다. 변경은 optional `customerUserId` 연결에만 제한하고 법적·회계상 보존이 필요한 연락처/가격/결제 snapshot은 승인된 보존 정책에 따라 분리 보관한다. 일반 주문 생성/재시도에서 owner가 불변이라는 계약의 예외는 이 승인된 개인정보 처리 절차뿐이며 고객 API에는 이 기능을 노출하지 않는다.
5. 위 절차가 끝나면 해당 Account 및 연관 identities/credentials/preferences를 삭제하고 처리 결과를 확인한다. 완료 전에 안전하게 처리할 수 없는 부분이 있으면 차단 상태를 유지하고 미처리 범위를 설명하며 삭제 완료라고 보고하지 않는다. 과거 ID를 재사용하거나 같은 이메일로 다시 가입해도 옛 주문은 MY ORDERS에 나타나지 않아야 한다. 단순히 Account만 삭제하면 동일 custom user ID 재사용으로 과거 owner 연결이 살아날 수 있으므로 금지한다.
6. 보존이 불필요한 사본/내보내기/부수 로그는 승인된 범위에서 삭제 또는 비식별화한다. backup 접근·만료 정책과 복구 후 삭제 요청 재적용 절차도 기록한다. 사용자에게 프로필 처리 결과, 보관하는 기록의 범주·목적과 문의 방법을 알린다.

이 절차는 현재 주문 데이터에 대한 보관/삭제 결정을 미리 내리지 않는다. 2차 회원 연동이 생기면 그 소유권 자원도 함께 처리하도록 절차를 확장한다. 기존 번호+전화 조회는 기존 계약대로 유지되므로, 계정 삭제 안내가 법적으로 보관 중인 주문 snapshot의 삭제나 기존 비회원 조회의 자동 폐쇄를 약속해서는 안 된다. 특정 주문 개인정보의 별도 삭제가 필요한 경우에는 관련 조회·회계·알림 reader 영향까지 별도 검토한다.

정책 검토 근거: [OAIC APP 11](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information)은 해당 규율이 적용되는 정보의 불필요한 보관 중단과 법률상 보존 예외를 구분한다. [ATO 사업 기록 안내](https://www.ato.gov.au/api/public/content/0-53cc7a8e-0668-4c9d-95d7-eb841eb09c04)는 기록 종류와 사업 상황에 따른 보존 기준 검토에 사용한다. 이 설계는 특정 보존 기간이나 사업자의 법 적용 여부를 단정하지 않는다.

## 14. 현재 완료 범위와 다음 게이트

이 문서는 실제 코드와 공식 1.8.1 소스 분석에 기반한 1차 설계이며 제품 구현 완료 보고가 아니다. 현재까지 제품 코드·의존성·스키마·운영 설정은 변경하지 않았다. SMTP/Google 제공자 실제 인증, 격리 환경 공급자 간 ID 재사용, 모바일 브라우저와 새 코드 전체 테스트는 구현 후 검증 대상이다.

사용자는 위 1차 범위 수정과 개인정보 운영 절차를 반영한 뒤 설계 재승인으로 중단하지 않고 상세 구현 계획 작성까지 진행하도록 승인했다. [상세 구현 계획](../plans/2026-10-17-customer-account.md)을 작성·문서 검증·커밋한 뒤 중단한다. 제품 구현은 사용자의 해당 계획 검토 승인 이후에만 시작한다. 실행 방식은 Mac Codex 단독을 유지한다. 계획 승인은 production 배포·실제 개인정보 삭제 처리를 포함하지 않는다.


## 로컬 구현 검증 보완 — 2026-10-17

승인된 1차 범위와 위 보호장치를 유지했다. readiness/migration은 project DB inventory도 확인하며 미분류 DB/collection 또는 불완전 metadata를 거부한다. 공개 settings/pickup calendar/booked dates의 의도된 read는 유지할 수 있지만 broad write는 거부한다. owner 정의의 암호화/format 불일치와 processing 상태도 활성화 준비 완료로 인정하지 않는다. 이 검사는 metadata-only이며 기존 운영 ACL을 수정하지 않는다. 관리자 ID 기준은 기존 `APPWRITE_ADMIN_USER_IDS`다. 상세 결과는 [로컬 인수 기록](../../customer-account-validation.md)과 [배포 절차](../../customer-account-rollout.md)에 연결한다. 실제 공급자·운영 metadata 검증은 미실행으로 남아 있다.
