# Customer Account B안 — very-server Test Project Implementation Plan

> **health403 집중 조사:** [결과](../../customer-account-b7-health-403-investigation.md). 변수 API readback·기존 deployment 활성화를 runtime 환경 반영으로 취급한 계약 결함을 확인. 실제 거부 predicate는 UNVERIFIED이며 [D1 닫힌 진단/new deployment1개 제안](2026-10-18-customer-account-b7-runtime-env-verification.md)은 승인 대기다. 이번 원격 쓰기/새 execution0, OFF/B6/CLOSED. B5 DEFERRED — RELEASE BLOCKER·과거 AU raw UNVERIFIED 유지.

> **최신 수동 B7 실행:** [실제 결과](../../customer-account-b7-manual-run-results.md). 사용자 시작 뒤 기존 guarded deployment의 Owner health1회가403으로 실패, Account/공개 Function/Pages OPEN 전 중지했다. 복구 PASS/OFF403/B6/CLOSED/flagsfalse·세션0 확인. 누적 실행7/120·Pages7/9, 실패 predicate UNVERIFIED. 같은 창 재시작·자동 배포 금지. **B5 — DEFERRED — RELEASE BLOCKER**와 과거 AU raw UNVERIFIED 유지.

> **최신 B7 수동 전환:** [CLI/사용자 Chrome 계획](2026-10-18-customer-account-b7-manual-chrome.md), [준비 결과](../../customer-account-b7-manual-preparation.md). CUA/getApp/자동 브라우저 조작 중단. 사용자의 `시작` 전 Account/Function 활성화·Pages 배포 금지. 현재 OFF/B6/CLOSED, H/쿠폰/같은7 변수/기존 guarded deployment 재사용, 실행6+최대114·Pages7+OPEN8/CLOSED9. 새900초 창은 아직 시작하지 않았다. **B5 — DEFERRED — RELEASE BLOCKER** 및 과거 AU raw UNVERIFIED 유지. 다음 내용은 과거 기록으로 보존한다.

> **최신 B7 V3 재개:** [실제 결과](../../customer-account-b7-v3-continuation-results.md). 기존 자원을 재사용해 별도 승인 창에서 gate/Owner health/watchdog을 검증했으나 Chrome 파일 권한 및 운영 탭 자동 관찰로 중지했다. Google/주문 NOT RUN, 복구 PASS, Pages7/7·누적 실행6/120. 현재 OFF/B6/CLOSED, 새 창/배포 자동 재개 금지. **B5 — DEFERRED — RELEASE BLOCKER**, 과거 AU raw UNVERIFIED 유지.

> **최신 B7 V3 조사:** [활성화 게이트 진단·로컬 검증](../../customer-account-b7-v3-activation-gate-investigation.md). 과거 원인은 UNVERIFIED이며 이번에는 원격 쓰기0이다. 이전 실행·자원·만료 window·Pages5/5 기록을 보존한다. 새 창/최소 추가 Pages2회는 아직 승인받지 않았으며 B5는 **DEFERRED — RELEASE BLOCKER**다. 아래 단계는 과거 승인 범위의 기록이며 재실행하지 않는다.

> **B7 V3 준비:** [새 manifest](../../customer-account-b7-execution-manifest-v3.json), [준비 계획](2026-10-18-customer-account-b7-v3-preparation.md), [검증 결과](../../customer-account-b7-v3-readiness.md)를 추가했다. 신규 변수 상한 7개는 로컬 명세이며 실제 추가/활성화/배포는 하지 않았다. V1/V2 승인 기록은 보존하며 V3는 별도 실행 승인이 필요하다. 운영 AU의 과거 raw 설정 차이는 UNVERIFIED다. **B5 — DEFERRED — RELEASE BLOCKER** 유지.

> **B7 V2:** 신규6건을 Renewal v2로 통일한 별도 manifest/실행 계획 및 [로컬 검증 결과](../../customer-account-b7-v2-validation.md)를 작성했다. 기존 V1 승인 기록은 보존하며, 새 SHA에 대한 실제 실행 승인은 대기 중이다. B5는 DEFERRED — RELEASE BLOCKER다.

> **2026-10-18 B7 조건부 실행 중단:** 승인 SHA는 일치하지만 Renewal writes ON에서 신규 legacy fixture 3건이 원본 서버의 `409 RENEWAL_CONTRACT_REQUIRED`로 거부된다. guard 구현/시험 창 개방 전 중단했으며 Account·Function은 OFF다. [실패 근거와 재개 조건](../../customer-account-b7-validation.md). 승인 manifest는 보존했다. 아래 기존 계획은 이 충돌을 해결하기 전 실행하지 않는다.

> **For agentic workers:** REQUIRED SUB-SKILL: 승인 후 `superpowers:executing-plans`로 실행한다. Mac Codex 단독, subagent/Hermes 위임 없음. **B1/B2/B3 및 별도 승인된 B4 테스트 전용 SMTP 검증 완료, Account OFF로 중단.** [B2 결과](../../customer-account-b2-owner-execution.md), [B3 결과와 검증 한계](../../customer-account-b3-google-validation.md), [B4 결과](../../customer-account-b4-smtp-validation.md)를 먼저 읽고 자원 생성/Key 발급/migration/메일 발송/인증 창을 재실행하지 않는다. B5/B7/B8은 별도 승인 전 실행 금지다. 2026-10-18 B6 승인은 test-only reservation-api 및 로컬 sharp/runtime 수정에만 적용한다.

> **B5 사전 점검만 완료:** [실제 설정·운영 영향](../../customer-account-b5-preflight.md), [확정 실행 계획](2026-10-18-customer-account-system-smtp.md), [제안 manifest](../../customer-account-b5-system-smtp-manifest.json). B5 공통 env 변경/system Key/재생성과 공개 OTP는 미실행이다. 다음 실제 적용 승인을 기다린다.

**Goal:** 기존 very-server Appwrite 1.8.1에 운영과 분리한 테스트 프로젝트를 만들고 Google/6자리 OTP·일반 상품 주문을 합성 자료로 검증할 수 있게 준비한다.

**Architecture:** 기존 API/MariaDB/Redis/executor/mail worker는 공유하고, project·Auth users·keys·DB·Function·Google client·SMTP credential은 분리한다. 공통 SMTP 변경은 다른 프로젝트까지 영향을 주는 별도 운영 변경으로 취급한다. 새 호스트, 별도 Docker Compose, Appwrite 설치 또는 Mailpit 설치는 하지 않는다.

**Tech Stack:** Appwrite 1.8.1, 기존 HTTPS API, Web SDK 23.0.0 / node-appwrite 22.1.3, Google OAuth2, B4에서 검증한 프로젝트별 Resend SMTP, 기존 Node22 runtime.

**Spec:** [최초 조사 및 A01–A11](../../customer-account-auth-test-environment.md), [제품 설계](../specs/2026-10-17-customer-account-design.md), [운영 적용/rollback](../../customer-account-rollout.md). 이 문서가 이전 A2 실행 계획을 대체한다.

## B5 — DEFERRED — RELEASE BLOCKER

B5는 취소가 아니라 뒤로 미룬 필수 작업이다. B6 테스트 Function 성공은 B5 완료가 아니다. 아래 항목이 해소되기 전 native Email OTP는 OFF이며 Google+OTP 최종 출시 준비는 미완료다. Google-only 출시는 별도 제품 결정과 승인이 필요하다.

- [ ] 기존 운영 4개 프로젝트와 Console의 공통 SMTP 영향 검토·승인
- [ ] 테스트 OTP의 수신자 접근 제한과 남용 방지 입증
- [ ] Gallery 설정 의미적 지문 전후 검증 및 B5 raw 지문 예외 검토
- [ ] System SMTP 전용 Sending Key·발신자 확정 및 별도 발급 승인
- [ ] 운영 보호 백업, 정식 root 인증, API/mail-worker 재생성·복구 승인 및 검증
- [ ] 실제 6자리 이메일 OTP와 Google↔OTP 동일 UID 검증

## Global Constraints

- 승인 worktree `/Users/nam9295/Desktop/john_2.0/code/au-cake-customer-account`, branch `feat/customer-account`만 수정한다. 조사 시작 HEAD는 `2150720cfed5b637aec9d35129252f9d87d97d94`다.
- B1의 test project/Account OFF와 B2의 승인된 M1/Key3/DB2/Collection12/Attribute182/Index38/settings1 및 조건부 migration을 완료했다. [B2 결과](../../customer-account-b2-owner-execution.md). 이후 별도 승인된 B3에서 test HTTPS/Google SDK 검증 후 Account OFF로 복원했고 B4에서 테스트 전용 Resend SMTP와 일반 sample 1건 수신을 확인했다. 공통 SMTP/재시작/production Google·사이트 배포는 미승인이다. B6에서 정확히 `ca-test-reservation-api` 1개만 별도 승인됐다.
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

위 B1 이전 4개 모두 version 1.8.1이다. **정정:** SMTP/OAuth는 암호화 envelope로 저장되므로 직접 SQL의 `enabled=null`·`googleEnabled=null`을 미설정으로 판정할 수 없다. 기존 프로젝트의 실제 override/provider 상태는 미판정이다. plain auth 설정의 **`emailOtp=true`, `usersAuthMagicURL=true`**는 4개 모두 관측됐다. 공통 SMTP empty와 OTP host gate도 확인했으므로 저장된 Auth method가 OFF인 것으로 해석하지 않는다. 운영 Google 로그인은 실행·검증하지 않았다. 이후 B1에서 신규 project가 추가되어 총 5개가 됐으며, 신규 project의 Custom SMTP OFF·Google 등 모든 provider disabled는 Console에서 확인했다.

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

현재 API와 mail worker의 `_APP_SMTP_HOST/PORT/USERNAME/PASSWORD/SECURE`는 모두 비어 있고 system sender domain은 `appwrite.io`다. 이 sender를 그대로 Resend로 보내면 검증된 발신 도메인 조건을 충족한다고 볼 수 없다. B5 system sender 후보는 Verified `verygood-chocolate.com`의 `appwrite-system@verygood-chocolate.com`이며 새 domain-scoped system Key가 필요하다. test sender `customer-test@auth-test.verygood-chocolate.com`은 B4에서 별도 subdomain/DNS/전용 Key를 검증했다. test용 값을 인스턴스 전체 기본 발신자로 쓰지 않는다.

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

**승인 A1 확보·B1 완료(2026-10-17):** project ID/name, 기존 Console owner team, 생성 직후 test Account service OFF까지. 다른 단계는 미포함. 실행 시작 HEAD는 `df0f1d4`다.

**변경 자원:** 신규 project 및 Appwrite 내부 namespace, 그 project의 service 설정만. 새 DB/Function/key/provider/SMTP 없음. 재시작 없음.

- [x] 실행 직전 branch/HEAD/clean, 기존 4개 project metadata·후보 ID 부재·서버 여유를 재확인했다.
- [x] 정식 owner Console에서 지정 project 1개만 생성했다. 기존 project 복제·전체 setup은 실행하지 않았다.
- [x] 새 project Account service OFF를 저장하고 reload 및 API 403으로 확인했다. 개별 Auth method는 기본값을 유지하며 이후 ON/방법 선택은 별도 승인 대상이다.
- [x] 신규 test DB·Collection·Function·bucket·API key·platform·변수 0, Google 등 OAuth disabled·Custom SMTP OFF를 확인했다. 기존 project 9범주 지문이 모두 동일하며 내부 namespace와 사용자 자원을 구분했다.
- [x] [실제 생성 ID·자원·검증 결과](../../customer-account-b1-validation.md)를 기록했다. **B2 전에 중단한다.**

## B2: test target guard·전용 key·합성 baseline

**진행 상태: B2 완료.** Console UI 중단 후 사용자가 공식 Owner API/CLI 인증 경로를 승인했고, exact manifest/legacy scope로 자원 생성 및 조건부 owner1+1 apply를 마쳤다. [최종 결과](../../customer-account-b2-owner-execution.md)를 기준으로 중단한다. Account/customer flags OFF, test Function0. 기존 seed CLI는 offline-only다. B3 이후는 별도 승인 전 실행하지 않는다.

**Files:** 새 `scripts/customer-account-test-target.mjs`, `scripts/customer-account-test-baseline.mjs`, `tests/customer-account-test-target.test.mjs`, `scripts/seed-customer-account-test-project.mjs`, `tests/customer-account-test-seed.test.mjs`, `scripts/provision-customer-account-test-project.mjs`, `tests/customer-account-test-provision.test.mjs`; 결과 `docs/customer-account-provider-test-results.md`. private run manifest는 Git 제외. 기존 `scripts/migrate-customer-account-schema.mjs`를 재사용한다. 후속 `scripts/customer-account-test-owner.mjs`, `scripts/customer-account-test-monitor.mjs`와 대응 테스트/실행 결과 문서를 추가했다.

**Interfaces:** `assertCustomerAccountTestTarget({endpoint,projectId,resources}) -> frozen target` 또는 throw. `resources`는 databaseIds/functionIds의 명시 allowlist subset이다. `buildCustomerAccountTestSeedPlan({target,adminUserIds,runId}) -> {creates,fixtures,migration,env,...}`는 승인된 test IDs의 create만 계획한다. 기본 dry-run, 기존 document update/delete·guest owner backfill 없음.

- [x] 같은 host의 모든 운영 project, 혼합 DB/Function, redirect/unknown key 소속을 거부하는 RED → GREEN을 완료했다. 잘못된 대상/operation/header의 network count 0을 확인했다.
- [x] guard/seed/provision/Owner/monitor30개(Node24/22), account89개, 전체1,865 pass/0 fail/기존 skip1 및 lint/TypeScript 통과. 실제 공급자 인증은 미실행이다.
- [x] 정확한 2 DB/12 collections/181 baseline attributes/37 indexes, owner1+1, M UID/ACL, Key3/scope/expiry와 settings fixture를 승인·생성·검증했다. 승인 manifest hash는 유지했다.
- [x] 기존 Owner의 공식 CLI 로그인 + 1.8.1 Owner REST로 metadata부터 검증한 뒤 bootstrap/fixtures를 발급했다. exact scope/만료와 project-scoped GET, metadata smoke 통과. 운영 접근 probe 없음.
- [x] 빈 test baseline만 승인된 seed plan으로 생성한다. 모든 고객·쿠폰·날짜·이메일은 run ID가 있는 합성 자료이며 운영 schema/data export 없음. 순차 available 확인 및 실제 monitor로 완료했다.
- [x] test 관리자 M UID와 정확한 schema ACL을 검증한다. 전용 migration GET-only dry-run → 결과 검토 → **apply 승인이 있는 경우에만** test apply → available 재확인한다. private 권한 자동 완화 금지. 실제 누락 정확히2개 → 승인된 test apply → 사후 GET dry-run changes[]를 검증했다.
- [x] 실제 생성 자원·권한·기능 OFF를 기록하고 보고한다. Function·Google·SMTP·재시작은 이 승인에 포함하지 않는다. B2에서 중단한다.

## B3: 테스트 HTTPS·Google 설정

**승인 A3 필요:** 테스트 frontend 호스팅/DNS/TLS·test Web platform, Google Cloud client/consent/test users, test provider 설정 및 제한된 Google Auth SDK smoke. 운영 사이트 배포 아님.

- [x] test origin의 호스팅 위치와 DNS/TLS를 승인받고 준비한다. 새 Linux/Compose/Appwrite는 설치하지 않는다. wildcard/운영 stage origin을 재사용하지 않는다.
- [x] test project에 exact hostname을 Web platform으로 추가하고 별도 Google client의 Appwrite callback을 exact 등록한다. secret은 test project에만 저장한다.
- [x] 테스트 계정 G1/E1/B/M과 허용된 접속 범위를 검토한다. test Account service를 필요한 기간에만 ON, Email OTP/Magic URL 등 미검증 방법은 OFF로 유지한다. 고객 비밀번호 가입 UI는 만들지 않으며 관리자 비밀번호 계약은 보존한다.
- [x] 공통 SMTP 없이 가능한 신규 Google·로그아웃·세션 restore의 SDK 단독 smoke를 수행했다. Function readiness가 없는 상태를 제품 `/account` 통합 성공으로 보고하지 않는다.
- [x] 실제 Google 동의 취소/access_denied 실패 복귀, 로그인 중 재진입 버튼 차단과 cookie 격리의 검증 범위를 기록했다. 다른 Google 계정으로 기존 identity를 연결하는 실험은 하지 않았다. production provider/client·관리자 권한은 변경하지 않았다. 결과 보고 후 Account OFF로 중단한다.

**B3 결과:** [최종 검증](../../customer-account-b3-google-validation.md). 테스트 Google 1명 추가, M+G 총2명. Google Testing의 기본 scope 예외를 설명하고 별도 승인받아 authLimit2/15분 이내/자동 OFF 감시로 한정했으며 약6분51초 후 OFF했다. 이메일 allowlist 보장으로 해석하지 않는다. 시크릿 cookie 격리는 사용자 보조 확인이며 실제 OTP/동일 이메일 UID 통합/제품 account·order/실기기 검증은 미완료다. B4 이후를 자동 진행하지 않는다.

## B4: 프로젝트별 Resend SMTP 준비

**승인 A4 아래 완료:** 현재 계정 소유자 접근 확인, test 발신 subdomain/DNS 검증·전용 sending key, test SMTP override, 사용자가 지정·승인한 수신함에 일반 sample 1건 발송·수신. 공통 설정·재시작은 미포함. 재실행하거나 B5로 자동 진행하지 않는다.

- [x] 현재 공식 Resend Owner Console에서 기존 verified domain·quota·Sending access Key metadata를 확인했다. 보관 key의 `/domains` 401을 운영 장애로 단정하지 않았고 운영 Key/Function은 변경하지 않았다.
- [x] `auth-test.verygood-chocolate.com`과 신규 DNS3를 검증하고 테스트 도메인 전용 Sending access Key 1개를 구성했다. 도메인 제한이 TO allowlist가 아님을 명시하고 Account OFF/보호 credential/1회 승인 주소 helper를 유지했다. 실제 OTP 활성화는 보류했다.
- [x] test project에만 `smtp.resend.com:465` / `ssl` override를 저장했다. secret은 Git 제외 보호 파일과 테스트 SMTP에만 보관하고 출력하지 않았다. Auth/OAuth 지문은 동일했다.
- [x] 지정·승인된 수신함에 일반 SMTP sample을 1회 제출했다. Appwrite204/전용 Key 사용1회·200/사용자 받은편지함1건 수신을 확인했다. **이는 공통 host gate를 통과하는 OTP 성공이 아니다**.
- [x] [B4 결과](../../customer-account-b4-smtp-validation.md)에 증거와 한계, 기존4 project/핵심 container 불변을 기록했다. Account OFF·신규 인증 창 OFF, CLI current session logout으로 중단했다. 공통 SMTP·재시작·B5는 실행하지 않았다.

## B5: 공통 SMTP와 두 서비스 재생성 — 운영 변경 전용 승인

**승인 A5 필요:** system sender/새 system key·공통 SMTP 값, 기존 네 프로젝트/Console의 이메일 경로 변화 수용 또는 별도 보호 설정, 저부하 시간·API 중단 범위, 백업·두 서비스 재생성·원상복구 권한. A1/A4로 대체 불가.

**2026-10-18 사전 점검:** 기존4 모두 Account/OTP/Magic URL/Email-Password ON, SMTP override OFF, session alerts OFF를 공식 Console에서 확인했다. queue0/processing0/failed1, `.env` root:root0644·비 UTF-8 bytes, 비대화식 sudo 실패를 기록했다. [B5 실행 계획](2026-10-18-customer-account-system-smtp.md)의 7개 변수·root 보호 백업·bytes 보존·worker→API 적용/API→worker 복구·AUTH-only 검증을 따른다. 이 결과는 실제 적용 승인이 아니며 아래 쓰기 항목은 계속 미완료다.

Gallery raw config 지문 예외도 해당 보고서에 남겼다. 정상 조회의 활동 저장·무작위 IV 재암호화와 일치하지만 이전 semantic 자료가 없어 전부 불변을 확정하지 않는다. raw 증거를 보존하고 공식 Owner GET 기반 전후 semantic 비교·예외 검토를 실제 적용의 선행 gate로 추가했다.

- [ ] 바로 전 compose/env/이미지 ID·metadata hash를 접근 제한된 서버 디렉터리에 백업한다. SMTP 외 설정 변경 여부, worker/API consumer 목록, 운영 metadata 불변을 확인한다.
- [ ] 승인된 실제 Resend host/credentials·verified system sender만 설정한다. 임의 가짜 host, test sender의 전역 적용, Mailpit 전환 금지. 기존 Auth 설정을 임의 OFF/ON하지 않는다.
- [ ] 기존 compose의 mail worker 1개만 원래 이미지로 재생성하고 상태·비민감 진단을 확인한다. API는 이 시점까지 기존 환경을 유지한다.
- [ ] API 1개만 같은 방식으로 재생성한다. SQL/queue/customer data 접근 없이 public health/version·예정된 synthetic smoke로 준비 상태와 SMTP gate를 확인한다. `running`만으로 끝내지 않는다.
- [ ] 기존 DB/Function/ACL·비SMTP env 불변, test SMTP override·운영 HTTP Resend 설정 불변, host 자원/공유 서비스 상태를 확인한다. 운영 주문 생성/고객 조회는 smoke에 포함하지 않는다.
- [ ] 실패하면 test 요청을 차단하고 승인된 SMTP keys의 원래 값으로 복원, 두 서비스만 재생성한다. 전체 `.env` 덮어쓰기/DB restore/Redis flush 금지. 결과 보고 후 중단한다.

## B6: 승인된 테스트 전용 reservation-api 구축

**2026-10-18 승인:** 로컬 sharp 패치와 분리된 Node22 배포 경로, `ca-test-reservation-api` 1개 구축·검증. 운영 Function/DB/ACL/판매·가격·쿠폰 정책 변경은 금지한다. B5와 B7의 선후 순서만 분리하며 B5 출시 blocker는 유지한다.

- [x] 실행 직전 Settings ID/endpoint, 정식 Owner, Account OFF/인증 7개 OFF, Google·SMTP 보존, B2 schema/ACL, 기존 4개 metadata와 host 여유를 확인한다.
- [x] reservation 및 로컬 시험용 sharp만 0.35.5로 패치한다. 별도 review-api 0.35.4는 미해결 추적하며 배포하지 않는다. JPEG/PNG/WebP·잘못된 형식·픽셀·메타데이터 회귀를 검증한다.
- [x] production Node16 기본값과 기존 Custom opt-in 계약을 유지하고 exact test pair/DB/Function에서만 `node-22`를 명시 선택한다. Custom 배포 flag를 켜지 않는다. runtime 선택·대상 제한 RED→GREEN.
- [x] 공식 registry의 node-22/활성 1vCPU·1GiB를 확인한다. 공식 Owner CLI 관리 경로로 create-only Function 1개·test 전용 변수·deployment 1개만 만든다. 새 API Key는 필요하지 않으면 발급하지 않는다.
- [x] `enabled=false`, execute roles `[]`, events `[]`, schedule empty, customer OFF, test DB/Admin M 매핑, test-only 새 HMAC/PIN을 사용한다. SMTP/Resend/payment credential을 넣지 않는다. Function 생성에 수반되는 내부 비활성 schedule metadata는 활성 작업이 아니다.
- [x] Appwrite 1.8.1 Function API에는 per-Function build/execution concurrency 인자가 없다. 전역 executor 설정은 변경하지 않고, 공개 실행 차단과 관리 runner의 단일 in-flight 작업으로 이번 시험 동시성 1을 유지한다. 이를 서버의 별도 hard-cap 설정으로 보고하지 않는다.
- [x] source/package/lock/native-smoke만 archive에 담고 `npm ci --omit=dev --include=optional` 후 실제 Linux x86_64 Node22 codec gate를 실행한다. 실패 시 activate/retry/overwrite/delete하지 않는다.
- [x] readiness·test schema·allowlist/ACL·guest 유효성/lookup·private 직접 접근 거부·customer OFF 차단을 검증한다. actual JWT/회원 주문/MY ORDERS는 B7 미실행으로 기록한다.
- [x] 전체 npm test, account, Node22 focused, lint/TS, KR→AU 순차 빌드, 서버 자원·기존 운영 불변을 검증하고 커밋·결과를 보고한 뒤 중단한다. Account/Email OTP는 OFF이며 B5/B7/B8 자동 진행 금지.

실제 결과와 검증 한계: [B6 결과](../../customer-account-b6-function-validation.md). 정상 guest 생성은 로컬 suite, 실제 Function은 validation/lookup까지만 확인했다. 실제 JWT/회원 주문은 B7 미실행이다.

## B7: 실제 인증·주문 인수

**V3 HTTPS 재개 최신 결과:** [보고](../../customer-account-b7-v3-https-resume-results.md). 추가 Pages3회·누적5회 승인 아래 HTTPS와 실제 guarded runtime을 검증했으나 OPEN 후 readiness gate에서 중단했다. Account/공개 Function ON0, 자동 OFF/B6/사이트 CLOSED 복원 verified=true. Google·회원 주문은 NOT RUN, Pages5/5를 임의 재설정하지 않는다. B5 DEFERRED — RELEASE BLOCKER와 과거 AU 지문 UNVERIFIED 유지.

**2026-10-18 V3 조건부 실행 중단:** [최신 결과](../../customer-account-b7-v3-execution-results.md). V3 별도 승인·로컬 보호 검증 후 CLOSED preview의 실제 Checkout 경로404에서 중단했다. 인증 창·Function·새7변수·H·쿠폰·주문은 미실행이며 CLOSED 복원했다. Pages2/3회를 사용해 재실행 예산을 임의 재설정하지 않는다. 아래 초기 계획·승인 기록은 보존하며 V1/V2를 재실행하지 않는다. **B5 — DEFERRED — RELEASE BLOCKER**는 계속 미완료다.

**2026-10-18 Google-only 준비 계획 작성, 실행 미승인:** [B7 준비 결과](../../customer-account-b7-preflight.md), [상세 계획](2026-10-18-customer-account-b7-google-orders.md), [제안 manifest](../../customer-account-b7-execution-manifest.json). 원래 B7의 OTP/교차 UID 범위는 B5 release blocker로 남기며 이번 준비가 ON/주문 생성 승인이 되지 않는다.

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

**B1은 완료했다.** 정식 Console owner 접근을 확인한 뒤 `verygood-au-account-test`만 생성하고 Account OFF를 저장했다. 프로젝트 생성에 공통 SMTP 변경·서비스 재시작은 필요하지 않았다. SQL은 읽기 전용 metadata 비교에만 사용했고 운영 API key 권한을 확대하지 않았다. 프로젝트를 다시 생성/자동 삭제하지 않는다.

**실제 OTP 및 주문 통합 테스트를 바로 시작할 준비는 완료되지 않았다.** 유효한 Resend 계정/domain·전용 키, 합성 수신자 제한, system sender, 기존 네 프로젝트 이메일 영향 승인, API/mail-worker 재생성 시간·복구 승인이 필요하다. Function 주문 통합은 별도 sharp/runtime 해결 gate도 통과해야 한다. 이 조건을 프로젝트 생성 승인에 포함된 것으로 간주하지 않는다.

B1에서는 test project 생성·Account OFF만 수행했다. 후속 B2는 별도 자원/Owner API 경로 승인 아래 [최종 결과](../../customer-account-b2-owner-execution.md)대로 test 자원·조건부 migration까지 완료했다. 고객 로그인·메일·Function/사이트 배포·운영 schema/권한 변경은 미실행이다. B3 이후 승인을 기다린다. A2/runtime/native 분석과 최초 중단 기록은 역사적 근거로 보존한다.
