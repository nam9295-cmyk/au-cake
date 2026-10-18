# Google-only 로그인 단독 인수 — 준비 결과

2026-10-18 KST. Branch `feat/customer-account`, 시작 커밋 `204421a`. [승인 계획](superpowers/plans/2026-10-18-customer-account-google-only-acceptance.md)의 로컬 준비와 CLOSED 사전 점검을 수행했다. **사용자의 새 `시작` 지시 전까지 Account ON·Pages 배포·실제 인증 창을 실행하지 않는다.**

## 구현과 보호 경계

- `tools/customer-account-google-only/entry.tsx`: 실제 제품 Provider·AccountPage·callback·auth 사용. Google 버튼과 프로필, EN/KO, Account/current-session 확인만 제공한다. 이메일 UI는 시험에서만 숨기고 Email SDK 경로도 거부한다. 서버의 다른 인증 OFF 검사는 별도로 유지한다.
- 같은 디렉터리 `contract.mjs`: 정확한 origin/900초 deadline/기존 G·H UID만 허용. Google 시도 최대4회, 합성 프로필 G/H 각각 최대2회. 로그인 이메일은 Account가 제공한 값을 화면에서 확인하며 공개 bundle에 실제 테스트 이메일을 새로 넣지 않는다. 이 client 제한을 Appwrite API의 수신자/이메일 allowlist로 주장하지 않는다.
- `orders-unavailable.mjs` 및 Provider의 orderService 주입: HTTP 없이 주문 unavailable. Vite stage에서 repository import도 이 모듈로 격리한다. Function/JWT/주문/쿠폰/결제 호출0. 실제 backend readiness 실패를 재현하거나 MY ORDERS 인수를 성공한 것은 아니다.
- `scripts/build-customer-account-google-only.mjs`: 운영 `.env`를 읽지 않는 격리 Vite stage, 테스트 공개값만 포함한다. 실제 `/account`·callback html, JS/CSS, hard404, 동일 출처 폰트/CSP를 유지한다. OPEN8/CLOSED9 claim은 배포 전 exclusive 생성하며 재호출로 예산을 늘리지 않는다. CLOSED는 JS 없는 정적 화면이다.
- `scripts/customer-account-google-test.mjs`: 기존 B3 API를 보존한 별도 Google-only manager. exact target, 기존3 UID/상한2·Google-only·세션 알림 OFF·B6/flags OFF를 검증한다. 쓰기 경로는 테스트 Account 서비스와 명확히 귀속된 G/H 세션 삭제뿐이다. Function·authLimit·다른 인증·Key·사용자·DB 쓰기 인터페이스가 없다.
- `scripts/customer-account-google-only-watchdog.mjs`, `customer-account-google-only-live.mjs`: 독립 CLI 프로세스, 1초 heartbeat·5초 freshness·고정 deadline, 자원/설정/사용자/세션/예상 외 Function execution 감시. Account ON 전후의 명시적인 최대8초 전환 상태는 과도기적인 OFF/ON 응답만 허용하며 deadline/lease는 늘리지 않는다. 중지 시 OFF 우선, 귀속 세션 정리, CLOSED, 직접 검증을 수행한다. 이전 execution/설정을 새 정상 baseline으로 받아들이지 않는다.

제품 `src/`·reservation 서버·가격/쿠폰/멱등성·DB ACL·migration·dependency·운영 feature flag는 이번에 변경하지 않았다. HMAC/주문 guard/health를 다시 실행하거나 새 signing key·Function 변수·deployment를 만들지 않았다. Mac Codex 단독 자체 리뷰이며 CUA/Chrome 자동 조작/Playwright를 사용하지 않았다.

구현·테스트 커밋은 `63bb331` (`test(account): prepare isolated Google-only manual acceptance`)이다. 상세 RED/GREEN·검사·공식 Owner checkpoint·보호된 준비 proof와 수동 복구 명령은 Git 제외 `.superpowers/sdd/2026-10-18-customer-account-google-only-acceptance/`에 보관한다. 현재 `startAuthorized=false/window=null`이며 새 `시작` 지시 전 실제 시험을 실행하지 않는다.

## 실제 CLOSED 사전 점검

| 항목 | 결과 |
| --- | --- |
| 공식 Owner 인증·team owner membership | PASS. 기존 CLI 세션 사용, 새 Key/role0 |
| Cloudflare 공식 CLI 인증·계정 일치 | PASS. whoami만 수행, 배포0 |
| test Account | OFF, 실제 client403 `general_service_disabled` PASS |
| test Auth | 정확히 M/G/H3명, authLimit2, G/H/M 세션0, Google만 enabled, Email OTP 등 다른 인증·sessionAlerts OFF |
| reservation Function | disabled / execute=[] / Node22 / B6 `6ad41e576cb7a8f346af` active, events/schedule 없음 |
| variables | 기존30개, customer·Renewal writes·preorders false. 신규/갱신 변수0 |
| 테스트 DB/schema/ACL | 2/12/182/38, available, 승인 B2 정의와 ACL 및 owner attribute/index 검증 PASS |
| 외부 메일 부작용 | 테스트 webhook0·Function events 없음·sessionAlerts OFF. 공통/프로젝트 SMTP 변경0 |
| B3 Google/B4 SMTP·기타 test 보호 설정 | 이전 보호 지문과 일치 PASS |
| 운영4개 / 기존 Function6개 | 현시점 의미적 설정·active deployment/runtime/enabled가 이전 checkpoint와 일치 PASS |
| 테스트 사이트 | HTTPS root 정적 CLOSED·script 없음·test-window=false PASS |
| 실제 OFF 관리 경로 | 이미 OFF인 test Account에 idempotent OFF1회, 관리 GET/실제 API403 재확인 PASS. ON0 |
| 서버 aggregate sample | RAM available 약8.42GiB, disk available 약83.29GiB, load1 약0.78, OOM0, API1.8.1. 공유 서버의 일회성 관측이며 증분 영향으로 단정하지 않음 |

준비 과정의 초기 checkpoint 실패도 보존했다. enum이 manifest의 `type=enum`과 실제 API의 `type=string, format=enum`으로 표현되는 차이는 값/순서/required 검증을 유지한 로컬 정규화로 해결했다. Webhook metadata의 공식 경로와 aggregate metrics probe의 명시적 빈 resource allowlist도 바로잡았다. 이들은 새 검증기 연결 오류였으며 운영 schema/SMTP/Auth를 바꾸지 않았다. 전체 checkpoint의 공식 API Mock·부정 테스트를 추가했다. [Appwrite 1.8.1 Webhook 경로](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/projects.php#L1143-L1178)

**현재 누적은 Function8/120·Pages7/9 그대로다.** 준비 중 Function 실행/배포·Pages 배포·신규 사용자/주문/쿠폰·프로필 쓰기는 모두0이다. 유일한 사전 쓰기는 승인 계획에 명시된 test Account OFF 권한 확인1회이며 OFF 상태는 그대로다.

## 시작·복구 절차

새 보호 preparation proof는 `kind=GOOGLE_ONLY`, 계획 SHA `9a938d7a5b86af5f17c12a61baddf73748565a9c4c7c9bb86ce41883046708ab`, `startAuthorized=false`, `window=null`이다. 승인 계획 원문과 V1/V2/V3 manifest·SHA·journal은 수정하지 않았다. 원래 B7 승인 proof를 Google-only 실행에 재사용하지 않는다.

1. 사용자가 Mac 앞에서 **`시작`**이라고 말하면 Owner/Cloudflare 인증·현재 OFF 상태·G/H 참여를 재확인한다. 별도 start proof와 새 journal에 과거 사용량을 인계하며 새 최대900초 deadline을 고정한다.
2. 실제 OFF 권한을 가진 독립 watchdog을 시작하고 여러 heartbeat 주기가 5초 이내인지 확인한다. 준비 중 실행한 detached self-test는 Mock이며 이 live 검증을 대체하지 않는다.
3. OPEN8을1회 배포한다. 실제 HTTPS `/account`·callback·JS/CSS status/MIME/CSP·정확한 새 test-window를 CLI GET으로 확인한다. 전파 지연 읽기 재확인은 고정 deadline 안에서만 제한적으로 수행한다. 실패하면 Account를 열지 않고 CLOSED9로 종료한다.
4. lease·Google/다른 인증 OFF·Function OFF를 확인한다. journal의 `phase=opening`, `activationRequestedAt`를 기록하고 Account ON을1회 시도한다. 검증 성공 후 `phase=open/accountOn=true`와 승인된 G/H 로그인 intent를 기록한다. 새 사용자/상한 오류나 H identity 충돌은 설정을 바꾸지 않고 즉시 종료한다.
5. 사용자에게 테스트 페이지를 안내한다. 비밀값·키·파일 업로드·DevTools 입력은 없다. 사용자가 G/H Google 인증·프로필·로그아웃을 직접 수행하고 결과만 알려 준다.
6. 종료/첫 실패/deadline 시 Account OFF→관리 GET/client403→귀속된 G/H 세션 정리→CLOSED9→정적 HTML까지 직접 검증한다. 예전 baseline 세션/M/미귀속 세션·사용자/주문/쿠폰/프로필을 자동 삭제하지 않는다. Function/B6/flags는 읽어 확인하며 이번에 변경하지 않은 설정을 임의로 쓰지 않는다.

수동 OFF-only 명령은 보호 폴더의 `recover.command`로 준비했다. 실제 run config는 `시작` 이후에만 생성하므로 지금은 실행할 필요가 없다. 복구 실패/미확인은 PASS가 아니며 즉시 Console에서 정확한 test project의 Account OFF를 요청한다. Mac/네트워크 중단 시 로컬 watchdog이 서버 측 TTL처럼 계속 작동한다고 보장하지 않는다.

## 사용자 클릭 순서

OPEN 확인 안내 후 `https://au-account-test.verygood-chocolate.com/account`를 **별도 테스트 탭**에서 연다.

1. SIGN IN → Continue with Google → G 계정 선택·2FA·동의. 로그인 이메일과 세션 확인 버튼, 새로고침 복원을 확인한다.
2. 이름 `Google Test G`, 주문 연락 이메일 `g-contact@example.invalid`, 전화 공란, 언어 한국어로 저장한다. 새로고침 후 유지되는지 확인한다. MY ORDERS unavailable은 이 시험의 예상 화면이다.
3. Sign out → **Check account and session**에서 두 API의401 거부를 확인한다. 개인정보가 사라져야 한다.
4. H로 동일하게 로그인하고 G 정보가 남지 않았는지 확인한다. `Google Test H` / `h-contact@example.invalid` / 전화 공란 / English를 저장·새로고침·로그아웃한다.

각 사용자 저장은 최대2회다. 오류가 나면 반복 클릭하지 말고 상황만 알린다. Google 비밀번호·2FA code·Cookie·JWT·Client Secret을 채팅에 보내지 않는다. 최대15분을 연장하지 않고 미완료 항목은 NOT RUN으로 기록한다.

## 미실행 범위

최종 로컬 검증: 전체 `npm test` **2,072 PASS / 0 FAIL / 기존 SKIP1**(총2,073), `npm run test:customer-account` **295 PASS / 0 FAIL / 0 SKIP**, 신규 Google-only **26 PASS**. 기존 기준2,046 pass에26개 회귀를 추가했다. 제품 TypeScript `tsc -b`, 테스트 entry 별도 TypeScript, ESLint 및 신규 JS의 별도 ESLint도 PASS다. compiled artifact의 로컬 HTTP route/JS/CSS MIME·CSP·hard404와 독립 프로세스 Mock 복구를 검증했으며 자동 브라우저 조작은0이다.

`VITE_MARKET=KR npm run build`→`VITE_MARKET=AU npm run build` 순차 PASS다. 존재하지 않는 `build:kr` alias의 초기 호출 오류를 실제 환경 선택 명령으로 정정했으며 기존 bundle-size 경고는 그대로다. Git 후보·AU 및 테스트 build·안전한 evidence 파일3,057개에서 알려진 보호값5개의 포함 여부를 검사해0건을 확인했다. 테스트 bundle의 실제 G/H 이메일 문자열도0건이다. 승인 계획/V1·V2·V3 manifest SHA, 과거 journal과 D1 archive SHA는 불변이며 모든 private evidence는 Git 제외0700 디렉터리/0600 파일에 둔다.

실제 Google 로그인·Account/getSession·prefs 쓰기/복원·로그아웃·사용자 Chrome 인수 및 live watchdog/OPEN/CLOSED 배포는 아직 **NOT RUN**이다. 성공 여부는 독립적으로 기록하며 MY ORDERS unavailable을 로그인 실패로 처리하지 않는다. 실제 MY ORDERS/회원 주문/소유권 인수는 이 시험에 포함하지 않는다.

D1 settings1+병렬metadata7 지연 원인과 backend readiness17→5 최적화는 별도 후속으로 남긴다. **B5 — DEFERRED — RELEASE BLOCKER**, native OTP OFF·실제 OTP/Google↔OTP 동일 UID NOT RUN. 과거 운영 AU raw 설정 차이는 **UNVERIFIED** 유지. 운영 배포·main 병합·B5/B8 자동 진행은 없다.
