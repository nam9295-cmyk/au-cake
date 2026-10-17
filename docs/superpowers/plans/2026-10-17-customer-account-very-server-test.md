# Customer Account B안 — very-server Test Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: 승인 후 `superpowers:executing-plans`로 단계별 실행한다. Mac Codex 단독, subagent/Hermes 위임 없음. 현재는 조사·계획 작성까지만 승인됐다. 모든 checkbox는 미실행이다.

**Goal:** 기존 very-server Appwrite 1.8.1에 운영과 분리한 테스트 프로젝트를 만들고 Google/6자리 OTP·일반 상품 주문을 합성 자료로 검증할 수 있게 준비한다.

**Architecture:** 기존 API/MariaDB/Redis/executor/mail worker는 공유하고, project·Auth users·keys·DB·Function·Google client·SMTP credential은 분리한다. 공통 SMTP 변경은 다른 프로젝트까지 영향을 주는 별도 운영 변경으로 취급한다. 새 호스트, 별도 Docker Compose, Appwrite 설치 또는 Mailpit 설치는 하지 않는다.

**Tech Stack:** Appwrite 1.8.1, 기존 HTTPS API, Web SDK 23.0.0 / node-appwrite 22.1.3, Google OAuth2, 프로젝트별 Resend SMTP 후보, 기존 Node22 runtime.

**Spec:** [최초 조사 및 A01–A11](../../customer-account-auth-test-environment.md), [제품 설계](../specs/2026-10-17-customer-account-design.md), [운영 적용/rollback](../../customer-account-rollout.md). 이 문서가 이전 A2 실행 계획을 대체한다.

## Global Constraints

- 승인 worktree `/Users/nam9295/Desktop/john_2.0/code/au-cake-customer-account`, branch `feat/customer-account`만 수정한다. 조사 시작 HEAD는 `2150720cfed5b637aec9d35129252f9d87d97d94`다.
- 이번에는 프로젝트/키/DB/Function 생성, 공통·프로젝트 SMTP 변경, 서비스 재시작, Google 설정, migration apply, 사이트 배포를 하지 않는다.
- 운영 고객 users/sessions·주문 document·업로드·메일/queue 본문·execution log를 조회/복사하지 않는다. 허용된 구성·schema/ACL·자원 metadata만 읽는다.
- 운영 project의 Auth·DB·Function·ACL·판매 설정을 테스트 구성으로 덮어쓰지 않는다. main 병합/reset/history rewrite/GC 금지.
- Google + 6자리 Email OTP만 고객 UI에 제공한다. guest 유지, 일반 케이크·초콜릿만 회원 연결. Custom Cake/Kids Class 회원 연동 제외.
- frontend/server customer flags 기본 OFF. `APPWRITE_ADMIN_USER_IDS`와 `REVIEW_ADMIN_USER_IDS`의 기존 역할 유지; 새 이름이나 권한 완화 금지.
- sharp 패치와 reservation deploy Node16/운영 Node22 불일치는 **별도 승인·해결 작업**이다. B안 구축으로 운영 runtime 또는 Custom/판매 플래그를 변경하지 않는다.
- 단계 승인 하나가 다음 단계의 승인이 되지 않는다. 리소스·설정 쓰기는 Appwrite 공식 API/Console만 사용한다. 아래 조사용 SQL을 구축/복구에 사용하지 않는다.

## Review Focus

- 같은 host의 운영 project/DB/key가 섞이는 오류를 network 이전에 exact pair/resource 검사로 차단한다(B1/B2).
- 공통 SMTP 추가가 기존 네 프로젝트와 Console의 이메일 인증을 활성화하는 영향을 승인 없이 수용하지 않는다(B4/B5).
- 프로젝트 SMTP OFF가 발송 중지가 아니라 공통 transport fallback이 될 수 있음을 복구 시험으로 확인한다(B8).
- `.env` 변경 뒤 단순 container restart로 적용됐다고 오인하지 않는다. 재생성 범위와 실제 readiness를 검증한다(B5).
- 동일 이메일 UID·다른 탭 cart·guest 경로를 Mock 결과로 대신하지 않고 실제 합성 Account/주문으로 검증한다(B7).

## 읽기 전용 사전 점검 결과

2026-10-17 약 20:43 KST부터 확인했다. SSH 자원 상태, Docker의 필요한 설정, Appwrite의 project/schema/Function metadata를 READ ONLY transaction의 SELECT로만 읽었다. 실제 고객 테이블은 읽지 않았다. API key secret/Google secret/관리자 UID 원문을 출력·문서화하지 않았다. 아래 수치는 일회성 관측이며 용량 보장이 아니다.

| 프로젝트 | DB | Collection | Bucket | Function | API key | Web platform |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `verygood-main` | 5 | 10 | 2 | 2 | 2 | 8 |
| 기타 프로젝트 2 | 1 | 4 | 1 | 0 | 0 | 2 |
| 기타 프로젝트 3 | 1 | 2 | 1 | 0 | 1 | 5 |
| `verygood-au` | 2 | 22 | 2 | 4 | 3 | 7 |

현재 4개 모두 version 1.8.1, 프로젝트 SMTP `enabled` 미설정이다. auth 설정의 **`emailOtp=true`, `usersAuthMagicURL=true`**도 4개 모두 관측됐다. 현재 공통 SMTP가 비어 있어 이 이메일 발송 경로가 막혀 있는 것이며, 저장된 Auth 설정이 OFF인 것은 아니다. 저장 metadata의 Google enabled/client는 미설정으로 관측했지만 운영 Google 로그인 흐름을 실행·검증하지는 않았다.

AU는 cake DB의 20개 collection(기존 private Custom 자원 포함), kids DB의 2개 collection을 사용한다. private 자원에서 `any/users/guests`의 일반 공개 grant는 관측되지 않았고 settings/pickup openings/class booked dates에는 공개 read가 있다. 실제 document는 조회하지 않았다. schema 관리자 UID의 server 환경값은 1개, admin API UID 환경값은 2개로 서로 다르다. 관측한 collection의 명시적 user grant는 schema allowlist 안이었다. **두 환경변수를 강제로 같은 집합으로 바꾸지 않는다.** 서버에 보관된 env와 deployed secret 변수의 완전한 일치 여부 및 전체 readiness 인수는 별도 확인 대상이다.

AU Function metadata는 reservation-api/review-api/reservation-notification이 `node-22`, booking-reminder가 `node-16.0`이다. 모두 enabled, specification `s-8vcpu-8gb`로 관측됐다. 이를 테스트에 복사하지 않는다. 두 API의 sharp 0.35.4/native 분석은 최초 조사 문서에 유지한다.

| 서버 자원 | 관측값 |
| --- | --- |
| CPU / load | 4 CPU, load 0.07/0.22/0.26 |
| RAM / swap | 총 15.57GiB, used 약 7.6GiB, available 약 8GiB. swap 1.7/4GiB 사용 |
| 디스크 | 84GiB available, 62% 사용 |
| 주요 idle 메모리 | API 약 589MiB, MariaDB 243MiB, Redis 21MiB, mail worker 17MiB, Node 실행기 관측 24/36MiB |
| compute 공통 설정 | API의 `_APP_COMPUTE_CPUS=0`, `_APP_COMPUTE_MEMORY=0`. 이것을 테스트별 자원 상한으로 간주하지 않음 |

API/mail worker의 `_APP_DOMAIN=api.verygood-chocolate.com`, `_APP_OPTIONS_FORCE_HTTPS=enabled`를 확인했다. API의 `_APP_DOMAIN_FUNCTIONS=functions.localhost`는 그대로 둔다. 테스트 Function은 기존 HTTPS API의 SDK execution 경로를 사용하므로 별도 공개 Function domain이나 그 전역 설정 변경을 전제로 하지 않는다.

공유 서비스를 유지한 채 소규모 순차 테스트를 시작할 여지는 있다. 프로젝트는 CPU·RAM·queue·장애 영역의 강제 격리가 아니다. 빈 프로젝트에는 별도 상시 container가 생기지 않는다. 추가량은 **빈 프로젝트 metadata/cache 수십–수백 MiB 이내 예산**, schema·소량 합성 데이터·archive/log **5–10GiB 디스크 예산**, build/테스트 시 **RAM 2–4GiB 여유 예산**으로 계획한다. 이는 측정한 증분이 아니다. test Function은 기존 정의에 있는 1vCPU/1GiB급부터, build/execution 동시성 1로 시작한다. 필요 시 2GiB로 확대하는 것도 test 자원 승인 후 결정한다.

테스트 중 host available RAM 3GiB 미만, disk available 30GiB 미만, 1분 load 4 이상이 5분 지속되거나 새 OOM/API health 실패가 생기면 **테스트 요청·build만 중단**한다. 정상 운영의 고객 데이터를 읽어 성능을 측정하지 않는다. 전역 executor 설정을 바꿔 테스트를 수용하지 않는다.

## SMTP: Resend 가능 여부·영향·필요 설정

Resend는 기존 계정에서도 SMTP를 제공한다. 공식 설정은 `smtp.resend.com`, 465/SSL 또는 587/STARTTLS, username `resend`, password API key다. verified sender domain과 유효한 key가 필요하다. SMTP와 HTTP API는 rate limit을 공유하므로 같은 Resend 계정을 쓰면 운영 알림 quota·평판까지 완전히 분리되지는 않는다. [SMTP 공식 문서](https://resend.com/docs/send-with-smtp)

서버 작업 폴더에는 Resend key와 `verygood-chocolate.com` 발신 설정이 존재한다. 그 보관 키로 **GET `/domains` metadata만** 조회했으나 HTTP 401이어서 계정/domain 상태는 확인하지 못했다. 운영 Function의 실제 key가 같거나 운영 발송이 실패한다고 추론하지 않는다. SMTP AUTH/메일 발송/키 발급을 시도하지 않았다. 실행 전 계정 소유자가 현재 유효한 접근·domain status·quota를 확인하고 전용 키를 발급해야 한다.

| 계층 | 향후 설정안 | 영향/승인 |
| --- | --- | --- |
| 인스턴스 기본 SMTP | 실제 Resend SMTP host, port 465, secure `ssl`, username `resend`, **새 system 전용 sending key**, 검증된 system sender | 모든 기존 프로젝트의 기본 transport와 Console에 영향. host만 채우지 않고 sender·credentials 전체를 검토 |
| 테스트 project override | `enabled=true`, 같은 Resend host, 별도 **test 전용 domain-restricted sending key**, test sender/reply-to | 테스트 project에만 저장. SMTP 연결 검증을 수반하는 API 변경이며 별도 승인 필요. shared worker에서 override를 사용 |
| 기존 주문 알림 | 현재 Resend HTTP API/Function/key·from 설정 유지 | Auth SMTP를 위해 기존 key를 revoke/교체하거나 운영 Function을 재배포하지 않음 |

현재 API와 mail worker의 `_APP_SMTP_HOST/PORT/USERNAME/PASSWORD/SECURE`는 모두 비어 있고 system sender domain은 `appwrite.io`다. 이 sender를 그대로 Resend로 보내면 검증된 발신 도메인 조건을 충족한다고 볼 수 없다. system sender 후보는 기존 검증이 확인된 도메인의 `appwrite-system@<verified-domain>`, test sender 후보는 `customer-test@auth-test.verygood-chocolate.com`이다. 후자는 **미등록 후보**이며 별도 subdomain 검증/DNS 승인이 필요하다. test용 값을 인스턴스 전체 기본 발신자로 쓰지 않는다.

프로젝트 SMTP API는 host/port/sender/credentials를 저장하고 연결을 검사하며, 메일 payload가 별도 SMTP를 mail worker에 전달한다. 하지만 1.8.1 OTP endpoint는 **공통 host의 비어 있음부터 검사**하므로 프로젝트 override만으로 OTP를 활성화할 수 없다. 공통 SMTP를 유효하게 준비해야 한다. 기존 네 프로젝트의 OTP/Magic URL·password recovery 등 기본 메일 및 Console 메일에도 의미 있는 동작 변화가 생길 수 있다. 이 영향의 수용 또는 기존 프로젝트 보호 설정은 **별도 운영 승인 사항**이다. 기존 프로젝트 auth method를 임의로 OFF하지 않는다. [고정 버전 Account](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/account.php), [프로젝트 SMTP](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/projects.php), [메일 워커](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Workers/Mails.php)

합성 수신함은 소유자가 관리하는 Google 테스트 mailbox G1/E1/B/M으로 한정한다. Resend의 sending/domain 제한은 **발신 도메인 제한이며 수신자 allowlist가 아니다**. frontend 입력 제한/Google test-user 제한만으로 공개 Email OTP API의 외부 수신자 발송까지 차단했다고 보고하지 않는다. OTP 활성화 전 테스트 project에만 적용되는 서버 측 접근·수신자 제한을 검증하고 승인받아야 한다. 현재 설치에서 이를 보장하는 제어는 미확인이다. 확인할 수 없다면 OTP는 OFF 유지하고 프로젝트 구성/Google 단독 smoke까지만 진행한다. 새 relay·proxy 정책이 필요하면 추가 설계·승인을 받고, 무단으로 새 SMTP 서비스나 Compose를 추가하지 않는다. [Resend key 제한](https://resend.com/docs/dashboard/api-keys/introduction)

Resend simulated delivery 주소는 bounce/sending smoke용일 뿐 실제 Google mailbox OTP 수신·동일 이메일 교차 인증의 대체물이 아니다. 계정별 key/domain으로 식별하고 수신자·발송량을 제한하되, 공통 계정 quota를 우회하기 위한 새 계정 생성은 하지 않는다. 기존 mail/queue 본문은 조회하지 않았다. 이미 queue에 있는 메일의 양/지연 발송 가능성도 검증된 것으로 간주하지 않는다.

## 재시작 범위와 백업·복구

현재 compose와 실제 container 환경 양쪽에서 SMTP/system sender 변수를 소비하는 서비스는 **`appwrite`, `appwrite-worker-mails` 두 개**다. `.env` bind mount는 없다. 프로젝트·DB·키·Google·프로젝트 SMTP 설정은 DB 기반 변경이므로 그 자체로 서비스 재시작이 필요 없다. 공통 환경변수 반영에는 두 container의 **재생성**이 필요하다. host 재부팅, MariaDB/Redis/executor/Traefik/realtime/나머지 worker 재시작은 계획하지 않는다.

단순 `docker compose restart`는 변경된 환경변수를 반영하지 않는다. [Docker restart](https://docs.docker.com/reference/cli/docker/compose/restart/), [Docker up](https://docs.docker.com/reference/cli/docker/compose/up/)

승인 후 재생성 방법은 기존 `/home/john/srv/appwrite/appwrite`의 compose를 그대로 사용해 **worker 먼저, API 다음** 각각 `up -d --no-deps --no-build --pull never --force-recreate <service>`로 한정한다. 새 compose를 만들거나 전체 `down/up`을 하지 않는다. 기존 이미지 ID를 고정·대조하고 pull/upgrade를 섞지 않는다. API 단일 container 교체 중 로그인·주문 API·Console 요청이 일시 실패할 수 있어 운영 저부하 시간과 중단 허용 범위를 승인받는다. 현재 두 서비스에 compose healthcheck가 없어 running/`--wait`만으로 준비 완료를 판정하지 않고 실제 health/version 및 승인된 합성 smoke를 확인한다.

백업은 실행 승인 후 서버의 접근 제한된 디렉터리에 현재 `.env`·compose·해당 두 container의 이미지/설정 hash를 보관하는 방식이다. secret 원문을 Git/보고서에 넣지 않는다. 기존 프로젝트 metadata/ACL/배포 ID의 비민감 fingerprint도 저장한다. 복구 시 **승인된 SMTP/system-sender keys만** 기존 값으로 복원한다. 백업 후 다른 운영 설정이 변했으면 파일 전체를 덮어쓰지 않고 diff를 검토한다. 같은 두 서비스만 원래 이미지·값으로 재생성한다.

프로젝트만 중지하는 B8과 공통 SMTP rollback은 구분한다. 테스트를 멈춘다는 이유로 성공적으로 적용된 운영 공통 SMTP를 자동 철회하지 않는다. 반대로 공통 변경 실패 시 test 프로젝트만 멈춰서는 운영 영향이 복구되지 않는다. 원래 empty SMTP로 복귀하면 모든 프로젝트의 OTP는 다시 차단될 수 있다. queue payload에 이미 포함된 test SMTP 정보는 공통 값 복원만으로 제거되지 않으므로 test key revoke/차단도 별도로 다룬다. 공유 Redis queue flush, DB/volume 복원·삭제는 하지 않는다.

## HTTPS·project·key·ACL 구성안

| 자원 | 승인 후 생성/설정할 값과 분리 방법 |
| --- | --- |
| Project | 후보 `verygood-au-account-test`, 이름 `VERYGOOD AU Customer Account TEST`. 기존 4개와 다른 ID. 생성 시 Appwrite 내부 project/Auth namespace metadata만 추가; 운영 export 복제 없음 |
| Console 관리 | 승인된 기존 Console owner team을 선택하되 그 team 구성원/role을 변경하지 않음. 테스트 Auth 사용자와 Console 관리자를 혼동하지 않음 |
| API endpoint | 기존 `https://api.verygood-chocolate.com/v1` 유지. 공개 GET version 1.8.1 확인. 새 API hostname/instance/proxy는 만들지 않음 |
| Test frontend | 후보 `https://au-account-test.verygood-chocolate.com`; DNS 응답이 관측되지 않음. 별도 test preview origin으로 등록/호스팅·TLS 승인 필요. 기존 `au-stage` 등 운영 project에 등록된 origin을 그대로 재사용하지 않음 |
| Google | 별도 Google Cloud test client/consent/test users. Appwrite callback 후보 `https://api.verygood-chocolate.com/v1/account/sessions/oauth2/callback/google/verygood-au-account-test`; 생성 뒤 Console이 제시하는 URL과 exact 대조 |
| App callback | test origin의 `/account/auth/callback?flowId=...`는 Appwrite success/failure URL. Google redirect에 앱 callback을 잘못 넣지 않음. 운영 callback/provider는 그대로 보존 |
| DB | 후보 `ca_test_cake_au`, `ca_test_kids_au`. 일반 상품 reservations 및 현재 readiness에 필요한 baseline 설정/쿠폰/리뷰/메일·빈 class metadata만 생성. 최소 baseline 12 collections 예상. 실제 schema allowlist 검토 후 확정 |
| Owner migration | test reservations의 optional string `customerUserId` size36, `customerUser_created_idx`만 additive. 운영 migration 미실행. Custom/Class owner 변경 없음 |
| Function | 후보 `ca-test-reservation-api` 1개를 우선. review/알림/스케줄은 필요 검증과 별도 승인 전 생성·활성화하지 않음. 생산 Function ID/runtime/events/scopes·판매 설정 불변 |
| Keys | test project에만 속하는 metadata-read key / 일시 bootstrap schema key / Function deploy key를 역할별 최소 scopes·만료로 분리. server runtime은 기존 dynamic key 계약 사용. 운영 key 재사용 금지 |
| Admin/ACL | test 관리자 M의 새 Auth UID를 테스트의 `APPWRITE_ADMIN_USER_IDS`, `REVIEW_ADMIN_USER_IDS`에만 설정. 운영 admin UID/ACL을 복사하지 않고 역할과 schema 정의만 재현. broad private ACL/미분류 자원은 활성화 거부 |

같은 host라 production host 전체 deny는 사용하지 않는다. 요청 전에 **정확한 test endpoint/project pair, DB/Function IDs, key 소속**을 확인하고 `verygood-main`, `verygood-au`, 나머지 기존 project IDs를 금지한다. browser도 test project cookie namespace와 별도 브라우저 프로필을 사용한다. origin/CORS는 권한 검증의 대체물이 아니다. 같은 이메일이어도 project 간 UID를 같다고 기대하지 않으며, Google↔OTP는 **동일 test project 안에서** 비교한다. [OAuth 설정](https://appwrite.io/docs/products/auth/oauth2), [Google redirect 규칙](https://developers.google.com/identity/protocols/oauth2/web-server)

현재 일반 Renewal create 경로는 `au-renewal-storage.js`에서 reservations 데이터를 만든다. test seed에 운영 Custom collection을 통째로 복제하지 않는다. 후속 fixture 계약 검사에서 실제 일반 상품의 private snapshot 자원이 필요하면 이름만 보고 Custom 요청으로 간주하지 말고 필요한 최소 자원·schema를 명시해 승인받는다. Custom/Kids 회원 기능을 켜는 것으로 보완하지 않는다.

## B1: 빈 테스트 프로젝트 생성·초기 차단

**승인 A1 필요:** project ID/name, 기존 Console owner team, 생성 직후 test Account service OFF까지. 다른 단계는 미포함.

**변경 자원:** 신규 project 및 Appwrite 내부 namespace, 그 project의 service 설정만. 새 DB/Function/key/provider/SMTP 없음. 재시작 없음.

- [ ] 실행 직전 branch/HEAD/clean, 기존 4개 project metadata·후보 ID 부재·서버 여유를 재확인한다.
- [ ] 공식 Console/API로 후보 project 1개만 생성한다. 기존 project 복제·전체 setup 실행 금지.
- [ ] 새 project의 Account service를 OFF로 두고 공개 로그인 진입을 막는다. 미사용 로그인 방법을 기본 허용 상태로 방치하지 않는 후속 설정 목록을 기록한다. 기존 project 설정은 건드리지 않는다.
- [ ] 신규 test project에 DB·Function·bucket·API key·platform/provider가 아직 없는지 확인하고 기존 project metadata/ACL hash 불변을 검증한다. Appwrite 자체 내부 auth collections와 사용자 생성 자원을 구분한다.
- [ ] 실제 생성 ID/자원 증분/중지 방법을 문서로 보고하고 **B2 전에 중단**한다.

## B2: test target guard·전용 key·합성 baseline

**승인 A2 필요:** 로컬 helper 코드/테스트, test key·DB·baseline schema/fixtures, owner dry-run/apply 범위를 각각 명시. customer flags OFF 유지.

**Files:** 새 `scripts/customer-account-test-target.mjs`, `tests/customer-account-test-target.test.mjs`, `scripts/seed-customer-account-test-project.mjs`, `tests/customer-account-test-seed.test.mjs`; 결과 `docs/customer-account-provider-test-results.md`. private run manifest는 Git 제외. 기존 `scripts/migrate-customer-account-schema.mjs`를 재사용한다.

**Interfaces:** `assertCustomerAccountTestTarget({endpoint,projectId,manifest}) -> {endpoint,projectId}` 또는 throw. `buildCustomerAccountTestSeedPlan({target,resources,adminUserIds,runId}) -> {creates,fixtures}`는 승인된 test IDs의 create만 계획한다. 기본 dry-run, 기존 document update/delete·guest owner backfill 없음.

- [ ] 같은 host의 `verygood-au`/기타 운영 project, 혼합 DB/Function, redirect/unknown key 소속을 거부하며 network count 0인 RED를 작성한다.
- [ ] helper/seed의 Mock GREEN·기존 account 회귀 후 로컬 기능별 커밋한다. 운영 `.env` 자동 상속·키/secret 출력 금지.
- [ ] test metadata-read key와 일시 bootstrap key를 발급한다. 양 key로 production read/write를 실제 시도하지 않고 Console key 소속·scope metadata와 target guard로 경계를 확인한다.
- [ ] 빈 test baseline만 승인된 seed plan으로 생성한다. 모든 고객·쿠폰·날짜·이메일은 run ID가 있는 합성 자료이며 운영 schema/data export 없음.
- [ ] test 관리자 M UID와 정확한 schema ACL을 검증한다. 전용 migration GET-only dry-run → 결과 검토 → **apply 승인이 있는 경우에만** test apply → available 재확인한다. private 권한 자동 완화 금지.
- [ ] 실제 생성 자원·권한·기능 OFF를 기록하고 보고한다. Function·Google·SMTP·재시작은 이 승인에 포함하지 않는다.

## B3: 테스트 HTTPS·Google 설정

**승인 A3 필요:** 테스트 frontend 호스팅/DNS/TLS·test Web platform, Google Cloud client/consent/test users, test provider 설정 및 제한된 Google Auth SDK smoke. 운영 사이트 배포 아님.

- [ ] test origin의 호스팅 위치와 DNS/TLS를 승인받고 준비한다. 새 Linux/Compose/Appwrite는 설치하지 않는다. wildcard/운영 stage origin을 재사용하지 않는다.
- [ ] test project에 exact hostname을 Web platform으로 추가하고 별도 Google client의 Appwrite callback을 exact 등록한다. secret은 test project에만 저장한다.
- [ ] 테스트 계정 G1/E1/B/M과 허용된 접속 범위를 검토한다. test Account service를 필요한 기간에만 ON, Email OTP/Magic URL 등 미검증 방법은 OFF로 유지한다. 고객 비밀번호 가입 UI는 만들지 않으며 관리자 비밀번호 계약은 보존한다.
- [ ] 공통 SMTP 없이 가능한 신규 Google·로그아웃·세션 restore의 SDK 단독 smoke를 합성 계정으로 수행할 수 있다. Function readiness가 없는 상태를 제품 `/account` 통합 성공으로 보고하지 않는다.
- [ ] callback 취소/실패·다른 계정의 기존 session guard를 기록한다. production provider/client·관리자 권한은 변경하지 않는다. 이후 SMTP/Function 단계 전 결과를 보고한다.

## B4: 프로젝트별 Resend SMTP 준비

**승인 A4 필요:** 현재 계정 소유자 접근 확인, test 발신 subdomain/DNS 검증·전용 sending key, test SMTP override, 승인된 합성 수신자에 한한 SMTP test 발송. 공통 설정·재시작은 미포함.

- [ ] 보관 key의 `/domains` 401을 현재 운영 장애로 단정하지 말고 계정 소유자가 현재 verified domain·quota·사용 가능 key를 확인한다. 운영 Function key를 교체/회수하지 않는다.
- [ ] test 전용 발신 domain/key·허용 수신함 목록 및 서버 측 접근/수신자 제한을 검토한다. domain-scoped key를 recipient allowlist라고 표시하지 않는다. 제한을 입증하지 못하면 실제 OTP 활성화는 보류한다.
- [ ] test project에만 valid Resend SMTP override를 저장한다. secret은 기록하지 않고 project ID·sender domain·TLS 방식·key identifier만 확인한다.
- [ ] 승인 범위에 있을 때 test SMTP sample을 합성 수신함으로 보낸다. worker는 payload override를 쓸 수 있지만 **이 성공은 공통 host gate를 통과하는 OTP 성공이 아니다**.
- [ ] SMTP 연결·수신·테스트 설정 hash를 기록한다. 수신함 본문/OTP/메일 log를 보고서에 복사하지 않는다. 공통 SMTP·운영 프로젝트 설정을 변경하지 않고 결과를 보고한다.

## B5: 공통 SMTP와 두 서비스 재생성 — 운영 변경 전용 승인

**승인 A5 필요:** system sender/새 system key·공통 SMTP 값, 기존 네 프로젝트/Console의 이메일 경로 변화 수용 또는 별도 보호 설정, 저부하 시간·API 중단 범위, 백업·두 서비스 재생성·원상복구 권한. A1/A4로 대체 불가.

- [ ] 바로 전 compose/env/이미지 ID·metadata hash를 접근 제한된 서버 디렉터리에 백업한다. SMTP 외 설정 변경 여부, worker/API consumer 목록, 운영 metadata 불변을 확인한다.
- [ ] 승인된 실제 Resend host/credentials·verified system sender만 설정한다. 임의 가짜 host, test sender의 전역 적용, Mailpit 전환 금지. 기존 Auth 설정을 임의 OFF/ON하지 않는다.
- [ ] 기존 compose의 mail worker 1개만 원래 이미지로 재생성하고 상태·비민감 진단을 확인한다. API는 이 시점까지 기존 환경을 유지한다.
- [ ] API 1개만 같은 방식으로 재생성한다. SQL/queue/customer data 접근 없이 public health/version·예정된 synthetic smoke로 준비 상태와 SMTP gate를 확인한다. `running`만으로 끝내지 않는다.
- [ ] 기존 DB/Function/ACL·비SMTP env 불변, test SMTP override·운영 HTTP Resend 설정 불변, host 자원/공유 서비스 상태를 확인한다. 운영 주문 생성/고객 조회는 smoke에 포함하지 않는다.
- [ ] 실패하면 test 요청을 차단하고 승인된 SMTP keys의 원래 값으로 복원, 두 서비스만 재생성한다. 전체 `.env` 덮어쓰기/DB restore/Redis flush 금지. 결과 보고 후 중단한다.

## B6: 테스트 Function 배포 — 별도 runtime/sharp 해결 gate

**승인 A6 필요:** 새 test Function/key/specification·검증된 artifact 배포. 운영 Function 배포/변수/권한·runtime 변경은 미포함.

- [ ] 별도 해결 작업에서 sharp 0.35.5와 reservation Node22 배포 계약·Linux transaction/native 검증을 검토한다. 아직 미완료면 project/provider 구성까지 유지하고 주문 통합 인수는 미완료로 남긴다.
- [ ] test-only artifact의 가격·판매·쿠폰·flags·정확한 test mappings를 확인한다. Custom 배포 flag를 켜거나 운영 Function을 clone/deploy해서 runtime gate를 우회하지 않는다.
- [ ] 승인된 1vCPU/1GiB급 test Function을 customer OFF, schedule/events 기본 없음으로 배포한다. guest/readiness·실제 JWT·private ACL을 합성 자료로 확인한다.
- [ ] test flags를 승인된 순서로만 ON하고 자원 peak·운영 metadata 불변을 기록한다. review/알림 Function이 필요하면 별도 resource 승인을 받는다.

## B7: 실제 인증·주문 인수

**승인 A7 필요:** 합성 Auth users·주문·쿠폰 및 한정된 테스트 메일, 실제 브라우저/실기기 검증. 운영 데이터 사용/실제 결제 없음.

- [ ] [최초 조사 A01–A11](../../customer-account-auth-test-environment.md)의 case를 test 프로젝트에 한정해 실행한다. 신규 Google/OTP, 6자리 오류·만료·재전송, 세션 유지/로그아웃을 확인한다.
- [ ] G1 Google→logout→OTP, E1 OTP→logout→Google에서 **같은 primary 이메일·같은 test project UID**와 신규 member 주문 owner 유지, guest 자동 연결 0을 검증한다. Google password/2FA 자동화는 하지 않는다.
- [ ] 실제 AU Bag·기존 Checkout의 프로필 자동입력, 작성값 보존, OAuth 성공/취소/실패 후 cart/date/options/coupon/requestId·다른 탭 최신 cart를 검증한다.
- [ ] A/B detail/cursor·직접 test DB 접근·위조 UID/JWT를 검증하고, guest create/예약번호+전화 lookup·쿠폰/멱등성·test 관리자 M 권한을 확인한다. 운영 A/B 계정을 조회해 차단을 시험하지 않는다.
- [ ] Chrome/WebKit·실제 Safari/Chrome, EN/KO 결과를 pass/fail/not-run으로 구분한다. trace에서 OTP/cookie/JWT/Google code를 제거한다. 실제 미실행 항목을 Mock pass로 대체하지 않는다.

## B8: 테스트만 중지·안전 복구·보고

**승인 A8 필요:** test 진입/Account service·provider/Function 중지, test 키 revoke·합성 session 정리 범위. 공통 SMTP 원복과 프로젝트/데이터 삭제는 별도 승인.

- [ ] test frontend 진입/두 customer flags OFF, 새 로그인은 test Account service 및 Google/OTP 설정에서 차단한다. 1.8.1의 project service-status API를 test ID에만 적용한다. 진행 중 callback/draft·guest의 제한된 복구 시험 후 최종 진입을 닫는다.
- [ ] test Function `enabled=false`, execute roles·events·schedule 정리를 수행한다. existing session/in-flight execution은 곧바로 사라지지 않으므로 승인된 합성 session만 관리자 경로로 revoke·종료 확인한 뒤 test Appwrite/deploy/Resend 키만 revoke한다. 공유 worker/executor를 kill하지 않는다.
- [ ] **test SMTP override를 단순 OFF하여 중지하지 않는다.** queued payload에는 credential이 남을 수 있으므로 test key revoke와 신규 요청 차단을 함께 적용한다. 공유 queue purge 금지; project 삭제도 즉시 정지 수단으로 사용하지 않는다.
- [ ] 기존 네 프로젝트의 구성·ACL/배포 ID와 공유 서비스 상태가 유지되는지 metadata만 대조한다. 합성 자료·증거는 보존한다. 삭제는 별도 승인된 정확한 test IDs에만 수행한다.
- [ ] 공통 SMTP가 실패 원인이면 A5의 별도 승인된 원복을 실행한다. test 중지가 공통 변경을 자동 원복하는 것은 아니다. 운영 고객/주문 데이터 restore는 하지 않는다.
- [ ] 새 helper/product fix가 있다면 관련 RED/GREEN·전체 npm test/account·lint/TypeScript·AU/KR build를 검증하고 로컬 커밋을 구분한다. 문서만 바뀐 단계에서는 문서 링크/범위/diff 검증으로 보고한다.
- [ ] 생성/중지 자원·최대 CPU/RAM/disk·인증·권한 결과·미검증·Git 상태를 보고하고 중단한다. production 배포/main 병합 승인으로 해석하지 않는다.

## 최종 판단과 단계별 승인 경계

**기술적으로 B안의 빈 프로젝트 생성·초기 차단은 현재 인스턴스에서 가능하다고 판단한다. 단, A1 실제 생성 승인은 아직 없다.** 프로젝트 1개를 추가하는 데 공통 SMTP나 재시작이 필요하지 않으므로 그 단계만 독립적으로 승인할 수 있다. 실제 생성에 필요한 Console/API owner 접근은 아직 확인하지 않았다. 조사에 사용한 읽기 전용 SQL 접근은 공식 생성 권한 검증이 아니며, 승인 후에도 owner 접근이 없으면 중단한다. SQL write나 운영 API key scope 확대를 우회 수단으로 쓰지 않는다.

**실제 OTP 및 주문 통합 테스트를 바로 시작할 준비는 완료되지 않았다.** 유효한 Resend 계정/domain·전용 키, 합성 수신자 제한, system sender, 기존 네 프로젝트 이메일 영향 승인, API/mail-worker 재생성 시간·복구 승인이 필요하다. Function 주문 통합은 별도 sharp/runtime 해결 gate도 통과해야 한다. 이 조건을 프로젝트 생성 승인에 포함된 것으로 간주하지 않는다.

이번에는 4개 문서만 수정/추가했다. 서버/프로젝트/SMTP/Google/ACL/데이터/Function·런타임은 변경하지 않았고 메일·인증 요청도 실행하지 않았다. 전체 테스트/빌드는 문서 작업에서 재실행하지 않는다. 이전 A2 권장과 runtime/native 분석은 역사적 근거로 보존하되 새 호스트/Compose/Appwrite 설치를 실행하지 않도록 명시했다.
