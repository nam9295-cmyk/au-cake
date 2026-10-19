# B7 health 호출 시간 계측 Implementation Plan — 실행 미승인

> **For agentic workers:** 승인 후 `superpowers:executing-plans`로 Mac Codex가 직접 수행한다. subagent/Hermes·CUA·브라우저 자동 조작은 사용하지 않는다. 이번 승인은 읽기 전용 조사와 로컬 진단 준비까지이며 아래 source 변경·배포·execution은 별도 승인 대상이다.

**Goal:** 원래 health의 settings 대기와 병렬7개 metadata 대기를 최소 Owner 호출로 구분한다.

**Architecture:** test-only archive entrypoint가 원래 handler를 호출하는 동안에만 SDK DB 호출의 단계/시간을 관측한다. 원래 main/readiness·SDK·guard 정책을 그대로 보존하며 현재20초 제한 안에서 어느 await가 끝나지 않았는지 기록한다.

**Tech Stack:** Node22, AsyncLocalStorage, 기존 node-appwrite22.1.3, 기존 V3 guarded archive/Owner runner/OFF watchdog.

**Spec:** [D1 timeout 읽기 전용 조사](../../customer-account-b7-d1-timeout-investigation.md), [D1 결과](../../customer-account-b7-d1-runtime-results.md), V3 원본 manifest/SHA `1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90`.

## Global Constraints

- exact test endpoint/project/Function만 사용, Account 항상 OFF, Function disabled/execute=[] 유지.
- timeout20초·TLS 검증·endpoint·DB ACL/JWT/owner/schema/readiness·가격/쿠폰/멱등성 조건 변경 금지.
- 기존 H/M/G·쿠폰2·같은7변수 ID·30개 변수·모든 manifest/proof/journal 보존. 신규 변수/Key/DB/사용자/주문/Pages0.
- 기존 누적 execution8/120·Pages7/9를 인계한다. D1의 prior7 고정 proof나 만료 window를 재사용하지 않는다.
- 새 key·fixture·Customer=true/writes=true/preorders=false·최대300초 window를 새 deployment 전에 동결. build도 deadline을 소비하며 연장/재시도 없음.
- B5 DEFERRED — RELEASE BLOCKER, native OTP OFF, 과거 AU raw UNVERIFIED, production/main 변경 금지.

## Review Focus

- settings가 끝나지 않으면 metadata7개가 시작됐다고 로그에 표시하지 않는다.
- Promise.all 중 하나만 늦거나 reject해도 원래 완료/오류 동작을 보존한다.
- SDK args/result/error 객체에 credential·고객정보가 있어도 출력하지 않는다.
- 계측 logger 실패/병렬 요청이 다른 invocation의 성공이나 비밀값 출력으로 이어지지 않는다.
- runtime500이 pending SDK 호출을 취소한 것처럼 해석하지 않으며, 관리 OFF와 runtime stale env를 구분한다.

### Task 1: 로컬 test-only 계측과 archive 계약

**Files:** Create `tools/customer-account-b7-v3/db-trace.mjs`, `tests/customer-account-b7-db-trace.test.mjs`; modify `scripts/customer-account-b7-v3-runtime.mjs`, `tests/customer-account-b7-v3-runtime.test.mjs` only as needed for exact new member/entrypoint verification. 제품 source/SDK/lockfile은 변경하지 않는다.

**Interfaces:** `withB7DbTrace({log,clock}, operation)`은 원래 operation의 반환값/오류를 보존한다. 설치한 고정 SDK DB method wrapper는 AsyncLocalStorage context가 있을 때만 관측하고 원래 method/this/인자를 그대로 호출한다. context는 guard 통과 뒤 원래 handler에만 적용한다. Account/JWT client를 대체하지 않는다.

- [ ] RED: settings unresolved→START만1개/metadata0; metadata7개 동시 시작→pending별 END 없음; 원래 오류 객체 그대로 reject; 성공 값/인자/this 동일.
- [ ] RED: args/result/error에 synthetic secret을 넣어도 log에 검출0, 단계 enum 밖 값·URL·header/body 출력0, logger 실패는 성공으로 변환하지 않음, context 격리/중복 설치/trace cap 검증.
- [ ] 최소 구현: `listDocuments/getCollection/listAttributes/listIndexes/list/listCollections/getAttribute/getIndex`의 승인된 health 리소스만 고정 단계명에 매핑. log에는 `stage`, START/END/ERROR, monotonic elapsed/duration 숫자만 허용. 결과·오류 문자열·환경변수·UID·HMAC·requestId 기록 금지. 예산128 trace records, 추가 API 호출/재시도/await 생략0.
- [ ] archive entrypoint가 원래 handler를 위 context로 감싸도록 연결. 원래 main/endpoint/readiness/package/lock byte 일치 검증을 유지하고 추가 파일/수정 entrypoint만 정확히 허용한다. 기존 보호 archive/proof를 덮어쓰지 않는다.
- [ ] GREEN: 새 계측 테스트 + 기존 guard/runtime/readiness/customer-orders/internal-endpoint 테스트. secret scan·정확한 archive/source 검사·lint 통과 후 test-only 기능 커밋.

### Task 2: 새 승인 증거와 닫힌 controller 준비

**Files:** 새 test-only timing controller와 tests를 필요 최소로 추가한다. 기존 D1 runner/proof/state 파일을 수정해 재실행하지 않는다. 새 보호 approval/journal은 현재8회와 D1 journal SHA를 명시한다.

**Interfaces:** 새 controller는 원격 동작으로 OFF 관리·기존 변수 갱신·새 deployment1개·정확한 Owner health1회만 허용한다. 선택적 customer-health 추가1회는 별도 proof의 명시 승인과 첫 health200/ready 조건이 모두 있어야 한다.

- [ ] RED: 승인 없음/wrong target/old proof/변수 drift/old deployment/stale lease/deadline/cap 초과는 실행 writes0 또는 즉시 OFF. Pages·Account ON·execute-any·사용자/주문/쿠폰/변수 생성 capability 없음.
- [ ] 기존 D1과 같은 OFF watchdog·새 deadline·수동 OFF 경로를 연결하고 first-failure latch/실행 누적8 인계/복구를 검증한다. 실제 관리 권한 확인은 추가 실행 없이 OFF 경로로만 수행한다.
- [ ] 로컬 관련 검증/secret scan/archive SHA·proof 결합 검사 후 정확한 배포1개·health1회 범위를 제출한다. **여기서 새 실행 승인 대기.**

### Task 3: 별도 승인 후 최소 실제 진단

- [ ] 공식 Owner GET으로 OFF403/B6/CLOSED·현재 운영4개 지문·test DB/ACL/Google/B4 SMTP·known inventory18 확인. 예상 밖 변화 시 실행하지 않는다.
- [ ] 새 key/window/fixture/flags를 먼저 고정하고 새 archive를1회만 배포한다. Node22/20초/기존 scope·사양 및 실제 새 deployment ID를 확인한다. Account와 공개 실행은 계속 OFF다.
- [ ] Owner health **1회**. 마지막 START와 END/ERROR를 대조해 settings 또는 미완료 metadata 단계를 기록한다. 첫 실패면 즉시 복구하며 호출을 반복하지 않는다. TLS/DNS 세부 원인이 그 로그로 증명되지 않으면 UNVERIFIED를 유지한다.
- [ ] 선택적으로 별도 승인된 경우에만 첫 health200/ready 후 `customer-account-health`1회. 성공하더라도10초 제품 UI 예산과 고객 JWT/MY ORDERS 성능 검증은 별도다. Account OFF 상태의 Owner 호출로 고객 주문 인수를 주장하지 않는다.
- [ ] Account403/disabled execute[]/명시적 flagsfalse/key 무효화/B6/CLOSED/운영 지문·실행 inventory를 직접 검증한다. 새 deployment는 inactive로 보존. 복구 미확인 시 사용자 수동 차단 요청.

**요청할 최소 추가 수량:** deployment1 + health1 → 누적9/120, Pages7/9 그대로. 선택적 회원 readiness1까지 별도 승인되면 최대10/120. Google 창/Pages/주문은0. 지금은 둘 다 미실행이며 승인된 실행 수량을 늘리지 않았다.

**Self-review:** 사용자6개 조사 항목과 단계 계측·비밀값/원래 계약 보존·최소 자원·OFF 복구를 모두 위 task에 대응했다. 병렬 metadata를 순차화하거나 readiness를 cache/우회하는 수정은 포함하지 않았다. 계측으로 호출 위치만 확인되고 transport 원인은 남을 수 있다는 한계를 유지한다.
