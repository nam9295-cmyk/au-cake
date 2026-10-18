# B7 V3 사용자 Chrome 시험 — runtime guard 거부로 OPEN 전 중단

2026-10-18 KST. 사용자의 `시작해보자!` 승인으로 [수동 계획](superpowers/plans/2026-10-18-customer-account-b7-manual-chrome.md)을 실행했다. **첫 실제 Owner health가403 `B7_GUARD_REJECTED`여서 즉시 중지했다. Account/Function 공개 실행과 Pages OPEN을 하지 않았다. 실제 Google·고객 JWT·주문·MY ORDERS는 NOT RUN이다.** 독립 watchdog 복구와 이후 직접 GET 차단 검증은 PASS다. 같은 창을 재시작하거나 남은 시간으로 다시 시도하지 않았다.

## 승인·기존 자원 보존

- V3 SHA `1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90`, 원본 `executionApproved=false`, V1/V2와 기존 proof·journal을 변경하지 않았다.
- 별도 Git 제외 `manual-run-20261018/`에 이번 사용자 시작 승인 proof·이전 journal SHA·새 실행 journal을 만들었다. 이전 사용량 B7 6/120·Pages7회를 인계했다. V2 proof나 과거3/5 전용 continuation을 재사용하지 않았다.
- G/H/M·쿠폰2·같은7 변수 ID·기존 guarded deployment `6ad456239aeb781a4f4d`·원래 frozen6 body·기존 artifact/archive를 재사용했다. 사용자/쿠폰/변수/Function deployment/API Key/DB 신규 생성0이다.
- 창 전용 key를 새로 생성해 이전 두 key와 다름을 확인하고 보호 파일 및 기존 secret 변수에만 저장했다. 원문을 출력하지 않았다. clipboard packet은 **start false / prepared / key 없음**으로 그대로 남았다. 실제 clipboard 접근·파일 import·CUA/getApp/자동 브라우저 제어·운영 고객 화면 접근0이다.

## 실제 단계·시간

| KST | 실행·판정 |
| --- | --- |
| 시작 전 | 공식 Owner GET, Account OFF403/disabled/execute=[]/B6/CLOSED, exact users3·세션0·변수30/같은7ID·schema/ACL·Google/B4 SMTP·운영4개 현시점 정책 불변 확인 |
| 닫힌 probe5주기 | PASS — 최대 heartbeat 간격3,459ms, API/자원/metadata/known execution 모두 정상. 5초 기준 완화 없음 |
| 관리 OFF 경로 | Account OFF·Function OFF·flags OFF 실제 요청과 직접 verifyClosed 성공 후, 기존 guarded deployment 활성화와 authLimit3 준비. 공개 Account/Function은 계속 OFF |
| 15:55:51.130 | 새 단일900초 창 확정. 원래 deadline16:10:51.130, 연장 없음. 같은 변수에 창·새 key·Customer=true/writes=true/preorders=false 설정 |
| watchdog 시작 | 독립 PID92488. heartbeat 첫 probe2,916ms, 신선한 lease 확인 후 health 요청1회 |
| 15:55:58.591 | health execution `6ad46d7e8edb336f8f97`: status completed, HTTP403, `B7_GUARD_REJECTED`, duration 약4.9ms. runtime logs/errors 길이0 |
| 15:55:58.627 | `REUSED_RUNTIME_HEALTH_FAILED` 기록, 즉시 stop 요청. 추가 health·재시도·Pages 배포·사용자 로그인 안내를 실행하지 않음 |
| 15:56:03.345 | watchdog **closed=true / verified=true / failedSteps=[]**. OPEN 미시도·기존 CLOSED GET 확인으로 Pages 복구 배포 생략 |
| 15:56:34.416 이후 | 별도 직접 GET: Account OFF403/authLimit2/Function disabled execute[]/B6/flagsfalse/CLOSED/세션0·운영 정책과 test Google/SMTP 지문 검증 |

종료 probe의3,976ms는 OFF 복구를 포함한다. 정상 heartbeat 기준을 완화하거나 실패를 성공으로 전환하지 않았다. 새 watcher 자체는 실제 관리 권한과 stop/OFF 경로를 사용했으며 단순 Mock 결과가 아니다. 반면 runtime guard 통과·새 창의 장기 heartbeat 안정성은 실패/미실행과 구분한다.

## 확인된 실패 근거와 미확인 사항

Owner API에 저장된 실행 metadata의 requestPath를 **출력하지 않고** 새 key로 검증했다.

- 저장 경로의 HMAC: 일치
- body hash와 원래 `{"action":"health"}`: 일치
- 서명 timestamp: 새 고정 window 내부
- request method: POST
- 승인된 이번 health1건 외 새 execution:0

이는 **runtime 내부가 동일한 env/key/header/path를 받았다는 증명은 아니다.** guard는 여러 조건을 동일403으로 응답하며 이번에는 성공 시 platform contract log에도 도달하지 않았다. 실제 실패 predicate·runtime env 반영·플랫폼 header/path의 내부 값은 **UNVERIFIED**다. 캐시·환경변수 전파·클라이언트 서명 오류 중 어느 것이라고 추측 확정하지 않는다. 공개 API 재호출로 원인을 시험하거나 guard/JWT/소유권 조건을 완화하지 않았다.

다음 재개 전에는 이 health403의 개별 조건을 비민감 진단으로 구분할 방법과 기존 deployment 재사용 시 runtime 계약을 별도로 검토해야 한다. guard 수정·새 Function deployment·추가 인증 창은 이번 실패를 이유로 자동 승인되지 않는다.

## 사용량·실제 종료 확인

- **B7 누적7/120**, 이번 승인된 health1회 소비, 산술 잔여113회. 전체 Function inventory17은 B6 과거10 + B7 7이다. 외부 미승인 실행0이다. guard 거부1건은 monitor의 중단 대상이며 이를 정상 health로 보고하지 않는다.
- **Pages 누적7/9**, 이번 배포0. OPEN8/CLOSED9를 소비하지 않았다. 그러나 이번 새900초 창은 한 번 시작한 뒤 조기 종료했으므로, 남은 Pages/실행 수량이 새 인증 창을 자동 승인하지 않는다.
- Account OFF/실제403, authLimit2, Function disabled/execute=[], B6 `6ad41e576cb7a8f346af` active. Customer/writes/preorders 모두 명시적 false, 변수30/기존7ID 보존.
- watchdog signing-key 무효화 단계에 실패가 없다. secret GET 마스킹 때문에 원문 비교로 무효화를 입증했다고 주장하지 않는다. 공개 실행 OFF/B6/CLOSED는 직접 확인했다.
- G/H 세션 각각0, 사용자3명·쿠폰2건(active,5%/10%,M-only ACL) 보존, reservations0/email queue0, 실제 결제·메일0.
- 전후 schema GET28씩: DB2 / Collection12 / Attribute182 / Index38,available·ACL·M·owner schema 모두 PASS.
- 운영4개 현시점 Auth/SMTP/OAuth/service 의미적 설정 지문과 기존 Function6개의 deployment/runtime/enabled 불변, test Google/B4 SMTP 보호 지문 동일. **과거 AU raw 차이는 UNVERIFIED** 유지.
- 종료 서버 sample: API healthy, 가용 RAM 약8.31GiB / disk 약82.99GiB / load1 약0.43 / OOM0. CPU 사용률 측정값이 아니다.
- 서비스 재시작·Function/사이트 신규 배포·운영 변경·main 병합0.

## PASS / FAIL / NOT RUN

| 검증 | 판정 |
| --- | --- |
| 정확한 target·기존 자원/manifest/이전 journal·누적 budget 보존 | PASS |
| 닫힌 실환경 probe5주기, 실제 관리 OFF 경로 | PASS |
| 기존 archive 검증·Pages CLI 인증·새 키 보호 | PASS |
| 재사용 guarded runtime의 첫 health | **FAIL — 403 B7_GUARD_REJECTED** |
| 실패 predicate 원인 | **UNVERIFIED** |
| 즉시 stop·watchdog 복구·직접 GET | PASS |
| 이번 Node22 집중 검증 | **49 PASS / 0 FAIL / 0 SKIP** |
| Git+기존 compiled artifact credential 검사 | PASS —2,939파일·지정 보호값 검출0 |
| 전체 npm/lint/TypeScript/AU build | 관련 파일 변경 없이 직전 HEAD0c56638 검증 재사용: **2,023 pass / 0 fail / skip1**, lint/TS/AU build PASS. 이번 새 전체 실행이라고 표시하지 않음 |
| KR build / compiled browser 새 자동 실행 | NOT RUN — 제품/overlay 변경 없음, 자동 브라우저 금지 준수 |
| Pages OPEN8·사이트 activation gate·Account ON·execute-any | **NOT RUN** |
| 실제 clipboard 성공 경로·G/H Google·고객 JWT | **NOT RUN** |
| 회원 주문·MY ORDERS·고객 간404·Guest/쿠폰/멱등성 실제 인수 | **NOT RUN** |
| native Checkout 전체 제출·OAuth 폼/카트 복원·실기기 | **NOT RUN** |
| 실제 OTP·Google↔OTP 동일 UID | **NOT RUN — B5 미완료** |

제품 코드·기존 테스트·원래 JWT/owner/가격/쿠폰/cutover 정책을 변경하지 않았다. 보호 evidence는 Git 제외로 보존하고 문서만 커밋한다. 같은 창/Pages 배포를 재시도하지 않고 여기서 중단한다.

**B5 — DEFERRED — RELEASE BLOCKER.** 공통 SMTP·OTP 수신자/남용 방지·Gallery 예외·system credential·운영 백업/재생성/복구·실제 OTP/교차UID는 미완료. native OTP OFF, Google+OTP 출시 미완료. B5/B8·production 배포·main 병합은 진행하지 않는다.
