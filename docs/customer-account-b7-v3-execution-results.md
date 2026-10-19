# B7 V3 — 사전 조건 실패, 인증 창 미개방

2026-10-18 KST. **실제 HTTPS Checkout 경로 검증 FAIL로 중단했다. Google 회원 주문 인수는 NOT RUN이다.** Account와 Function을 열지 않았고, 테스트 사이트는 스크립트 없는 CLOSED 화면으로 복원했다. B7 완료 또는 출시 준비 완료가 아니다.

승인 대상은 `verygood-au-account-test` / `ca-test-reservation-api`뿐이다. [V3 manifest](customer-account-b7-execution-manifest-v3.json)의 SHA-256은 `1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90`이며 `executionApproved=false`를 유지했다. V1/V2와 승인 기록을 보존했고 재사용하지 않았다. V3 승인은 Git 제외 0600 파일에 별도로 기록했다. Penpot은 사용하지 않았다.

## 중단 원인과 로컬 수정

승인된 CLOSED Pages preview 1회를 배포했다. `/`와 공개 manifest는 정상이며 SHA도 일치했다. 하지만 실제 상품 링크 `/cakes/pave-chocolate-cake`는 HTTP 404 / `text/html` / JavaScript 없는 기존 `public/404.html`을 반환했다. 실제 HTTPS Bag·Checkout의 requestId/body를 동결할 수 없어, Account/Function ON·Function 배포·합성 자원 생성으로 넘어가지 않았다.

test builder가 `public/404.html`을 복사하면서 필요한 경로별 HTML을 생성하지 않았다. 로컬 서버는 없는 경로를 항상 `index.html`로 바꿔 주어 원격 차이를 가렸다. [Cloudflare 공식 규칙](https://developers.cloudflare.com/pages/configuration/serving-pages/)도 top-level 404가 있으면 자동 SPA fallback을 적용하지 않는다고 설명한다. Google Fonts·CSS MIME·CSP 문제와 구분했다.

다음 수정은 **로컬만 검증했으며 원격에 배포하지 않았다.**

- B7 builder가 account/callback/cart/reserve/lookup/complete 및 두 승인 상품의 목록·상세 경로에 concrete HTML entry를 생성한다. 운영 `public/404.html`, 디자인, CSP, 상품 정책은 변경하지 않는다.
- 새 로컬 static server는 실제 파일/경로별 HTML만 제공하고 없는 route/asset에는 shipped hard 404를 반환한다. 무조건적인 SPA fallback은 제거했다.
- `account/index.html` 누락을 RED로 재현하고 GREEN을 확인했다. Chromium/WebKit에서 concrete route 200, 없는 route/JS 404, CSS 200/MIME, 앱 렌더링 및 native UUID/body·draft 복원을 검사했다. 연속 navigation은 각 앱 렌더 완료를 기다리며 pageerror 검사를 유지한다.

Pages 시도는 **2/3회**다: CLOSED preview 1회 + 종료 CLOSED cover 1회. 새 CLOSED preview·OPEN·종료 cover에 필요한 배포 예산이 남지 않아 상한을 초기화하거나 추가 배포하지 않았다. 재개에는 명시적인 실행/배포 예산 승인이 필요하다. 15분 인증 창은 시작하지 않았고 연장도 없다.

## V3 보호장치 구현

- contract/runner/archive/browser/monitor/watchdog/recovery를 정확한 V3 SHA와 signature domain에 연결했다. V2 proof·manifest·signature는 거부한다. 원본 제품 handler는 그대로 사용한다.
- prepare는 닫힌 상태에서 정확히7변수를 create-only로 추가하고 arming은 같은 ID들만 갱신한다. 기존 customer flag와 writes/preorders 상태, secret metadata, 충돌 시 write0을 검사한다.
- JWT-only Account 검증, frozen body/requestId, cross-owner 원본404/409, HMAC/nonce/path, 120회·단일 실행·900초, 실패 시 OFF 및 한정된 session 정리를 로컬에서 검증했다. guard가 고객 간 요청을 먼저 막아 원본 소유권 검증을 숨기지 않는다.
- Appwrite1.8.1 Function PUT의 생략된 scopes/commands/timeout 기본값 적용을 발견했다. V3 OFF/OPEN adapter가 확인된 기존 B6 전체 계약을 보존하도록 RED→GREEN으로 수정했다. 실제 Function PUT은 실행하지 않았다.
- 자체 리뷰에서 archive가 이전 V2 guard를 복사하는 연결 오류를 발견했다. packed guard의 V3 파일 바이트·signature domain 검사 RED→GREEN으로 수정했다. V2 파일은 변경하지 않았다.
- overlay는 원래 SDK와 Checkout을 사용한다. 보호 파일의 key와 body6개를 local File API로 읽으며 key 입력은 사용 후 비운다. 잘못된 SHA/중복 UUID/잘못된 파일은 거부한다. 공개 bundle·명령행·보고서에 실제 key를 넣지 않는다. 단순 검증용 controls만 추가하고 운영 UI는 수정하지 않았다.
- 독립 watchdog deadline/heartbeat/manual stop/실패 복구와 HTTP Mock은 PASS다. **실제 Owner OFF 권한 시험, guarded runtime/JWT/header/path 및 watchdog 관리 요청은 NOT RUN**이다. Mock을 실제 공급자 검증으로 표시하지 않는다.

## PASS / FAIL / NOT RUN

| 검증 | 상태 | 근거·한계 |
| --- | --- | --- |
| V3 proof·target·7변수·HMAC·guard·archive·watchdog 로컬 회귀 | PASS | 기존 테스트 보존, 부정 시험 포함 |
| 전체 `npm test` (최종 수정 후) | PASS | **1,986 pass / 0 fail / 1 기존 skip, 총1,987** |
| Node22 집중 테스트 | PASS | **100 pass / 0 fail / 0 skip**; 로컬 Node22, 새 Linux deployment 실행 아님 |
| ESLint / TypeScript | PASS | root lint/TS, 신규 MJS·overlay 별도 검사 |
| KR→AU 순차 build | PASS | exit0; 기존 chunk size/dynamic import 경고 유지 |
| Chromium / WebKit compiled artifact Mock | PASS | 각 signed Mock9, pageerror0, wrong-target0, closed Function 호출0, concrete route/404/native 복원 |
| 비밀정보 검사 | PASS | 검사 파일 수는 최종 private 로그에 기록; 실제 보호 credential 검출0 |
| Console Owner·project ID·현재 운영 정책 GET | PASS | 정식 Owner, 운영4×42 Auth/SMTP/OAuth/service 필드 작업 전후 hash 동일 |
| CLOSED preview / V3 public manifest | PASS | 정확한 test Pages project, branch `b3-google-test`, SHA 동일, window=false |
| 실제 HTTPS 상품·Checkout entry | **FAIL** | 원격404로 native body 동결 불가; 수정 원격 재검증은 NOT RUN |
| 실제7변수 생성·runtime 반영 / guarded deployment·실행 | NOT RUN | 원격 변수 생성0, 새 Function deployment0 |
| 실제 독립 watchdog 관리 권한·heartbeat·OFF 요청 | NOT RUN | 로컬/Mock만 PASS |
| G/H 실제 Google 인증·플랫폼 JWT | NOT RUN | B3는 과거 별도 SDK 시험이며 이번 인수가 아님 |
| G/H 주문 owner·MY ORDERS·타인404 | NOT RUN | 신규 주문0, H 생성0 |
| Guest 주문·자동 귀속 차단·예약번호/전화 조회 | NOT RUN | 이번 실제 Function execution0, 로컬 회귀만 PASS |
| 실제 멱등성·쿠폰 단일 사용·Legacy 신규409 | NOT RUN | 쿠폰0, historical legacy retry도 로컬 근거만 유지 |
| 실제 OAuth·카트·프로필·실기기 | NOT RUN | compiled Mock 복원과 구분 |
| 종료 CLOSED / B6 상태 | PASS | 아래 직접 확인 |

기존 skip은 AU 산출물 검사 시 `KR production dist does not publish AU Chocolate pages`의 market 조건이다. 새 실패·skip 또는 기존 테스트 삭제·완화는 없다. 원격 gate FAIL을 전체 테스트 PASS에 포함하지 않는다.

## 실제 변경과 종료 확인

| 항목 | 결과 |
| --- | --- |
| Pages | 정확한 test project에2회, 마지막 CLOSED cover. 추가 deploy 없음 |
| Account / anonymous API | OFF / HTTP403 |
| Function | enabled=false, execute=[], Node22, B6 `6ad41e576cb7a8f346af`. Function 설정·배포 write0 |
| Auth limit / 사용자 | 원래2 유지, M+G 정확히2명. H·새 로그인 session 생성0, 기존 session 삭제0 |
| customer flag | 기존 변수 false 유지 |
| Renewal writes / preorders | 원격 둘 다 **아직 없음**. 암묵적 OFF를 명시 변수 계약 PASS로 간주하지 않음 |
| B7 signing key | 실제 run key 생성·배포0, 무효화할 새 key 없음 |
| 주문 / 쿠폰 / mail queue | test reservations/manual/review/mail queue 모두0, 결제·메일0, 사전 점검 이후 execution0 |
| Google / B4 SMTP / schema·ACL | 보존. test DB2/collection12/attribute182/index38, available·ACL·owner schema·Admin M 재확인 |
| 운영4 | 현재 의미적 설정 지문 작업 전후 동일. Function6개의 active deployment/runtime/enabled는 B6 기록과 동일. 운영 document 조회·쓰기0 |
| 과거 AU raw 지문 | **UNVERIFIED 유지**. 이번 동일성으로 과거 차이를 해결했다고 주장하지 않음 |
| 서버 | API 정상/OOM0. RAM 가용8.81→8.77GiB, disk 가용83.07→82.99GiB, load1 0.42→0.36 표본. CPU 사용률 % 측정 아님. 서비스 재시작·재생성0 |

## 파일·커밋·재개 전제

- `50fbb67`: V3 server/contract/archive/runner/fixture manager/monitor/watchdog/recovery와 테스트.
- `221e6d5`: isolated V3 browser builder/signer/controls/native capture와 compiled tests.
- routing 수정 커밋은 Git log의 `fix(account): materialize B7 Pages routes and test hard 404`로 식별한다.
- [실행 계획](superpowers/plans/2026-10-18-customer-account-b7-v3-execution.md), 이 결과, rollout/provider index를 문서 커밋으로 보존한다.

증거는 `.superpowers/sdd/2026-10-18-customer-account-b7-v3-execution/`에 Git 제외로 보존했다. credentials/proof는0600, 원문은 출력하지 않았다. Mac Codex 단독 구현·자체 리뷰이며 별도 reviewer 검토를 받았다고 주장하지 않는다. 다른 worktree/main/원격 branch는 변경하지 않았다.

재개에는 수정 artifact의 실제 HTTPS 검증과 Pages 예산 승인이 필요하다. 그 뒤에만 실제 Checkout 동결, H/쿠폰 create-only, 정확히7변수, guarded deployment, 실제 management OFF·watchdog/header/runtime, 사용자 G/H 참여를 확인할 수 있다. 현재 이 gate들은 완료되지 않았다. Google 인증·2FA는 사용자가 직접 수행한다.

## B5 — DEFERRED / RELEASE BLOCKER

- [ ] 운영4 프로젝트·Console 공통 SMTP 영향 승인
- [ ] OTP 수신자 접근·남용 방지
- [ ] Gallery 의미적 지문 검증/예외 처리
- [ ] System SMTP 전용 Key·발신자 확정
- [ ] 운영 백업·root 인증·API/mail-worker 재생성·복구
- [ ] 실제 Email OTP·Google↔OTP 동일 UID 검증

native Email OTP는 OFF다. 공통 SMTP·OTP·B8·production 배포·main 병합과 후속 자동 실행은 하지 않았다. Google-only 출시도 별도 제품 결정·승인이 필요하다.
