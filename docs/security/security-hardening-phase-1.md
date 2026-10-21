# VERYGOOD AU 보안 강화 Phase 1

- 작성일: 2026-10-21
- 전용 브랜치: `fix/security-review-api`
- 시작 기준: `bd362dccaf2efd9efd817af7867be39f6cce37ca`
- 조사 대상 운영 프로젝트: `verygood-au`
- 범위: 로컬 코드 패치와 운영 설정 읽기 전용 조사
- 운영 변경: 없음

## 결론

review-api의 `sharp`는 0.35.5로 패치했고, 실제 Appwrite Node 22 Alpine 런타임과 Debian Linux x86_64에서 clean install 및 이미지 회귀를 통과했다. 이 패치는 별도 승인 후 review-api deployment만 교체할 수 있다.

운영 API Key 3개는 모두 만료일이 없고 범위가 넓다. 최근 사용된 `au-cake-function-deploy`는 즉시 삭제하면 안 되며, `functions.read`·`functions.write` 전용 단기 Key로 교체하는 것이 우선이다. 나머지 setup Key 2개는 오래된 마지막 접근 기록만으로 미사용이라고 단정할 수 없으므로 사용처 확인 후 폐기해야 한다.

운영 Auth에서 Google, Email OTP, email/password, JWT는 실제 기능에 필요하다. Anonymous, Magic URL, Phone은 저장소 사용 흔적이 없어 OFF 후보지만, 직접 API 부정 시험과 복구 준비 후 별도 변경해야 한다. 세션은 현재 1년/10개이며, 신규·연장 세션부터 30일을 적용하고 10개 제한은 우선 유지하는 안을 권장한다.

Cloudflare는 현재 `nosniff`, `DENY`, `strict-origin-when-cross-origin`만 반환한다. CSP는 바로 차단하지 않고 au-stage Report-Only부터 적용해야 한다. Appwrite 1.8.1 업그레이드는 OAuth legacy secret 문제의 수정 PR이 2026-10-21 현재 미병합이라 운영에서 진행하면 안 된다.

## 1. 증거와 한계

2026-10-21 공식 Appwrite Console Owner GET으로 프로젝트 정책, 플랫폼, API Key metadata, review-api Function metadata를 읽었다. Secret 원문, 실제 고객·주문 데이터는 조회하지 않았다. 운영 설정을 수정하지 않았다.

API Key의 `accessedAt`는 최근 접근의 보조 증거다. Appwrite가 매 요청마다 즉시 갱신한다고 가정하지 않았고, 정적 저장소 검색으로 Secret과 실제 사용 프로세스를 연결할 수 없으므로 오래된 값만으로 폐기하지 않는다.

AU와 au-stage의 실제 HTTPS 응답을 읽었다. 둘 다 HTTP 200이고 다음 헤더가 일치했다.

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Access-Control-Allow-Origin: *`
- CSP, CSP Report-Only, HSTS, Permissions-Policy는 없음

## 2. review-api sharp 패치

상세한 실행·rollback 계약은 [review-api sharp 0.35.5 배포 문서](./review-api-sharp-0355-rollout.md)에 기록했다.

[공식 sharp 권고 GHSA-wq5f-xc86-pv6w](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)는 0.35.5 미만을 영향 버전으로, 0.35.5 이상을 수정 버전으로 분류한다. 현재 패치는 `sharp@0.35.5`와 이에 딸린 libvips 1.3.4 optional artifacts만 갱신한다.

운영 review-api의 읽기 전용 기준선:

| 항목 | 값 |
|---|---|
| Function / active deployment | `review-api` / `6a90036a14939fa970f1` |
| Runtime | `node-22` |
| Timeout / specification | 30초 / `s-8vcpu-8gb` |
| Execute | `any` |
| Schedule / events | 없음 / 없음 |
| Scopes | databases read/write, documents read/write, files read/write |
| Entrypoint / command | `src/main.js` / `npm ci --omit=dev` |
| Variables | 19개, 기존 secret metadata 포함 |
| 상태 | enabled, logging, active deployment ready |

패치는 Function 설정, 변수, scope, 공개 실행 계약을 바꾸지 않는다.

## 3. 운영 API Key 3개

### 3.1 관측값

모두 프로젝트 `verygood-au` 소속이며 `expire`가 비어 있어 무기한이다. Appwrite 1.8.1의 공식 프로젝트 API 구현은 Key 생성·수정 시 ISO 8601 `expire`를 허용하고 null/빈 값은 무기한으로 취급한다. Console UI가 이를 모두 노출하지 않더라도 API 계약은 지원한다. 근거: [Appwrite 1.8.x projects controller](https://github.com/appwrite/appwrite/blob/1.8.x/app/controllers/api/projects.php).

| 이름 / ID | 생성 / 마지막 접근 | Scope | 판정 |
|---|---|---|---|
| `au-cake-setup` / `6a378527b75a105721ed` | 2026-06-21 / 2026-06-21 | attributes, buckets, collections, columns, databases, documents, functions, indexes, rows, tables read/write (20) | 폐기 후보 · 추가 조사 필요 |
| `verygood-kids-setup` / `6a478680e2c1245423e5` | 2026-07-03 / 2026-07-04 | attributes, collections, columns, databases, documents, indexes, rows, tables read/write (16) | 폐기 후보 · 추가 조사 필요 |
| `au-cake-function-deploy` / `6a48ed6824fe0c915917` | 2026-07-04 / 2026-10-21 | buckets, collections, databases, documents, files, functions, rows, tables read/write (16) | 축소·교체 |

세 Key 이름/ID는 tracked source와 배포 문서에 직접 참조되지 않는다. 저장소의 배포 스크립트는 일반 `APPWRITE_API_KEY`를 받는다. 따라서 어떤 보호 환경이나 자동화가 어떤 Key를 쓰는지는 Secret 저장소·실행 호스트의 비밀값 없이 확정할 수 없다.

### 3.2 실제 코드가 요구하는 최소 범위

- review-api, reservation-api, notification, reminder 배포 스크립트: 기본적으로 `functions.read`, `functions.write`.
- schema setup/migration: 실행 대상에 따라 databases/collections/attributes/indexes/documents 또는 tables/columns/rows scope가 필요하다.
- review-api runtime 자체는 동적 Function Key를 사용하며 operator `APPWRITE_API_KEY`를 runtime에 전달하지 않는다.
- Storage·DB 조작과 Function 배포를 하나의 무기한 Key에 합칠 이유는 없다.

### 3.3 단계적 교체안

1. Appwrite audit/access 기록과 Mac·서버·CI의 Secret 이름을 조회해 각 Key 사용처를 확인한다. Secret 원문은 비교·출력하지 않는다.
2. `au-cake-function-deploy` 대체 Key를 `functions.read`, `functions.write`로만 만들고 24시간 이내 만료를 지정한다.
3. 보호 저장소의 배포 자격증명만 새 Key로 전환한다.
4. read-only Function GET과 승인된 dry-run으로 소속·scope·만료를 검증한다.
5. 기존 배포 Key의 접근이 더 이상 발생하지 않는 확인 기간 후 폐기한다.
6. setup Key는 상시 보관하지 않는다. 승인된 migration 때만 필요한 resource family별 단기 Key를 생성해 사용 후 폐기한다.
7. `au-cake-setup`, `verygood-kids-setup`의 호출 주체를 찾지 못하면 먼저 비활성 운영 작업 여부를 확인한 후 폐기한다. 현재 증거만으로는 즉시 삭제하지 않는다.

교체 실패 시 기존 Key를 폐기하지 않고 새 Key 사용처만 되돌린다. 한 번에 세 Key를 회전하지 않는다.

## 4. 인증 방식과 세션

### 4.1 실제 운영 정책

| 정책 | 현재 | 사용 근거 | 권장 |
|---|---:|---|---|
| Account service | ON | 고객·관리자 로그인 | 유지 |
| Google OAuth | ON | 고객·관리자 경로 | 유지 |
| Email OTP | ON | 고객 로그인 | 유지 |
| Email/password | ON | 관리자 로그인 | 유지 |
| JWT | ON | MY ORDERS, 관리자 review photo preview | 유지 |
| Anonymous | ON | tracked source 사용 없음 | 단계적 OFF 후보 |
| Magic URL | ON | tracked source 사용 없음 | 단계적 OFF 후보 |
| Phone | ON | tracked source 사용 없음 | 단계적 OFF 후보 |
| Invites | ON | 고객 로그인과 별개; Console/team 사용 가능 | 추가 조사 |
| Session duration | 31,536,000초 | 운영 설정 | 1차 2,592,000초(30일) |
| Session limit | 10 | 운영 설정 | 당분간 10 유지 |
| Session alerts | OFF | 운영 설정 | SMTP 관측 안정화 후 별도 검토 |

코드 확인 결과:

- 고객: `createEmailToken` + `createSession`, Google OAuth, session restore, prefs, logout.
- 관리자: email/password와 Google OAuth.
- 서버 위임: `createJWT`.
- Anonymous, Magic URL, Phone 생성 API 호출은 tracked source에서 찾지 못했다.

웹 UI 버튼 부재만으로 미사용이라고 판단하지 않았다. 변경 전에는 해당 운영 프로젝트를 대상으로 직접 REST endpoint의 사전/사후 결과를 비교하고, 다른 클라이언트·운영 스크립트·Console 흐름을 확인해야 한다.

### 4.2 세션 변경 영향

Appwrite 1.8.x 소스는 session duration을 세션 생성 및 명시적 연장 시점에 적용한다. 1년에서 30일로 낮춰도 이미 발급된 세션의 저장된 만료 시간을 일괄 다시 쓰지 않는다. 새 로그인과 연장 세션부터 짧아진다.

Appwrite 문서에 따르면 1.2 이상에서 session limit을 초과해 새 세션을 만들면 가장 오래된 세션을 삭제한다. 따라서 10→5를 즉시 적용하면 기존 세션을 즉시 일괄 삭제한다고 보기는 어렵지만, 다음 로그인에서 오래된 세션 제거가 빨라질 수 있다. 고객의 휴대전화·데스크톱과 관리자 세션을 고려해 Phase 1에서는 10을 유지한다. 근거: [Appwrite authentication security](https://appwrite.io/docs/advanced/security/authentication).

JWT는 사용자 세션을 전제로 하며 15분 또는 원 세션 삭제 시 만료한다. JWT는 계속 필요하다. 근거: [Appwrite JWT login](https://appwrite.io/docs/products/auth/jwt).

### 4.3 Auth 적용·검증·rollback

별도 승인 범위에서 한 프로젝트 `verygood-au`만 변경한다.

1. 현재 project/auth/provider/platform semantic JSON을 저장한다.
2. Anonymous OFF → 직접 anonymous API가 401/403인지 확인하고 Google/OTP/admin/guest checkout smoke를 수행한다.
3. Magic URL OFF → 직접 token 요청이 거부되는지 확인한다.
4. Phone OFF → 직접 phone token 요청이 거부되는지 확인한다.
5. Session duration만 30일로 변경하고 신규 합성 관리자/고객 세션의 expiry를 확인한다. 기존 세션의 즉시 종료가 없는지 확인한다.
6. 단계별 실패 시 해당 필드만 원래 값으로 되돌린다.
7. Email/password, Email OTP, Google, JWT, Account service는 건드리지 않는다.

### 4.4 Web platform

| Host | 현재 관측 | 권장 |
|---|---|---|
| `au.verygood-chocolate.com` | 운영 AU | 유지 |
| `au-stage.verygood-chocolate.com` | 운영 stage | 유지 |
| `au-cake-next.pages.dev` | 현재 AU Pages | 유지 |
| `au-cake.pages.dev` | 다른 AU body hash의 legacy Pages | traffic/callback 확인 후 판단 |
| `localhost` | 운영 등록 | 개발이 테스트 프로젝트를 쓰는지 확인 후 제거 후보 |
| `jeniselect.com`, `www.jeniselect.com` | 현재 Coming Soon, AU와 다른 사이트 | Appwrite 사용·OAuth callback 확인 후 제거 후보 |

플랫폼 삭제 전 Cloudflare traffic, Google redirect URI, Appwrite OAuth callback 로그를 확인한다. host가 응답한다는 사실만으로 사용 중/미사용을 단정하지 않는다.

## 5. Cloudflare 보안 헤더 제안

Cloudflare Pages는 정적 asset directory의 `_headers` 파일을 적용한다. 근거: [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).

### 5.1 현재 브라우저 의존성

- Appwrite: `https://api.verygood-chocolate.com`
- Google Analytics: `https://www.googletagmanager.com`, Google Analytics 수집 origin
- Chatwoot: `https://chat.verygood-chocolate.com`의 SDK, API/asset, WebSocket 가능성
- Google Maps iframe: `https://www.google.com`
- Fonts/CSS: `https://fonts.googleapis.com`, `https://fonts.gstatic.com`, `https://cdn.jsdelivr.net`
- inline script 2개와 inline style 1개가 `index.html`에 존재
- runtime JSON-LD script가 존재
- Resend는 Function 서버 요청뿐이며 브라우저 allowlist가 필요하지 않음
- 현재 저장소에서 PayPal 브라우저 SDK는 발견되지 않음. 향후 결제 SDK가 추가되면 CSP를 다시 검토해야 함.

### 5.2 Report-Only 초안

실제 `public/_headers`는 이 브랜치에서 바꾸지 않는다. 디자인 브랜치 통합 후 생성된 HTML의 inline hash와 네트워크를 다시 수집한다.

초기 stage 정책:

```text
/*
  Content-Security-Policy-Report-Only: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://chat.verygood-chocolate.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: blob: https://api.verygood-chocolate.com https://chat.verygood-chocolate.com https://www.google-analytics.com; connect-src 'self' https://api.verygood-chocolate.com https://www.google-analytics.com https://region1.google-analytics.com https://chat.verygood-chocolate.com wss://chat.verygood-chocolate.com; frame-src https://www.google.com https://chat.verygood-chocolate.com; manifest-src 'self'; worker-src 'self' blob:
  Strict-Transport-Security: max-age=86400
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
```

`unsafe-inline`은 첫 계측에서 현재 기능을 보존하기 위한 임시 값이다. 디자인 통합 후 static inline script/style hash 또는 외부 asset 이동을 검증해 제거한다. Report endpoint가 정해지기 전에는 `report-uri`/Reporting API를 허구로 넣지 않는다.

HSTS는 첫 단계에 1일만 적용하며 `includeSubDomains`와 `preload`를 넣지 않는다. 하위 도메인 전체가 HTTPS-only임을 별도로 확인한 뒤 기간을 늘린다. Permissions-Policy에서 payment를 막지 않는다. 현재 결제 동작을 계측한 후 결정한다.

### 5.3 적용 단계

1. 디자인 브랜치를 먼저 통합하고 최종 `index.html`과 asset host를 재수집한다.
2. au-stage에 CSP Report-Only, HSTS 1일, Permissions-Policy를 적용한다.
3. 사용자 브라우저와 Chromium/WebKit에서 OAuth callback, Appwrite, 관리자/리뷰, Chatwoot, 지도, fonts, GA, checkout을 확인한다.
4. 승인된 CSP report collector에서 최소 7일의 위반을 분류한다.
5. 필요한 origin만 수정하고 stage에서 enforced CSP로 전환한다.
6. production에는 먼저 Report-Only로 별도 배포한다.
7. production 관측 후 enforced CSP를 별도 승인한다.
8. 실패 시 이전 Pages deployment로 rollback한다.

프론트 UI 파일은 이 작업에서 수정하지 않았다.

## 6. Appwrite 1.8.1 업그레이드 계획

운영 업그레이드는 차단한다.

[공식 업데이트 문서](https://appwrite.io/docs/advanced/self-hosting/production/updates)는 1.8.x 이하에서 1.9.5로 올려 migration을 실행한 뒤 1.9.7로 진행해야 1.9 migration을 건너뛰지 않는다고 명시한다. 각 단계의 최신 patch/release note도 함께 확인해야 한다.

[공식 issue #12819](https://github.com/appwrite/appwrite/issues/12819)는 1.8 이하에 저장된 중첩 암호화 OAuth provider secret이 1.9.x callback에서 HTTP 500을 만들 수 있음을 기록한다. 수정 [PR #12857](https://github.com/appwrite/appwrite/pull/12857)은 2026-10-21 GitHub API 기준 open, merged=false이다. 따라서 Google OAuth를 쓰는 현재 운영은 exact target release에 수정이 포함되거나 격리 복제본에서 별도 검증되기 전까지 업그레이드하면 안 된다.

격리 검증 계획:

1. 운영 트래픽과 분리된 Linux host/Compose namespace를 준비한다.
2. DB dump, 모든 Appwrite storage/function/build/config volume, `.env`, compose/image digest를 백업한다.
3. 특히 `_APP_OPENSSL_KEY_V1` 원문을 보호 저장한다. 없으면 암호화 데이터 복구가 불가능하다. 근거: [Appwrite backups](https://appwrite.io/docs/advanced/self-hosting/production/backups).
4. 운영 4개 프로젝트의 설정·schema·user/order 수치만 익명화한 복제 검증 자료를 만든다. 고객 데이터를 개발 장비에 복사하지 않는다.
5. 1.8.1 기준 Google OAuth callback, Email OTP, email/password admin, session restore, JWT, Function runtime을 기록한다.
6. 1.9.5 설치 → migration → 검증, 이어 1.9.7 → 검증 순서를 따른다.
7. legacy Google secret 형식의 callback과 신규 저장 secret 형식을 모두 시험한다.
8. OTP UID, Google UID, session expiry/limit, JWT 15분, Console, 4개 프로젝트, DB ACL, Function build/execution을 검증한다.
9. 실패 rollback은 migration된 DB에 구버전을 덮는 방식이 아니라 격리 환경 폐기 또는 전체 pre-upgrade snapshot restore다.
10. PR #12857 병합 및 포함 release를 확인한 뒤 새 target manifest로 운영 승인받는다.

## 7. 승인 범위 분리

### 승인 1 — review-api sharp 단독 배포

- 새 review-api deployment 1개
- Function metadata·variables·scope·schedule·execute 변경 0
- ready 전 activation 금지
- read-only health/public review/admin preview smoke
- 실패 시 이전 deployment `6a90036a14939fa970f1` 재활성화 1회

### 승인 2 — API Key 교체 및 미사용 Auth 비활성화

- 먼저 Key 1개씩 최소 권한·짧은 만료로 교체
- 사용처 전환 확인 뒤 기존 Key 1개씩 폐기
- `verygood-au`의 Anonymous/Magic URL/Phone만 단계적으로 OFF
- Email/password, Email OTP, Google, JWT 유지
- session duration 30일은 독립 변경으로 실행
- platform 삭제는 traffic/callback 확인 후 별도 목록 승인

### 승인 3 — 프론트 보안 헤더

- 디자인 브랜치 통합 후 au-stage Report-Only 1회
- HSTS 1일, Permissions-Policy 보수적 적용
- 7일 관측 후 enforced stage와 production은 별도 승인
- 기존 헤더 보존, Pages rollback checkpoint 유지

### 승인 4 — Appwrite 업그레이드

- 별도 격리 환경 구축·복원 리허설만 먼저 승인
- 운영 업그레이드는 PR #12857 포함 버전과 1.9.5→1.9.7 migration 경로 검증 후 별도 유지보수 승인
