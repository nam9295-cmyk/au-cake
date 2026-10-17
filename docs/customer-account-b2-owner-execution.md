# Customer Account B2 — 공식 Owner 인증 경로 실행 결과

2026-10-17 KST. **B2 완료.** `https://api.verygood-chocolate.com/v1`의 `verygood-au-account-test`에 승인된 자원만 생성하고 조건부 owner migration을 적용했다. Account는 계속 OFF다. B3 이후 및 production 활성화 승인은 사용하지 않았다.

Mac Codex 단독, `au-cake-customer-account` / `feat/customer-account`에서 수행했다. 시작 HEAD `8f8c91c88403ffb5826d0eaf81167e83ed947876`, main/origin main `34ba1072f475ba8458b25a8ffd7a9e5467293dbe`. 기존 [Console UI 중단 기록](customer-account-b2-execution.md)은 역사적 기록으로 보존한다.

## 승인과 인증 경로

[manifest](customer-account-b2-resource-manifest.json) SHA-256은 실행 전·순차 생성 직전·최종 검증 시 모두 `75e18834d1020a0279946169ddc3e9c9d1e58684c76104a6738d92c559f8ef94`였다. 승인 manifest 바이트·scope·ACL은 변경하지 않았다.

공식 Console Settings에서 endpoint/project ID 및 Account OFF를 재확인했다. 사용자가 Terminal에서 공식 `appwrite-cli@15.0.0`으로 기존 Console Owner에 직접 로그인했다. 공식 `whoami` 및 Owner REST의 Account/current session/조직 membership 응답으로 동일 계정·Owner role·유한 세션 만료를 확인했다. 새 Console Owner/관리자 role 또는 전역 API Key를 만들지 않았다.

[공식 self-hosted 호환표](https://appwrite.io/docs/advanced/self-hosting/installation#sdk-version-compatibility)의 1.8.1/CLI15 조합을 사용했다. CLI의 생성형 Projects/Account 명령은 `sdkForProject()`의 admin mode와 Console project 제한이 충돌했다. 설치된 공식 CLI source와 [1.8.1 Projects API](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/projects.php)를 확인한 뒤, 사용자가 방금 로그인한 **CLI 세션의 정상 자격증명**을 공식 Owner REST에 사용했다. Key 관리 요청은 Console context에서 `/projects/verygood-au-account-test/keys`로 고정했다. 브라우저 cookie/storage/session 추출, 비공식 인증 우회, SQL 쓰기, 운영 Key 사용은 없었다.

Owner 확인 후 metadata 하나만 발급했다. 프로젝트를 명시한 `GET /projects/verygood-au-account-test/keys/{keyId}` 및 실제 metadata Key의 test DB GET으로 소속·scope·만료·사용 가능성을 검증한 후에만 bootstrap/fixtures를 발급했다. 1.8.1 Key model에는 projectId 필드가 없으므로 소속 증거는 위 project-scoped 공식 route의 성공이다.

작업에 추가한 CLI 세션만 공식 current-session logout으로 종료하고 CLI 로컬 인증 정보를 정리했다. 기존 브라우저 Owner 세션과 테스트 자원/Key는 보존했다. Secret은 Git 제외 private 디렉터리 0700/파일 0600에만 보관했다. 제품 `.env`, 명령행 인자, 로그 출력, 보고서에 넣지 않았다.

## 생성 결과

| 자원 | 승인 | 실제 최종 |
| --- | ---: | ---: |
| 테스트 Auth 관리자 M | 1 | 1 |
| metadata/bootstrap/fixtures Key | 3 | 3 |
| DB | 2 | 2 |
| Collection | 12 | 12 |
| 기본 Attribute | 181 | 181, 모두 available |
| 기본 Index | 37 | 37, 모두 available |
| 합성 settings document | 1 | 1 |
| owner Attribute / Index | 1 / 1 | 1 / 1, 모두 available |
| Function/Bucket/platform/변수 | 0 | 0 |

총 239개 객체: Auth user1 + Key3 + DB2 + Collection12 + Attribute182 + Index38 + document1. schema/fixture/migration POST는 정확히 235회이며 Key/M POST까지 합치면 239회다. 실패한 mutation 재시도·중복 발급·덮어쓰기·자동 삭제는 없었다.

DB는 `ca_test_cake_au`, `ca_test_kids_au`다. Collection별 최종 Attribute/Index 수와 ACL은 다음과 같다. M=`ca-test-admin-m-20261017`, CRUD=create/read/update/delete, RUD=read/update/delete. 전부 enabled=true/documentSecurity=false이며 승인된 전체 permissions 배열을 실제 GET으로 검증했다.

| DB | Collection | Attribute / Index | ACL |
| --- | --- | ---: | --- |
| cake | reservations | 39 / 8 | M:CRUD |
| cake | cake_pickup_openings | 3 / 2 | any:R, M:CUD |
| cake | settings | 13 / 0 | any:R, M:CUD |
| cake | review_invites | 15 / 2 | 없음, 서버 전용 |
| cake | reviews | 14 / 5 | M:RUD |
| cake | review_coupons | 14 / 4 | M:RUD |
| cake | manual_coupons | 9 / 3 | M:RUD |
| cake | review_photo_cleanup | 7 / 2 | M:RUD |
| cake | email_deliveries | 15 / 1 | 없음, 서버 전용 |
| cake | email_delivery_retry_claims | 11 / 1 | 없음, 서버 전용 |
| kids | class_reservations | 38 / 8 | M:CRUD |
| kids | class_booked_dates | 4 / 2 | any:R, M:CUD |

M은 `CA TEST Admin M`이라는 **테스트 Auth UID만 준비한 상태**다. 이메일/전화번호/비밀번호/label이 없으며 Console 관리자 권한을 추가하지 않았다. M으로 실제 관리자 로그인을 수행한 결과가 아니다. Custom Cake 자원이나 Class owner 필드는 만들지 않았다. Class baseline은 승인된 readiness용이며 회원 연동은 포함하지 않는다.

유일한 document는 `ca_test_cake_au/settings/ca-settings-20261017-b2`다. 승인된 13개 합성 필드와 document permissions를 read-back 검증했다. 은행 정보는 `TEST ONLY - DO NOT PAY`, 합성 연락처/주소/공지/가격/시간이며 운영 주문·사용자·쿠폰을 조회하거나 복사하지 않았다. 새 주문도 생성하지 않았다. 운영 판매 정책은 변경하지 않았다.

## Key scope 및 실제 만료

| 역할 / Key ID | 정확한 scopes | 실제 만료 KST |
| --- | --- | --- |
| metadata / `6ad37fe1d6b32b50bfb1` | databases.read, collections.read, attributes.read, indexes.read | 2026-10-18 22:57:09.515 |
| bootstrap / `6ad380392909dcaa6a4c` | 위 4개 + databases.write, collections.write, attributes.write, indexes.write | 2026-10-18 00:58:36.777 |
| fixtures / `6ad3803a67616e266a52` | documents.read, documents.write | 2026-10-18 00:58:38.078 |

각 이름은 `ca-test-{role}-20261017-b2`다. metadata 실제 수명은 약 23시간55분, 나머지는 약 1시간55분으로 각각 최대24/2시간 이내다. 발급 응답·project-scoped getKey·최종 목록 및 getKey를 교차 비교했다. tables/columns/rows/public/health/users 등 scope를 추가하거나 대체하지 않았다. Key는 project 단위 권한이므로 로컬 resource/path/payload allowlist와 함께 사용했다. 만료 뒤 재발급/갱신은 별도 승인 대상이다.

## 실제 migration 및 실행 중 차이 처리

기본 schema/ACL/inventory가 완성된 뒤 실제 test API에서 **GET-only dry-run**을 실행했다. 정확히 다음 두 항목만 누락됐다.

- `ca_test_cake_au/reservations.customerUserId`: optional string, size36, required=false.
- 같은 Collection의 `customerUser_created_idx`: key, `[customerUserId,$createdAt]`, `[ASC,DESC]`.

baseline 전체 및 두 항목 부재를 다시 확인한 뒤 조건부 additive apply했다. 새 Attribute/Index의 available과 전체 최종 schema/ACL을 재검증했다. 독립적인 사후 GET-only dry-run은 `ready:true`, `changes:[]`였다. 운영 migration/owner backfill/Collection 권한 완화는 없었다.

실행 중 확인한 두 차이는 RED→GREEN으로 보완했다.

1. Key expiry 응답은 UTC를 `+00:00`로 직렬화하고 요청은 `Z`였다. 동일 시각 문자열의 차이로 첫 metadata 발급 뒤 검증기가 중단했다. timestamp 비교를 적용하고 **이미 발급된 Key를 GET-only로 재검증·채택**했다. metadata POST 재실행이나 중복 Key 생성은 없었다.
2. `/health/version`은 [1.8.1 공식 public route](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/health.php)지만 API Key를 동봉하면 applications role에 public scope가 없어 401을 반환했다. 첫 schema 실행은 여기서 중단해 DB/schema POST가 0회였다. 빈 DB inventory와 쓰기 event 부재를 확인한 뒤 version GET에서만 Key를 제외하고 별도 기록된 실행을 시작했다. 승인 scope를 확대하거나 실패한 mutation을 재시도하지 않았다.

두 preflight 차이를 해결한 뒤 baseline/schema/migration 생성은 모두 성공했다. 잔여 실패·미완성 B2 자원은 없다.

## 운영 불변·서버 상태

23:00:05 → 23:12:16 KST의 읽기 전용 metadata snapshot을 비교했다. 기존 네 project(`verygood-main`, `69cb27ef002b63e77c53`, `69db3ae20026cdc0c7fe`, `verygood-au`) 각각의 9범주 지문·자원 수·활성 배포가 전부 동일했다. 비교 범주는 projectConfig/databases/schemaAcl/functions/activeDeployments/buckets/variables/keysMetadata/platforms다. 고객 rows나 Key secret은 snapshot에 포함하지 않았다.

주요 컨테이너 5개의 ID/image/start time/env 지문도 동일했다. test project의 projectConfig/functions/deployments/buckets/variables/platforms 지문은 동일했고 DB/schema/Key만 승인대로 추가됐다. SMTP/Google/서비스 설정·운영 Auth/ACL은 변경하지 않았다.

| 측정 | 전 | 후 | 생성 중 관측 |
| --- | ---: | ---: | ---: |
| 가용 RAM | 8.858GiB | 8.916GiB | 최소8.911GiB |
| 가용 disk | 83.091GiB | 83.137GiB | 최소83.137GiB |
| CPU load1 | 0.09 | 0.53 | 최대1.582, 4CPU |
| OOM 증가 | — | 0 | 0 |

5초 이내 캐시의 aggregate SSH metrics + public version probe 50개가 모두 정상이다. 각 쓰기/poll의 budget gate는 RAM3GiB/disk30GiB/new OOM/API 실패/load1≥4 5분 지속을 중단 기준으로 사용했다. 중단 기준 도달은 없었다. CPU는 사용률 %가 아닌 loadavg 측정이며 공유 서버의 전후 변동을 test 자원만의 순수 증분으로 해석하지 않는다. version probe는 full health.read 진단을 의미하지 않는다.

최종 Console Settings와 공식 project GET 모두 Account OFF, 비인증 test `/account` GET은 403 `general_service_disabled`였다. frontend/server customer flags의 기본 OFF는 유지하며 Function이나 사이트를 배포하지 않았다.

## 로컬 검증·Git·다음 승인

| 검증 | pass | fail | skip |
| --- | ---: | ---: | ---: |
| guard/seed/provision/Owner/monitor 도구, Node24 | 30 | 0 | 0 |
| 같은 도구, Node22.23.3 | 30 | 0 | 0 |
| 계정 suite | 89 | 0 | 0 |
| 전체 npm test | 1,865 | 0 | 기존1 |

전체 테스트 총1,866개. 기존 skip은 `KR production dist does not publish AU Chocolate pages`다. `npm run lint`, `npx tsc -b`, 새 JS unused/syntax, diff 검사도 통과했다. 테스트 삭제/완화는 없다. AU/KR 독립 build와 고객 Google/OTP 브라우저 flow는 이번 B2 도구 작업에서 별도로 재실행하지 않았다. Node22 검증은 macOS 도구 실행이며 Linux Function/native 라이브러리 검증을 뜻하지 않는다.

코드 커밋 `0679771`: 공식 Owner API guard/단일 합성 M 생성/실제 자원 monitor 및 회귀 테스트, public version probe 수정. 결과 문서·B안 진행 상태는 후속 문서 커밋으로 구분한다. 제품/Function/package/lock/manifest/main/다른 worktree는 수정하지 않았다. 작성자가 최종 범위·비밀값·보안 검토를 수행했으며 사용자 단독 작업 조건에 따라 위임하지 않았다. Private evidence와 실패했던 preflight 기록은 Git 제외로 보존한다.

**B2에서 중단한다.** 실제 Google/6자리 OTP/동일 이메일 동일 UID/메일/세션·본인 주문·타인 접근 차단 인수는 미실행이다. B3의 test HTTPS 도메인·platform/redirect·Google test client/consent/test users 설정은 별도 승인이 필요하다. 공통·project SMTP/발송/Account ON/Function·사이트 배포는 각각 해당 후속 단계 승인이 있어야 한다. sharp 및 Node16 기본 deploy/Node22 운영 차이는 별도 해결 과제로 유지한다. 운영 적용·main 병합 준비 완료로 보고하지 않는다.
