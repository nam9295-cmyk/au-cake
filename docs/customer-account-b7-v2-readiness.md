# B7 V2 로컬 수정 및 실행 준비 검증

2026-10-18. `feat/customer-account`, 전용 `au-cake-customer-account` worktree에서만 작업했다. V1 승인 기록과 V2 원본은 보존했다. V2 SHA-256은 `2421d820d99e38652a1adff4e37ca4afdbd0c002a37281462ac9b5a892d50c41`이며 `executionApproved=false` 원본을 변경하지 않았다. 승인 증거와 인증정보는 Git 제외 보호 파일에만 보관했다.

**이번 작업은 로컬 코드·테스트와 원격 GET/metadata 읽기만 수행했다. 실제 15분 인증 창은 시작하지 않았다. Account/Function 활성화, Function/Pages 배포, 사용자·주문·쿠폰 생성은 0건이다.**

## CSS 실패 원인과 수정

기존 compiled artifact의 main CSS URL은 HTTP 200, MIME `text/css`였다. CSS 안의 Google Fonts 및 jsDelivr 폰트 `@import`가 CSP에 차단되면서 동적 `main.tsx` import의 CSS preload promise가 실패했다. 테스트 stage의 `tokens.css`에서 해당 두 import만 제거하자 앱이 마운트됐다. 기존 system-font fallback을 사용하며 CSP와 운영 소스 스타일은 변경하지 않았다.

그 뒤 계정 route가 demo/404로 표시되는 별도 문제를 확인했다. 전체 `import.meta.env` 객체 치환 대신 각 `import.meta.env.KEY`를 명시적으로 정의해 실제 compiled SDK 대상에 테스트 project/DB/Function/flags가 전달되도록 수정했다. 공개 config JSON 파일만 확인하는 검증을 보완해 실제 앱의 API 요청을 가로채 대상·서명·경로를 검사했다.

Chromium/WebKit compiled artifact 검증은 외부 요청을 모두 Mock으로 가로챘다. `/account` 렌더링, 닫힌 상태의 Function 요청 0건, 테스트 API 대상, 서명 헤더/경로, CSS 200/MIME, page error 0건, 원래 Checkout UUID·wire body 및 draft reload 보존을 검사한다. Mock 주문 제출은 의도적으로 503을 반환해 원래 재시도 폼을 유지하며 실제 DB/메일/결제를 사용하지 않는다. 이는 실제 Google/Appwrite 인증 성공 증거가 아니다.

## 보호장치 구현

- 승인 manifest/hash, 명시적 endpoint/project/DB/Function, 15분 불변 기한과 별도 승인 증거를 검증한다. 운영 env를 자동 상속하지 않는다.
- 서버 guard는 본문·시각·nonce·HMAC 및 플랫폼 UID/JWT를 확인한다. JWT adapter는 테스트 project에 `setJWT`만 적용한 Account client로 `Account.get()` UID/status를 대조한다. 관리자 key/cookie를 고객 인증 근거로 사용하지 않는다.
- 정확히 동결된 6개 requestId/body만 create에 허용한다. 교차 고객 detail/cursor/replay는 원래 handler까지 전달해 원래 404/409를 검증한다. 원래 가격·쿠폰·Renewal cutover·소유권 코드를 변경하지 않았다.
- native Checkout draft의 UUID를 관찰하고 원래 제출 필드 순서로 wire body를 읽는다. capture→원래 SDK submit→draft reload 사이 UUID/body가 유지되는지 compiled artifact에서 검증했다. 실제 HTTPS 사이트의 최종 두 native UUID는 다음 승인된 닫힌 preview 단계에서 별도로 동결해야 한다.
- Node22 archive는 원래 source/package-lock/native-smoke를 그대로 포함하고 guard entry만 추가한다. deployment adapter는 POST 전에 archive의 모든 파일과 bytes를 검증하고, ready 확인 및 disabled/execute=[] 상태에서만 activate한다. create/deploy 시도는 persist 후 단 한 번 허용한다.
- Appwrite 1.8.1은 실행 metadata에 custom headers를 모두 저장하지 않으므로 `requestPath`에 시각/nonce/body digest/MAC를 넣는다. 비밀 key/JWT는 포함하지 않는다. monitor는 무서명/중복 marker, guard 오류, 실행 상한, UID·배포·flags·metadata·서버 자원 이상을 차단 조건으로 취급한다. 실제 provider의 path 보존과 목록 query 동작은 아직 인수하지 않았다.
- watchdog은 별도 detached Node process로 실행하고, 신호 또는 보호 파일을 통한 수동 stop을 지원한다. deadline 종료와 수동 종료를 실제 별도 로컬 process에서 검증했다. 이는 live 복구 시험이 아닌 `self-test`다.
- 활성화 lease는 살아 있는 독립 watchdog의 최신 heartbeat와 stop marker를 확인한다. Function enable 이후 기한이 만료되면 Account ON을 실행하지 않고 OFF 복구로 들어간다. heartbeat의 잘못된 시각/만료/수동 stop도 거부한다.
- OFF adapter는 Account, Function, flags, signing key, B6 deployment, authLimit, 해당 run에 귀속된 G/H session만 복원한다. baseline/미귀속 session은 삭제하지 않는다. 요청이 멈춰도 제한 시간 후 나머지 차단을 계속하며 실패를 `verified=false`로 보고한다.
- 사이트 종료 adapter는 고정 테스트 Pages project/branch의 credential 없는 CLOSED cover만 발행하고 시도 수를 기록한다. 실제 CLI 실행·배포는 하지 않았다. 배포 실패에 자동 재배포하지 않는다.

수동 OFF 복구 명령(이번에는 실행하지 않음):

```sh
node scripts/customer-account-b7-recover.mjs --test-project-off-only /ABSOLUTE/PRIVATE/watchdog-config.json
```

관리 인증/네트워크가 실패하면 Console에서 Settings의 정확한 project ID를 확인하고 Account OFF, 해당 Function disabled/execute=[]를 먼저 적용한 뒤 복구 상태를 확인한다. B6 deployment는 `6ad41e576cb7a8f346af`다. native Account OFF는 Mac 프로세스/네트워크 상실 시 서버 guard deadline만으로 보장되지 않는다.

## 원격 읽기 전용 점검

공식 기존 Console Owner CLI 세션으로 project ID와 owner를 확인했다. 브라우저 세션 추출이나 새 Key 발급은 하지 않았다.

- Account OFF 및 anonymous `Account.get` HTTP 403.
- Function disabled / execute=[] / 기존 B6 active deployment 유지.
- 테스트 사이트 `test-window.json.enabled=false`.
- native 7개 인증 방법 OFF, Google ON, SMTP override ON, authLimit=2.
- 테스트 DB2 / Collection12 / Attribute182 / Index38 available 및 ACL, 관리자 M UID 검증.
- 이번 작업 시작/종료 사이 운영 4개와 테스트 프로젝트의 9개 raw 지문 전체 및 핵심 컨테이너 5개가 모두 일치했다. 종료 표본 RAM 가용 8.38 GiB, 디스크 가용 83.07 GiB, load1 0.19다.
- 운영 4개 프로젝트의 공식 인증·SMTP override·Google·session alerts 설정은 B5 Console 기록과 일치.
- 이전 B7 기준과 비교해 운영 AU의 `projectConfig` raw fingerprint만 차이가 있다. 운영 DB/ACL/Function/active deployment/Key/변수/platform 지문은 같다. 과거 field별 원본이 없어 전체 의미적 불변을 입증할 수 없으며, 재암호화나 자동 동작이라고 단정하지 않는다. Gallery의 기존 B5 예외와 별개의 미확인 사항이다.

## 최종 검증 결과

| 검증 | 판정 | 결과/범위 |
| --- | --- | --- |
| 전체 `npm test` | PASS | **1,940 pass / 0 fail / 1 skip**, 총 1,941. 기존 KR production-dist 조건부 skip 유지. 누락 flag write0 회귀도 포함 |
| Node 22 집중 | PASS | **56 pass / 0 fail / 0 skip**, 로컬 Darwin Node 22.23.3. codec JPEG/PNG/WebP 및 거부 입력 포함 |
| ESLint | PASS | 기존 전체 lint와 신규 MJS에 대한 별도 recommended 규칙 검사 |
| TypeScript | PASS | `tsc -b`와 테스트 overlay 단독 타입 검사 |
| KR → AU build | PASS | 순차 빌드; 기존 큰 chunk 경고 유지 |
| Compiled artifact Chromium/WebKit | PASS | 각각 닫힌 Function 호출0, signed Mock 호출8, 잘못된 대상0, page error0, native wire/draft 복원 PASS |
| guard/타인 소유권 결합 | PASS | 원래 handler의 404/409와 guest 거부를 로컬에서 검증 |
| watchdog/복구 | PASS (local) | 독립 프로세스 deadline/manual stop, timeout/실패/재시도 상한, OFF adapter의 모의 HTTP 계약, baseline session 보존 |
| 비밀값 검사 | PASS (files) | Git 후보와 compiled artifact 1,053개 파일에서 지정된 실제 보호 자격정보 일치0; env sentinel/analytics 검사도 통과 |
| 실제 B6 DB/schema/ACL | PASS (read-only) | GET28회, DB2/Collection12/Attribute182/Index38 및 관리자 allowlist |
| 이번 작업 전후 운영/테스트 프로젝트 지문 | PASS | 5개 프로젝트 지문과 core5 동일 |
| 현재 V2 변수 상한 적합성 | **FAIL / BLOCKED** | 신규 필요7 > 승인5. 자동 추가0, configure write0 |
| 새 guarded archive의 Linux/Appwrite 실행 | NOT RUN | 새 배포 금지. B6의 과거 Linux 검증과 구분 |
| 실제 플랫폼 JWT·Google 회원 주문·live 복구 | NOT RUN | 실제 창/배포/주문을 열지 않음 |

실패한 초기 CSS/환경변수 브라우저 검증, 잘못된 archive 입력, 활성화 중 deadline 만료, 잘못된 heartbeat의 RED→GREEN 로그를 보호 작업 폴더에 보존했다. 최초 중단 보고도 [기록](customer-account-b7-v2-execution-blocked.md)으로 보존한다.

## 추가로 발견한 변수 계약 충돌 — FAIL / 실행 차단

실제 B6 Function 변수는 23개다. `CUSTOMER_ACCOUNT_ENABLED=false`는 존재하지만 `AU_RENEWAL_WRITES_ENABLED`, `AU_RENEWAL_PREORDERS_ENABLED` 두 변수는 없다. 원래 business 코드에서는 미설정이 OFF이므로 현재 비활성 상태에는 문제가 없다. 이 읽기 전용 확인 중 "세 변수 모두 명시적인 false"라는 검사 가정은 실패했고, 실제 present/default 상태를 별도 기록했다.

승인 V2는 `functionVariablesAddedMax=5`이며 신규 guard 이름 다섯 개를 열거한다. 현재 계획대로 guard 5개와 두 Renewal flag를 명시적으로 추가하면 **신규 7개**다. writes flag만 추가하고 preorder는 기본 OFF에 맡겨도 6개여서 기존 상한을 넘는다. 기존 변수를 임의 재활용하거나 guard 정보를 축소해 우회하지 않았다. runner의 기존 변수 확인은 이 실제 상태에서 모든 POST/PUT 전에 거부하며, observed-metadata 회귀 테스트로 write0을 검증했다.

다음 검토에 제시하는 변경안은 테스트 Function에 한해 신규 변수 상한을 7로 조정하고, 기존 다섯 guard 이름에 아래 두 public flag 이름을 추가하는 것이다. 준비/종료 때 두 flag는 false, 승인된 창에서만 writes=true / preorders=false를 사용한다. scope·프로젝트·상품·가격·쿠폰·DB/ACL·인증 창 한도는 바꾸지 않는다. **이 변경안은 승인되지 않았고 적용하지 않았다.** V2 bytes와 SHA는 그대로다. 새 manifest/SHA에 대한 검토와 승인이 선행되어야 한다.

| 추가 변수 | Secret | 준비/종료 | 시험 창 |
| --- | --- | --- | --- |
| `AU_RENEWAL_WRITES_ENABLED` | false | false | true |
| `AU_RENEWAL_PREORDERS_ENABLED` | false | false | false |

## 실행 준비 판정과 남은 확인

**실제 B7 창 개방은 보류한다.** 로컬 Mock 통과를 실제 provider 인수로 해석하지 않는다.

- [ ] 신규 변수 5개 상한과 실제 필요 7개의 계약 충돌에 대한 새 명세/승인.
- [ ] 운영 AU의 과거 `projectConfig` 지문 차이 원인 또는 검토된 기준선 확정.
- [ ] 최종 HTTPS native Checkout 두 UUID/body를 닫힌 preview에서 동결.
- [ ] 새 guarded deployment의 Node22/Linux build, 플랫폼 JWT, signed path metadata 보존과 실제 runtime 변수 반영 확인.
- [ ] live watchdog의 실제 OFF/사이트 복구 권한·CLI 인증·남은 Pages quota·독립 heartbeat 확인.
- [ ] 정확한 M/G/H 3명, authLimit=3, 합성 fixture 및 Google test audience를 다음 승인 범위에서 준비.
- [ ] 실제 Google 인증·회원/guest 6개 주문·쿠폰 2개·본인/타인 조회·멱등성 인수는 NOT RUN.

실제 복구 API와 deploy를 금지한 이번 승인 범위에서는 위 live 항목을 PASS로 판정할 수 없다. 다음 단계는 기존 15분/120회/동시1/6주문/2쿠폰/Function1배포/Pages3배포 한도를 그대로 유지한다. `execute=[any]` 초기 자원 소비 위험과 Mac/watchdog 장애 시 native Auth 잔여 위험도 유지한다.

## B5 — DEFERRED — RELEASE BLOCKER

- [ ] 운영 4개 프로젝트와 Console의 공통 SMTP 영향 승인.
- [ ] OTP 수신자 접근 및 남용 방지.
- [ ] Gallery 의미적 지문 예외 검토.
- [ ] System SMTP 전용 Key·sender.
- [ ] 운영 보호 백업/root 인증/API·mail-worker 재생성 및 rollback.
- [ ] 실제 Email OTP 및 Google↔OTP 동일 UID.

native OTP OFF, Google+OTP 최종 출시 준비 미완료. 운영 배포/main 병합/B5/B8은 진행하지 않는다.

## 커밋과 파일 범위

- `ea4ff0d` — manifest/fixture/서명 guard·JWT identity·native draft 계약과 테스트.
- `ee8c68e` — 격리 site builder, 테스트 overlay, analytics 차단, CSS/env 수정, compiled artifact 검증.
- `b964d7f` — archive 검증·배포 adapter, 실행 monitor, 독립 watchdog/activation lease, OFF/Pages/session 복구와 secret scan.

이후 문서 커밋은 본 보고·기존 중단 기록·rollout 상태를 보존한다. 원래 `src/`, 운영 Function source/package-lock, 루트 dependency, V1/V2 manifest에는 변경이 없다. 실제 기능 플래그 기본값도 바꾸지 않았다.

## 진단 출력 사고

로컬 프로세스 진단에서 프로세스 제목에 포함된 연결 토큰이 도구 출력으로 노출됐다. 해당 값은 사용하거나 파일/Git에 저장하지 않았고 보고서에도 복사하지 않았다. 운영 API Key나 Appwrite 자원을 변경하지 않았다. 해당 연결의 재인증을 권장한다. 파일/배포 artifact secret scan PASS는 이 도구 출력 노출을 부정하는 의미가 아니다.
