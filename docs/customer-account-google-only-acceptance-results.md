# Google-only 실제 인수 결과 — G 로그인 성공, 조기 안전 종료

2026-10-18 KST. `feat/customer-account`, 실행 시작 HEAD `cfb3330`. 사용자의 새 `시작!` 지시와 [승인 계획](superpowers/plans/2026-10-18-customer-account-google-only-acceptance.md)에 따라 기존 테스트 프로젝트에서만 실행했다. **전체 인수는 미완료이며 현재 Account OFF / Function OFF / 사이트 CLOSED다. 자동 재시도·새 창·시간 연장은 하지 않았다.**

## 실행 범위와 시간

- Endpoint/project: `https://api.verygood-chocolate.com/v1` / `verygood-au-account-test`.
- Pages: `au-cake-account-test`, `b3-google-test`, `https://au-account-test.verygood-chocolate.com`. OPEN8과 CLOSED9를 각각 한 번 사용해 누적 **9/9**다.
- 기존 M/G/H 3명, `authLimit=2`, Google만 허용, 다른 인증 및 sessionAlerts OFF를 유지했다. 사용자 Chrome 직접 조작이며 CUA/getApp/Playwright/자동 브라우저 조작은 사용하지 않았다.
- Function 실행·배포·변수 변경 각각 **0회**. 기존 누적 **8/120** 및 실제 execution inventory 18개를 그대로 유지했다. reservation Function은 disabled / execute=[] / B6 `6ad41e576cb7a8f346af` active였다.
- 신규 사용자·API Key·DB/schema/ACL·주문·쿠폰·결제·메일 발송 요청 0건. 사용자는 프로필을 입력하려던 중 닫혔고 저장은 누르지 않았다고 확인했다. G/H 프로필 저장 **각 0회**로 기록한다.
- 새 고정 창: **19:16:23.087–19:31:23.087 KST**. Account ON 확인 시각은 **19:17:09.353**, 독립 watchdog의 CLOSED 검증 완료는 **19:18:41.751**이다. 예정 기한 전에 안전 종료했다.

승인 계획 SHA-256은 `9a938d7a5b86af5f17c12a61baddf73748565a9c4c7c9bb86ce41883046708ab`다. 원문/준비 proof/V1·V2·V3 manifest/기존 journal은 보존했다. 별도 start approval proof, 새 창과 journal, watchdog heartbeat·종료 결과, 실행 전후 공식 Owner checkpoint는 Git 제외 보호 디렉터리에 보관한다. Cookie·OAuth code·JWT·Key·환경변수 원문은 보고서에 기록하지 않는다.

## PASS / FAIL / NOT RUN

| 항목 | 판정 / 근거 |
| --- | --- |
| 시작 전 관리 인증·대상·OFF/B6/CLOSED | **PASS**. 공식 기존 Owner와 Cloudflare CLI, 정확한 test project, 기존3 UID/상한2, 운영4개 구성·Function 지문을 확인했다. |
| 독립 watchdog 시작·lease | **PASS**. 활성화 전 서로 다른 실제 완료 probe 3주기와 5초 이내 freshness를 확인했다. |
| 실제 OPEN8 HTTPS | **PASS**. root/account/callback HTTP200, JS/CSS MIME와 로컬 artifact 바이트 일치, CSP, 정확한 window, 예상 외 경로 hard404를 CLI GET으로 검증했다. |
| Account ON | **PASS**. 공식 Owner GET ON, 익명 Account API401, watchdog lease 정상, Function OFF/B6와 execution 불변 확인 후 사용자에게 안내했다. |
| G Google 로그인·Account/getSession·새로고침 복원 | **PASS — 사용자 수동 Chrome 확인**. 사용자가 `G 로그인·세션 확인·새로고침 유지 성공`을 보고했다. 세션 확인 UI는 기존 G UID와 Google provider를 검증한다. 브라우저 세션 원문을 수집하지 않았다. |
| Google-only 전체 인수 창 정상 지속 | **FAIL**. 프로필 단계 전에 안전 감시가 창을 닫았다. 전체 인수 완료로 처리하지 않는다. |
| G 프로필 저장·readback·명시적 logout401 | **NOT RUN**. 저장 전 CLOSED, 이후 새로고침만 했다고 사용자 확인. 강제 종료 후의 Account403을 명시적 logout401 성공으로 대체하지 않는다. |
| H 로그인·프로필·G 정보 잔존 방지·logout | **NOT RUN**. H 인증을 요청하지 않고 종료했다. |
| Google 취소·재로그인 | **NOT RUN**. 재시도하지 않았다. |
| 자동 OFF·세션 정리·CLOSED9 복원 | **PASS**. watchdog 결과 `verified=true / failedSteps=[]`. 후속 OFF-only 복구 확인과 공식 GET/공개 API/HTTPS 확인도 통과했다. |
| 실제 MY ORDERS·주문 소유권·쿠폰·멱등성·D1 health | **NOT RUN / 이번 범위 밖**. Function 호출0, 주문 unavailable adapter 사용. |
| 이메일 OTP·Google↔OTP 동일 UID | **NOT RUN**. native OTP OFF, B5 미완료. |

## 조기 종료의 증거와 한계

마지막으로 기록된 완료 probe는 **19:18:31.083**, 마지막 heartbeat는 **19:18:35.865**였다. 해당 heartbeat 기준 완료 probe age는 **4,782ms**로 5초 한계 이내였다. CLOSED9 claim은 **19:18:33.871**, 복원 검증 완료는 **19:18:41.751**이다. `stop.request`와 `worker-failed.json`은 없었고 worker의 `closed.json`은 검증 성공을 기록했다.

이 기록은 안전 종료와 복구를 입증하지만 **최초 실패 predicate는 UNVERIFIED**다. 현 watchdog은 probe 예외/timeout, 안전 상태 불일치, 자원 조건, lease 종료 사유를 각각 남기지 않고 공통 OFF 경로로 처리한다. 따라서 stale heartbeat, 네트워크/API/SSH 실패, 부하 또는 세션 불일치 중 하나를 원인으로 확정하지 않는다. 종료 뒤 정상 자원·설정 관측도 당시 transient failure의 부재를 입증하지 않는다. G 로그인 실패로 재분류하거나 기존 D1 timeout과 같은 원인이라고 주장하지 않는다.

다음 실행 전에는 이 공통 경로에 **비민감 stop reason과 단계·소요 시간만 남기는 로컬 계측**이 필요하다. Secret/세션/요청 본문을 기록하거나 freshness·deadline을 완화해서는 안 된다. 이번에는 계측 변경, 재배포, 새 시험 창을 진행하지 않았다. Pages 예산을 모두 사용했으므로 재시험에는 별도 승인과 최소 OPEN/CLOSED **추가 2회**가 필요하다.

## 종료 후 직접 검증

- Account OFF, 실제 익명 `/v1/account` **403 `general_service_disabled`**.
- 기존 M/G/H 3명·상한2 유지, M/G/H 세션 모두0. 사용자와 프로필을 자동 삭제하지 않았다.
- Function disabled / execute=[] / Node22 / B6 active, CUSTOMER_ACCOUNT_ENABLED·Renewal writes·preorders 모두 false. 기존 변수30개 및 execution inventory 불변.
- `/test-window.json.enabled=false`. root/account/callback 모두 동일 출처 redirect만 허용한 뒤 HTTP200의 **Test CLOSED** 정적 HTML이며 앱 script 없음.
- DB2/Collection12/Attribute182/Index38, available·ACL·owner schema 및 B3 Google/B4 SMTP 보호 지문이 시작 전과 일치했다. 운영4개 현재 의미적 Auth/SMTP/OAuth·구성과 기존 Function6개 deployment/runtime/enabled도 불변이다.
- 서버 일회성 관측: 시작 RAM available 약8.41GiB / disk 약82.98GiB / load1 약0.17, 종료 약8.40GiB / 약82.98GiB / 약0.55. 새 OOM 없음. 공유 서버 전체 관측으로 시험의 순수 증분이라고 해석하지 않는다.

이번에는 실행 source를 변경하지 않았으며 기존 로컬 검증 **전체2,072 PASS / 0 FAIL / 기존 SKIP1, 계정295 PASS, Google-only26 PASS, lint/TypeScript·KR→AU 빌드 PASS**를 재사용했다. 전체 suite를 다시 실행한 것으로 보고하지 않는다. 변경은 결과 문서와 상태 안내뿐이다.

**B5 — DEFERRED — RELEASE BLOCKER** 유지. native OTP OFF, 공통 SMTP·수신자/남용 방지·Gallery 예외·system credential·운영 백업/재생성/복구·실제 OTP와 Google↔OTP UID 검증은 미완료다. 과거 운영 AU raw 설정 차이는 **UNVERIFIED** 유지. production 배포·main 병합·B5/B8 자동 진행은 하지 않았으며 여기서 중단한다.
