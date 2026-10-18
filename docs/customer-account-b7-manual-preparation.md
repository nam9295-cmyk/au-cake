# B7 V3 수동 Chrome 시험 준비 결과

2026-10-18 KST. **수동 시험 준비를 완료하고 `시작` 대기 중이다.** 이번 작업의 원격 쓰기·Account ON·Function 활성화·Pages 배포·새 인증 창·주문/쿠폰/사용자 생성은 모두0이다. CUA/getApp/자동 브라우저 제어를 사용하지 않았으며 운영 고객/예약 화면에 접근하지 않았다. 과거 화면 관찰 사고를 없던 일로 바꾸지 않고 [기존 결과](customer-account-b7-v3-continuation-results.md)를 보존한다.

## 준비 결과

- [수동 실행 계획](superpowers/plans/2026-10-18-customer-account-b7-manual-chrome.md)에 CLI 준비·감시·독립 watchdog·복구, 사용자가 누를 버튼 및 중단 조건을 정리했다. Chrome 확장의 파일 접근 권한이나 보호 파일 import는 필요하지 않다.
- `scripts/customer-account-b7-manual.mjs`는 정확한 V3 bytes·기존 journal SHA·자원·사용량6/7·성공한 이전 closure·세션0으로부터 **start false / window null** preparation을 만든다. 원래 journal을 수정하거나 실행 예산을 초기화하지 않는다.
- clipboard helper는 본인 소유의 보호 파일/폴더와 정확한 target·V3 SHA·새900초·start true/open·fixture hash를 검증한다. key는 pbcopy stdin으로만 전달하고 출력/argv/env에 넣지 않는다. 최대45초 뒤 같은 clipboard만 정리한다. 실제 CLOSED packet으로 실행한 명령이 clipboard 접근 전 거부됨을 확인했다. 준비 중 실제 clipboard를 읽거나 변경하지 않았다.
- 원래 fixture6개와 동결 재생성 bytes/hash의 일치를 확인했다. 수동 `G-cake`는 **원래 G 케이크 body 문자열 그대로**, requestId `e132a45c-996e-4768-a1f7-b5eb92c4ff9a`를 복사한다. H의 `G-detail`은 같은 유효 frozen ID를 사용하므로 원래 서버의 owner 검사404를 시험할 수 있다. 기존 real reservation handler 단위 테스트가 타인404/guest401/재시도409를 검증한다. 실제 고객 JWT·소유권 인수는 아직 NOT RUN이다.
- CLOSED 복구 adapter에 정확한 추가 승인 cap **OPEN8 이후 CLOSED9** 분기를 추가했다. cap 변경·무승인 proof·잘못된 slot·열 번째 배포는 거부한다. adapter를 실제 원격 배포에 호출하지 않았다. 기존 cap3/5/7와 테스트도 보존했다.
- `manual-20261018/` 보호 evidence에 preparation proof·원본 body·수동 복사 명령·GET 결과·RED/GREEN·검증 로그를 분리 저장했다. `transfer.private.json`은 **startAuthorized=false / phase=prepared / 새 key 없음**이다. 사용자 `시작` 뒤에만 새 승인 proof·실행 journal·창 전용 키·watchdog config를 구성한다. 기존 V1/V2/V3 manifest와 승인 증거는 변경하지 않았다.

## 실제 GET-only 확인

| 확인 항목 | 결과 |
| --- | --- |
| 정확한 endpoint/project, Account OFF / 실제403 | PASS |
| Function disabled / execute=[] / B6 active | PASS — `6ad41e576cb7a8f346af` |
| 기존 guarded deployment | PASS — `6ad456239aeb781a4f4d`, ready/inactive·재생성 없음 |
| 변수30 / 신규7개 ID 보존 / secret metadata / 세 flags false | PASS |
| M/G/H 3명 / G·H 세션0 / authLimit2 | PASS |
| 기존 쿠폰2건 | PASS — active,5%/10%,M 전용 ACL, 재생성0 |
| 합성 reservations / email queue | 0 / 0, 이번 주문·결제·메일0 |
| B7 사용량 | 누적6/120, **추가114회**. 전체 inventory16 = B6 과거10 + B7 6; 알 수 없는 실행0 |
| Pages | 기존7회 유지, 추가 배포0. 향후 OPEN8/CLOSED9만 예약 |
| HTTPS 사이트 | CLOSED200, enabled=false, script-free |
| 테스트 DB/schema/ACL | PASS — GET28, DB2 / Collection12 / Attribute182 / Index38,available·M·owner schema 검증 |
| 테스트 Google/B4 SMTP | 기존 보호 설정 지문 동일, 변경0 |
| 운영4개 설정·기존 Function6개 | 현시점 의미적 지문·deployment/runtime/enabled 동일, 쓰기0 |
| 과거 운영 AU raw 지문 차이 | **UNVERIFIED** 유지 |
| 서버 | API1.8.1 healthy, 가용 RAM 약8.92GiB / disk 약82.99GiB / load1 약0.23 / OOM0. CPU 사용률 측정값이 아니며 서비스 재시작0 |

## 로컬 검증과 한계

| 검증 | 결과 |
| --- | --- |
| 새 수동 계약/clipboard/누적 실행/Pages | **13 PASS / 0 FAIL**, 기존 Pages 테스트 포함. 최초 RED는 누락 helper·cap9 거부의8 FAIL / 기존3 PASS이며 증거 보존 |
| 전체 `npm test` | **2,023 PASS / 0 FAIL / 기존 SKIP1**, 총2,024·69 summaries |
| Node22.23.3 집중 | **49 PASS / 0 FAIL / 0 SKIP** — 수동·Pages·guard·gate·watchdog/복구 |
| ESLint / TypeScript / 변경MJS lint / syntax / diff | PASS |
| Git 후보 비밀정보 검사 | PASS — 1,901파일·확인한 보호값5종 일치0·credential 패턴0. 원본manifest3종과 이전journal SHA 보존 |
| AU build | 전체 npm test 안의 build PASS |
| 이번 KR build / compiled browser 자동 실행 | NOT RUN — 제품/UI/overlay/dependency 변경 없음, 자동 브라우저 사용 금지 준수. 기존 증거를 이번 수동 Chrome 검증으로 간주하지 않음 |
| 실제 clipboard 성공 경로 | NOT RUN — start false에서 실제 명령 거부만 확인. 성공·45초 정리·사용자 새 clipboard 보존은 로컬 메모리 boundary 테스트 |
| 새 창의 실제 watchdog/OPEN/종료 | NOT RUN — 이전 실제 watchdog 복구 PASS evidence는 보존. 새 worker를 시작하지 않음 |
| G/H 실제 로그인·JWT·회원 주문·MY ORDERS·고객 간404 | **NOT RUN** — `시작` 이후 P0 |
| 일반 Checkout 제출 / Google 후 주문서·카트 복원 / 실기기 | **NOT RUN** — 수동 테스트 패널 주문과 구분 |
| OTP / Google↔OTP UID | **NOT RUN** — B5 미완료 |

기존 skip은 AU dist의 `KR production dist does not publish AU Chocolate pages` 조건부 skip이다. 기존 테스트를 삭제하거나 완화하지 않았다. 제품 UI·가격·상품·쿠폰·cutover·JWT/owner 정책은 변경하지 않았다.

코드·테스트 커밋: `f544032` — 수동 preparation/clipboard 전달·실행6+114·CLOSED9 계약. 문서와 안내는 별도 커밋으로 분리한다. 작업은 지정 feature worktree에서만 수행했으며 보호 evidence·원본 body·CLI 인증정보·복사 packet은 Git 제외다. main 병합/push/다른 worktree 수정은 없다.

## 사용자가 직접 할 순서

지금은 **`시작`이라고 말하기만 하면 된다.** 아직 사이트는 CLOSED다. Codex가 필수 GET/lease 확인과 OPEN을 마치면 다음을 한 단계씩 안내한다.

1. 별도 테스트 Chrome 탭에서 `/account`를 연다.
2. 안내한 로컬 명령으로 key를 복사 → **Test signing key**에 붙여넣기 → **Use key in this tab**.
3. **Continue with Google**로 G 로그인·2FA → **Read test identity** → “G 로그인 완료” 알리기.
4. 로컬 `G-cake` 복사 → **Approved B7 request**에 붙여넣기 → **Execute approved request** 한 번. 일반 Checkout 제출/결제는 누르지 않는다.
5. **MY ORDERS** 목록·상세 확인. 로그아웃 후 H로 Google 로그인해 H 목록에 G 주문이 없는지 확인.
6. 로컬 `G-detail` 요청을 같은 패널에서 실행해 **404 / CUSTOMER_ORDER_NOT_FOUND** 확인. 오류·종료를 알리면 CLI가 즉시 OFF/B6/CLOSED를 복구·검증한다.

한 탭·순차1·새900초·누적120회·주문 최대6·쿠폰2·Pages9 cap을 유지한다. 시간이 남아도 새 창을 자동 시작하지 않는다. key/JWT/Cookie/code를 채팅이나 화면 캡처로 공유하지 않는다. clipboard 기록·iCloud 사본 삭제는 보증하지 않으므로 짧은 test key만 사용하며 종료 서버 무효화가 별도로 필요하다.

**B5 — DEFERRED — RELEASE BLOCKER.** 공통 SMTP·OTP 수신자/남용 방지·Gallery 예외·system credential·운영 백업/재생성/복구·실제 OTP와 Google↔OTP UID는 미완료다. native OTP OFF. main 병합·운영 배포·B5/B8 자동 실행 없이 `시작`을 기다린다.
