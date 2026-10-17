# Customer Account B2 — 로컬 보호장치 및 자원 생성 승인안

> 실행 상태: 승인된 manifest는 변경하지 않았으며, 공식 Owner 경로의 [B2 최종 실행 결과](customer-account-b2-owner-execution.md)를 참조한다. 아래는 승인 당시의 자원/권한 명세다.

2026-10-17 KST. 승인 worktree `au-cake-customer-account`, branch `feat/customer-account`. 시작 HEAD `c1573545fd14fb615d93cd17027528b26969c6d7`는 clean이었다. Mac Codex가 단독으로 진행했다.

**현재 완료 범위는 로컬 코드·테스트·offline dry-run이다. 실제 Key/사용자/DB/Collection 생성과 migration apply는 승인 대기다.** [B안 계획](superpowers/plans/2026-10-17-customer-account-very-server-test.md)의 B2 전체 완료 또는 실제 인증 검증 완료를 의미하지 않는다.

## 대상과 현재 상태

기존 Owner 세션으로 정식 Console Settings에서 다음 값을 직접 확인했다. 새 Owner/조직 역할을 추가하지 않았다.

- Endpoint: `https://api.verygood-chocolate.com/v1`
- Project ID: `verygood-au-account-test`
- Name: `VERYGOOD AU Customer Account TEST`
- Account: **OFF**. Settings의 마지막 수정 시각은 B1의 Oct 17, 21:05 그대로다.
- Auth: `Create your first user` 상태다. Create user 폼을 읽기 전용으로 확인하고 Cancel했다. email/phone/password가 optional이며 custom UID를 지정할 수 있다.

이번 실행의 원격 동작은 테스트 Console 조회뿐이다. Key 발급, 자원 생성, 운영 project 조회·변경, 고객 데이터 읽기·복사, 서비스 재시작, Function 배포, SMTP/Google 설정, 이메일 발송은 수행하지 않았다. B1의 자원 수를 이번 실행에서 전체 재감사한 것으로 표현하지 않는다. 실제 생성 직전에 다시 inventory를 확인한다.

## 구현한 보호장치

- `scripts/customer-account-test-target.mjs`: endpoint 문자열과 project ID가 정확히 일치해야 한다. trailing slash, 명시적 port, userinfo, query/hash, 다른 host도 거부한다. allowlist 밖의 모든 project를 거부하므로 기존 네 운영 ID도 모두 차단된다.
- 허용 DB는 `ca_test_cake_au`, `ca_test_kids_au`뿐이며 Collection을 DB에 묶어 검사한다. 혼합 운영 DB, 중복 ID, Custom 저장소, 잘못된 DB/Collection 조합은 실패한다.
- Function identity allowlist는 후속 B6 후보 `ca-test-reservation-api` 하나다. **이번 seed는 functionIds가 빈 배열이어야 하며 Function 생성·실행·배포는 없다.** `reservation-api`, `review-api`, `ca-test-review-api` 등은 거부한다.
- metadata transport는 승인된 schema GET만 허용한다. document/users/account/Function 경로, POST/PATCH/PUT/DELETE는 전부 거부한다. project/key header 충돌도 덮어쓰지 않고 network 전에 거부한다. redirect는 `error`이고 3xx·redirected 응답도 실패한다.
- Key의 Console 소속 확인, key ID, 정확한 scope set, 발급 시각, 유효기간을 검증한다. 소속이 미확인인 key는 network 0회다. **이 provenance는 관리자가 Console에서 확인한 사실에 대한 입력이며 secret의 소속을 암호학적으로 판별하는 기능은 아니다.** 운영 project에 key를 넣어 시험하지 않는다.
- `.env` 파일을 읽거나 process.env의 target/key/admin/resource 값을 가져오지 않는다. seed CLI는 명시적인 네 인자를 요구한다. 운영 env가 있는 subprocess에서도 명시 입력만 사용함을 검증했다.
- seed는 create 대상의 불변 계획만 만든다. **CLI의 `--apply`는 실패하며 실제 생성 기능은 아직 없다.** 전체 setup script를 import/실행하지 않는다. 이 단계에서 원격 쓰기 경로가 없고, invalid target 테스트의 operation/network 호출은 0회다.

테스트에서는 전송 경계만 가짜 transport로 대체했다. 실제 guard·schema builder·readiness·Renewal storage builder·CLI subprocess를 사용했다. 로컬 Mock pass는 Appwrite 실제 API 성공을 뜻하지 않는다.

## 승인 요청하는 생성 목록

정확한 전체 필드 정의는 [resource manifest](customer-account-b2-resource-manifest.json)에 있다. Attribute의 key/type/size/required/min/max/elements/default, Index의 type/attributes/orders, 각 ACL과 settings 내용까지 포함한다. 무기명 운영 export가 아니라 현재 저장소의 declarative schema를 사용했다.

Manifest SHA-256: `75e18834d1020a0279946169ddc3e9c9d1e58684c76104a6738d92c559f8ef94`

| DB ID | 이름 | Collection 수 |
| --- | --- | ---: |
| `ca_test_cake_au` | CA TEST Cake AU | 10 |
| `ca_test_kids_au` | CA TEST Kids baseline AU | 2 |

두 DB는 enabled=true다. `kids`의 빈 2개 Collection은 현재 readiness의 전체 inventory 계약에 필요하다. Kids Class의 회원 연동·owner 필드·예약 fixture·폼 복원은 추가하지 않는다. Custom Cake DB/Collection은 만들지 않는다. 실제 일반 Renewal 주문은 `au-renewal-storage.js` → `reservations` 경로를 사용한다.

기본 schema는 **Collection 12개 / Attribute 181개 / Index 37개**다. 소유권 migration은 별도로 Attribute 1개 / Index 1개를 추가해 최종 **182 / 38**이 된다.

ACL 약어: M은 아래의 테스트 Auth UID, CRUD=create/read/update/delete, RUD=read/update/delete다. 모든 Collection은 **enabled=true, documentSecurity=false**다. 일반 고객의 직접 private DB 권한은 없다. API key는 scope로 접근하므로 ACL만으로 Key를 제한할 수 없으며 test project·최소 scope·만료·guard를 함께 사용한다.

| DB | Collection ID | Attribute | Index (type/columns/order는 manifest) | ACL |
| --- | --- | ---: | --- | --- |
| `ca_test_cake_au` | `reservations` | 38 | `reservationNumber_idx`, `pickupDate_idx`, `status_idx`, `status_pickupDate_idx`, `paymentStatus_idx`, `cacaoPercent_idx`, `createdAt_idx` | M:CRUD |
| `ca_test_cake_au` | `cake_pickup_openings` | 3 | `pickupSlot_unique`, `pickupDate_idx` | any:R + M:CUD |
| `ca_test_cake_au` | `settings` | 13 | 없음 | any:R + M:CUD |
| `ca_test_cake_au` | `review_invites` | 15 | `tokenHash_unique`, `sourceReservation_unique` | [] (Function-only) |
| `ca_test_cake_au` | `reviews` | 14 | `sourceReservation_unique`, `moderationStatus_idx`, `createdAt_idx`, `sourceType_idx`, `public_reviews_idx` | M:RUD |
| `ca_test_cake_au` | `review_coupons` | 14 | `codeHash_unique`, `sourceReview_unique`, `status_idx`, `expiresAt_idx` | M:RUD |
| `ca_test_cake_au` | `manual_coupons` | 9 | `codeHash_unique`, `status_idx`, `expiresAt_idx` | M:RUD |
| `ca_test_cake_au` | `review_photo_cleanup` | 7 | `fileId_unique`, `status_createdAt_idx` | M:RUD |
| `ca_test_cake_au` | `email_deliveries` | 15 | `eventKey_unique` | [] (Function-only) |
| `ca_test_cake_au` | `email_delivery_retry_claims` | 11 | `eventKey_unique` | [] (Function-only) |
| `ca_test_kids_au` | `class_reservations` | 38 | `reservationNumber_idx`, `classDate_idx`, `advancedClassDate_idx`, `status_idx`, `status_classDate_idx`, `status_advancedClassDate_idx`, `paymentStatus_idx`, `createdAt_idx` | M:CRUD |
| `ca_test_kids_au` | `class_booked_dates` | 4 | `classSlot_unique`, `classDate_idx` | any:R + M:CUD |

`customerUserId`는 baseline에 넣지 않는다. `ca_test_cake_au/reservations`에만 optional string(size=36, required=false, array=false, default 없음)을 migration으로 추가한다. `customerUser_created_idx`는 key, columns=`customerUserId,$createdAt`, orders=`ASC,DESC`다. 기존 document 갱신/과거 guest backfill은 없다.

Bucket, Function, platform, provider, project variable, schedule, notification 자원은 **0개** 생성한다. 기존 AU 프로젝트 전체 setup/clone은 사용하지 않는다.

## 관리자 M과 ACL 준비

승인 후보 UID는 **`ca-test-admin-m-20261017`**다. 아직 존재하는 사용자로 보고하지 않는다.

1. 생성 직전 Console의 test project ID·Account OFF·UID 부재를 확인한다.
2. 기존 Owner 세션 → test Auth → Create user에서 Name `CA TEST Admin M`, 위 custom UID만 지정한다. email/phone/password는 비운다. 이 폼의 optional/custom UID 지원은 이번에 확인했다. 토큰·세션 생성, 이메일 발송, 인증 활성화는 하지 않는다.
3. 생성 후 test 사용자 UID를 재확인한다. 조직/Console Owner나 team member로 추가하지 않는다. 운영 관리자 UID를 읽거나 복사하지 않는다.
4. 이 UID만 test schema의 `APPWRITE_ADMIN_USER_IDS`와 향후 test Function의 `REVIEW_ADMIN_USER_IDS`로 사용한다. 두 기존 변수의 역할은 유지한다. manifest의 env는 향후 명시 입력안이며 remote 변수는 설정하지 않았다.
5. B3/B7에서 실제 관리자 로그인 검증을 하려면 승인된 테스트 inbox를 M에 연결하는 별도 준비가 필요하다. 비밀번호 입력이 필요하면 사용자가 직접 입력한다. 지금은 로그인 불가능한 ACL 전용 synthetic UID만 제안한다.

이는 테스트 프로젝트 안의 앱 관리자 역할이며 기존 Console Owner/운영 프로젝트 권한 확대가 아니다. UID가 다르거나 충돌하면 기존 사용자를 재사용/수정하지 않고 중단한다.

## API Key: 정확한 scope와 만료 정책

Appwrite **1.8.1**의 [공식 scope 정의](https://github.com/appwrite/appwrite/blob/1.8.1/app/config/scopes.php)와 [key expire API](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/projects.php)를 기준으로 정했다. 최신 Cloud의 keys.write/ephemeral 예제를 1.8.1에 적용하지 않는다. `/health/version`은 [1.8.1 public endpoint](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/health.php)이므로 health.read는 추가하지 않는다.

| Key 이름 | 정확한 scopes | 만료 |
| --- | --- | --- |
| `ca-test-metadata-20261017-b2` | `databases.read`, `collections.read`, `attributes.read`, `indexes.read` | 발급 시각 + 최대 24시간 |
| `ca-test-bootstrap-20261017-b2` | 위 4개 + `databases.write`, `collections.write`, `attributes.write`, `indexes.write` | 발급 시각 + 최대 2시간 |
| `ca-test-fixtures-20261017-b2` | `documents.read`, `documents.write` | 발급 시각 + 최대 2시간 |

기존 Owner가 test Console에서 3개만 발급하는 안이다. 정확한 key ID와 ISO 8601 expiry는 발급 시점에 확인해 private run 기록에 남기며, 무기한/null expiry는 금지한다. users/sessions/teams/keys/projects/buckets/files/functions/execution/messages/provider 권한은 부여하지 않는다. M은 Console에서 준비하므로 users.write Key가 필요 없다. B6 deploy Key는 지금 발급하지 않는다.

Appwrite scope는 project 수준이며 특정 DB/Collection의 create만 허용하는 capability가 아니다. bootstrap/documents.write에는 update/delete 능력도 포함되므로 사용자에게 승인받은 생성 목록 외에는 사용하지 않는다. 현재 로컬 helper에는 apply가 없으며, 승인 후 생성 경로에도 동일한 guard와 전체 계획 검증을 먼저 적용해야 한다.

secret은 Console에서 소속을 확인한 뒤 접근 제한된 로컬 private 기록(디렉터리 0700/파일 0600, 저장소 밖 또는 Git 제외)에만 보관한다. 명령행 인자, Git, 보고서, trace, Function/frontend env 자동 상속에 넣지 않는다. private credential metadata는 endpoint/project/keyId/scopes/issuedAt/expiresAt/Console 확인 여부만 기록한다. key 식별자와 secret을 수동으로 잘못 결합할 위험이 있어 발급 직후 한 쌍으로 보관하고, 불명확하면 사용하지 않는다. 유출·작업 중단 시 해당 test key만 취소하는 별도 승인된 복구를 수행하며 운영 Key는 건드리지 않는다.

## 합성 데이터 범위

B2에서 실제로 만들도록 제안하는 데이터는 다음 **2건**뿐이다.

- Auth M 1명: 위 예약 UID/이름만. 로그인 식별자·credential·session 없음.
- settings document 1건: `ca_test_cake_au/settings/ca-settings-20261017-b2`. 전체 13필드는 manifest에 있다. bankName=`TEST ONLY`, bankAccount=`TEST ONLY - DO NOT PAY`, accountHolder=`CA TEST` 등이며 실제 계좌·주소·고객 연락처를 복사하지 않는다. price=45와 시간 필드는 기존 AU baseline 계약을 유지하며 운영 가격/판매 설정은 바꾸지 않는다.

reservations, class_reservations, pickup openings, booked dates, 리뷰·쿠폰·메일 ledger의 document는 모두 **0건**이다. owner가 들어간 주문을 직접 seed하여 서버 소유권 검증을 통과한 것처럼 만들지 않는다. 상품/판매/미확정 가격 활성화도 없다.

후속 B3/B7 승인 때 사용할 합성 시나리오는 다음과 같이 예약한다. 실제 inbox 주소는 소유자가 제공·승인할 때 확정하며 `.invalid` 주소로 OTP를 보내지 않는다.

| 계정/주문 | 후속 테스트 자료와 생성 경로 |
| --- | --- |
| G1/A | 승인 inbox의 새 Google 계정 → OTP 전환, 같은 UID. 로그인 이메일과 다른 주문 contactEmail 사용 |
| E1 | 다른 승인 inbox의 새 OTP 계정 → Google 전환, 같은 UID |
| B | 다른 고객 inbox/UID. A와 다른 개인 주문을 만들어 상호 조회 거부 확인 |
| M | B2 예약 UID에 승인된 test 이메일/로그인 방법을 준비한 뒤 앱 관리자 로그인 회귀 |
| A-upcoming | 일반 Pavé cake 8in 1개, 실제 로그인 JWT + reservation-api. run별 UUID requestId |
| A-chocolate | almond-chocoball-80g 1개, 같은 경로. 테스트 내 과거 주문 분류는 별도 승인된 synthetic 관리자 처리로 준비하며 과거 날짜 신규 주문을 API에 강제로 통과시키지 않음 |
| B-order | 별도 JWT로 일반 상품 주문 1건. A의 상세 조회는 404, B만 조회 |
| Guest-order | A와 같은 합성 연락 이메일/전화번호로 비로그인 주문 1건. owner 없음, A 로그인 후에도 자동 귀속 0 |
| 재시도/쿠폰 | 동일 requestId 재요청과 합성 5% 쿠폰의 단일 사용. 코드/암호화 key는 후속 test 전용으로 준비하고 실제 결제·알림 provider는 사용하지 않음 |

주문은 통합 시점의 유효한 미래 pickup 날짜·정책/옵션·현재 판매 중 상품만 사용한다. 위 시나리오는 **B2 생성 승인 대상이 아니며** 실제 공급자·서버 인증은 미검증이다.

## 실행 순서와 migration 경계

승인 전 재현 가능한 offline 명령(네 인자 모두 명시):

```sh
node scripts/seed-customer-account-test-project.mjs \
  --endpoint https://api.verygood-chocolate.com/v1 \
  --project-id verygood-au-account-test \
  --admin-user-id ca-test-admin-m-20261017 \
  --run-id 20261017-b2 --dry-run
```

이 명령은 네트워크·파일 쓰기·Key를 사용하지 않고 stdout으로 manifest를 반환한다. `--apply`는 사용할 수 없다.

다음 생성 승인을 받은 후의 순서:

1. Git/Console Owner·Settings exact pair·Account OFF, test 빈 inventory·기존 project 구성 metadata 불변·서버 자원 여유를 실행 직전에 확인한다. 고객 rows는 조회하지 않는다. 기존 자원/UID나 drift가 있으면 overwrite하지 않고 중단한다.
2. 승인된 M UID를 생성/확인하고 위 3개 Key를 test project에 발급한다. private 발급 metadata와 실제 scope/expiry·manifest digest를 확인한다. 운영 Key는 읽거나 사용하지 않는다.
3. 승인받은 manifest만 쓰는 생성 adapter에 target/resource/credential guard와 create-only 전체 사전 검증을 적용한 뒤 로컬 테스트한다. 현재 offline helper에 무조건적인 apply를 추가하거나 전체 setup을 호출하지 않는다. Console의 직접 생성도 정확한 test ID 안에서만 수행한다.
4. DB 2개 → 12개 Collection 및 정확한 ACL → baseline Attribute 181개 → 모두 available 확인 → Index 37개 → available 확인 → 합성 settings 1건 순서다. 실패/409/예상 밖 자원은 중단하며 업데이트·삭제·덮어쓰기·자동 retry apply는 하지 않는다.
5. `migrate-customer-account-schema.mjs`의 `runCustomerAccountMigration({env: manifest.env, client})`를 재사용한다. env는 manifest에서 새로 만들고 key만 명시적으로 넣는다. `createCustomerMigrationClient`의 transport에 `createCustomerAccountTestMetadataTransport`를 결합해 **GET-only remote dry-run**을 수행한다. 현재 generic migration CLI를 운영 `.env`가 있는 shell에서 그대로 실행하지 않는다.
6. remote dry-run 예상 결과는 ownershipTarget=`ca_test_cake_au/reservations`, missing attribute/index 2개, ready=false다. 전체 classified inventory/ACL과 Appwrite 1.8.1을 확인한다. 실제 GET dry-run은 Key 미발급으로 아직 미실행이다.
7. **명시적인 test owner migration apply 승인까지 받은 경우에만**, 동일 guard로 제한한 write adapter로 `customerUserId` 1개 → available → `customerUser_created_idx` 1개 → available 순서의 additive apply를 한다. 현재 read-only transport는 POST를 차단하므로 write adapter가 별도로 검증되기 전 apply할 수 없다. 새 테스트 namespace만 대상으로 하며 기존 주문 데이터는 읽거나 변경하지 않는다.
8. read-only 검증으로 2 DB/12 collections/최종182 attributes/38 indexes/정확 ACL, document 수 1(settings), M 1, Account OFF, flags 기본 OFF를 확인한다. 기존 운영 metadata 불변·서버 상태를 확인하고 B2 결과 보고 후 중단한다.

전체 setup, production migration, owner backfill, Function deploy, SMTP/Google/Account ON은 위 생성안에 포함하지 않는다. 부분 실패하면 이후 작업만 멈추고 생성된 test ID 목록을 보존한다. test 프로젝트/자원 자동 삭제, SQL 쓰기, 공통 서비스 재시작, 운영 권한 변경으로 복구하지 않는다. Key 만료/승인된 test Key 취소를 이용한다.

## 로컬 검증과 남은 확인 사항

실제 테스트 결과와 커밋은 [B2 검증 결과](customer-account-provider-test-results.md)에 기록한다. 실제 Appwrite schema 생성/API Key 소속·권한 적용·migration available 및 Google/OTP는 아직 검증하지 않았다.

생성 직전 최종 확인은 이 manifest digest와 ACL·Key scope/expiry·M 생성 범위에 대한 사용자 승인, 기존 Console Owner 세션 유효성, test Account OFF/빈 자원, 서버 여유, 신규 namespace 충돌 없음이다. 관리자 UID/권한은 test project에만 한정한다. frontend/server flag는 OFF를 유지한다. 잘못된 ACL이나 미분류 DB가 있으면 고객 기능 활성화 없이 원인을 보고한다.

**요청하는 승인:** 위 test M 1명, Key 3개, DB 2개, Collection 12개, baseline181 Attributes/37 Indexes, synthetic settings 1건, GET-only migration dry-run, 그리고 결과가 정확히 일치할 때 test reservations의 owner Attribute/Index 각 1개 additive apply. apply를 따로 승인하려면 baseline+dry-run까지만 승인해도 된다. 승인 전에는 어느 자원도 생성하지 않으며 B3 이후는 자동 실행하지 않는다.
