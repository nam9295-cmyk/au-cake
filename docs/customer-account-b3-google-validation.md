# Customer Account B3 — Google SDK 인증 검증

2026-10-17 KST 시작, 2026-10-18 완료. **B3의 제한된 Google SDK 인증 검증을 마치고 Account OFF로 중지했다.** 회원 주문/MY ORDERS/제품 Checkout의 실제 공급자 통합 검증은 이 단계에 포함하지 않는다.

## 대상과 관리 경로

- Appwrite 1.8.1: `https://api.verygood-chocolate.com/v1`, `verygood-au-account-test`. 공식 Console Settings의 Project ID/endpoint/Account OFF를 재확인했다.
- 기존 Console Owner가 직접 로그인한 공식 Appwrite CLI 15 세션으로 공식 Projects API를 호출했다. 브라우저 cookie/storage를 추출하거나 새 관리 Key/role을 만들지 않았다.
- Cloudflare: 별도 Pages `au-cake-account-test`, branch `b3-google-test`, Git integration 없음. 운영 `au-cake-next`의 production/staging 및 기존 `au-cake`는 수정 대상이 아니다.
- HTTPS origin: `https://au-account-test.verygood-chocolate.com`. 신규 proxied CNAME `au-account-test` → `au-cake-account-test.pages.dev` 하나만 추가했다. 기존 zone의 TLS mode/CAA/메일 레코드/운영 DNS는 수정하지 않았다.
- Google Cloud: 신규 `verygood-au-account-test` / `VERYGOOD AU Account TEST`. External/Testing, 등록 테스트 사용자 1명. 별도 Web OAuth Client `VERYGOOD AU Account TEST Web`.
- Google origin은 위 테스트 HTTPS 하나, redirect는 Appwrite Console에서 확인한 `https://api.verygood-chocolate.com/v1/account/sessions/oauth2/callback/google/verygood-au-account-test` 하나다.

Google 사용자 데이터 정책 동의·Client 생성/JSON 다운로드는 사용자가 직접 수행했다. JSON은 Downloads에서 Git 제외 보호 디렉터리로 옮기고 디렉터리 0700/파일 0600으로 보관했다. Client Secret/Owner cookie/OAuth code/JWT/session secret은 보고서·Git·로그에 기록하지 않는다.

Cloudflare 로그인은 사용자가 공식 Wrangler 4.151.1에서 직접 진행했다. 요청한 resource scopes는 `account:read user:read pages:write zone:read`이며 Wrangler가 정상 refresh용 `offline_access`를 함께 요청했다. 새 API Key는 만들지 않았다. 테스트 bundle은 production `.env`/Vite config를 읽지 않고 SDK 23과 고정 공개 endpoint/project/origin만 포함한다.

## Google 테스트 사용자 목록의 한계와 추가 승인

기본 `openid/email/profile` 및 Sign in with Google에는 Testing 사용자 목록 제한의 예외가 있다. 따라서 목록 1명이 다른 Google 계정의 인증을 막는다고 주장하지 않는다. [Google 공식 Audience 문서](https://support.google.com/cloud/answer/15549945?hl=en)

기존 Cloudflare 계정에는 Zero Trust onboarding이 구성되지 않았다. Access/WAF 또는 공유 Appwrite endpoint의 프로젝트별 방화벽을 새로 만들거나 운영 설정을 변경하지 않았다. 이 한계를 알린 뒤 사용자가 다음 제한 실험을 추가 승인했다.

- 테스트 project `authLimit=2`: 기존 관리자 M 1명 + 신규 Google G 1명. 최초 변경 전 Auth inventory는 M(`ca-test-admin-m-20261017`) 1명뿐이었다.
- 최대 15분의 Account ON. 실제 감시 창은 14분으로 잡아 OFF 요청 지연 여유를 둔다.
- 별도 로컬 watchdog이 deadline/예상하지 않은 test user/health/auth configuration/서버 자원 문제를 감시하고 고정된 테스트 프로젝트 Account OFF를 요청·검증한다.
- 자동 감시가 준비되지 않았거나 HTTPS/사용자 상한/다른 인증 OFF 조건이 맞지 않으면 ON 금지. 종료 후 프론트 진입도 닫는다.

이 상한은 이메일 allowlist 또는 원자적 가입 lock이 아니다. 외부 사용자가 먼저 가입하거나 동시 생성이 경합할 가능성은 남는다. 예상 외 UID/이메일이면 즉시 중단하고 자동 삭제하지 않는다. 로컬 watchdog은 Mac/네트워크 정상 동작에 의존하므로 OFF 실제 GET 검증이 최종 종료 증거다.

## 변경한 테스트 설정과 검증 도구

- Account 활성화 전 Email/Password, Phone, Magic URL, Email OTP, Anonymous, Team Invites, JWT를 모두 OFF. Google 이외 모든 OAuth provider disabled 확인.
- Web platform 1개: `6ad387926a28db794a81`, 정확한 테스트 hostname/type web.
- 테스트 Google provider만 등록/enabled. Account OFF에서는 client SDK 인증이 차단된다.
- DB 2/Collection 12/Attribute 182/Index 38/Key 3/settings 1/관리자 ACL은 B2 자원을 그대로 보존한다. Function/Bucket/전역 변수는 생성하지 않는다.
- `scripts/customer-account-google-test.mjs`: exact target/Owner session endpoint/fixed management routes, 기타 인증 OFF/정확한 platform/2명 상한/승인·watchdog·15분 이내 proof가 있어야 ON. stop은 실패한 사전 read와 무관하게 고정 OFF 요청 가능.
- `scripts/customer-account-google-test-hosting.mjs`: 신규 test Pages/정확한 custom domain POST 두 종류만 허용. 재시도·삭제·운영 mutation 없음.
- `scripts/build-customer-account-google-smoke.mjs`, `tools/customer-account-google-smoke/`: 제품 기능과 별도의 SDK-only static probe. 기본 닫힘, no-store/noindex/no-referrer/CSP/hard 404. pages.dev origin에서는 인증 요청을 실행하지 않는다.
- 테스트 페이지는 Account.get/current logout/Google session만 사용한다. callback query/fragment는 UI/진단 전에 제거하며 계정 출력은 user ID/name/email/verified, 오류는 status/허용된 type만 표시한다. 주문/결제/Function/DB 호출은 없다.

## 실제 인증 결과

Account ON은 2026-10-18 00:01:49 KST, OFF GET 확인은 00:08:40 KST다(약 6분 51초). 예정 deadline 00:15:07보다 먼저 정상 중지했다. 사용자 본인이 Google 기본 프로필/이메일 동의를 완료한 뒤 신규 Google Auth 사용자가 생성됐다.

- G UID: `6ad38e4e0ffd5f810e23`, 생성 2026-10-18 00:03:42 KST. 지정된 테스트 이메일 일치, emailVerification=true, labels=[] 확인.
- 실제 SDK `Account.get()` 성공. 새로고침 및 같은 Chrome profile의 새 탭에서 같은 UID 복원 성공.
- 테스트 Auth inventory는 기존 M + 신규 G의 정확히 2명이다. 운영 Auth 사용자는 조회하지 않았다.
- 명시적 `deleteSession(current)` 후 Account.get 거부. 같은 Chrome profile의 다른 탭에서도 재검사 시 401, 이전 identity 표시 제거 확인. Owner 관리 API로 G의 남은 server session=0을 검증했다.
- 사용자가 Chrome 시크릿 창을 직접 열어 Signed out/401을 확인했다. 이때 기본 profile은 G로 로그인돼 있었다. **쿠키 분리는 사용자 보조 검증**이며 자동화된 두 번째 Google 로그인/Safari 실기기 검증으로 계산하지 않는다. Native Chrome 시크릿 창 열기는 사용자 입력에 의해 중단되어 다른 창을 강제로 조작하지 않았다.
- 실제 Google 재진입 → 지정 계정 선택 → Google 동의 취소 → `/failed/` 복귀 → Signed out/401, identity 빈 상태 확인. 취소 후에도 G server session=0. Google `access_denied` 실패 복귀를 실제 검증했으며 별도 provider outage/잘못된 client secret을 인위적으로 만들지는 않았다.
- Account OFF 후 실제 client API는 HTTP 403 `general_service_disabled`, canonical 사이트는 `test-window.json={enabled:false,endsAt:null}`. Google provider/client/user/platform은 후속 검증을 위해 보존했다.

DNS/TLS는 Console/API의 domain/validation/verification Active·SSL enabled, 정상 HTTPS 200과 certificate verification으로 확인했다. Mac 음성 DNS 캐시로 초기에 ERR_NAME_NOT_RESOLVED가 있었고, 공개/권위 resolver와 Mac DNS-SD read 검증 후 정상 갱신됐다. DNS server/hosts/TLS 예외를 추가하거나 Mac/서버 서비스를 재시작하지 않았다. `sudo -n` 캐시 갱신은 비밀번호 요구로 실행되지 않았다.

로그인 이메일과 UID만 실제 SDK 인증 결과로 확인했다. OTP 발송, Google↔OTP 동일 이메일 UID 통합, 고객 profile Preferences, 제품 OAuth draft/cart 복원, 회원 주문 소유권/다른 고객 차단/관리자 Function 회귀는 **실제 공급자 통합 미검증**이다. Function/readiness가 없으므로 제품 로그인·주문 통합 성공 또는 production 준비 완료로 보고하지 않는다.

## 로컬 회귀 검증

실행 당시 전체 `npm test`: 1,872 pass / 0 fail / 기존 skip 1. 신규 B3 7개 및 Node22.23.3 재실행 7개 모두 통과. 이전 1,865 pass에서 7개 추가됐다. 제한 조건 보강 시 RED 2개를 재현한 뒤 GREEN으로 전환했다. 기존 테스트 삭제/완화는 없다.

`npm run lint`, `npx tsc -b`, 신규 JS Node syntax, AU/KR build 통과. 기존 bundle size advisory만 있으며 기능 변경으로 경고 기준을 완화하지 않았다. production/Function/runtime/sharp/package/lock은 수정하지 않았다.

KR build 직후 재실행은 SEO 1개 실패(950 pass 시점 중단)를 보였다. KR build가 공용 생성물 `public/llms.txt`/`public/sitemap.xml`을 바꾼 상태가 원인이었다. AU build로 재생성하여 두 파일의 HEAD 동등성을 확인한 뒤 전체를 다시 실행해 1,872 pass/0 fail/skip1을 확인했다. 검사/정책/가격/테스트를 수정하거나 완화하지 않았다. 신규 JS 8개에 별도 no-unused-vars/no-undef 검사도 통과했다.

최종 read-only 점검의 초기 assertion은 service-disabled를 HTTP 503으로 잘못 가정해 실패했다. 실제 응답과 [고정 1.8.1 error 정의](https://github.com/appwrite/appwrite/blob/1.8.1/app/config/errors.php)를 대조해 공식 계약인 403으로 정정하고 다시 검증했다. 서버 설정을 바꿔 assertion을 맞추지 않았다.

## 종료·운영 불변·Git

신규 인증 진입과 Account가 모두 OFF다. 최종 테스트 Pages deployment는 `c21f53ed-e3c2-4937-b638-2b7e2f29895c`다. 초기 closed → bounded armed → final closed의 세 번 배포는 전부 신규 `au-cake-account-test`에만 실행했다.

23:24:05 → 00:09:10 KST read-only metadata 비교:

- 기존 `verygood-main`, `69cb27ef002b63e77c53`, `69db3ae20026cdc0c7fe`, `verygood-au`의 9개 fingerprint/자원 수/active deployment가 전부 동일.
- 테스트 DB/schema ACL/Function/deployment/Bucket/변수/Key metadata fingerprint도 동일. 달라진 항목은 승인된 test auth/project configuration과 신규 Web platform뿐이다.
- 핵심 5개 container ID/image/start/env hash 동일. RAM available 약 8.93→8.93GiB, disk available 약 83.14→83.19GiB, load 1/5/15분 0.42/0.42/0.37→0.08/0.27/0.29. 공유 서버 관측치이며 변화 전체를 테스트의 영향으로 단정하지 않는다. watchdog은 API/version/Auth inventory/자원 중단 기준 이상 없이 operator stop으로 종료됐다.
- Cloudflare는 초기 첫 페이지의 기존 10개 public deployment/domain/branch metadata 동일, Account ON 전 전체 inventory를 보완해 기존 Pages 30개 설정 hash·canonical/latest deployment·domain·branch가 최종 모두 동일. 초기 조회는 10개씩 3페이지 중 첫 페이지만이었으므로 전체 30개의 configuration 비교 기준은 ON 전 checkpoint임을 구분한다.
- DNS 초기 화면의 기존 24개 행이 최종 모두 보존됐다. 신규 승인 CNAME 1개와 초기 viewport 밖의 managed Worker 행을 구분했다. MX/SPF/DKIM/Google verification 레코드를 수정하지 않았다.

코드 커밋 `e58a09b`: target/auth/hosting guard와 별도 SDK probe 및 7개 테스트. 문서 커밋은 이 파일의 Git log로 식별한다. 제품 `src/`, Function code, package/lock, 운영 env, main/다른 worktree는 수정하지 않았다. main/origin main ref는 `34ba1072f475ba8458b25a8ffd7a9e5467293dbe`로 보존했다. manifest SHA-256도 기존 승인 값 그대로다.

작업용 Appwrite CLI의 current session만 공식 logout 204 후 기존 자격증명 401을 확인하고 로컬 cookie를 지웠다. 기존 브라우저 Console Owner는 새로고침 후에도 Settings 접근 가능·정확한 project ID·Account OFF로 유지됐다. Wrangler도 공식 logout 완료·로컬 token 파일 없음·이전 access token GET 거부(403)를 확인했다. 정상 logout이 설정 파일을 제거하므로 최초 파일 존재를 가정한 후속 로컬 read는 ENOENT를 보였고, 파일 없음과 실제 접근 거부로 종료 상태를 재검증했다.

보호된 Client JSON 및 테스트 자원/사용자/설정은 보존한다. 최종 문서 commit 후 worktree clean을 확인하고 보고한다. **B4 이후, SMTP/OTP/Function/production 배포/main 병합은 미실행이며 별도 승인 전 진행하지 않는다.** sharp 0.35.4 및 reservation Node16 deploy 기본값/운영 Node22 차이는 별도 해결 대상으로 유지한다.
