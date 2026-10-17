# VERYGOOD AU Customer Account — 배포 및 복구 절차

2026-10-17. 이 문서는 향후 승인된 작업을 위한 절차다. 현재 작업은 `feat/customer-account`의 로컬 구현·Mock 검증까지이며, 실제 Appwrite metadata 조회/dry-run/apply, Function·사이트 배포, 공급자 설정, 운영 데이터 변경 및 main 병합을 실행하지 않았다. 기능은 기본 OFF다. [검증 기록](customer-account-validation.md), [개인정보 절차](customer-account-privacy.md), [승인 설계](superpowers/specs/2026-10-17-customer-account-design.md)를 함께 검토한다.

## 후속 안정화 배포 gate

main의 주말 13:00 정책 통합, profile focus 보존과 Node 22/24 로컬 검증은 [안정화 기록](customer-account-stabilization.md)에 추가했다. 운영 배포 전에는 해당 문서의 **sharp Function 위험 대응**, 실제 target runtime(Review node-22 및 기존 reservation 배포 gate 구분), Linux native codec·공급자/ACL/실기기 검증을 확인한다. root production audit 0이나 Mac Node 22 통과만으로 gate를 해제하지 않는다. 실제 프로젝트/리소스·설정·권한 변경은 별도 승인 대상이다.

## 적용 리소스와 설정

| 위치 | 필요한 변경 / 유지할 조건 |
| --- | --- |
| AU frontend | `VITE_MARKET=AU`, 기존 endpoint/project/resource 매핑, `VITE_RESERVATION_API_MODE=all`, 기존 `VITE_RESERVATION_API_FUNCTION_ID`; `VITE_CUSTOMER_ACCOUNT_ENABLED=false`가 기본값이다. 활성화는 별도 승인 후 `true` 빌드로 한다. KR에는 계정 경로가 없다. |
| 기존 reservation-api | 신규 모듈을 포함한 호환 archive. `CUSTOMER_ACCOUNT_ENABLED=false` 기본값. 기존 Function ID/runtime/execute roles/API key scopes, 쿠폰·메일·판매 플래그를 유지한다. 새 Function이나 고객 테이블은 만들지 않는다. |
| ACL 검증 | 기존 `APPWRITE_ADMIN_USER_IDS`를 schema 관리자 ID allowlist로 사용한다. `REVIEW_ADMIN_USER_IDS`는 기존 관리자 API 권한용으로 유지한다. 둘을 임의 대체하거나 권한을 확대하지 않는다. 두 설정의 실제 관리자 구성을 운영자가 대조한다. |
| reservations만 | optional string `customerUserId`, size 36, required false, 기본값 없음. `customerUser_created_idx`: key, `[customerUserId,$createdAt]`, `[ASC,DESC]`. 기존 데이터 backfill·ACL 변경 없음. |
| 기존 private 자원 | cake/class 예약, review/coupon/mail ledgers, 구성된 private Custom Cake 자원은 metadata 권한만 확인한다. 회원 연동·새 owner schema를 만들지 않는다. 미분류 DB/collection, 불완전 inventory, broad private ACL은 활성화를 차단한다. |
| 공개 설정·달력 | settings, cake pickup openings, class booked dates의 공개 read는 허용하되 일반 사용자 write 또는 documentSecurity 활성 상태는 거부한다. 실제 ACL이 맞지 않으면 OFF로 두고 원인을 보고한다. 자동 수정하지 않는다. |
| Account | Appwrite Account 및 Preferences의 `verygoodAuCustomer` namespace. 이름, 주문 연락 이메일, AU 휴대전화, 언어. 로그인 이메일은 별도이며 수정하지 않는다. 다른 prefs 보존. |
| 공급자 | Appwrite 1.8.1의 Google OAuth2 및 Email OTP 활성화, 승인된 Google test/production 클라이언트와 정확한 redirect URI, SMTP와 발신 도메인, Appwrite Web platform 등록 및 세션 cookie 정책 확인. 이번 작업에서 변경하지 않았다. |

서버 매핑은 `.env.example`과 `resolveCustomerAccountResources()`를 따른다. `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, server-only `APPWRITE_API_KEY`, cake/kids database·collection IDs, 기존 review/mail/custom 매핑을 승인된 대상으로 정확히 준비한다. 사용자 ID/키/실제 고객정보를 보고서·명령행 기록·브라우저 변수에 넣지 않는다. 신규 secret이나 API key scope 확대는 이 절차의 전제가 아니다. 현재 권한으로 metadata를 볼 수 없으면 활성화를 보류한다.

## 격리 환경의 필수 gate

전용 nonproduction Appwrite 1.8.1 project, SMTP 수신함, Google test users를 운영 리소스와 구분해 승인받아 준비한다. 테스트 실행 설정에서 운영 host/project를 거부하고, 실제 대상·버전·인증정보 주입 경로를 사람이 확인한다. 해당 환경은 제공되지 않아 아래 항목은 미실행이다.

1. Google → logout → 같은 이메일 OTP, OTP → logout → 같은 이메일 Google에서 `$id`와 신규 주문 소유권이 동일한지 확인한다. 기존 계정·다른 이메일·동시 최초 로그인·남아 있는 관리자/고객 세션도 확인한다. 공급자 동작이 다르면 활성화를 중단한다. 이메일을 이용한 주문 재귀속으로 보완하지 않는다.
2. 실제 OTP 신규/재로그인, 6자리 검증, 만료·재전송·429·SMTP 오류, Google 성공/취소/실패, blocked/deleted account, 세션 만료/로그아웃/재방문을 검증한다. cookie 제한과 Safari의 실제 동작을 포함한다.
3. 실제 Functions 실행의 platform ID/JWT를 JWT-only Account.get으로 검증하고, 위조 header/body/만료 JWT·A→B detail/cursor 요청을 거부하는지 확인한다. 게스트·일반 고객이 DB에 직접 예약/관리자 데이터를 읽거나 쓰지 못하는지도 확인한다.
4. 동시 requestId 재시도, 쿠폰 transaction/claim/reconciliation 경로, tied timestamp pagination, frozen 저장 주문의 가격·연락처, 관리자 Google/비밀번호 권한, 기존 guest lookup과 알림을 격리 데이터로 확인한다.
5. 실제 iPhone Safari/Android Chrome에서 360/390/768/1440px의 대응 화면과 Google 왕복 후 폼·카트·날짜·옵션·쿠폰·requestId·다른 탭 변경을 검증한다. 로컬 Chrome/WebKit Mock 결과는 실제 공급자/실기기 검증을 대체하지 않는다.

## 전용 additive migration

아래는 **미래 승인 후** 실행할 명령이다. 실제 대상에 대한 dry-run도 이번 작업에서는 실행하지 않았다. `npm run setup:appwrite` 전체를 운영 migration으로 사용하지 않는다.

사전에 shell 환경을 승인된 target으로 준비한다. 스크립트는 dotenv를 자동 로드하지 않는다. `CUSTOMER_ACCOUNT_MIGRATION_MARKET=AU`, HTTPS `/v1` endpoint, project ID, server key, 정확한 자원 매핑과 `APPWRITE_ADMIN_USER_IDS`가 필요하다. localhost/self-signed 우회나 redirect를 허용하지 않는다. 설정/권한 문제는 운영자 검토 후 별도 승인으로 해결한다.

```sh
node scripts/migrate-customer-account-schema.mjs --dry-run
```

GET-only로 버전 1.8.1, DB/collection inventory·ACL 및 기존 owner/index 정의를 검사한다. 출력 `changes`는 reservations의 누락 attribute/index만 나타낸다. `ready`는 두 정의가 모두 `available`일 때만 true다. `changes: []`라도 `processing`이면 준비 완료가 아니다. 값·타입·정렬·암호화·권한 불일치는 실패한다. `ready: true`는 공급자·전체 배포 준비 완료를 의미하지 않는다.

dry-run의 대상·결과와 기존 ACL/checkpoint를 검토한 후 **apply 승인을 별도로 받은 경우에만**:

```sh
node scripts/migrate-customer-account-schema.mjs --apply
node scripts/migrate-customer-account-schema.mjs --dry-run
```

누락 항목만 생성하며 각 status를 최대 30회, 1초 간격으로 기다린다. 실패/timeout 시 OFF를 유지한다. 이미 생성된 optional attribute는 삭제하지 않는다. 원인을 확인한 뒤 동일 전용 migration을 재실행한다. 주문·owner·기존 스키마·권한을 변경하거나 되돌리는 작업은 없다.

## Production 적용 순서 — 실행 전 별도 승인

1. 최종 커밋·diff·로컬/격리/실기기 결과, 실제 대상·관리자 IDs·ACL, migration dry-run, 보존 정책을 제출한다. 운영 배포·설정·거래성 smoke의 범위를 각각 승인받는다. 기존 frontend/backend deployment 및 변수·schema/ACL checkpoint를 안전하게 보관한다.
2. 승인된 전용 migration을 적용하고 `available`, ACL 불변, guest 원장 불변을 확인한다. 예기치 않은 자원이 있으면 활성화하지 않는다.
3. 호환 reservation-api를 customer flag OFF로 배포한다. guest create/lookup, 관리자 권한, 기존 reader·쿠폰·결제·메일을 승인된 데이터와 범위로 검증한다. frozen Custom/Class reader 및 판매 정책 플래그를 유지한다.
4. callback 복원 코드를 포함한 AU frontend를 customer flag OFF로 배포한다. `/account`와 `/account/auth/callback` direct load·noindex, 기존 hard 404와 카트 복원을 확인한다. 민감 페이지는 analytics/공개 sitemap에서 제외한다.
5. 격리 gate와 운영 검토가 모두 완료된 뒤 서버 flag를 ON, health ready를 확인하고 frontend flag ON 빌드를 순차 적용한다. Appwrite 변수 변경이 deployment 재생성을 요구하는 경우에도 별도 배포 승인과 checkpoint를 남긴다. 관리자/고객 전환·guest fallback과 오류율을 확인한다.

## 즉시 rollback

1. AU frontend를 `VITE_CUSTOMER_ACCOUNT_ENABLED=false`로 전환한 호환 빌드를 적용해 새로운 고객 인증 진입을 중단한다. 이어서 reservation-api의 `CUSTOMER_ACCOUNT_ENABLED=false`를 적용한다. 각 실제 배포·변수 변경에는 승인이 필요하다.
2. OAuth 진행 중인 탭을 위해 callback 및 checkout 복원을 포함한 버전을 유지한다. draft 유효기간은 30분이다. 플래그 OFF에서도 같은 탭의 저장 form/cart/coupon/requestId로 guest 제출이 가능하다. callback 없는 옛 frontend로 즉시 복귀하지 않는다.
3. 필요하면 저장 형식·coupon claim·알림·frozen reader·callback과 호환되는 검증된 deployment checkpoint만 사용한다. frontend/backend를 무조건 과거 SHA로 되돌리지 않는다.
4. optional owner attribute/index, 계정/preferences, 주문·원장·기존 ownership을 보존한다. rollback은 데이터 삭제·owner 수정·guest backfill·schema 삭제·권한 공개를 포함하지 않는다.
5. guest 생성과 예약번호+전화번호 조회, 관리자 권한, 카트·폼 보존을 확인한다. 쿠폰/결제/메일 등 실제 거래·알림을 일으키는 smoke는 승인된 범위에서만 수행한다. 인증만 장애인 경우 guest 경로는 account readiness와 독립적이다. Appwrite/DB 전체 장애를 우회하는 새 저장소는 없으며 기존 오류 안내와 카트/requestId를 유지한다.

계정 삭제는 rollback과 별개이며 [개인정보 처리 절차](customer-account-privacy.md)를 따른다. 로그인 고객에게 기존 비회원 주문을 자동 연결하거나, 이메일 일치로 이전 소유권을 복구하지 않는다.
