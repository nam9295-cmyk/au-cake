# B7 D1 — 새 runtime guard 통과, health timeout으로 중단

> **후속 읽기 전용 조사:** [timeout 계층·호출 구조·시간 예산](customer-account-b7-d1-timeout-investigation.md). Node soft timeout500을 확인했으나 정확한 DB 대기 단계는 UNVERIFIED다. 신규 배포/execution 없이 로컬 구조 probe10개·기존 관련88개를 통과했고 [최소 계측 계획](superpowers/plans/2026-10-18-customer-account-b7-health-timing-diagnostic.md)을 제안했다. 아래 D1 실제 기록은 보존한다.

2026-10-18 KST. **D1 전체 판정은 FAIL이다.** 배포 전 새 key/window/fixture/flags를 동결한 새 Node22 deployment에서 CONFIG/TIME/SECRET_SHAPE/BODY/HEADERS/SIGNATURE/PATH 검사를 통과했다. 이어진 원래 reservation handler의 첫 `health`가 약19.74초 뒤 timeout/HTTP500으로 끝나 나머지 두 health를 실행하지 않았다. Account와 Function 공개 실행은 열지 않았으며 자동 복구와 별도 Owner GET 검증은 PASS다.

## 승인·보존·사용량

- 대상은 `https://api.verygood-chocolate.com/v1` / `verygood-au-account-test` / `ca-test-reservation-api`뿐이다. 기존 공식 Owner CLI 세션을 사용했고 새 API Key는 발급하지 않았다.
- V1/V2/V3 원본과 V3 `executionApproved=false`, 승인 SHA `1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90`를 보존했다. 별도 Git 제외 D1 proof에 archive/fixture/직전 journal SHA와 deployment1·health3·300초 상한을 연결했다. 기존 실행 기록과 예산을 초기화하지 않았다.
- M/G/H·쿠폰2·30개 변수 중 같은7개 guard/renewal 변수 ID·frozen body를 보존했다. 신규 사용자/쿠폰/주문/변수/DB/ACL/Pages/API Key는0이다.
- **D1 deployment1/1, health1/3. B7 누적8/120**, Function inventory18 = B6 과거10 + B7 8, 미승인 execution0. 실패 뒤 잔여2회를 사용하지 않았다.
- **Pages7/9 그대로**, 이번 배포0. Google 창·사이트 OPEN·실제 고객 JWT·주문은 NOT RUN이다. 수량 잔여는 새 실행 승인을 뜻하지 않는다.
- 보호 파일0600/디렉터리0700·Git 제외. raw key/JWT/Cookie/HMAC/환경변수 원문/고객정보 출력0, CUA/getApp/자동 브라우저 제어0이다.

## 실제 시간·deployment

| KST | 확인된 사실 |
| --- | --- |
| 시작 전 | 공식 Owner GET으로 OFF403/disabled·execute=[]/B6/CLOSED, 운영4개 현재 지문·Function 상태, test Google/B4 SMTP, schema/ACL·자원 여유 검증 |
| 16:40:07.342 | 고정300초 Owner-only 진단 시작. deadline **16:45:07.342**, 연장/재시작 없음 |
| 16:40:16.557 | 새 key·window·fixture와 Customer=true/writes=true/preorders=false를 기존 변수에 반영한 뒤 동결 완료. Account OFF/Function disabled 유지 |
| 16:40:18.177 | 새 진단 deployment **`6ad477e22a983cbda34c`** 생성 |
| 16:40:28.661 | ready. buildDuration10초, entrypoint `src/b7-entry.mjs`, runtime `node-22`, 기존1vCPU/1GiB·timeout20초·scope 유지 |
| health 직전 | 새 deployment active, Account OFF, enabled=false/execute=[], live=false. live 대신 실제 execution deployment ID와 guard 결과를 검증 |
| 16:40:50.763 | execution **`6ad477ee72988db3dfb8`**, 새 deployment ID 일치. guard PASS/accepted=true·플랫폼 계약 boolean 확인. 최종 execution failed/HTTP500, duration19.7395초, timeout 오류, 응답 body 없음 |
| 16:40:50.831 | `B7_D1_HEALTH_FAILED`, 즉시 stop. 추가 health·deployment 없음 |
| 16:40:56.782 | 독립 watchdog closed=true/verified=true/failedSteps=[]; deadline 전 OFF/B6 복구 완료 |
| 16:43 이후 | 별도 직접 GET으로 종료 상태·운영 구성·schema/ACL·합성 fixture 검증 |

watchdog 첫 probe5,567ms는 heartbeat 발행 전 준비 시간이다. 완료 후 신선한 heartbeat를 확인한 뒤 배포했다. 이후 정상 heartbeat 간격 최대3,739ms로5초 기준 안이었다. 마지막 CLOSED 기록 간격5,940ms는 중지 후 OFF 복구를 포함하며 정상 lease 성공으로 재분류하지 않는다. worker 종료도 확인했다. 수동 OFF 전용 복구 명령과 실제 관리 OFF 경로를 사전 검증했으며 자동 복구가 성공해 fallback은 사용하지 않았다.

## PASS / FAIL / NOT RUN

| 항목 | 판정 |
| --- | --- |
| 새 deployment·고정 runtime 입력·모든 guard 단계 | **PASS** — 새 window 내부 요청의 새 key HMAC 검증 성공 |
| Appwrite custom header/path와 플랫폼 UID/JWT 존재 계약 | **PASS** — runtime 성공 로그. raw 값 기록 없음 |
| 첫 reservation health/readiness | **FAIL — runtime timeout/HTTP500** |
| renewal-health / customer-account-health | **NOT RUN** — 첫 실패 즉시 중단 |
| 실제 G/H Google·고객 JWT·owner·MY ORDERS·주문 | **NOT RUN** — Owner health는 고객 identity 검증 분기를 실행하지 않음 |
| 자동 복구·별도 직접 GET·운영 현재 구성 불변 | **PASS** |
| 과거403의 정확한 최초 거부 predicate | **UNVERIFIED 유지** — 제거된 과거 runtime 환경을 복원한 것은 아님 |
| 이번 timeout의 내부 호출/네트워크 원인 | **UNVERIFIED** — guard 이후 원래 handler에 진입했지만 health 내부 단계 로그 없음 |

이번 실행에서 이전 `B7_GUARD_REJECTED`403은 재현되지 않았다. **배포 전 입력 동결→새 deployment→runtime guard 검증** 경로는 통과했지만 readiness/Google 시험 준비 완료로 확대하지 않는다. timeout과20초 Function 제한의 일치는 확인했으나 어느 DB/SDK 호출에서 지연됐다고 추측 확정하지 않는다. timeout 증가·권한 확대·handler 우회·추가 health·runtime 재시작은 하지 않았다.

다음에는 timeout의 내부 구간을 먼저 좁혀야 한다. D1은 종료하며 새 execution/deployment/Google 창을 자동 시작하지 않는다. 향후 Google 시험도 별도 승인과 **새 key/window를 배포 전에 고정한 새로운 deployment**가 필요하다. D1 deployment를 변수 PUT만으로 재사용하지 않는다.

## 직접 검증한 종료 상태

- Account OFF/익명 실제 API403 `general_service_disabled`, authLimit2. G/H 세션 각각0, M/G/H3명 보존.
- Function enabled=false/execute=[], **B6 `6ad41e576cb7a8f346af` active**. D1 deployment는 ready/inactive로 보존, 자동 삭제0.
- 관리 API의 Customer/writes/preorders는 명시적 false. 변수 총30개·기존7개 ID·secret metadata 유지.
- signing-key 무효화 API 단계 성공 및 execution 뒤 변수 updatedAt 확인. secret GET 마스킹 때문에 원문 readback 비교나 기존 runtime 메모리 교체를 주장하지 않는다. 실제 차단은 Account/Function OFF·B6 포인터·CLOSED·고정 runtime deadline으로 보장한다.
- HTTPS test-window enabled=false, 사이트 script 없는 CLOSED 응답. Pages 배포0.
- 전후 schema GET28씩: DB2/Collection12/Attribute182/Index38, available·M allowlist·private/public-read-only ACL·owner schema PASS. 운영 DB/schema/ACL 변경0.
- 합성 쿠폰2건 active/unused·5%/10%·M-only ACL 그대로. 테스트 reservations0/email queue0, 실제 결제·메일0.
- 운영4개 현시점 Auth/SMTP/OAuth/service 의미적 지문 동일. 기존 Function6개의 deployment/runtime/enabled 불변. test Google/B4 SMTP 보호 지문 동일. **과거 AU raw 차이는 UNVERIFIED** 유지.
- 서버 전후 가용 RAM 약8.37→8.32GiB, disk83.07→82.98GiB, load1 0.401→0.415, OOM0, API healthy. 공유 서버 두 sample의 차이를 D1 단독 사용량으로 귀속하지 않는다. CPU 사용률은 측정하지 않았고 서비스 재시작0이다.

## 로컬 변경·검증

코드 커밋 **`ed800d5`**: test-only phase 진단, D1 승인/입력 동결/새 deployment/health 제한 runner, 명시적 D1 watchdog 모드와 관련 회귀 테스트. 제품 handler/JWT/owner/가격/쿠폰/cutover·frontend·dependency/lockfile 변경0.

- RED→GREEN: 단계별 guard 거부·비밀값 출력 방지·승인/대상/상한·오래된 deployment/변수 drift/stale lease 거부·첫 실패 latch·deadline 후 OFF 복구.
- **전체 npm test: 2,035 PASS / 0 FAIL / 기존 SKIP1**. 기존 테스트 삭제·완화0.
- **Node22.23.3 집중33 PASS / 0 FAIL / 0 SKIP**. Node24 관련33개도 PASS.
- ESLint/TypeScript/추가 MJS lint/syntax/git diff PASS. 전체 suite의 AU build PASS.
- KR 새 빌드·Chromium/WebKit 새 자동 실행은 **NOT RUN**: 제품/UI 변경 없음, 사용자 자동 브라우저 금지 준수. 과거 결과를 새 실행으로 표시하지 않음.
- 실행 전 Git 후보+Function stage1,967파일·지정 보호값 검출0. 최종 문서 포함 **1,968파일/보호값5개/검출0**, V1/V2/V3 manifest·직전 journal 불변, archive 멤버/source/lock/fixture/V3 SHA 검증 PASS. 고정 deadline이 지난 뒤에도 직접 OFF403/B6/flagsfalse/CLOSED를 재확인했다.

**B5 — DEFERRED — RELEASE BLOCKER**, native Email OTP OFF, 실제 OTP와 Google↔OTP 동일 UID NOT RUN. 공통 SMTP·운영 프로젝트·main·production 배포·B5/B8을 변경하지 않고 중단한다.
