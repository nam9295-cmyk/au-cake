# VERYGOOD AU Customer Account 설계

작성일: 2026-10-17
상태: 코드 분석 완료, 작성된 설계의 사용자 검토 대기. 제품 코드 구현 전.
작업 위치: `/Users/nam9295/Desktop/john_2.0/code/au-cake-customer-account`
작업 브랜치: `feat/customer-account`
기준 커밋: `45971f4b53224a199513448128cf3d26543219f2`
실행 방식: Mac Codex 직접 구현. Hermes 이관 없음.

## 1. 확정된 목적과 경계

회원가입을 강제하지 않고 재방문 고객에게 Google OAuth2 또는 이메일 6자리 OTP 로그인을 제공한다. 가입/로그인을 한 화면으로 통합하고, 로그인 고객의 기본 정보를 다음 주문에 자동입력하며 `/account`에서 본인 주문을 조회한다. 비회원 주문과 예약번호+전화번호 조회는 유지한다.

사용자가 2026-10-17 추가 확인한 대로 일반 케이크·초콜릿, Custom Cake 요청, Kids Class 예약을 모두 포함한다. 닫힌 상품이나 Class 모집을 이 작업으로 다시 열지 않는다. 로그인한 상태에서 생성한 신규 기록부터 연결하고 과거 비회원 기록은 이메일·전화번호 일치 여부와 관계없이 연결하지 않는다.

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
| 기타 저장 경로 | `create-class`는 별도 Class collection, Custom Cake와 cake-order.v2는 private snapshots/claims 및 트랜잭션 | reservations 컬럼 하나만 추가하면 전체 범위를 충족하지 못한다 |
| 관리자 검사 | `repository.isAdminLoggedIn()`은 허용되지 않은 이메일의 정상 세션도 `deleteSession('current')`로 삭제 | 권한 확인은 읽기 동작으로 바꾸고 명시적 로그아웃만 세션을 삭제해야 한다 |
| 관리자 서버 권한 | `custom-cake-security.resolveCustomCakeAdmin`은 allowlist와 user JWT를 검증 | 일반 고객 세션이 생겨도 이 검사를 유지해야 한다 |
| 고객 정보 | 각 주문에 연락처 snapshot 저장, 별도 고객 프로필 없음 | Appwrite Preferences를 추가하고 과거 주문 snapshot은 변경하지 않는다 |
| 장바구니 | `CartProvider`가 일반/renewal 장바구니를 기존 localStorage에 저장 | 기존 저장 구조를 유지하고 인증 때문에 비우거나 새 ID로 바꾸지 않는다 |
| 기존 조회 | `LookupPage`는 기존 조회 API와 Custom Cake lookup을 사용 | 회원 조회 액션과 구분해 계약을 유지한다 |
| 스키마 setup | `setup-appwrite.mjs`는 collection 권한/다른 자원도 갱신 | 운영 마이그레이션에는 사용하지 않고 전용 additive 스크립트를 작성한다 |
| 테스트 | Node test runner, TS bundling/실제 UI 렌더링, Function SDK doubles, 브라우저 시나리오, 배포 아카이브 검사 | 같은 패턴으로 인증·소유권·실제 AU Checkout 회귀 검증을 추가한다 |

현재 worktree에는 dependencies를 설치하지 않았다. 이전 기준 검증은 1,771 pass, 0 fail, AU 모드의 KR 전용 검사 1 skip이며 그 검사는 KR 빌드 후 별도로 통과한 기록이다. 새 기능의 검증 결과로 이를 재사용하거나 주장하지 않는다.

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
- 공개 `customer-account-health`는 enabled/ready 여부만 반환하고 DB ID·권한 목록·사용자 정보를 노출하지 않는다. frontend는 이 readiness를 확인한 뒤에만 고객 인증을 시작한다. readiness는 세 저장 경로의 optional 소유권 schema/index와 아래의 DB 권한 경계를 모두 검사한다.
- 플래그가 꺼진 환경에서 고객 기능 때문에 Appwrite 인증 요청을 추가하지 않는다. `/account`는 noindex 비활성 안내와 기존 주문/조회 경로를 제공한다.
- 고객 provider는 확인 중/비회원/로그인/일시적 오류를 구분한다. Account.get()으로 복원하고 앱 재진입·focus·인증 API의 401에서 최신 상태를 확인한다. 네트워크 오류를 로그아웃 성공으로 처리하지 않는다.
- 로그인 화면은 Continue with Google, Continue with Email, Continue as Guest만 제공한다. OTP는 6자리 숫자, 진행 중 요청 잠금, 최신 요청만 반영, 만료/실패/429 안내와 60초 재전송 cooldown을 처리한다. Appwrite 서버의 email/IP rate limit이 최종 제한이며 UI cooldown을 보안 통제로 간주하지 않는다.
- 이메일 정규화 후 `ID.unique()`로 OTP를 요청하고 반드시 발송 응답의 userId로 세션을 생성한다. OTP secret/JWT/세션 정보를 URL·영구 저장소·analytics·로그에 저장하지 않는다.
- Google은 Appwrite OAuth2 session API를 사용한다. callback은 `/account/auth/callback`, 성공/실패와 관계없이 저장된 동일 출처 continuation으로 돌아갈 수 있다. return 경로를 허용된 AU 내부 주문/계정 경로로 제한하며 Appwrite의 OAuth state 검증을 대체하지 않는다.
- 기존 정상 세션이 있으면 새 로그인 시도를 시작하지 않고 계정 화면을 제공한다. 관리자 검사 실패나 계정 페이지 진입으로 세션을 삭제하지 않는다. 로그아웃은 사용자 동작으로만 수행하고 본인 주문의 메모리 캐시를 폐기한다.

## 6. 프로필과 폼 보존

고객용 새 table 없이 `Account.get()`과 Preferences의 `verygoodAuCustomer` namespace를 사용한다. 버전, 이름, 주문 연락 이메일, 호주 전화번호, 기본 언어를 저장하고 다른 preferences는 병합 보존한다. Google 이름/로그인 이메일은 저장된 프로필이 없을 때의 초기값이다.

로그인 이메일과 주문 연락 이메일을 구분한다. 로그인 principal의 이메일은 임의로 변경하지 않고 계정 화면에 읽기 전용으로 표시한다. 편집 가능한 프로필 이메일은 주문 연락 이메일이다. OTP/Google 계정에는 비밀번호를 요구하는 Account.updateEmail/updatePhone을 사용하지 않는다. 주문 소유권은 연락 이메일과 무관한 Appwrite `$id`다.

프로필 수정은 다음 주문의 기본값만 바꾼다. Checkout에서 바꾼 연락처를 자동으로 프로필에 저장하지 않으며, 과거 주문의 고객 snapshot도 갱신하지 않는다.

자동입력은 비어 있고 고객이 아직 건드리지 않은 필드에만 적용한다. 비동기 세션 복원, 프로필 갱신, 언어 변경, 로그인 후 callback으로 이미 작성한 값을 덮어쓰지 않는다. 수정/삭제한 연락처 필드의 dirty 상태도 복원한다.

Google로 이동하기 전에 주문 종류별 draft를 versioned sessionStorage에 저장한다. 유효기간은 30분이며 크기·타입·허용 경로를 검사하고 한번 소비한다. 저장할 수 없으면 이동 전에 안내하여 작성 중 폼을 잃지 않도록 한다. 세션 만료나 인증 실패에도 draft를 복원하고 비회원으로 계속할 수 있다.

보존 대상은 실제 AU Bag의 모든 form 값, 날짜/시간, requestId와 해당 장바구니의 제출 기준 snapshot이다. 기존 ReservePage의 product/options/orderLines/promo handoff 및 Custom Cake/Class의 작성 내용도 포함한다. CartProvider의 기존 storage와 ID는 변경하지 않는다. callback 복원만으로 새 requestId를 만들거나 장바구니를 제거하지 않는다. 주문 성공 시에만 해당 draft와 실제 제출한 cart line을 정리한다.

## 7. 서버 소유권 계약

고객 Auth 활성화 전 DB 권한 검증은 필수다. 현재 setup 소스는 관리자 ID 목록이 없을 때 `Role.users()`를 관리자 권한으로 fallback할 수 있고 direct 모드에서는 `create(Role.any())`를 허용한다. 이런 설정에서 단순히 고객 로그인을 추가하면 일반 고객이 DB를 직접 읽거나 임의 owner가 든 row를 생성할 수 있다. 실제 production collection 권한은 아직 인증된 조회로 확인하지 않았으며, 안전하다고 가정하지 않는다.

고객 기능 readiness/전용 migration 사전 검증은 세 source collection의 `documentSecurity=false`, optional owner schema/index 준비, 그리고 collection의 권한이 비어 있거나 명시적인 기존 관리자 user ID에만 제한됐음을 확인한다. `any`, `users`, guest 또는 allowlist 밖의 principal에 예약 read/create/update/delete가 열려 있으면 고객 기능을 비활성 상태로 유지하고 실패한다. frontend API 모드도 `all`이어야 한다. 기존 API key의 collection metadata read scope를 사용하므로 추가 권한 확대가 필요하지 않다. 고객 조회/회원 주문 연결 시 서버에서 이 조건을 다시 확인한다.

이번 additive migration은 발견한 기존 ACL을 자동으로 변경하지 않는다. 안전한 권한 상태가 아니면 production 활성화의 차단 사유로 보고하며, 권한 전환이 필요하면 대상·기존 비회원 경로·관리자 allowlist를 별도 검토/승인한다. Email OTP 활성화 자체도 이 권한 검증 이후에만 수행한다. 신규 설치 setup에서 고객 기능을 활성화하는 경우 관리자 ID 없는 broad fallback을 거부한다.

주문 body의 `customerUserId`, 이메일 일치 또는 클라이언트가 보낸 user 객체를 신뢰하지 않는다. 회원 연결 의도는 pricing/canonical payload와 분리된 transport envelope에서만 전달한다. 그 의도는 신원 증명이 아니며 서버에서 검증한 Account ID만 저장한다.

신규 회원 주문은 유효한 platform user JWT와 일치하는 user ID가 필요하다. 인증 정보가 일부만 있거나 잘못됐으면 회원 주문을 조용히 비회원으로 낮추지 않고 인증 오류로 처리한다. 폼을 유지하고 사용자가 비회원 진행을 선택할 수 있게 한다. 비회원 요청에는 소유권 필드를 기록하지 않는다.

일반/renewal 주문은 기존 `create-cake` 트랜잭션에서, Class는 기존 예약/slot 트랜잭션에서 optional `customerUserId`를 신규 row에만 기록한다. 기존 canonical/fingerprint/가격/쿠폰 재시도 계약에 고객 인증 상태를 섞지 않는다.

Custom Cake/cake-order.v2는 private snapshots의 top-level optional 소유권 metadata로 기록한다. 주문 request/creationResponse/quote/outbox payload에 고객 ID를 추가하지 않는다. snapshot 생성과 동일 트랜잭션에서 저장하고 mutation/replace에서는 최초 owner를 보존한다. owner가 없는 과거 snapshot도 수정 동작으로 새 owner를 얻지 않는다.

기존 requestId 재시도는 기존 owner를 유지한다. 비회원으로 생성된 주문을 로그인 뒤 재시도해도 owner를 추가하지 않는다. 이미 다른 사용자에게 연결된 requestId를 새 회원 주문으로 재사용하면 충돌을 반환한다. 쿠폰 commit reconciliation과 Custom Cake claims의 경쟁 경로에도 같은 조건을 적용한다.

## 8. MY ACCOUNT / MY ORDERS

`/account`에서 프로필, Upcoming Orders, Past Orders, 상세와 로그아웃을 제공한다. 헤더/모바일 메뉴는 로그인 상태에 따라 SIGN IN / ACCOUNT를 표시하고 기존 BAG/언어/메뉴 동작을 유지한다. 고객 화면에는 주문 수정·취소 버튼을 추가하지 않는다.

`customer-orders`는 source별 제한된 페이지를 조회하고 owner equality와 생성시각 정렬을 서버에서 고정한다. 클라이언트는 조회 대상 userId, 임의 DB query, collection ID를 지정할 수 없다. 페이지 크기는 source당 최대 25이고 source별 다음 cursor를 반환한다. cursor 문서도 본인 소유인지 검증한다. 전체 고객 기록을 스캔해서 브라우저에서 필터링하지 않는다.

`customer-order`는 종류와 해당 기록의 식별자만 받아 서버에서 다시 owner를 대조한다. 없는 주문, 소유권이 없는 주문, 다른 사용자 주문은 같은 NOT_FOUND 응답을 사용한다. 인증이 없으면 401이며 고객 읽기 응답은 모두 `Cache-Control: no-store`다.

상세는 기존 저장 주문 reader/가격 snapshot을 사용한 명시적 allowlist projection으로 반환한다. adminMemo, 내부 쿠폰/원장 ID, fingerprint, 사진 credential, Function key, audit/outbox 등 내부 필드는 제외한다. 고객 계정 조회를 기존 번호+전화 lookup의 지름길로 구현하지 않는다.

Upcoming/Past는 Australia/Sydney의 서비스 날짜와 완료/취소 상태를 기준으로 구분한다. Class의 패키지 예약은 남아 있는 advanced 일정도 고려한다. 화면에는 로딩·빈 목록·오류·세션 만료·추가 불러오기 상태를 EN/KO로 제공한다. 데이터는 현재 사용자 ID별 메모리 캐시로만 유지하고 계정 전환/로그아웃 때 폐기한다.

## 9. Additive 스키마와 배포 자원

새 고객 테이블과 새 Function은 필요 없다. 기존 `reservation-api`에 모듈/액션/변수와 배포 아카이브 manifest를 추가한다. 기존 Function의 runtime, execute roles, scopes, schedule, events와 다른 플래그는 유지한다.

| 저장 자원 | 추가만 허용하는 항목 |
| --- | --- |
| cake reservations | optional string `customerUserId`, size 36, required false; `customerUserId`/`$createdAt` 복합 key index |
| class reservations | 동일 optional 컬럼과 인덱스 |
| private custom snapshots | 동일 optional 컬럼과 인덱스; 기존 payload/schemaVersion/chunk/history 구조 유지 |

인덱스 이름은 `customerUser_created_idx`, attributes는 `[customerUserId, $createdAt]`, orders는 `[ASC, DESC]`다. 과거 데이터 backfill, required 변경, collection/document/storage 권한 갱신, 새 public ACL, 기존 인덱스 삭제는 하지 않는다.

전용 `scripts/migrate-customer-account-schema.mjs`와 schema contract를 작성한다. 기본 dry-run은 읽기만 수행하고 server-only endpoint/project/database/collection 매핑, AU 대상, 버전, 기존 정의와 권한을 검증한다. `--apply`일 때만 누락된 optional 컬럼/인덱스를 추가하고 bounded polling으로 available 상태를 확인한다. 이미 다른 정의가 있으면 덮어쓰지 않고 실패한다. 중간 실패 후 재실행은 idempotent하다. 실제 production 실행은 승인 후 별도 단계다.

신규 설치용 setup에는 동일 additive 정의를 반영하되 기존 setup 전체를 운영 migration에 사용하지 않는다. 스크립트/문서에는 비밀값이나 실제 고객 데이터를 추가하지 않는다.

## 10. 구현 파일 경계와 검토 단위

Frontend 신규 모듈은 `src/lib/customer-auth.ts`(SDK adapter), `customer-profile.ts`(프로필 계약), `customer-checkout-draft.ts`(복원 계약), `customer-orders.ts`(API/응답 파서), `src/CustomerAccountProvider.tsx`, `src/components/CustomerSignInDialog.tsx`, `src/pages/AccountPage.tsx`, `src/styles/customer-account.css`로 나눈다. 기존 Appwrite 설정, route/SEO/static generation, main provider, AuNavigation과 각 실제 주문 폼에 연결한다.

Backend는 reservation-api 내부의 `customer-identity.js`와 `customer-orders.js`에 새 책임을 분리하고 기존 main/Custom Cake persistence/workflow에는 연결에 필요한 최소 변경만 한다. 공통 주문 core/가격 정책은 리팩터링하지 않는다.

각 검토 단위는 별도 커밋으로 남긴다: 분석·설계 → 플래그/계약/테스트 도구 → 고객 상태와 로그인 UI → Google/OTP adapter → 프로필과 폼 복원/자동입력 → 서버 소유권/마이그레이션 → 내 주문 API → 계정 화면 → 관리자 충돌 수정 → 전체 회귀 검증/배포 문서. 각 제품 기능 단위에서 실패 테스트를 확인한 후 구현한다. 새 기능은 플래그 기본 off인 상태로 통합한다.

## 11. 검증 기준

- OTP 신규/기존 계정, 6자리 입력, 실패/만료/429/재전송 cooldown/중복 요청/늦게 도착한 응답, 복원/로그아웃/계정 전환을 검증한다.
- 실제 SDK가 보내는 endpoint/body를 로컬 HTTP 서버에서 검증한다. Google→OTP 및 OTP→Google의 동일 이메일은 별도 격리 Appwrite 프로젝트에서 동일 `$id`와 기존 owner 유지까지 확인한다. 서로 다른 이메일/기존 세션/동시 첫 로그인 충돌도 포함한다. mock 검증을 실제 provider 검증으로 보고하지 않는다.
- 두 사용자와 guest fixture로 목록/상세/커서/위조 body·headers·JWT·이메일/플래그 off/직접 DB 거절/기존 비회원 재시도 미귀속을 검증한다. broad read/write ACL, direct mode, documentSecurity=true, 누락된 owner schema/index에서 인증/회원 연결이 열리지 않는지 검증한다. 각 신규 주문 종류의 원자적 owner 저장과 경쟁/쿠폰 reconciliation을 포함한다.
- 실제 AU Bag, 기존 예약, Custom Cake, Class 폼의 입력/동의/쿠폰/옵션/requestId/장바구니가 OTP와 Google 성공·실패 후 보존되는지 검증한다. 비동기 자동입력이 dirty 값을 덮어쓰지 않는지 확인한다.
- 기존 번호+전화 조회, 관리자 Google/비밀번호/allowlist/서버 권한, 가격·결제·쿠폰·메일·reminder·출고 reader·배포 아카이브를 회귀 검증한다.
- mobile Chromium/WebKit와 Safari/Chrome의 확인 범위를 분리 기록한다. 로컬 WebKit emulation을 실제 iOS Safari 기기 검사로 보고하지 않는다.
- lint, TypeScript, AU/KR build, 전체 npm test를 최종 커밋에서 실행한다. 이전 1,771 pass 기준에 새 실패가 없어야 하며 조건부 skip과 미실행 외부 통합 검사를 따로 보고한다.

## 12. Production 적용 및 rollback 순서

1. 로컬 구현/테스트/검토를 마치고 변경 파일·커밋·마이그레이션 dry-run 계획·남은 외부 검증을 보고한다. 이 단계에서 배포 승인 요청을 별도로 한다.
2. 승인 후 지정된 격리 환경에서 SMTP/Email OTP/Google redirect, 공급자 간 동일 사용자 ID, 세션 쿠키와 실제 JWT Functions 실행을 확인한다. production 고객으로 시험하지 않는다.
3. 승인된 production 대상의 기존 권한/플래그/배포 checkpoint를 기록하고 전용 migration dry-run을 검토한다. 별도 승인 범위에서 additive schema를 적용하고 available을 확인한다.
4. 기능 플래그 off로 호환 backend를 배포하고 guest/기존 stored-order readers를 검증한다. 이후 승인된 계정 플래그와 frontend를 단계적으로 활성화한다. 기존 예약·쿠폰·결제·메일을 변경하는 smoke는 별도 승인 없이는 실행하지 않는다.
5. 장애 시 고객 frontend 플래그를 끄고 고객 backend 플래그를 끈다. 기존 비회원 주문/조회와 관리자 기능을 검증한다. 필요 시 검증된 호환 코드 checkpoint로만 되돌린다. owner 컬럼/인덱스/기존 owner 값/preferences/계정/원장/고객 기록을 삭제하거나 backfill하지 않는다.

## 13. 현재 완료 범위와 다음 게이트

이 문서는 실제 코드와 공식 1.8.1 소스 분석에 기반한 설계이며 제품 구현 완료 보고가 아니다. 현재까지 소스·의존성·스키마·운영 설정은 변경하지 않았다. SMTP/Google 제공자 실제 인증, 격리 환경 공급자 간 ID 재사용, 모바일 브라우저와 새 코드 전체 테스트는 구현 후 검증 대상이다.

현재 적용 중인 brainstorming 절차는 작성된 설계 검토 승인을 요구한다. 이 문서 승인 후 writing-plans 절차로 상세 구현 계획을 작성하고 그 계획을 검토받는다. 실행 방식은 이미 정해진 Mac Codex 직접 구현을 유지한다. 설계/계획 승인은 production 배포 승인을 포함하지 않는다.
