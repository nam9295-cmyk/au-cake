# Customer Account Provider Test Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task by task after explicit approval. Mac Codex 단독으로 수행하며 subagent/Hermes에 넘기지 않는다. 체크되지 않은 모든 항목은 미래 작업이다.

**Goal:** 운영 자원과 분리한 Appwrite 1.8.1에서 Google/6자리 OTP·주문 소유권·guest 복구를 실제 검증한다.

**Architecture:** 별도 Linux x86_64 호스트에 전용 Appwrite/MariaDB/Redis/executor/Mailpit을 둔다. 정확한 endpoint/project와 합성 fixture만 허용하는 실행 guard를 먼저 만든다. provider 시험과 sharp/runtime 개선은 별도 검토 단위로 진행하며 production으로 승격하지 않는다.

**Tech Stack:** Appwrite 1.8.1, Web SDK 23.0.0, node-appwrite 22.1.3, exact Node22 Linux musl runtime, Google OAuth2, SMTP/Mailpit, 기존 Node/Chrome/WebKit tests.

**Spec:** [사전 조사·비교·위험 및 A01–A11 기준](../../customer-account-auth-test-environment.md), [기존 제품 설계](../specs/2026-10-17-customer-account-design.md).

## Global Constraints

- 현재 승인은 조사·문서까지만이다. 이 계획의 실행은 승인되지 않았다.
- 작업 worktree는 `/Users/nam9295/Desktop/john_2.0/code/au-cake-customer-account`, branch `feat/customer-account`만 사용한다.
- production 변경/고객 데이터 접근·수정/main 병합/원격 삭제/reset/history rewrite/GC 금지.
- Google OAuth2 + Email OTP만, 일반 케이크·초콜릿만 회원 연결. Custom Cake/Kids Class 회원 연동·owner schema·OAuth 폼 복원 제외.
- 기존 판매·가격·쿠폰·결제 정책 불변. frontend/server flag 기본 OFF. 실제 결제 금지.
- schema allowlist `APPWRITE_ADMIN_USER_IDS`, 기존 admin API `REVIEW_ADMIN_USER_IDS`; 새 이름/권한 완화 금지.
- 모든 실제 provider·리소스 생성·schema apply·배포·외부 발송은 각각 명시된 테스트 대상 승인 후 수행한다.
- 실패를 숨기거나 기존 tests를 삭제/약화하지 않는다. 코드 수정은 RED → 최소 구현 → GREEN → 관련 회귀 → 별도 커밋.

## Review Focus

- 잘못된 endpoint/project/env 상속으로 production을 호출하지 않도록 최초 network 전에 거부한다(P1).
- Mailpit 성공을 외부 inbox 수신으로 오인하거나 프로젝트 SMTP만으로 1.8.1 gate를 통과했다고 오인하지 않는다(P2/P4).
- 기존 세션/같은 mailbox alias 때문에 동일 이메일 UID 시험이 거짓 양성이 되지 않도록 두 순서의 clean Account와 명시적 logout을 사용한다(P4).
- Node22 실제 운영 상태와 로컬 Node16 deploy 기본값의 차이, optional native package 누락을 archive 생성 전에 차단한다(P3).
- OAuth 중 다른 탭 cart/만료 draft/연락 이메일 수정이 owner나 주문 재시도를 바꾸지 않도록 실환경으로 반복한다(P5/P6).

## 파일과 승인 경계

**이번 작성 파일:** 이 계획과 `docs/customer-account-auth-test-environment.md`뿐이다.

**다음 실행 승인 후 작성할 파일:**

| 파일 | 목적 |
| --- | --- |
| `scripts/customer-account-test-target.mjs` | nonproduction target pair/manifest·요청 사전 검증. 제품 코드에 import하지 않음 |
| `tests/customer-account-test-target.test.mjs` | production/mixed target/redirect/unknown mapping 거부 |
| `scripts/seed-customer-account-test-project.mjs` | 승인된 새 테스트 프로젝트의 합성 baseline schema/fixtures만 생성, dry-run 기본 |
| `tests/customer-account-test-seed.test.mjs` | write allowlist·no backfill·no Custom/Class ownership·재실행 검증 |
| `tests/customer-account-provider.live.mjs` | 명시적 수동 실행용 실제 Account/owned-order assertion helper; 기본 npm test에 포함하지 않음 |
| `tests/customer-account-provider-helper.test.mjs` | helper의 대상 차단·UID 비교·민감정보 제거를 Mock으로 검증 |
| `docs/customer-account-provider-test-results.md` | 비민감 case 결과·버전·실패/미검증·중단 기록 |

**별도 sharp/runtime 수정 승인 후 수정할 기존 파일:**

- `package.json`, `package-lock.json`.
- `appwrite-functions/review-api/package.json`, `appwrite-functions/review-api/package-lock.json`.
- `appwrite-functions/reservation-api/package.json`, `appwrite-functions/reservation-api/package-lock.json`.
- `scripts/reservation-api-deploy-config.mjs`, `tests/reservation-api-deploy.test.mjs`, `tests/custom-cake-deploy-config.test.mjs`: exact Node22 선택과 engine fail-closed 계약만 수정. Custom gate/판매 로직을 켜지 않음.
- `tests/review-photo-api.test.mjs`, `tests/custom-cake-photo-codec.test.mjs`, `tests/review-api-deploy.test.mjs`: patched native 버전·archive·SVG/이미지 안전 회귀를 보강. 필요할 때만 script/package script 추가.
- `docs/customer-account-auth-test-environment.md`, `docs/customer-account-rollout.md`: 실제 승인된 runtime/patch·실행 결과로 보완.

기존 migration `scripts/migrate-customer-account-schema.mjs`, auth/Checkout/Account 제품 코드는 우선 그대로 검증한다. 실제 실패가 제품 변경을 요구하면 원인·영향을 보고하고 승인 범위 내 별도 RED/GREEN fix로 구분한다.

호스트 bootstrap 파일은 승인 후 **전용 테스트 호스트의** `/srv/verygood-customer-auth-test/`에 둔다. installer-generated compose/env와 image digest manifest를 사용하고 secret 파일은 Git에 넣지 않는다. 현재 이 디렉터리나 설정 파일을 만들지 않는다.

## P1: 대상 차단과 실행 manifest — 모든 외부 작업의 선행 gate

**Files:** Create target helper/test 위 표; Create 비추적 private `customer-auth-test-run.json`(저장 위치는 실행 승인 시 지정).

**Interfaces:** `assertCustomerAccountTestTarget({endpoint,projectId,manifest}) -> {endpoint,projectId}` 또는 throw. manifest에는 `mode:'isolated-instance'|'shared-project'`, 정확한 승인 pair, 금지 production pair, 승인된 resource IDs, test origin, 버전, run ID, 발송 허용 범위가 있다. secret은 포함하지 않는다.

- [ ] production pair, 다른 project, scheme/userinfo/query/fragment/redirect 및 mixed DB/Function mapping을 넣는 failing tests를 작성한다. shared mode에서는 같은 host의 승인된 test project만 허용하는 case도 작성한다.
- [ ] `node --test tests/customer-account-test-target.test.mjs`의 RED를 확인한다.
- [ ] exact pair·HTTPS `/v1`·manifest mapping을 검사하고, network 호출 전에 throw하는 helper를 구현한다. production `.env` 자동 로드나 implicit fallback은 금지한다.
- [ ] 위 test GREEN 및 fake transport call count 0을 확인한다. mail/browser runner도 guard를 호출하도록 한다. live helper를 기본 suite에서 실행하지 않는지 검사한다.
- [ ] 로컬 커밋: `test: guard customer auth tests against production targets`.

**Gate:** 사용자가 선택한 A2 호스트/domain·예산·키 발급·데이터 보존 범위가 승인되고 manifest가 검토됨. B 선택 시 공통 SMTP 영향/복구를 별도 승인받기 전 P2 이후 OTP 진행 불가.

## P2: 격리 호스트와 내부 SMTP 수신 — 운영 서버 미접촉

**Files:** 전용 호스트 compose/env/digest manifest, 결과 문서. 저장소 제품 변경 없음.

**Interfaces:** 정확한 Appwrite 1.8.1 HTTPS endpoint, 빈 전용 project, 내부 SMTP sink, 버전/digest·자원 증거를 P3/P4에 제공.

- [ ] 승인된 별도 x86_64 호스트의 4vCPU/8GiB RAM/2GiB swap/50GiB available, 포트·접근·비용·로그 상한을 확인한다. 신규 Docker 설치도 승인 범위에 포함되어야 한다.
- [ ] `appwrite/appwrite:1.8.1` installer의 release compose를 생성/검토한다. 저장소 루트 development `docker-compose.yml` 또는 최신 2.x 설치 명령을 복사하지 않는다. 별도 secret/DB/Redis/executor/volumes를 사용한다.
- [ ] 초기 자원은 build/execution 동시성 1로 시작한다. 운영의 `s-8vcpu-8gb`를 그대로 복사하지 않는다. test Function의 작은 specification과 host peak를 기록한다.
- [ ] 전용 Mailpit의 SMTP는 내부 network, UI는 loopback/tunnel로 제한한다. relay/forward OFF. 공통 SMTP host를 이 실제 sink로 설정한다. 테스트 프로젝트를 만들고 Google/OTP 이외 제품 로그인 방법은 승인 설계대로 제한한다. 관리자 비밀번호 로그인은 보존한다.
- [ ] test-only 메일 1건이 sink에 도착하고 외부 전송 0인지 확인한다. 공통 host empty일 때 OTP 실패와 정상 설정 시 OTP route 진입을 격리 환경에서 비교한다. 실제 OTP 검증은 P4에서 수행한다.
- [ ] `/health/version` exact 1.8.1, 독립 volume/network/secret, 운영 endpoint 연결 0, DNS/TLS/SSH 제한, 기준 RAM/CPU/disk를 기록한다. 실패하면 테스트 스택만 중지하고 증거를 보존한다.
- [ ] 결과 문서 커밋: `docs: record isolated Appwrite test infrastructure`.

**Gate:** 운영 DB/네트워크 mount·SMTP credential 없음. 모든 실제 조작은 승인된 test host/project에 한정. 문서 작성 승인을 인프라 승인으로 취급하지 않음.

## P3: runtime/패치·합성 schema·Function 준비

**Dependencies:** P1/P2, 별도 로컬 sharp/runtime 변경 승인 및 test resource 생성/배포 승인. 승인되지 않은 부분은 미실행으로 남긴다.

**Interfaces:** Node22에서 설치 가능한 patch archives, `customer-account-health` ready test API, private 합성 DB, guest/member 시험용 run fixture IDs.

Seed의 `buildCustomerAccountTestSeedPlan({target,resources,adminUserIds,runId}) -> {creates,fixtures}`는 P1의 검증된 target과 승인된 정확한 resource ID 목록만 소비한다. 기본 dry-run은 계획만 반환하고, 승인된 실행 모드만 해당 test IDs에 create한다. 기존 document update/delete와 owner backfill은 계획에 포함할 수 없다.

- [ ] reservation runtime test에 exact Node22가 Custom backend flag 없이 선택되는 case와 Node16+sharp artifact가 network 이전에 거부되는 RED를 추가한다. transaction/Custom 조건부 정책은 완화하지 않고 일치 여부를 별도로 검증한다.
- [ ] 관련 deploy test를 실행해 RED 확인 후 reservation runtime 선택 계약만 정정한다. Custom의 persistence/recovery/schedule·판매 opt-in은 그대로 강제하고, reservation-notification의 기존 runtime gate도 유지한다. 두 Function을 함께 검사하는 기존 tests는 이 차이를 분리해 명시한다. 새 production 환경변수나 Custom 활성화 우회는 추가하지 않는다. GREEN·기존 deploy/Custom config 회귀 후 별도 커밋 `fix: align reservation deployment with verified Node 22 runtime`.
- [ ] root/각 Function의 `sharp@0.35.5` exact 기대값, archive lock 및 SVG 위장 입력·기존 codec 출력을 검사하는 RED를 추가한다. 악성 exploit payload는 만들지 않는다.
- [ ] **6개 manifest/lock**만 대상으로 명시적 patch를 적용한다. 전체 audit fix 금지. root `npm ci`와 두 Function `npm ci --omit=dev`를 깨끗한 승인된 설치 디렉터리에서 확인한다. optional dependencies를 유지한다.
- [ ] review builder와 reservation checkpoint/full builder로 source archive를 만든다. archive 안 manifest/lock SHA·0.35.5, 필요한 shared/src, no `.env`/secret/node_modules를 확인한다. archive import가 판매 정책을 바꾸지 않는지 기존 tests와 대조한다.
- [ ] 승인된 Linux x64 musl Node22 exact image에서 fresh install·import·`sharp.versions`를 확인한다. sharp 0.35.5 / native bundle 1.3.4 / vips 8.18.7 / rsvg 2.63.2가 기대값이다. 실행 예정인 다른 glibc 환경도 따로 확인한다. 테스트/전역 libvips override로 구버전이 선택되면 중단한다.
- [ ] `node --test tests/review-photo-api.test.mjs tests/custom-cake-photo-codec.test.mjs tests/review-api-deploy.test.mjs tests/reservation-api-deploy.test.mjs tests/custom-cake-deploy-config.test.mjs`와 `npm run test:custom-cake-photos`를 GREEN으로 만든다. 실제 HEIC/AVIF·WebP·EXIF·회전·과대/손상·SVG 거부·preview/cleanup 및 root SVG crop 품질을 확인하고 sharp 변경만 별도 커밋한다.
- [ ] seed helper tests로 production/mixed IDs/no allowlist/기존 document 변경을 거부하고, 빈 cake/kids baseline의 정확한 private/public-read-only ACL과 idempotent seed plan을 검증하는 RED를 만든다. 신규 고객 테이블·Custom/Class owner 정의는 허용하지 않는다.
- [ ] dry-run 기본 seed helper를 구현하고 Mock GREEN 후, 승인된 **빈 test project**에만 baseline schema와 합성 pickup/settings/coupon fixtures를 생성한다. 전체 production setup을 실행하거나 운영 schema/data export를 가져오지 않는다. 기존 판매 OFF 상품은 그대로 둔다.
- [ ] 관리자 M UID와 `APPWRITE_ADMIN_USER_IDS`/`REVIEW_ADMIN_USER_IDS`를 대조한다. broad private ACL/미분류 resource는 flag OFF·보고, 자동 권한 수정을 하지 않는다.
- [ ] P1 guard를 통과한 test 환경에서 기존 `node scripts/migrate-customer-account-schema.mjs --dry-run`을 수행한다. GET-only changes가 reservations optional `customerUserId` size36 및 `customerUser_created_idx` `[customerUserId,$createdAt] [ASC,DESC]`뿐인지 검토한다. **별도 apply 승인 범위가 있을 때만** apply 후 dry-run으로 available/무변경을 확인한다.
- [ ] test API를 customer flag OFF로 배포한다. registry exact `node-22`/digest, SDK/JWT/transaction과 guest smoke가 통과해야 한다. 현재 deploy rollout이 checkpoint/full에서 다루는 기존 판매 정책까지 검토한 승인 artifact만 사용한다.
- [ ] 전체 npm test·신규 account·lint/TypeScript·AU/KR build GREEN, test native/guest/private ACL 증거를 기록하고 seed/docs를 독립 커밋한다. P4 전까지 test frontend/server customer flags OFF를 유지한다.

**Gate:** stock 1.8.1과 실제 현재 운영 인스턴스의 transaction/runtime 계약이 다르면 원인을 보고한다. registry/권한/가격·Custom flags를 우회해서 시험을 통과시키지 않는다.

## P4: 전용 Google·OTP와 UID 연결 검증

**Dependencies:** P3; Google/SMTP 테스트 client·mailbox·발송 승인.

**Files:** Create `tests/customer-account-provider.live.mjs`; Modify 결과 문서. 기존 Mock browser scripts는 그대로 보존.

**Interfaces:** 승인된 G1/E1/B/M test accounts, 비민감 `caseId`, masked UID 비교/HTTP 결과. OTP/secret/token을 증거에 저장하지 않음.

`assertSameCustomerIdentity({beforeUserId,afterUserId,orderOwnerId}) -> void`는 세 값이 같은 경우만 통과한다. `redactProviderEvidence(input) -> safeEvidence`는 case ID·상태·UID 일치 boolean만 반환하며 email/token/cookie/code/OTP 원문을 제거한다. helper는 이 live 파일에서 export하고 일반 Mock tests가 import할 때 network가 실행되지 않도록 direct-entry guard를 둔다.

- [ ] `tests/customer-account-provider-helper.test.mjs`에 target 거부 시 요청 0, 세 UID 중 하나라도 불일치 시 실패, Cookie/JWT/OTP/code 제거 및 import만으로 network 0인 tests를 작성한다. `node --test tests/customer-account-provider-helper.test.mjs`의 RED/GREEN으로 구현한다. 인증 세션 secret을 명령행 인자에 넣지 않는다.
- [ ] 별도 Google 웹 client/consent와 test users를 설정한다. Appwrite 제공 Google callback과 앱 success/failure URL을 각각 검토한다. `redirect_uri_mismatch`·provider 거부도 확인한다. 운영 관리자 client를 수정하지 않는다.
- [ ] test-only flags를 준비 순서대로 활성화하고 실제 A01/A02를 실행한다. 각각 clean Account, primary email, 명시적 logout을 사용하고 두 provider 전후 `$id`·기존 member 주문 owner가 같음을 검증한다. 이메일 guest backfill은 0이어야 한다.
- [ ] 내부 sink의 실제 6자리 OTP로 A03/A04를 수행한다. 잘못됨·만료·재사용·재전송·중복·세션 revoke/계정 전환을 확인한다. 서버 rate limit을 전역 해제하거나 운영 주소로 발송하지 않는다.
- [ ] 승인된 외부 SMTP sandbox/발신 subdomain·수신자 allowlist를 test project에만 설정한다. Google-backed 테스트 inbox 실제 수신·TLS/인증·spam·locale와 6자리 로그인까지 확인한다. SMTP test 메일 성공만으로 끝내지 않는다.
- [ ] project override 해제 → 내부 sink fallback, 외부 SMTP 오류 → guest 진행을 확인한다. 같은 host 공통 SMTP 설정 변경은 A2에만 한정한다.
- [ ] case별 pass/fail/not-run, test project·SDK/runtime digest, 실제 UID 동일 여부를 결과 문서에 기록·커밋한다. 계정 중복/owner 분리면 P5 활성화를 중단하고 원인을 보고한다.

## P5: 실제 주문·권한·Checkout·관리자 인수

**Dependencies:** P4. 실제 합성 주문·쿠폰·격리 알림과 직접 ACL 시험 승인.

**Files:** live assertion helper와 결과 문서. 실패 수정은 기존 관련 auth/Checkout/ownership tests에 RED를 추가한 별도 변경으로 검토.

- [ ] [조사표 A05–A10](../../customer-account-auth-test-environment.md)의 case를 승인된 합성 fixtures로 실행한다. 일반 케이크/초콜릿 member/guest만 create하고 운영 사이트/API 요청 0을 확인한다.
- [ ] 실제 Google 성공/취소/오류 후 Bag·13:00·옵션·coupon·requestId, 다른 탭 cart 변경, 저장 중 폼/계정 draft·연락 이메일 분리를 확인한다. 만료 draft/storage 실패 시 자동 주문/덮어쓰기 0.
- [ ] A/B order detail/cursor·foreign/missing/guest404·API key 없는 직접 DB read/write·위조 body/header/JWT·만료 JWT를 확인한다. 요청 data의 임의 UID나 이메일로 소유권을 인정하면 실패다.
- [ ] idempotent 동시 requestId·coupon claim·ambiguous retry를 시험한다. 주문 1개·쿠폰 1회 및 기존 가격·연락처 snapshot 불변을 확인한다. payment는 기존 테스트 계약/합성 상태만, 실제 charge 0.
- [ ] guest 예약번호+전체 전화 lookup, flag OFF 및 auth 오류 후 guest 주문·조회, M Google/비밀번호·고객 세션 보존·일반 고객 관리자 API403을 확인한다.
- [ ] 알림은 전용 transport/허용 수신함에만 전달하고 run ID별 중복 0을 확인한다. schedule/event를 켜야 한다면 test 리소스만 별도 승인 범위에서 실행한다.
- [ ] Chrome/WebKit 및 실제 iPhone Safari/Android Chrome에서 EN/KO, 재방문 session cookie·focus·2탭·OAuth round trip을 반복한다. 실기기가 없으면 not-run으로 기록한다.
- [ ] 전 case 결과/실패 원인·정확한 증거 위치를 커밋한다. provider 장애와 Appwrite DB 전체 장애를 구분하고 전자를 guest fallback으로 검증한다.

## P6: OFF 복구·최종 검증·보고 후 중단

**Dependencies:** P5. 테스트 자원 중지/키 revoke/정리 범위 사전 승인.

**Files:** 결과·rollout 문서만. production 코드/설정 승격 없음.

- [ ] 테스트 frontend/server flags를 OFF로 전환한다. 진행 중 OAuth callback·30분 draft와 guest create/lookup, 기존 member 데이터 비공개·관리자 권한 유지를 확인한다. profile/order snapshot을 삭제/재귀속하지 않는다.
- [ ] 테스트 진입·메일·필요 없는 Function/schedule을 중지하고 테스트 키를 revoke한다. volume·합성 데이터·증거는 보존한다. 삭제는 이후 승인된 정확한 test IDs만; 공유 host 전체 compose down/volume prune/DB restore 금지.
- [ ] 새 코드가 있다면 `npm test`, `npm run test:customer-account`, `npm run test:renewal`, `npm run lint`, `npx tsc -b --pretty false` 및 flag OFF AU/KR build를 실행한다. 기존 1835 pass/1 skip 기준에 새 테스트 수를 더해 fail/skip/not-run을 분리 보고한다. KR 생성 후 AU를 마지막 build해 기존 public SEO 파일 변화를 점검한다.
- [ ] root와 Function별 production audit, patched manifest/archive hash, Linux loader/codec, provider/ACL/session/guest 결과를 기록한다. 모든 pass/미검증/남은 위험을 구분한다.
- [ ] 최종 diff·Git clean·main/다른 worktree 불변을 확인하고 결과 문서를 커밋한다. production migration dry-run/apply·Function/site 배포·운영 provider/SMTP·main 병합은 하지 않는다.
- [ ] 사용자에게 결과·비용/자원 peak·미검증·후속 production 승인 항목을 보고하고 중단한다. 실제 테스트 통과를 운영 배포 승인으로 해석하지 않는다.

## 현재 문서 자체 검증

이 계획을 조사 문서 및 원 요청과 대조했다. 환경 비교/SMTP 공통 gate·project override, A01–A11, 개인정보·자원 분리, actual runtime과 Node16 경로, 6개 manifest/lock·archive·native/image tests, 승인·중단·복구를 모두 task에 연결했다. 신규 제품 요구나 Custom/Class 회원 연동을 추가하지 않는다. 이번 단계에서는 어떤 checkbox도 실행 완료로 표시하지 않는다.
