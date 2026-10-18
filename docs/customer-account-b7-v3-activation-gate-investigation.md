# B7 V3 활성화 게이트 조사와 로컬 계측

2026-10-18 KST. **과거 `OPEN_SITE_OR_LEASE_UNVERIFIED`의 개별 실패 조건은 여전히 UNVERIFIED다.** 사이트와 watchdog 조건을 분리하는 코드·로컬 테스트를 추가했다. 실제 인증 창을 열거나 배포하지 않았다.

기준은 [HTTPS 재개 결과](customer-account-b7-v3-https-resume-results.md)다. V1/V2/V3 manifest, 기존 승인 proof, 실행 스크립트와 evidence는 보존했다. V3 원본 SHA는 `1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90`, `executionApproved=false`다. 이번 작업은 Mac Codex 단독이며 운영 고객·주문을 조회하지 않았다.

## 과거 증거로 확인할 수 있는 범위

보존된 `open-once.mjs`는 OPEN 배포 성공 뒤 fetch와 JSON parsing을 수행하고, 다음 조건을 OR/단락 평가했다.

1. HTTP `ok` 여부
2. `enabled === true`
3. `startsAt`의 정확한 일치
4. `endsAt`의 정확한 일치
5. 최신 watchdog lease

기록된 예외가 이 결합 조건의 throw 지점이므로 fetch와 JSON parsing은 반환했다. 다만 status·window 값·redirect/cache header·lease age를 기록하지 않았다. 앞선 사이트 조건이 실패하면 lease 호출 자체를 생략하므로, lease가 실제로 false였다고도 단정할 수 없다. 네트워크 지연의 유무도 이 기록만으로 알 수 없다.

| 남은 증거 | 관찰 | 해석의 한계 |
| --- | --- | --- |
| OPEN 배포 로그 mtime | 05:25:43.425Z | custom domain이 해당 시점에 어떤 JSON을 반환했는지는 모름 |
| stop marker mtime | 05:25:43.724Z | 결합 gate 실패 후 중단 요청 |
| 마지막 heartbeat | 05:25:45.762Z | 실패 시점 이후 값이며 이전 heartbeat가 덮어써짐 |
| closed proof | 05:25:57.131Z | watchdog의 실제 종료·복구 성공 |
| 원래 deadline | 05:24:59.634Z → 05:39:59.634Z | 재사용하거나 연장하지 않음 |
| 현재 HTTP 표본 | `/test-window.json` 200, CLOSED, `cf-cache-status=DYNAMIC`, Age 없음 | 과거 캐시·배포 전파 상태의 증거가 아님 |
| Mac 전원 이력 | 조사 구간 14:24:00–14:26:10 KST의 Sleep/Wake/DarkWake/TimeChange 일치 이벤트 없음 | 마지막 해당 종류 이벤트는 10:00:13. 로그만으로 시계·네트워크 연속성을 보증하지 않음 |

공식 Owner 인증을 사용하는 기존 probe의 **GET 부분만** 현재 닫힌 상태에서 한 번 측정했다. GET 11개와 서버 aggregate metrics 조회를 합쳐 **3,203ms**였다. API는 정상, load1 약0.33, OOM0이었다. probe가 끝난 뒤 heartbeat를 쓰고 다음 probe 전 1초 기다리는 구조라서 지연이 늘면 5초 lease 기준과 충돌할 가능성은 있다. **현재 표본은 과거 실패 원인을 입증하지 않는다.** 당시 probe 소요 시간, heartbeat age, clock offset은 복구할 수 없다. 닫힌 상태의 probe가 기존 OPEN 예상값과 불일치하는 것은 정상적인 차단 결과이며 이를 readiness PASS로 계산하지 않았다.

## 변경한 진단과 제한

- `scripts/customer-account-b7-v3-activation-gate.mjs`: 정확한 테스트 origin과 V3 SHA·900초 이하의 고정 window를 검증한 뒤 GET만 수행한다. HTTP status/redirect, JSON parsing, enabled, startsAt, endsAt, 전후 lease, deadline과 clock continuity를 각각 PASS/FAIL로 기록한다. cache 상태·Age·서버 Date·왕복 시간·서버/로컬 잔여 시간을 별도 값으로 남긴다. HTTP Date는 1초 해상도이며 왕복 지연을 포함한 표본이다. 이 값으로 deadline을 재계산하지 않는다.
- Pages 이전 CLOSED 응답 또는 404/503만 재확인 후보로 삼는다. **최대 5 GET, 간격 기본1초, 요청 timeout 최대3초, 전체 최대30초와 원래 deadline 중 이른 시점**까지다. OPEN이면서 다른 window, redirect, 잘못된 JSON, 네트워크 오류는 중단한다. 재확인은 배포·재인증·window 연장이 아니다.
- `scripts/customer-account-b7-v3-watchdog-process.mjs`: lease에 configuration/deadline/marker/heartbeat/PID 진단을 추가했다. **heartbeat age 최대5,000ms와 미래 timestamp 허용1,000ms는 기존 그대로**다. stale·worker 종료·stop/failed marker·검사 오류는 성공으로 간주하거나 재시도로 덮지 않는다. marker 접근 오류도 차단한다.
- `probe-start.json`으로 진행 중인 probe를 관찰하고, heartbeat에 wall/monotonic 소요 시간·차이·loop gap을 기록한다. `heartbeat-history.jsonl`을 append하여 이전 표본을 보존한다. timing은 새 인증 권한이 아니며, timing evidence가 없다고 오래된 heartbeat를 허용하지 않는다.
- 새 진단 파일 기록이 실패하면 실제 OFF 작업을 먼저 수행한다. 가능한 경우 `diagnosticRecordingFailed=true`인 closed proof를 남기고, 확인 불능이면 기존 failed marker/수동 복구 경로로 처리한다. 기록 성공이 OFF의 전제조건이 되지 않는다.
- `scripts/customer-account-b7-v3-runner.mjs`: 명시적인 `activationSiteGate`가 없거나 false면 활성화 요청0회. 사이트 gate 이후와 각 기존 활성화 단계의 deadline·독립 lease 검사를 유지한다. 기존 private 실행 스크립트는 수정하지 않았으며, 그대로 재실행해서 새 gate를 우회할 수 없다.

진단은 allowlist의 boolean·숫자·고정 상태값만 사용한다. 응답 본문 전체, Location 원문/credential URL, exception text, Cookie, JWT, HMAC key를 기록하지 않는다. gate의 `record` callback은 필수이고 기록 실패는 차단한다. 다음 승인 실행기는 이 callback을 새 보호 JSONL 파일에 연결하고, `activationSiteGate`에서 gate의 `ready===true`만 전달해야 한다. 이전 private controller와 approval proof를 덮어써서 연결하지 않는다. gate는 그 시점의 관측값이며 이후 runner의 deadline/lease 재검사를 대체하지 않는다.

## 로컬 검증

RED→GREEN으로 신규 API 부재, 새 사이트 gate가 없는 runner의 활성화 시도, tuple별 진단 누락, 진행 중 probe 진단 누락, 진단 I/O 실패 시 OFF 미실행을 확인하고 구현했다. 전체 테스트의 초기 실행에서는 새 fixture의 heartbeat와 probe timestamp가 모순되어 신규 테스트1개가 실패했다. 실제 시간 순서를 갖는 fixture로 수정했으며 기존 테스트·인증 기준을 완화하지 않았다.

검증 범위는 정상, Pages 전파 지연/상한, stale/missing/future heartbeat, 종료 PID/failed marker, window 불일치, 느린 네트워크, deadline 만료/clock jump, 인증 검사 오류, redirect·악성 본문/오류의 비밀정보 배제, 독립 프로세스 이력 및 OFF 복구다. 실제 provider 성공으로 계산하지 않는다.

| 최종 검증 | 결과 |
| --- | --- |
| 전체 `npm test` / 69 summaries | **2,009 PASS / 0 FAIL / 기존 SKIP1**, 총2,010 |
| 활성화 gate/runner/독립 process/복구 집중 검증 | 38 PASS / 0 FAIL / 0 SKIP |
| Node22.23.3 V3 및 watchdog 집중 검증 | 65 PASS / 0 FAIL / 0 SKIP, 로컬 macOS이며 새 Linux runtime 실행은 아님 |
| root ESLint / 변경 MJS no-unused-vars / TypeScript | PASS |
| Git 대상/신규 파일 credential 검사 | 1,893파일·보호값8종 대조, 검출0 |
| 기존 private 실행 evidence8개 hash | 모두 동일 |
| 실제 Google 고객 JWT·주문·OTP | NOT RUN |

기존 skip은 AU dist를 검사하는 실행의 `KR production dist does not publish AU Chocolate pages`다. 새 skip이나 기존 테스트 삭제·완화는 없다. 제품 source, 브라우저 overlay, Function business source, dependency/lock, manifest는 변경하지 않았다. KR/브라우저 compiled artifact는 이 변경으로 재실행하지 않았으며 기존 증거를 구분해 유지한다. 전체 npm suite에 포함된 AU build는 이번에 PASS다.

## 기존 자원의 재사용과 최소 다음 예산

| 자원 | 읽기 전용 확인 | 다음 실행 조건 |
| --- | --- | --- |
| H `ca-test-customer-h-20261018` | active, 지정 이메일 일치, 세션0 | 재생성 없음. 첫 Google identity 연결은 아직 NOT RUN |
| 쿠폰2건 | 기존 ID·active·M 전용 ACL 유지, reservations0 | 기존 code/정책·fixture를 그대로 사용, 재발급/자동 삭제 없음 |
| 신규7 변수 | 전체30, 기존7 ID·secret metadata 일치, 세 flag false | 같은 ID의 값만 새 승인 창에 맞게 설정. 추가 변수0 |
| guarded deployment `6ad456239aeb781a4f4d` | ready, 기존 archive SHA·fixture SHA 및 모든 source/lock bytes 검증 PASS | 기존 deployment 재활성화 검토. 새 Function/배포0, B6 복구 유지 |
| 브라우저 artifact | 이전 HTTPS 경로·native UUID/body 검증 증거 보존, 관련 source 변경0 | 같은 artifact에 새 승인 window JSON 적용. 새 preview 생략 가능 |
| 서명 credential | 이전 key는 무효화된 상태로 유지 | 이전 key 재사용 금지. 재승인 후 새 key로 같은 secret 변수 갱신 |

Pages는 **5/5 사용 완료**다. 현재 조건에서 최소 추가 예산은 **OPEN1 + 최종 CLOSED1 = 2회, 누적7회**다. 새 CLOSED preview가 필요할 정도로 artifact/라우팅을 바꾼다면 별도1회가 더 필요하므로 이 최소안의 범위를 벗어난다. OPEN 뒤 검증이 실패해도 CLOSED 복원1회는 확보해야 한다. 기존 Pages adapter의 승인 cap5는 변경하지 않았다. 새 승인 proof와 정확한 누적7 cap의 로컬 계약 검증이 후속 단계에서 필요하다.

새 시험은 기존 만료된900초 window를 재사용할 수 없다. **별도의 새 단일15분 창 승인이 필요**하다. 기존 immutable manifest와 실행 journal을 리셋하지 않고, 별도 승인 증거/continuation journal에 기존 자원·누적 소모를 인계해야 한다. 원래 Function 실행 cap120 중3회가 이미 소비됐으므로 명시적 변경 승인 없이는 잔여117회를 넘기지 않는다. 주문0/6·쿠폰2/2·guarded deployment1/1 및 원래 동시성·즉시 중단 조건을 유지한다. 현재 runner는 이전 journal의 재-arm을 거부하며, 이 차단을 제거하거나 새 창을 자동 생성하지 않았다.

현재의 read-only 조사·로컬 PASS는 새 시험 실행 승인이나 전체 B7 완료를 의미하지 않는다. 다음 실행 연결/승인 proof/복구 준비를 검토한 뒤 사용자 참여 시점에만 새 창을 정할 수 있다.

## 현재 상태와 미완료

2026-10-18 **14:53:42 KST** 최종 GET에서 Account OFF/실제403, Function disabled/execute=[], B6 active, customer·Renewal writes·preorders 명시적 false, 변수30개, 사이트 script-free CLOSED를 확인했다. 운영4개 현시점 의미적 설정 지문은 이전 기준과 동일하며, **과거 AU raw 지문 차이는 UNVERIFIED**다. 이번 원격 요청은 읽기 전용이고 리소스 생성·설정 변경·배포·주문·메일·결제0이다.

코드·테스트 커밋은 `0f5510c`다. 조사 문서는 별도 커밋으로 구분한다. worktree `au-cake-customer-account` / branch `feat/customer-account`만 수정했으며 main/origin/main은 `34ba1072f475ba8458b25a8ffd7a9e5467293dbe`를 유지한다. 보호 증거는 기존 workspace의 `activation-gate-20261018/`에 보존하고 기존 `resume-20261018/` 파일을 변경하지 않았다.

**B5 — DEFERRED — RELEASE BLOCKER**. 공통 SMTP·OTP 수신자/남용 방지·Gallery 예외·system credential·운영 백업/재생성/복구·실제 OTP와 Google↔OTP 동일 UID는 미완료다. native OTP OFF, provider 주문 인수·실제 OTP·교차 UID는 NOT RUN. main 병합·production 변경·B5/B8 자동 진행 없이 여기서 중단한다.
