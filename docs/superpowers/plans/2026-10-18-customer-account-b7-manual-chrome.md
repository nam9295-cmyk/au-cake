# B7 V3 — 사용자 Chrome 직접 조작 / CLI 준비·감시·복구

2026-10-18 KST. 사용자의 수동 전환 지시가 기존 CUA·file import 절차를 대체한다. **지금은 준비만 승인됐다. 사용자가 `시작`이라고 말하기 전 원격 쓰기·Pages 배포·새 시험 창을 실행하지 않는다.** Mac Codex 단독, `feat/customer-account` 워크트리에서 진행한다.

## 승인과 누적 한도

V3 원본 `docs/customer-account-b7-execution-manifest-v3.json` 및 SHA `1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90`, `executionApproved=false`, V1/V2, 기존 승인 증거·journal은 보존한다. 새 보호 preparation proof는 `startAuthorized=false / window=null`이다. 기존 900초 창을 재사용하지 않는다. `시작` 응답 뒤 별도의 실행 승인 증거와 새 journal을 만들고 원래 journal SHA·사용량을 인계한다.

| 항목 | 유지·승인된 제한 |
| --- | --- |
| 대상 | `https://api.verygood-chocolate.com/v1` / `verygood-au-account-test` / `ca-test-reservation-api` |
| 재사용 | M/G/H 3명, 쿠폰2건, 같은7개 변수 ID, guarded deployment `6ad456239aeb781a4f4d` |
| 실행 | 누적6/120 사용, **추가 최대114회**, 순차1. 기존 Function inventory16에는 B6 과거10건 포함 |
| Pages | 누적7회 사용. **OPEN8 + CLOSED9**만 승인 예정. CLOSED9는 복구 전용으로 예약 |
| 새 인증 창 | `시작` 뒤 사용자 참여 확인 시 새900초 단일 창1회, 연장·재시작 없음 |
| 합성 자료 | 고유 Renewal v2 주문 최대6건, 쿠폰 총2건. 첫 P0는 **G 케이크 회원 주문1건** |
| 금지 | 운영 데이터·결제·메일, 신규 사용자/쿠폰/변수/Function deployment, CUA/getApp/자동 브라우저 제어 |

`execute=[any]`의 외부 초기 실행 자원 소비 위험은 기존 승인 범위에서만 유지한다. Appwrite의 요청 hard cap으로 표현하지 않는다. 예상 밖 실행1건·알 수 없는 사용자·guard 오류·자원/health 이상이면 즉시 종료한다. 새 root/API Key·SMTP 설정·운영 권한은 필요하지 않다.

## CLOSED 상태에서 완료할 준비

1. 공식 Owner CLI 인증으로 **GET만** 수행한다. 정확한 project, Account OFF/403, disabled/execute=[], B6 active, CLOSED, 변수30/같은7 ID/false flags, 사용자3·G/H 세션0, guarded deployment ready/inactive를 확인한다. 운영4개 의미적 설정·Function6개 상태와 테스트 Google/B4 SMTP, schema/ACL, 서버 자원을 기존 evidence와 대조한다. 고객/운영 예약 화면은 열지 않는다.
2. 보호 preparation 파일에 이전 journal hash·기존 자원·사용량6/7을 고정한다. 새 키·deadline·실행 승인·watchdog worker를 만들지 않는다. 이전 H/쿠폰/변수/배포 생성 코드를 다시 호출하지 않는다.
3. 원래 fixture6개와 재직렬화·동결 결과의 전체 bytes/hash가 일치하는지 검증한다. 원래 G 케이크 requestId는 `e132a45c-996e-4768-a1f7-b5eb92c4ff9a`다. body·UUID·가격·상품·쿠폰을 바꾸지 않는다.
4. 수동 clipboard helper를 준비한다. CLOSED packet으로 실제 명령을 실행했을 때 **clipboard 읽기/쓰기 전 거부**하는지 확인한다. 정상/거부/45초 정리/사용자의 새 clipboard 보존은 로컬 메모리 adapter로 검증한다. 준비 중 실제 사용자 clipboard를 읽거나 덮어쓰지 않는다.
5. 기존 HMAC/플랫폼 JWT/원래 소유권·쿠폰·멱등성 테스트와 새 수동 경로/누적 예산/Pages9 복구 테스트를 수행한다. 브라우저를 자동 실행하지 않는다. 기존 compiled artifact와 archive를 재사용하며 일반 제품 코드를 바꾸지 않는다.

## 키의 로컬 전달

기존 HTTPS 테스트 패널의 `Test signing key` password input과 `Use key in this tab`을 사용한다. 확장 파일 권한·파일 import·DevTools·주소창·채팅 입력은 사용하지 않는다. 전체 run JSON이나 key를 출력하지 않는다.

`scripts/customer-account-b7-manual-clipboard.mjs`는 정확한 보호 packet(본인 소유 directory0700/file0600, symlink 거부)을 읽는다. V3 SHA·정확한 test target·`startAuthorized=true`·phase open·새900초 창·동결 body hash가 맞아야 복사한다. `/usr/bin/pbcopy` **stdin**으로만 전달하며 argv/env/log에 key를 넣지 않는다. 사용자에게 복사됐다는 고정 문구만 표시한다. 같은 값을 보유한 clipboard는 최대45초 또는 deadline까지 중 짧은 시간 뒤 비운다. 그동안 사용자가 다른 내용을 복사했으면 보존한다. **Terminal을 정리 완료까지 열어 둔다.** 전원 종료·강제 종료나 clipboard history/iCloud가 이미 보관한 복사본의 삭제까지 보증하지 않는다. 짧은 시험 전용 키만 사용하고 서버 deadline·종료 무효화는 별도로 유지한다.

보호 폴더의 `copy-to-test.command`는 로컬 전달만 수행하며 서버 활성화/배포 권한이 없다. 현재 packet은 start false이므로 거부한다. 시작 뒤 Codex가 검증한 새 키/창을 넣은 활성 packet을 만들고 다음 명령을 하나씩 안내한다. 지금 실행할 필요는 없다.

```sh
zsh '/Users/nam9295/Desktop/john_2.0/code/au-cake-customer-account/.superpowers/sdd/2026-10-18-customer-account-b7-v3-execution/manual-20261018/copy-to-test.command' key
```

같은 명령의 마지막 인수 `G-cake`는 원래 G 케이크 body를 **그대로** 복사하고, `G-detail`은 그 주문의 ID를 사용한 `customer-order` 요청만 복사한다. 임의 주문·새 UUID·수정 body는 허용하지 않는다. 두 요청도 화면/로그로 본문을 출력하지 않는다.

## `시작` 이후 Codex CLI 순서 — 이번 준비에서 실행하지 않음

1. G/H 참여·Owner/Cloudflare 인증·기준선·기존 archive/compiled artifact를 재확인한다. 과거 AU raw 차이는 **UNVERIFIED**로 남기고 현재 정책의 새 drift는 중단 사유로 삼는다. 새 protection proof는 V3 SHA에 바인딩하며 이번 수동 승인·새900초·6+114/7+2 cap을 명시한다. 기존 journal은 수정하지 않는다.
2. 실행 journal은 기존 deployment/archive/fixture/같은7 변수 ID를 인계하고 `attempts.deployment/prepareVariables=true`만 이어받는다. configure/open/window/Pages 시도는 새 단일 창에서 한 번만 허용한다. `createB7ContinuationState`의 **과거3/5 전용 계약을 이번6/7에 재사용하지 않는다.** 별도 수동 preparation을 검증해 새 실행 journal을 구성한다.
3. 같은 변수만 갱신한다. 새 창 전용 signing key, Customer=true, writes=true, preorders=false. authLimit3 및 기존 guarded deployment 활성화를 시험 대상에만 적용한다. 새 변수·Function 배포 없음. 준비/종료 false, secret metadata와 runtime 반영은 원래 계약대로 검증한다.
4. 독립 watchdog을 새 보호 config/journal로 실행한다. `priorExecutionCount=6`, known execution IDs16, 5초 heartbeat(완화 없음), 고정 deadline, OFF 관리 경로·수동 recover 명령을 확인한다. 필요한 health 호출도114회에 차감한다. 실제 worker 여러 주기가 안정적이지 않으면 OPEN하지 않는다.
5. 기존 artifact의 `test-window.json`에 새 고정 창만 설정해 **OPEN8**을 한 번 배포한다. 무단 closed preview·Function 배포는 하지 않는다. 개별 HTTP/window/lease gate를 통과해야 Account/Function을 연다. bounded GET은 원래 deadline 내에서만 하며 실패 시 즉시 복구한다.
6. 사용자에게 test origin의 `/account`와 로컬 복사 명령을 안내한다. 새 key는 masked input에만 넣는다. Codex는 CLI metadata/서명 execution·resource probe만 감시한다. G/H 로그인 전 intent를 journal에 기록하고 완료 응답 뒤 정확한 UID/provider/생성시각/세션ID metadata로 귀속한다. JWT·Cookie·OAuth code를 요청하거나 출력하지 않는다. 실패·취소 중 만들어진 세션도 intent·metadata로 확인 가능한 것만 귀속하고, 미귀속 세션은 성공으로 처리하지 않는다.
7. P0 뒤 시간이 남을 때만 나머지 허용 시나리오를 진행한다. 사용자 응답이 늦어도 자동 연장하지 않는다. deadline 또는 이상 시 사용자 조작과 무관하게 독립 watchdog이 OFF 복구한다.

## 사용자에게 안내할 클릭 순서

1. Codex가 OPEN 확인을 알리면 **별도 테스트 탭 하나**로 `https://au-account-test.verygood-chocolate.com/account`를 연다. 운영 사이트/예약 탭은 사용하지 않는다.
2. 안내된 `key` 로컬 명령을 실행하고, 테스트 패널의 **Test signing key**에 붙여넣어 **Use key in this tab**을 누른다. 비밀은 채팅에 보내지 않는다.
3. **Continue with Google** → G `nam9295@gmail.com`으로 직접 로그인·필요한2FA·동의. 돌아오면 **Read test identity**를 눌러 Codex에 “G 로그인 완료”만 알린다. UID는 Codex가 metadata로 대조한다.
4. Codex가 안내하는 `G-cake` 명령을 실행한다. **Approved B7 request**에 붙여넣고 **Execute approved request**를 **한 번** 누른다. 결제 버튼·일반 Checkout 제출·본문 수정은 하지 않는다. 연락처는 동결된 합성 값이다. “주문 결과 표시”라고 알려 확인을 기다린다.
5. `/account`의 **MY ORDERS**에서 G 주문과 상세를 직접 확인한다. 이름/전화/연락 이메일 수정 시험은 Codex가 시간과 상태를 확인해 안내할 때 합성 값으로만 진행한다.
6. **로그아웃** 후 같은 탭에서 H `verygoutchocolate@gmail.com`으로 Google 로그인한다. 필요하면 key 입력을 반복한다. **Read test identity** 후 “H 로그인 완료”를 알린다. H의 MY ORDERS에는 G 주문이 없어야 한다.
7. 안내된 `G-detail` 요청을 **Approved B7 request**에 붙여넣어 실행한다. 기대값은 **404 / CUSTOMER_ORDER_NOT_FOUND**다. guard의403은 소유권 검증 PASS가 아니다. 확인 뒤 Codex에 “종료” 또는 오류 상황만 알린다. key·JWT·Cookie·인증 코드는 보내지 않는다.

**범위 구분:** 이번 첫 주문은 사용자가 테스트 패널을 직접 눌러 원래 서버에 만드는 실제 회원 주문이다. 일반 Checkout은 새 UUID를 만들기 때문에 현재 frozen guard와 충돌한다. UI의 일반 Checkout 제출을 억지로 통과시키거나 원래 UUID 생성 로직을 바꾸지 않는다. 이 패널 시험을 **일반 Checkout 전체 인수·OAuth 주문서 복원 PASS로 보고하지 않는다.** 해당 항목은 별도 NOT RUN으로 유지한다. 고객 간 접근은 H가 G의 유효 frozen ID를 요청해 원래 서버 owner 검증404에 도달해야 PASS다.

## 종료·실패 복구

watchdog 및 기존 `customer-account-b7-v3-recover.mjs --test-project-off-only <새 config>`의 순서를 유지한다. Account OFF, Function disabled/execute=[], 세 flag false, signing key revoke, B6 `6ad41e576cb7a8f346af` 복원, authLimit2, 귀속된 G/H 세션 정리, **CLOSED9**를 수행한다. OPEN을 시도하지 않았고 기존 CLOSED가 GET으로 검증되면 Pages를 소비하지 않는다. OPEN 시도 뒤에는 CLOSED9를 한 번만 사용한다. 실패/미확인은 직접 차단을 사용자에게 요청하고 PASS로 기록하지 않는다. 합성 데이터·사용자·쿠폰은 삭제하지 않는다.

실제 GET으로 Account403, B6/disabled/execute=[], flagsfalse/같은7 ID, 신규 진입 CLOSED, G/H 세션, 운영4개 현시점 fingerprint와 Function6개, test schema/ACL/Google/B4 SMTP를 확인한다. 원문을 볼 수 없는 secret readback을 원문 일치 증명으로 보고하지 않는다. 결과는 PASS/FAIL/NOT RUN으로 구분하고 B7 뒤 중단한다.

**B5 — DEFERRED — RELEASE BLOCKER.** 공통 SMTP·수신자/남용 방지·Gallery 예외·system credential·운영 백업/재생성/복구·실제 OTP·Google↔OTP 동일 UID는 미완료. native OTP OFF. Google+OTP 출시, B5/B8·운영 배포·main 병합은 승인되지 않았다.
