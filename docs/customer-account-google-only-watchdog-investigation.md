# Google-only watchdog 조기 종료 — 로컬 조사와 계측 보완

2026-10-18. 시작 HEAD `dc7efe7`, branch `feat/customer-account`. [실제 인수 결과](customer-account-google-only-acceptance-results.md)의 **G Google 로그인·Account/session·새로고침 PASS를 그대로 보존**한다. 이번에는 기존 파일을 읽기 전용으로 비교하고 CLI 진단 코드와 로컬 테스트만 변경했다. 원격 API/SSH, Account/Function 활성화, Pages/Function 배포, 시험 창, 고객·주문·쿠폰 쓰기는 모두0이다.

## 과거 종료 원인: UNVERIFIED

| 기존 기록 | 관측 / 해석 한계 |
| --- | --- |
| 활성화 journal | `phase=open`, Account ON·G/H 로그인 intent 시각19:17:09.353 KST. 이는 마지막 활성화 의도 기록으로, 종료 후 현재 Account 상태를 뜻하지 않는다. |
| 마지막 완료 probe | 19:18:31.083 KST. 당시 호출별 소요 시간·세션 귀속 predicate·exception·설정 drift 기록이 없다. |
| 마지막 heartbeat | 19:18:35.865 KST, 완료 probe age4,782ms. 이 한 샘플은5초 이내다. 이후 stale 여부나 먼저 실패한 predicate는 입증하지 못한다. |
| CLOSED9 claim | 19:18:33.871 KST. 마지막 heartbeat보다 앞선다. 이전 코드에서 core의 stop/recovery promise가 끝나기 전 worker loop는 heartbeat를 계속 쓸 수 있으므로 OFF 진행 중 publication과 양립한다. 이것만으로 최초 중단 사유를 확정하지 않는다. |
| 종료 결과 | 19:18:41.751 KST, `verified=true`, failedSteps 없음. 복구 결과만 있고 시작 사유는 없다. stop marker/worker-failed 파일도 없었다. |
| 종료 후 checkpoint | Account OFF403·세션0·Function OFF/B6·사이트 CLOSED 및 운영/테스트 보호 지문 일치. 당시 일시적 네트워크/API/SSH 실패나 transient drift까지 배제하는 근거는 아니다. |

원래 `manager.inspect()`는 Owner metadata GET9개를 병렬 실행한다. project policy, platform, users, Function, variables, executions, M/G/H sessions다. **브라우저의 Account.get/getSession 시간을 측정하는 probe는 아니다.** 별도 자원 probe는 SSH aggregate metrics 뒤 Appwrite version GET을 실행하고5초간 결과를 재사용한다. 전체 watchdog probe의4,500ms bound는 Owner 요청4,500ms·SSH12,000ms·version GET10,000ms와 독립적이다. 따라서 내부 호출이 자체 timeout에 도달하기 전에 바깥 probe가 중단될 수 있다. 이는 코드로 확인한 계약이며 과거에 실제 이 경로가 실행됐다는 증거는 없다.

세션 귀속 실패, Account 정책 API 지연,5초 freshness, 네트워크/SSH 예외, 설정 drift 중 **실제 최초 원인은 모두 UNVERIFIED**다. G 로그인 실패, freshness 초과, D1 timeout 재발로 단정하지 않는다. 과거 로그에 새 원인 코드를 소급해 삽입하지 않았다. 기존 heartbeat/journal/proof/baseline/종료/예산 기록13개의 SHA-256이 작업 전후 동일함을 확인한다.

## 추가한 비민감 진단

| 구분 | 코드 / 단계 |
| --- | --- |
| 세션 귀속 | `SESSION_USER_NOT_ALLOWED`, `SESSION_USER_MISMATCH`, `SESSION_PROVIDER_MISMATCH`, `SESSION_TIMESTAMP_INVALID`, `SESSION_OUTSIDE_WINDOW`, `SESSION_LOGIN_INTENT_MISSING`; `session-attribution` 단계 |
| Account 상태·journal | `ACCOUNT_STATE_MISMATCH`, `JOURNAL_INVALID`; `account-state`, `journal` 단계 |
| Owner API | `API_TIMEOUT`, `API_NETWORK_EXCEPTION`, `OWNER_AUTH_DENIED`, `API_HTTP_ERROR`, `API_RESPONSE_INVALID`; `project.get`, `platforms.get`, `users.get`, `sessions.M/G/H.get`, Function metadata 등 고정 단계 |
| 설정·실행 drift | `AUTH_POLICY_DRIFT`, `PLATFORM_DRIFT`, `AUTH_USERS_DRIFT`, `FUNCTION_DRIFT`, `FUNCTION_FLAGS_DRIFT`, `PROJECT_SETTINGS_DRIFT`, `FUNCTION_VARIABLE_DRIFT`, `FUNCTION_EXECUTION_DRIFT` |
| 자원·통신 | `METRICS_READ_FAILED`는 `resource.metrics`; version GET의 네트워크/timeout/HTTP/version 실패는 `resource.api-version`. RAM/disk/OOM/load도 별도 코드 |
| 시간·lease | `PROBE_TIMEOUT`, `LEASE_HEARTBEAT_STALE`, `LEASE_PROBE_STALE`, `LEASE_CLOCK_INVALID`, `LEASE_WORKER_DEAD`, `LEASE_STOPPED`, `DEADLINE`, `CLOCK_INVALID` 등 |
| 수동·worker 종료 | `MANUAL_STOP`, `STOP_MARKER`, `STOP_MARKER_READ_FAILED`, `SIGNAL_STOP`, `WORKER_EXCEPTION` |

새 worker는 보호 폴더의 `diagnostics.jsonl`에 append-only로 고정된 단계·사유 코드·start/pass/fail/stop·시각·소요ms·필요한 HTTP status/age/limit만 기록한다. 실행 중 첫 종료 사유를 보존하고 `closed.json.reason`에도 넣는다. 병렬 호출에서 `start`만 있고 완료가 없는 단계는 전체 probe timeout 시 대기 후보로 볼 수 있다. 완료되지 않은 호출을 실제 장애 원인으로 자동 확정하지 않는다.

OFF·cleanup·siteClosed·verifyClosed 각각의 시작/성공/실패·소요 시간을 기록한다. 원래 단계 순서·bound·확인 조건을 유지한다. `inspectGoogleOnlyLeaseDetailed()`는 freshness/worker/marker 판정과 비민감 age를 반환하고, 기존 `inspectGoogleOnlyLease()` boolean API는 유지한다. 향후 승인된 호출자는 세부 결과를 보존해야 하며 단순 false만으로 원인을 확정해서는 안 된다. 새 계측은 기존 Google-only 실행 기록으로 실제 실행하지 않았다.

Secret/JWT/Cookie/HMAC/환경변수 원문/API body/고객정보/실제 UID·session ID/요청 URL/exception message·stack·cause는 진단에 넣지 않는다. 고정 단계와 코드 allowlist, 숫자 필드만 통과시키며 알 수 없는 값은 `UNVERIFIED/unknown`으로 축소한다. 진단 파일은0600·소유자 확인·symlink 거부를 적용한다. 로그 쓰기 실패 시에도 고정 Account OFF 요청과 나머지 복구를 계속 시도하고, `failedSteps=diagnostics`로 verified 성공을 막는다.

## 변경 파일과 보호 조건

- 신규 `scripts/customer-account-google-only-diagnostics.mjs`: allowlist 진단·안전한 오류·소요 시간 기록.
- 기존 `scripts/customer-account-google-only-watchdog.mjs`: 종료 사유 보존, 단계별 복구 계측, private writer, 상세 lease 판정.
- 기존 `scripts/customer-account-google-test.mjs`: Google-only manager의 호출 시간·네트워크/응답·drift 분리. 기존 B3 manager·target/write allowlist 유지.
- 기존 `scripts/customer-account-google-only-live.mjs`: journal/Account 상태/세션 귀속·자원 probe 계측.
- 기존 `scripts/customer-account-test-monitor.mjs`: SSH와 version GET 계측. 기존 자원·API 검사 및 cache 유지.
- 신규 `tests/customer-account-google-only-diagnostics.test.mjs`, 합성 API fixture `tests/fixtures/customer-account/google-only-management.mjs`.

코드와 회귀 테스트 커밋: `3e42e23` (`fix(account): trace watchdog stop reasons without relaxing safety gates`).

5초 freshness,4.5초 probe bound,1초 heartbeat, 최대900초 deadline, 자동 OFF, 복구 검증, 사용자·세션 allowlist, Function OFF/B6·flags·이전 baseline drift 검사는 완화하지 않았다. 재시도·연장·추가 API probe를 넣지 않았다. 제품 `src/`·Function 원본·가격/쿠폰/JWT/소유권/DB ACL·의존성·Pages builder/배포 정책은 변경하지 않았다.

## 검증 기록

초기 진단 회귀10개가 missing reason/measurement 때문에 RED였고 구현 후 GREEN을 확인했다. 구현 자체 리뷰 중 로그 sink 오류가 실제 OFF 요청을 막는 경로, version 판정 뒤 로그 오류가 `apiHealthy=true`를 남기는 경로, 응답 본문 timeout이 invalid-response로 분류되는 경로도 각각 RED로 재현 후 GREEN으로 수정했다. 이 결함들은 **이번 로컬 계측 구현 과정의 결함**이며 과거 조기 종료의 원인으로 주장하지 않는다. 추가 local worker/대기 단계 회귀를 포함해 신규15개가 통과한다.

합성 remote boundary와 임시 폴더의 자격증명 없는 self-test worker로 검증했다. 실제 Owner/Account probe나 배포를 수행한 결과가 아니다. 테스트는0/미귀속/M/잘못된 provider·UID·timestamp, 네트워크/timeout/403, baseline drift,4,500ms 대기 중단,5,000/5,001ms 경계·미래 시각·죽은 worker, 복구 실패, 로그 sink 오류·symlink·비밀값 축소를 다룬다. 기존 테스트를 삭제하거나 완화하지 않았다.

최종 검증:

- 전체 `npm test`: **2,087 PASS / 0 FAIL / 기존 SKIP1**(총2,088), exit0. 계정 그룹 **310 PASS / 0 FAIL / 0 SKIP** 포함.
- 신규 진단 집중 테스트: **15 PASS / 0 FAIL / 0 SKIP**. 독립 local self-test worker와 symlink 거부는 실제 임시 파일·프로세스로 검증했고 remote provider를 호출하지 않았다.
- `npm run lint`, 변경된 MJS/합성 fixture의 별도 ESLint recommended, `npx tsc -b`, `git diff --check`: PASS.
- 전체 suite에 포함된 AU build/static 회귀: PASS. 이번 변경은 CLI 도구에 한정하므로 별도 KR build·실제 브라우저·실제 provider 재시험은 하지 않았고 이전 결과를 새 실행 결과로 주장하지 않는다.
- 변경 후보10개 파일의 알려진 보호값 검사: 포함0. 진단 allowlist·raw error/body/UID/session/URL/credential 축소는 합성 canary 회귀로 별도 검증했다.
- 과거 증거13개 파일 SHA-256 불변, 승인 계획/manifest 변경0. 단독 자체 리뷰이며 main/origin main은 `34ba107`에서 그대로다.

## 원격 상태와 중단 지점

이번에는 **로컬만** 실행해 원격 상태를 다시 조회하거나 변경하지 않았다. 직전 직접 검증된 Account OFF403·M/G/H 세션0·Function disabled/execute=[]/B6·flags false·CLOSED 상태를 보존한다. Pages **9/9**, Function **8/120**에 추가 사용0이다. 별도 승인 전 새 창·Pages/Function 배포·실제 진단 실행은 금지다.

**B5 — DEFERRED — RELEASE BLOCKER**, native OTP OFF·실제 OTP/Google↔OTP 동일 UID NOT RUN. 과거 운영 AU raw 지문 차이는 **UNVERIFIED** 유지. production/main·B5/B8 작업은 수행하지 않고 보고 후 중단한다.
