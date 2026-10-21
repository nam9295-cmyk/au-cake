# VERYGOOD AU 보안 강화 Phase 2 — 인증 방식·세션·Web platform

- 조사일: 2026-10-21
- 전용 Worktree: `/Users/nam9295/Desktop/john_2.0/code/au-cake-security`
- 브랜치 / 조사 기준: `fix/security-review-api` / `16d3510c5f5cd14c1ad11b2e3e5294ae67ff87ce`
- 운영 대상: Appwrite `verygood-au` 1개 프로젝트
- 실행 상태: 읽기 전용 조사와 실행 준비 완료, 운영 Auth 변경 0건

## 결론

Anonymous, Magic URL, Phone은 운영 설정상 ON이지만 현재 저장소의 제품 코드와 현재 AU 배포 코드에서 호출하는 경로가 없다. Google OAuth, Email OTP, 관리자 Email/password, JWT, Account service는 실제 코드 경로가 있으므로 유지해야 한다. 따라서 `verygood-au` 한 프로젝트에서 Phone → Magic URL → Anonymous 순서로 OFF하는 최소 변경은 준비됐다.

세션은 실제로 **1년(`31536000`초), 사용자당 최대 10개(`authSessionsLimit=10`)**다. `authLimit=0`은 세션 수가 아니라 프로젝트 사용자 수 무제한 설정이다. 30일 변경은 기술적으로 한 필드만 바꾸지만 기존 세션 만료를 일괄 단축하지 않고 신규·명시적 연장 세션에 적용된다. 이 변경은 인증 방식 OFF와 분리해 별도 승인받는다.

등록된 Web platform 7개는 이번 단계에서 삭제하지 않는다. 운영 3개는 현재 동일 배포를 제공한다. 나머지 4개는 삭제 근거가 충분하지 않다.

## 1. 읽기 전용 기준선

공식 Appwrite Console Owner 세션과 프로젝트 team membership을 확인한 뒤 Owner GET으로 프로젝트와 platform metadata를 읽었다. Secret 원문, 고객, 주문, 세션 문서는 읽지 않았다.

- 캡처: `2026-10-21T09:08:48.780Z`
- Endpoint: `https://api.verygood-chocolate.com/v1`
- Project: `verygood-au`
- Project updatedAt: `2026-10-21T01:00:00.990+00:00`
- 보호 원본: `/tmp/verygood-security-phase2/owner-project.private.json`, mode `0600`
- 정정된 semantic baseline: `/tmp/verygood-security-phase2/auth-baseline-v2.safe.json`, mode `0600`
- semantic baseline SHA-256: `f46a571dbdaa6eade54a9da6ae6d4bd5480855940f6aafd103c59a8741429115`

초기 safe projection은 `authLimit`을 세션 한도로 잘못 표시했다. 원본은 보존하고 v2에서 Appwrite 1.8.1 응답 모델대로 `authLimit=0`(사용자 수)과 `authSessionsLimit=10`(세션 수)을 분리했다.

| 항목 | 실제 값 | 판정 |
|---|---:|---|
| Account service | ON | 유지 |
| Google OAuth | ON, 유일한 활성 OAuth provider | 유지 |
| Email OTP | ON | 유지 |
| Email/password | ON | 관리자 때문에 유지 |
| JWT | ON | MY ORDERS·관리자 photo preview 때문에 유지 |
| Anonymous | ON | OFF 후보 |
| Magic URL | ON | OFF 후보 |
| Phone | ON | OFF 후보 |
| Invites | ON | 이번 범위 밖, 유지 |
| Session duration | 31,536,000초 | 별도 30일 변경 후보 |
| Sessions limit | 10 | 유지 |
| User limit | 0, unlimited | 유지 |
| Invalidate sessions | ON | 유지 |
| Session alerts | OFF | 이번 범위 밖 |

Appwrite 1.8.1의 공식 프로젝트 API는 `PATCH /v1/projects/{projectId}/auth/{method}`가 해당 auth 필드 하나만 바꾸도록 구현돼 있다. 지원 method는 `email-password`, `magic-url`, `email-otp`, `anonymous`, `invites`, `jwt`, `phone`이다. 근거는 실제 운영 `appwrite/appwrite:1.8.1` 컨테이너의 `app/controllers/api/projects.php`와 같은 버전의 [공식 projects controller](https://github.com/appwrite/appwrite/blob/1.8.x/app/controllers/api/projects.php)다.

## 2. 코드·API 사용처

### 반드시 유지할 경로

| 방식 | 제품 사용처 | 근거 |
|---|---|---|
| Email OTP | 고객 통합 가입·로그인 | `src/lib/customer-auth.ts`의 `createEmailToken` → `createSession` |
| Google OAuth | 고객 및 관리자 로그인 | `src/lib/customer-auth.ts`, `src/lib/repository.ts`의 `createOAuth2Session` |
| Email/password | 관리자 로그인 | `src/lib/repository.ts`의 `createEmailPasswordSession` |
| JWT | MY ORDERS 서버 위임, 관리자 review photo preview | `src/lib/customer-orders.ts`, `src/lib/admin-review-photo-preview.ts` |
| Account service | session restore, prefs, logout, 위 인증 전체 | `src/CustomerAccountProvider.tsx`, `src/lib/customer-auth.ts` |

### OFF 후보 경로

다음 두 범위에서 Anonymous, Magic URL, Phone **호출**을 찾지 못했다.

1. tracked 제품 소스: `src/`, `appwrite-functions/`, `public/`
2. 현재 `https://au.verygood-chocolate.com`에서 제공되는 공개 JavaScript 8개 asset

Appwrite Web SDK 번들 자체에는 모든 SDK method 정의가 들어 있으므로 method 문자열의 존재만 사용 증거로 취급하지 않았다. 실제 제품 호출부를 기준으로 판정했다. 현재 저장소 밖의 비공개·과거 클라이언트까지 부재를 증명할 telemetry는 없으므로 세 방식을 순차 변경하고 필드별 rollback을 유지한다.

비회원 주문은 Appwrite Anonymous session을 사용하지 않는다. guest cart/checkout과 예약번호·전화번호 조회는 자체 주문 API 계약을 사용한다. 따라서 Anonymous OFF가 비회원 기능을 끄는 변경은 아니다.

## 3. 인증 방식 OFF 실행 계약

승인 대상 manifest:

- [`security-hardening-phase-2-auth-methods-manifest.json`](./security-hardening-phase-2-auth-methods-manifest.json)
- SHA-256: `b4aeb0f19aad296457485b2ca007d2caa62905435baa30595b4354f9715f7eaf`
- 현재 `executionApproved=false`

### 적용 순서

1. 실행 직전 공식 Owner GET으로 새 `0600` 원본과 semantic baseline을 만든다.
2. 프로젝트 ID, Appwrite 버전, 7개 platform, 보호할 auth/session 필드가 manifest와 정확히 일치하는지 검사한다.
3. Phone만 `status=false`로 변경하고 Owner GET으로 Phone 외 semantic diff가 0인지 확인한다.
4. Magic URL만 `status=false`로 변경하고 같은 검사를 수행한다.
5. Anonymous만 `status=false`로 변경하고 같은 검사를 수행한다.
6. 기존 고객 session의 `Account.get`·MY ORDERS 읽기, 기존 관리자 session과 allowlist, Google/OTP/password/JWT 설정, guest catalogue/cart/checkout/lookup UI를 확인한다. 주문·메일·사용자·세션을 새로 만들지 않는다.

예산은 적용 write 최대 3회, rollback write 최대 3회다. 컨테이너 재시작, Function/Pages 배포, 세션 변경, platform 변경은 0회다.

직접 Anonymous session 생성이나 Magic URL/Phone token 요청을 production 부정 시험으로 사용하지 않는다. 예상과 달리 설정이 적용되지 않으면 사용자 또는 메일/SMS가 생성될 수 있기 때문이다. Owner GET의 authoritative flag와 기존 기능 smoke를 사용하고, 직접 disabled-method 부정 시험은 격리 프로젝트에서만 수행한다.

### 즉시 rollback

한 단계라도 예상 밖 semantic diff나 고객·관리자·guest 회귀가 생기면 적용된 항목만 역순으로 ON 한다.

1. Anonymous `status=true`
2. Magic URL `status=true`
3. Phone `status=true`

rollback 후 Account, Google, Email OTP, Email/password, JWT, Invites, duration, sessions limit, user limit, 7개 platform이 기준선과 같은지 확인한다. 이 변경은 기존 session 문서를 삭제하거나 수정하지 않는다.

## 4. 세션 1년 → 30일 검토

별도 manifest:

- [`security-hardening-phase-2-session-duration-manifest.json`](./security-hardening-phase-2-session-duration-manifest.json)
- SHA-256: `38a04a137937c012dc0207feb9c0721227c4c6c02c9bf16e1d06f736afc60590`
- `executionApproved=false`, `requiresSeparateApproval=true`

변경 후보는 `PATCH /v1/projects/verygood-au/auth/duration`의 `31536000` → `2592000` 한 건이다. `authSessionsLimit=10`과 `authLimit=0`에는 write하지 않는다.

실제 Appwrite 1.8.1 소스 확인 결과:

- duration endpoint는 프로젝트 `auths.duration`만 갱신한다.
- 새 email/password, OTP, OAuth session 생성은 당시 프로젝트 duration으로 `expire`를 기록한다.
- 명시적 session 연장은 당시 프로젝트 duration으로 expiry를 다시 계산한다.
- 기존 session 문서를 일괄 갱신하는 코드는 이 endpoint에 없다. 기존 session은 저장된 expiry를 유지한다.
- 새 session으로 사용자 session 수가 10을 넘으면 shutdown handler가 오래된 session부터 삭제한다. limit 10은 유지한다. 일반 원칙은 [Appwrite authentication security](https://appwrite.io/docs/advanced/security/authentication)와 일치한다.

따라서 30일 변경은 기존 로그인 사용자를 즉시 로그아웃시키지 않을 것으로 판단한다. 다만 장기 세션은 자연 만료·연장·재로그인 때까지 남으므로 즉각적인 전 세션 단축 효과는 없다. 강제 logout이나 기존 session 삭제는 이 계획에 포함하지 않는다.

별도 승인 시 신규 고객 1회와 관리자 1회의 session expiry를 직접 확인하고, 예상 밖 기존 session 무효화가 보이면 duration만 즉시 1년으로 복구한다. Google/OTP/password/JWT와 max sessions는 변경하지 않는다.

## 5. Web platform 7개

| Host / ID | 2026-10-21 공개 관측 | 판정 |
|---|---|---|
| `au.verygood-chocolate.com` / `6a509b9573719d8c644e` | HTTP 200, 현재 AU body SHA `b723…85b5` | 유지 |
| `au-stage.verygood-chocolate.com` / `6acc5d01b7c2a7efaa18` | HTTP 200, AU와 동일 body | 유지 |
| `au-cake-next.pages.dev` / `6acc5d0d4419ab90688a` | HTTP 200, AU와 동일 body | 유지 |
| `au-cake.pages.dev` / `6a379d9e2b1abbef7a65` | HTTP 200, 다른 legacy body SHA `c38b…5129` | 불확실, 유지 |
| `localhost` / `6a379d093fd266cfdb5f` | 로컬 개발·테스트 코드 사용 확인 | 불확실, 유지 |
| `jeniselect.com` / `6a479e3b3c9a16eed157` | HTTP 200, Coming Soon 정적 페이지 | 불확실, 유지 |
| `www.jeniselect.com` / `6a479e5235ae19551e5e` | HTTP 200, 같은 Coming Soon 페이지 | 불확실, 유지 |

현재 Jeniselect HTML에는 Appwrite client가 없지만 향후/별도 클라이언트나 OAuth return origin 사용을 배제할 운영 로그가 없다. legacy Pages도 현재 응답 중이다. `localhost`는 실제 개발 코드가 사용한다. 따라서 이번에는 삭제 0건이다.

Appwrite OAuth callback은 Appwrite API의 provider callback을 거치고 success/failure origin으로 복귀한다. 등록 platform을 지우면 해당 hostname에서 인증이 거부될 수 있다. OAuth 흐름은 [Appwrite OAuth2 문서](https://appwrite.io/docs/products/auth/oauth2)를 따른다.

삭제를 다시 검토하려면 최소 30일 Cloudflare traffic, Appwrite auth/OAuth log, Google OAuth redirect 설정, 개발·운영자 inventory를 함께 확보해야 한다. 그 전에는 후보를 삭제하지 않는다.

## 6. 현재 미실행·보호 상태

- 운영 Auth setting 변경: 0
- Web platform 변경: 0
- API Key 변경: 0
- Function/Pages/SMTP/Appwrite 본체 변경: 0
- DB·고객·주문·session document 접근 또는 변경: 0
- `main` 병합: 0
- 디자인 Worktree 변경: 0

## 7. 요청할 최소 운영 승인

한 번의 승인 범위는 아래로 제한한다.

- manifest SHA `b4aeb0f19aad296457485b2ca007d2caa62905435baa30595b4354f9715f7eaf`
- project `verygood-au`만
- Phone, Magic URL, Anonymous를 순차 OFF: 최대 3 writes
- 실패 시 적용된 세 항목만 ON 복구: 최대 3 writes
- 보호 필드와 7개 platform read-only 검증
- 세션 duration, sessions limit, Web platform, Invites, API Key, Function, SMTP, Pages, DB 변경 제외

30일 session duration은 SHA `38a04a137937c012dc0207feb9c0721227c4c6c02c9bf16e1d06f736afc60590`의 별도 단계로 남긴다.
