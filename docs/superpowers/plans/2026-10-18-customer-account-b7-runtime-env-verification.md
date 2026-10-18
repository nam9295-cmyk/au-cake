# B7 runtime 환경 반영 검증 — 제안 / 실행 미승인

> **후속 승인·실행 기록:** 사용자가 D1 로컬 보완·새 진단 deployment 최대1·Owner health 최대3/300초를 별도 승인했다. [실제 결과](../../customer-account-b7-d1-runtime-results.md): 새 runtime guard PASS, 첫 health timeout/HTTP500 FAIL로1회만 실행 후 OFF/B6/CLOSED 복구 PASS. 누적8/120·Pages7/9. D1은 종료했고 Google/D2·추가 execution/deployment는 미승인이다. 아래 원래 제안은 당시 승인 경계의 기록으로 보존한다.

2026-10-18. [health403 조사](../../customer-account-b7-health-403-investigation.md)에 근거한 좁은 계획이다. **현재 승인 범위는 조사와 계획까지다. 아래 코드 변경·변수 PUT·배포·Owner execution을 지금 실행하지 않는다.** Account OFF, Function disabled/execute=[], flagsfalse, B6 active, 사이트 CLOSED를 유지하고 승인 대기한다.

## 다음 단계의 권장 승인 범위

| 항목 | 닫힌 진단 단계 D1 제안 |
| --- | --- |
| target | `https://api.verygood-chocolate.com/v1` / `verygood-au-account-test` / `ca-test-reservation-api` |
| Function 신규 deployment | **최대1개**, Node22/기존 사양·scope·native 의존성 그대로 |
| Account / execute | **항상 OFF / enabled=false / execute=[]** |
| 호출 | 공식 Owner health → renewal-health → customer-account-health, 순차 최대3회, 첫 실패 즉시 중단 |
| 고정 probe 시간 | 승인 실행 시 정하는 최대300초의 Owner-only 검증 시간. Google 인증 창이 아니며 연장/재시작 금지 |
| 변수 | 기존7개 ID와 Customer flag만 갱신, 새 변수0. key/window/flags/fixture를 **배포 전에 동결** |
| 추가 자원·거래 | 사용자/쿠폰/주문/DB/ACL/Pages/API Key/SMTP/메일/결제0 |
| 누적 예산 | 현재 실행7/120에서 차감, 최대3회면10/120. Pages7/9 그대로 |
| 종료 | Account OFF403·Function disabled/execute=[]·flagsfalse·key revoke API·B6 active·CLOSED 재검증 |

V3 원본 manifest와 `executionApproved=false`·승인 SHA는 수정하지 않는다. 별도 승인 amendment에 **새 archive SHA, 추가 deployment1개, 새 deployment ID 인계, 최대3개 Owner execution/300초, 기존 사용량7/7**을 명시한다. 기존 guarded deployment1개 한도를 조용히 초기화하지 않는다. 생성 실패 시 자동 재생성/삭제/무제한 재시도하지 않는다.

## 승인 후 로컬 변경과 제한된 검증

1. `tools/customer-account-b7-v3/function-entry.mjs`에 **거부 직전 Owner 로그용 phase enum/boolean 진단**을 추가한다. 외부 응답403과 core handler/JWT/owner/가격/쿠폰 정책은 유지한다. phase는 CONFIG/TIME/SECRET_SHAPE/BODY/HEADERS/SIGNATURE/PATH/IDENTITY/ACTION/INTERNAL 등 고정 목록만 허용한다. 성공 로그에는 고정된 code revision과 config/time/signature/path 검증 boolean만 남긴다.
2. raw env·key·key hash·HMAC·nonce·JWT·Cookie·headers·body·customer data·credential URL·exception message를 기록하지 않는다. key 일치는 **새 키로 서명된 요청이 runtime guard를 통과하는지**로 검증한다. API secret metadata/readback/live만으로 대체하지 않는다.
3. 관련 파일: 위 guard, `scripts/customer-account-b7-v3-runtime.mjs` archive/source 검증, `scripts/customer-account-b7-v3-runner.mjs` 또는 별도 test-only 진단 adapter, `scripts/customer-account-b7-v3-watchdog-adapters.mjs`의 명시적 D1 관측 모드와 해당 guard/runtime/runner/recovery 테스트. D1 watchdog은 **authLimit2·Account OFF·Function disabled/execute=[]·새 승인 deployment·고정 진단 flags**를 검사해야 한다. 기존 B7 open 모드의 authLimit3 또는 closedPreflight의 B6/flagsfalse 규칙을 느슨하게 바꾸지 않는다. controller에 명시적 D1 승인 proof와 새 archive/배포 ID가 없으면 writes0으로 거부한다. 기존 frozen6 body와 일반 제품 코드는 유지한다.
4. 단일 목적의 RED→GREEN: stale env/expired window/old key/missing headers/body/path의 단계 분리, 응답 불변, 비밀값 출력0, 동일 warm deployment+변수만 갱신하는 경로 거부, 승인 cap/기존 자원 보존. 기존 source/lock/native 검증을 재사용하고 관련 focused 검증을 수행한다. 실제 provider 성공으로 로컬 결과를 표시하지 않는다.

## 승인 후 실제 D1 순서

1. exact target·Account403/Function OFF/B6/CLOSED·같은7변수 ID·scope·current17 execution inventory·운영 현재 지문·테스트 Google/B4 SMTP/DB/ACL·자원 여유를 GET으로 확인한다. 기존 G/H·쿠폰2·schema를 생성하지 않는다.
2. 별도 journal과 새 key를 보호 저장한다. 공식 Owner를 쓰고 새 관리 Key를 만들지 않는다. test-only API path guard·create-only deployment claim을 먼저 고정한다.
3. 독립 OFF watchdog/수동 복구를 준비한다. **고정300초 이하 probe window와 새 key, Customer=true/writes=true/preorders=false 등 runtime 입력을 먼저 확정한다.** Account/Function 실행은 계속 차단한다. 이 시점부터 고정 deadline을 소비하며 build 실패/지연 때문에 연장하지 않는다.
4. 이 변수 상태에서 **새 diagnostic deployment1개**를 만든다. Node22, 기존 scopes/spec, events/schedule 없음을 확인한다. available/ready를 순차 확인한 뒤 같은 test Function에서만 활성화한다. B6 checkpoint를 보존한다. 활성화는 기존 warm runtime의 교체와 구분하고, 새 deployment ID의 fresh runtime 검증을 사용한다.
5. 배포 이후 runtime 변수(key/window/flags 포함)를 바꾸면 검증을 중단한다. `live`를 보기 좋게 만들기 위한 PUT·무단 재배포·spec 변경에 의한 cold-start 우회·Executor 직접 조작·서버 재시작은 하지 않는다. `live`는 진단 자료로 남기고 readiness는 archive/revision/새 deployment ID·runtime guard 성공으로 판정한다.
6. **항상 Account OFF/Function disabled·execute=[]**에서 공식 Owner 서명 health를1회 실행한다. 실제 execution deployment ID·새 키 서명 통과·phase diagnostics·고정 window·flags/runtime revision을 확인한다. 첫 실패면 추가 health 없이 종료한다. 성공한 경우에만 나머지2개 health를 실행한다. 실제 고객 JWT 검증은 이 결과에 포함하지 않는다.
7. 즉시 OFF/flagsfalse/key revoke/B6/CLOSED를 복원한다. runtime의 stale env 가능성 때문에 API flag/key 갱신만으로 안전 정지를 선언하지 않는다. 독립 Account/Function OFF·B6 포인터·고정 deadline을 검증한다. 새 deployment와 증거는 보존하며 자동 삭제하지 않는다. 실패/미확인 복구는 사용자 수동 차단을 요청한다.

## Google 시험에 필요한 추가 배포 수량

**권장 분리안은 총2개다. D1 닫힌 진단1개, 이후 D2 Google용 새 deployment1개.** D1을 끝내고 새 key/window를 설정하면 다시 환경이 달라지므로 같은 deployment를 그대로 재사용할 수 없다. D2의 새15분 창·추가 deployment1·OPEN8/CLOSED9·사용자 직접 Google 로그인은 **D1 결과 이후 별도 승인**이다. D1 성공만으로 D2를 자동 실행하지 않는다.

총량 최소안은 별도 승인된 **하나의 새15분 창 안에서 설정 동결→새 deployment1→Owner health→Google까지 모두 수행**하는 것이다. 이 경우 build·검증도 그900초에 포함되며 실패하면 해당 창이 소비된다. 이번 요청이 원인 조사와 닫힌 상태 유지이므로 현재는 이 결합 실행을 권장 승인 대상으로 열지 않는다. 두 안을 혼동해 진단1회 뒤 같은 env가 유지되는 것처럼 설명하지 않는다.

**현재 승인 요청 대상은 D1의 로컬 단계 진단 보완, 테스트 Function deployment1개, 최대3회 Owner-only health/300초 검증과 OFF/B6 복구까지다. Google 창/Pages/주문은 제외한다.** 승인 전 원격 쓰기0을 유지한다.

**B5 — DEFERRED — RELEASE BLOCKER**, native OTP OFF, Google↔OTP UID NOT RUN. 과거 AU raw UNVERIFIED. main/운영 프로젝트/공통 SMTP/Function/DB/ACL 변경 없음.
