# VERYGOOD AU Customer Account — 로컬 구현 인수 기록

2026-10-17. 승인된 `feat/customer-account` worktree에서 Mac Codex 단독으로 Task 1–10을 수행했다. 기준은 `45971f4b53224a199513448128cf3d26543219f2`다. 이 기록은 로컬 구현의 증거이며 운영 활성화 준비 완료 판정이 아니다. 격리 공급자·실기기·실제 ACL gate는 미완료다. [배포/rollback](customer-account-rollout.md), [개인정보 절차](customer-account-privacy.md)를 함께 검토한다.

## 구현 결과와 변경 경계

- 선택형 Google OAuth2 / 6자리 Email OTP 통합 로그인, session 복원·명시적 logout, 오류/만료/중복 요청/재전송 처리, EN/KO UI를 구현했다. 비밀번호 회원가입·Magic Link·Apple·Passkey는 없다.
- Account Preferences namespace로 이름·주문 연락 이메일·AU 전화번호·언어를 저장한다. 로그인 이메일은 읽기 전용이며 주문 연락 이메일과 구분한다. 타 namespace와 과거 주문 snapshot을 보존한다.
- 실제 `AuRenewalShop.Bag` 및 기존 `ReservePage`에 빈 미편집 연락처만 자동입력한다. OAuth 전후 cart/form/date/options/coupon/consent/requestId를 보존한다. 다른 탭이 cart를 바꾸면 현재 cart를 유지하고 명시적인 재검토 전 제출을 차단한다. ambiguous 주문 실패 후 인증이 자동 주문 재시도를 일으키지 않는다.
- 기존 `reservation-api`만 확장했다. 신규 일반 케이크·초콜릿 주문의 owner는 서버 JWT 검증 ID로 원자적으로 저장하며, client owner/email로 결정하지 않는다. guest replay는 guest로 남는다. 다른 회원의 requestId/coupon/claim 재생은 거부한다.
- `/account`의 profile 편집, Upcoming/Past Orders, cursor pagination, 저장된 가격·옵션·연락처 상세, logout을 구현했다. 본인 주문 조회만 허용하며 주문 수정·취소·자동탈퇴 API는 없다.
- 관리자 권한 검사는 고객 세션을 삭제하지 않는다. 기존 관리자 Google/비밀번호 로그인 및 서버 allowlist를 유지하고, 계정 전환은 명시적 logout을 요구한다.
- frontend/server flag는 기본 OFF다. OFF 및 인증 장애에서 guest 경로를 유지한다. 새 customer table/Function은 없고, owner schema는 cake reservations 한 곳의 optional attribute/index뿐이다. migration은 additive-only 및 기본 GET-only dry-run이다.
- Custom Cake/Kids Class의 회원 owner·목록·schema·OAuth 폼 연동은 구현하지 않았다. 실제 Renewal 주문은 cake reservations의 `orderLinesJson.version=2`이며 private Custom Cake `cake-order.v2`와 구분했다. frozen private storage/reader, 기존 가격·판매·쿠폰·결제·알림 정책을 변경하지 않았다.

## 단계별 커밋과 검증

각 단계의 신규 실패(RED)를 확인한 뒤 구현·GREEN·기존 전체 회귀·커밋 순서를 지켰다. 단계 중 발견된 경계/경합 실패는 같은 단계에서 수정했다. 전체 테스트 수는 기존 npm script들의 Node runner 요약을 합산한 실행 건수이며 고유 테스트 ID 수를 뜻하지 않는다.

| Task | 커밋 | 주요 결과 | 단계 전체 pass / fail / skip |
| --- | --- | --- | --- |
| 1 | `67e149c` | 기본 OFF 계약·테스트 runner | 1776 / 0 / 1 |
| 2 | `dddcf1b` | 실제 admin IDs/ACL gate·additive migration | 1781 / 0 / 1 |
| 3 | `3e399a6` | 서버 ID 검증·신규 owner·멱등성 | 1791 / 0 / 1 |
| 4 | `956d0a8` | private 본인 목록·상세·엄격한 DTO | 1798 / 0 / 1 |
| 5 | `446229c` | 실제 SDK transport 계약·OTP/Google/profile adapter | 1807 / 0 / 1 |
| 6 | `6cac061` | provider·선택형 인증창·stale 응답 차단 | 1810 / 0 / 1 |
| 7 | `019d9ab` | 실제 Bag/기존 Checkout·OAuth 복원 | 1817 / 0 / 1 |
| 8 | `552b5be` | MY ACCOUNT·상세·static/private route | 1823 / 0 / 1 |
| 9 | `5ee29eb` | 관리자 검사 및 명시적 계정 전환 | 1827 / 0 / 1 |
| 10 | 최종 인수 커밋 참조 | 보안 보강·Chrome/WebKit·전체 검증·운영 문서 | **1831 / 0 / 1** |

Task 1의 합계에는 기존 customer-stories 2건이 신규 discovery runner에서도 중복 실행됐다. Task 2부터 신규 runner의 해당 중복을 제외했다. 마지막 단계의 추가 admin API 테스트 등 단계 전체 실행 이후 추가된 회귀는 해당 단계 dedicated 검증과 최종 전체 검증에서 다시 확인했다. 어떤 기존 business assertion도 삭제/완화하지 않았다. 기존 React hook harness에 useContext/useRef를 지원하고, 기존 private route inventory에 AccountPage만 추가했다.

## 최종 로컬 검증 명령

| 명령/범위 | 결과 |
| --- | --- |
| `npm test` | exit 0; **총 1832, pass 1831, fail 0, skipped 1, cancelled 0**. 기존 Custom/Class·admin·coupon/payment·notification·archive/reader 회귀 포함. |
| `npm run test:customer-account` | 57 pass, 0 fail, 0 skip. 실제 Web SDK의 local HTTP 계약 포함. |
| `npm run lint` | exit 0 |
| `npx tsc -b --pretty false` | exit 0 |
| `VITE_MARKET=KR VITE_CUSTOMER_ACCOUNT_ENABLED=false npm run build` | exit 0; 고객 account/callback 미생성 검증 포함 |
| `VITE_MARKET=AU VITE_CUSTOMER_ACCOUNT_ENABLED=false npm run build` | exit 0; account/callback directory 및 extensionless entry·noindex·sitemap 제외·hard 404 보존 |
| market별 `node --test tests/customer-account-static.test.mjs tests/chocolate-static-direct-access.test.mjs` | KR: 3 pass / 0 fail / 2 skip. AU: 4 pass / 0 fail / 1 skip. 각 시장 전용 반대 시장 assertion은 의도된 skip. |
| `git diff --check` | exit 0 |
| migration/readiness/orders security RED→GREEN | 15 pass / 0 fail. dry-run/apply는 synthetic metadata/HTTP Mock만 사용. 실제 서버 dry-run 미실행. |

전체의 skip 1건은 AU dist에서 KR 전용 static 부재 assertion을 실행하지 않는 기존 조건이다. 별도 KR build 후 해당 assertion을 실제 실행했다. npm script는 pretest를 포함하며, 최종 결과 집계는 모든 `ℹ pass/fail/skipped/cancelled` 요약을 합산했다. build는 기존 큰 chunk 경고를 출력하지만 성공했다. SEO generator는 `public/llms.txt`, `public/sitemap.xml`을 시장별로 갱신하므로 KR 검증 후 AU를 마지막으로 생성했으며 해당 파일의 tracked diff는 없다.

## 실제 브라우저 엔진 + local transport Mock

Playwright CLI를 사용했다. 모든 Appwrite/주문 응답은 localhost 또는 test fixture이며 외부 서비스 요청은 route intercept/deny했다. 실제 Google/SMTP·Appwrite 서비스는 호출하지 않았다. 의도된 401/429/404 Mock 응답은 console network 오류로 나타날 수 있으나 마지막 성공 시나리오의 JavaScript `pageerror`는 모두 0이다.

| 검증 script | Chrome 155.0.8059.80 | Playwright WebKit 26.6 |
| --- | --- | --- |
| `customer-account-state.browser.mjs` | pass | pass |
| `customer-checkout.browser.mjs` | pass, 390px, synthetic 제출 6회 | pass, 390px, synthetic 제출 6회 |
| `customer-account.browser.mjs` | pass | pass |
| `customer-admin.browser.mjs` | pass | pass |
| `customer-account-disabled.browser.mjs` | pass, flag OFF built preview | pass, flag OFF built preview |

account 화면은 360/390/768/1440px × EN/KO, header overflow·메뉴·Escape·focus·상세·profile·pagination·A/B 늦은 응답·401 메모리 제거·언어 우선순위를 검사했다. OTP 오류→guest, Google 성공/취소→폼/UUID 보존, valid cookie 복원 후 명시적 guest 선택, 다른 탭 cart 보호·검토 시 UUID 교체, ambiguous 결과의 명시적 재시도, 저장 공간 오류 시 OAuth 출발 차단을 확인했다. OFF built callback→form/cart/coupon/UUID→guest 제출은 Account 호출 0회다. local mock 제출은 실제 주문 생성이 아니다.

추가 발견/수정:

- 360px header 넘침을 재현한 뒤 모바일은 기존 메뉴의 account 항목을 사용하도록 account 전용 CSS만 조정했다.
- WebKit의 마우스 클릭이 button을 focus하지 않아 인증창 닫기 후 focus를 잃는 현상을 재현했다. provider가 실제 invoker에 focus한 뒤 dialog를 열도록 수정했다.
- account에 기존 AU shell class가 빠져 footer 스타일이 적용되지 않는 실패를 재현해 기존 shell을 재사용하도록 수정했다. 신규 UI 리디자인은 하지 않았다.
- WebKit에서 테스트가 React 첫 mount/lazy import 완료 전에 storage를 바꾸고 reload하여 cart persistence 경합과 취소된 module import 오류를 만들었다. 불완전한 테스트 진입을 같은 origin의 inert robots 문서에서 seed한 후 진입하도록 바꿨다. 제품 business assertion은 유지했고 마지막 실행은 양 엔진에서 통과했다.

대표 360px KO/1440px EN screenshot을 시각 확인했다. 로컬 증거 위치는 ignored `output/playwright/customer-account/`와 `.superpowers/sdd/2026-10-17-customer-account/`다. 이 디렉터리에는 합성 테스트 데이터·로그만 보관하고 production 자격증명/고객정보는 넣지 않았다. WebKit은 실제 iPhone Safari 검증이 아니며 실제 모바일 Safari/Android Chrome은 미실행이다.

## 보안 검증과 남은 gate

| 위험 | 로컬 증거/대응 | 남은 검증 |
| --- | --- | --- |
| 공개 ACL에서 일반 세션이 개인정보를 읽음 | `APPWRITE_ADMIN_USER_IDS` exact allowlist, private documentSecurity false, DB/collection inventory fail closed; 공개 settings/calendar도 write 차단 확인 | 실제 metadata·직접 DB 거부 확인. 불일치 시 OFF 유지·보고, 자동 ACL 변경 없음 |
| client owner/타인 주문 | JWT-only Account.get과 platform UID 일치·status true; owner equality 강제, foreign/guest/missing detail/cursor 동일 404; 임의 query/collection/body user 거부 | 실제 Functions injected header/JWT·expired/deleted account |
| requestId/쿠폰 경합 | 새 row/transaction에만 owner, canonical fingerprint 밖의 transport intent; conflict/shared claim/ambiguous coupon reconciliation에 재검증 | 격리 Appwrite transaction과 부하/동시 세션 |
| profile/계정 전환으로 정보 혼합 | 로그인·연락 이메일 분리, prefs namespace merge, 늦은 A→B 응답 차단, read401 시 개인 상태 제거, 관리자 검사는 세션 비삭제 | 실제 다중 탭 cookie/provider session 정책 |
| OAuth 상태 손실 | 30분 bounded session draft, 안전한 return path·UUID/schema·StrictMode 확인 후 acknowledge, 다른 탭 current cart 유지, OFF callback 복원 | 실제 Google 왕복·cookie restrictions·실기기 |
| 계정 삭제/동일 UID 재사용 | manual block/revoke→quiescence→owner unlink→hard delete 절차; null owner retained records가 재생성 fixture에서 제외됨 | 운영 담당자·본인 확인 채널·보존 정책 확정, 격리 end-to-end 삭제 검증 |

Google와 OTP의 같은 이메일 계정 재사용은 Appwrite 1.8.1 pinned source 및 현재 Web SDK 23.0.0/server SDK 22.1.3 계약을 검토했고 로컬 Mock/SDK transport 테스트를 했다. **실제 Google→OTP/OTP→Google 동일 `$id`와 주문 공유는 아직 확인하지 못했다.** 신규/기존 OTP 발송·실제 세션·SMTP·Google callback/cookie·실제 ACL/Function runtime을 확인할 격리 프로젝트가 제공되지 않았다. 운영 DB/스키마·권한·고객 데이터에 접근하거나 변경하지 않았다. 이 gate 전에는 feature flag를 켜지 않는다.

Node v24.12.0 / npm 11.6.2에서 locked `npm ci`를 사용했다. root package-lock과 dependency versions는 바꾸지 않았다. 기존 review-api의 libheif-js 미설치로 초기 전체 실행이 실패해 해당 Function의 locked 의존성을 설치한 후 통과했다. review-api는 Node 22를 선언하므로 Node 24 engine warning과 실제 runtime 차이는 격리 검증 대상이다. `npm audit --json`은 기존 dependency 5건(1 moderate, 4 high: baseline-browser-mapping, brace-expansion, browserslist, sharp, source-map-js)을 보고한다. 자동 업그레이드하지 않았으며 배포 전 별도 dependency 위험 검토가 필요하다.

## 자체 리뷰와 Git 인수

사용자가 Mac Codex 단독을 지정했으므로 독립 subagent 리뷰를 수행하지 않았다. 승인 설계/Review Focus에 따라 저자 자체 리뷰를 별도 수행하며, 이것은 독립적인 제3자 보안 검토를 대체하지 않는다. reviewer 검토 범위는 JWT 신뢰 경계, 모든 idempotency 분기, no-backfill, stale auth/profile/order 응답, OAuth callback 및 flag OFF, ACL/migration 비파괴성, 기존 관리자/guest 경로다.

실행 중 다른 작업에서 `main`과 `origin/main`이 `34ba107`(주말 픽업 종료 13:00)로 이동한 것을 read-only ref/reflog 검사에서 확인했다. 이 feature branch의 merge-base는 승인된 `45971f4` 그대로다. main/다른 worktree를 수정하거나 새 main을 이 브랜치에 통합하지 않았다. 향후 merge 승인 전에 이 변경과 픽업시간 계약을 별도 통합·회귀 검증해야 한다. 두 기존 production 복구 태그와 두 worktree를 유지한다. push·merge·deploy·실제 migration은 실행하지 않았다.

추가 사용성 제한: `/account`에서 창 focus로 인증을 재검사할 때 개인 패널을 비우므로 저장 전 profile 편집값과 열린 상세 화면은 초기화될 수 있다. Checkout 초안은 별도 보존하며 해당 경로는 회귀 검증했다.

최종 Task 10 및 인수 기록 SHA, 최종 Git 상태와 최종 artifact 수치는 아래 최종 증거 절에 기록한다. 최종 보고 뒤 로컬 구현을 멈추며 production 적용은 별도 승인을 기다린다.

## 변경 파일 목록

승인 기준 `45971f4` 대비 구현·테스트·문서 파일이다.

```text
.env.example
appwrite-functions/reservation-api/src/customer-account-readiness.js
appwrite-functions/reservation-api/src/customer-identity.js
appwrite-functions/reservation-api/src/customer-orders.js
appwrite-functions/reservation-api/src/main.js
docs/customer-account-privacy.md
docs/customer-account-rollout.md
docs/customer-account-validation.md
docs/superpowers/plans/2026-10-17-customer-account.md
docs/superpowers/specs/2026-10-17-customer-account-design.md
package.json
scripts/customer-account-schema.mjs
scripts/generate-seo-pages.mjs
scripts/migrate-customer-account-schema.mjs
scripts/reservation-api-deploy-config.mjs
scripts/setup-appwrite.mjs
src/AdminLoginPage.tsx
src/App.tsx
src/CustomerAccountProvider.tsx
src/components/AuNavigation.tsx
src/components/CheckoutAccountPrompt.tsx
src/components/CustomerAuthCallback.tsx
src/components/CustomerOrderDetail.tsx
src/components/CustomerSignInDialog.tsx
src/index.css
src/lib/app-routes.ts
src/lib/appwrite.ts
src/lib/customer-account-config.ts
src/lib/customer-account-context.ts
src/lib/customer-account-copy.ts
src/lib/customer-account-types.ts
src/lib/customer-auth.ts
src/lib/customer-checkout-draft.ts
src/lib/customer-orders.ts
src/lib/customer-profile.ts
src/lib/renewal-client.ts
src/lib/repository.ts
src/lib/seo.ts
src/main.tsx
src/pages/AccountPage.tsx
src/pages/AuRenewalShop.tsx
src/pages/ReservePage.tsx
src/styles/customer-account.css
tests/app-private-lazy-routes-contract.test.mjs
tests/app-routes.test.ts
tests/chocolate-commerce-ui.test.ts
tests/customer-account-contract.test.ts
tests/customer-account-disabled.browser.mjs
tests/customer-account-migration.test.mjs
tests/customer-account-page.test.tsx
tests/customer-account-readiness.test.mjs
tests/customer-account-state.browser.mjs
tests/customer-account-static.test.mjs
tests/customer-account-ui.test.tsx
tests/customer-account.browser.mjs
tests/customer-admin-session.test.ts
tests/customer-admin.browser.mjs
tests/customer-auth-sdk.test.mjs
tests/customer-auth.test.ts
tests/customer-checkout-draft.test.ts
tests/customer-checkout-ui.test.tsx
tests/customer-checkout.browser.mjs
tests/customer-order-ownership.test.mjs
tests/customer-orders-api.test.mjs
tests/customer-orders-client.test.ts
tests/customer-profile.test.ts
tests/fixtures/customer-account/browser-orders.json
tests/fixtures/customer-account/metadata.mjs
tests/fixtures/customer-account/orders.json
tests/fixtures/customer-account/renewal-browser-projections.json
tests/fixtures/customer-account/ui-entry.tsx
tests/fixtures/customer-account/ui.html
tests/reservation-api-deploy.test.mjs
tests/robots-policy.test.mjs
tests/run-customer-account-tests.mjs
```
