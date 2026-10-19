# Customer Account 통합 전 안정화 기록

2026-10-17. 승인 범위는 `feat/customer-account`의 로컬 안정화다. 작업 시작은 `dc8cba6`, 통합 대상은 로컬 및 GitHub main에서 확인한 `34ba1072f475ba8458b25a8ffd7a9e5467293dbe`다. main·다른 worktree·운영 Appwrite/사이트를 변경하지 않았다. 격리 Appwrite 프로젝트도 생성하지 않았다. [기존 인수 기록](customer-account-validation.md), [배포 절차](customer-account-rollout.md), [개인정보 절차](customer-account-privacy.md)를 보완한다.

## main 통합과 정책 보존

`9b3412924572d210c159ab09c520b44e5305a9eb`는 두 부모 `5aed85d`(feature)와 `34ba107`(main)를 가진 일반 merge다. 충돌 없이 main 변경 16개 파일만 통합했다. rebase/reset/history rewrite는 하지 않았다. 이후 main은 여전히 `34ba107`이며 feature를 main에 병합하지 않았다.

정책 변경은 main에서 승인된 토·일 09:00–13:00 연장이다. 수·금 09:00–16:00, 나머지 휴무, 15분 간격 및 기존 `au-renewal-pickup.2026-10-14.v2` 계약은 유지한다. 기존 main의 pickup/API/UI/content/SEO tests도 그대로 통합했다. 가격/catalog, 쿠폰, 판매 활성화, frozen 주문 reader·owner schema에는 별도 변경을 하지 않았다.

통합 전 전체 검증은 1831 pass / 0 fail / 1 skip, merge 후 전체 검증은 1833 pass / 0 fail / 1 skip이다. Renewal·신규 account suite도 통과한 뒤 merge commit을 만들었다. 브라우저 실제 Bag fixture는 주말인 `2099-11-01`의 **13:00**을 선택하고 Google 성공/취소·다른 탭 변경 후에도 날짜·시간·쿠폰·requestId와 guest/member 제출 intent가 유지되는지 추가 확인한다. 이는 localhost Mock 주문이며 실제 예약을 생성하지 않는다.

## 프로필·상세 화면 보존과 인증 경계

원인은 provider가 매 focus마다 identity가 없는 checking 상태로 바뀌면서 AccountPanel을 unmount하는 구조였다. 실제 mounted App에서 미저장 이름·주문 연락 이메일·전화번호·언어 및 열린 상세가 초기화되는 RED를 확인했다.

- checking의 `previousIdentity`는 AccountPage 패널 수명 유지에만 쓴다. 재검사 중 패널은 **hidden/inert**이며 인증된 상태로 취급하지 않는다. 기존 Checkout/API는 `status === 'authenticated'`에서만 회원 intent를 사용한다.
- 같은 UID가 다시 확인되면 같은 패널을 유지해 네 입력값, 열린 detail, 로드한 주문·cursor를 보존한다. 불필요한 list/detail 재요청도 하지 않는다. 새 브라우저 storage나 profile draft DB는 만들지 않았다.
- 다른 UID, 세션 만료/guest, 검증 오류/unavailable이면 이전 패널을 폐기한다. 명시적인 auth-change/storage nonce는 이전 세션의 종료 신호로 취급해 같은 UID라도 패널을 즉시 폐기한다. 일반 focus/pageshow 재검사만 이전 패널을 보존한다.
- profile 저장은 UI가 표시하던 `expectedUserId`로 시작하고 prefs 쓰기 전에 Account UID를 검증한다. 읽는 동안 계정이 바뀌어도 쓰기를 거부한다. provider는 UID·auth intent·refresh epoch가 모두 같을 때만 결과를 반영한다.
- 늦은 A 저장 응답이 pending B restore를 취소하고 A를 다시 표시하는 별도 RED도 재현했다. epoch 검증으로 차단했다. A의 list/detail/restore 응답이 B 화면에 도착하는 경합, 명시적 auth 알림 및 401에 대한 기존 방어도 유지한다.

기존 tests의 assertion을 삭제하거나 완화하지 않았다. auth adapter에 필수 UID 인자를 도입하면서 기존 unit/SDK fixture의 호출 인자만 보강했다. 개인정보·주문 소유권의 서버 검증과 관리자 allowlist/세션 삭제 정책은 변경하지 않았다.

## npm audit 5건의 영향 분류

locked dependencies를 기준으로 `npm audit --json`, `npm audit --omit=dev --json`, 각 Function의 별도 production audit 및 `npm ls ... --all`을 실행했다. npm audit fix/update/install로 package versions를 변경하지 않았다. npm audit의 severity를 아래 표에 그대로 기록하며, 실제 노출도는 source와 입력 경로를 별도로 분석했다.

| 패키지 / 설치 버전 | audit 등급·의존 경로 | 이 프로젝트에서의 영향 | 가능한 대응과 패치 위험 |
| --- | --- | --- | --- |
| baseline-browser-mapping 2.10.42 | moderate; react-hooks ESLint → Babel → Browserslist | lint/개발 도구의 잘못된 질의로 process 종료 가능. 정적 frontend/Function production graph에는 없음 | 신뢰한 설정·입력만 사용, 작업 프로세스 격리. 명시적 2.11.0 이상 패치 후보는 Babel target/호환성 출력 재검증. [프로젝트 변경](https://github.com/web-platform-dx/baseline-browser-mapping/pull/137), [릴리스](https://github.com/web-platform-dx/baseline-browser-mapping/releases/tag/v2.11.0) |
| brace-expansion 5.0.9 | high; ESLint → minimatch | 복잡한 glob에 재귀/CPU DoS. 사용자 Checkout 입력을 이 함수로 전달하는 경로는 발견하지 않음 | untrusted glob/PR 작업에 시간·메모리 제한, 최소 권한·격리. 개별 핀/override 5.0.12 이상 검토 시 lint 파일 포함/제외와 glob 의미 변화 확인. [재귀 advisory](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-qhr7-859c-m2p7), [추가 CPU advisory](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr) |
| browserslist 4.28.5 | high; react-hooks ESLint → Babel targets | query cache OOM 및 untrusted custom stats의 crash/prototype write. 현재 개발 graph이고 사이트/API에 query 입력 경로 없음 | 고정된 신뢰 설정, untrusted stats 차단·빌드 격리. 4.28.7 이상 개별 패치 시 target 결과·번들·AU/KR build 회귀. cache 비활성화만으로 custom stats 문제까지 해결되지는 않음. [cache advisory](https://github.com/browserslist/browserslist/security/advisories/GHSA-c83g-rgw3-j3cx), [stats advisory](https://github.com/browserslist/browserslist/security/advisories/GHSA-73wf-gq98-2v4g) |
| source-map-js 1.2.1 | high; Vite → PostCSS | 악성 indexed source map offset의 동기 DoS. 빌드/개발 graph이며 고객 source map을 처리하는 production 서비스 없음 | untrusted map/빌드 입력 격리·시간 제한. 명시적 1.2.2 이상 패치 시 CSS/source map/CSP·build 출력 회귀. [수정 릴리스](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2) |
| sharp 0.35.4 | high; root dev 직접 의존, **review-api/reservation-api production 직접 의존** | root 이미지 최적화 및 Function 이미지 처리. librsvg native 취약점으로 일부 Linux glibc/Node binary 조건에서 RCE 가능성이 있어 운영 배포 검토 우선순위가 높음 | 아래 서버 입력 경로·workaround·패치 gate 참조. [maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) |

정적 사이트 runtime에 이 다섯 패키지의 import는 없다. root production audit 0건만으로 서버 Function을 안전하다고 판정하면 안 된다. 패키지 수 5건은 advisory 수와 다르며 brace-expansion/Browserslist에는 여러 advisory가 연결된다. 위 runtime 도달성 분류는 이 저장소의 graph와 source에 대한 추론이며 실제 운영 image/설정 검사를 수행한 결과는 아니다.

| 별도 graph | production audit 결과 |
| --- | --- |
| root `--omit=dev` | 0 |
| review-api | high 1 (`sharp`) |
| reservation-api | high 1 (`sharp`) |
| booking-reminder | 0 |
| reservation-notification | 0 |

### sharp의 구체적인 입력 경로와 조치 후보

`review-api/src/photo.js`는 `sharp(input).metadata()` 이후 format을 검사하는 경로가 있다. MIME/base64/용량 검증 및 잘못된 format 최종 거부만으로 native SVG parser 진입을 배제할 수 없다. 유효한 invite를 가진 공격자 입력을 포함해 검토해야 한다. `reservation-api/src/custom-cake-photo-codec.js`는 sharp 호출 전 JPEG/PNG/WebP의 실제 container를 검사해 raw SVG를 거부한다. 이 차이는 위험 분류의 근거이며 라이브러리 취약점 자체를 제거하지는 않는다.

maintainer가 제시한 업데이트 없는 조치 후보는 Function worker에서 `sharp.block({ operation: ['VipsForeignLoadSvg'] })`로 SVG decoding을 차단하는 것이다. 이번 작업에서는 분석만 했고 적용하지 않았다. 적용 시 정상 WebP/JPEG/PNG/HEIC/AVIF·회전·투명도·과대 이미지·사진 저장/preview 및 archive import를 Node 22 Linux에서도 재검증해야 한다. root의 `optimize-au-detail-images.mjs`는 신뢰된 내부 SVG를 만들어 crop/회전에 사용하므로 root 전체에 같은 block을 적용하면 이미지 최적화를 깨뜨릴 수 있다.

별도 명시적 패치 후보는 root와 두 Function의 sharp 0.35.5 및 각각의 lockfile이다. native libvips/librsvg 변경은 출력 bytes·색/크기·EXIF·HEIF 및 container/arch 호환성에 영향을 줄 수 있다. 루트만 업데이트하면 Function pin 0.35.4는 남는다. 이번에는 자동/수동 버전 업데이트, 새 mitigation code, 기존 Function 변경을 하지 않았다. **운영 배포 전 sharp 대응과 Linux 검증에 대한 검토가 필요하다.** 고객 기능 OFF는 기존 review 이미지 처리의 취약점 대응을 대신하지 않는다.

## Node 22와 로컬 Node 24

- 기본 로컬 환경은 Node 24.12.0 / npm 11.6.2다. 별도 npx cache의 Node **22.23.3**을 PATH 앞에 두어 같은 locked 의존성으로 신규 suite와 전체 테스트를 별도로 실행한다. 저장소 dependency/lockfile·system Node를 변경하지 않는다.
- `review-api/package.json` engine은 `>=22 <23`, 배포 config는 `node-22`만 허용한다. `sharp@0.35.4`의 로컬 package engine은 `>=20.9.0`이다. Node 24 통과만으로 이 engine/runtime 계약을 검증했다고 할 수 없다. [sharp 설치 조건](https://sharp.pixelplumbing.com/install/)도 참고한다.
- reservation-api는 일괄 Node 22가 아니다. 기존 config에서 일반 배포 기본은 transaction 호환 `node-16.0`이고, `CUSTOM_CAKE_BACKEND_DEPLOY_ENABLED=true`인 기존 custom deployment gate에서만 명시적 `node-22`를 허용한다. 그 gate를 회원 기능 때문에 활성화하거나 runtime 설정을 바꾸지 않았다. 실제 운영 runtime은 조회하지 않았으므로 향후 승인된 배포 검토에서 확인해야 한다.
- Node 22 local native probe는 macOS arm64에서 sharp 0.35.4의 WebP encode/decode를 확인했다. 설치된 libvips는 8.18.6, librsvg는 2.62.91이다. Mac 테스트는 Appwrite Linux의 libc/아키텍처·PIE binary·native loader, network/transaction/cookie 동작 또는 librsvg 보안 패치를 증명하지 않는다.
- Node 22 전체 검증의 기존 codec/archive suites와 실제 Functions execution은 별개다. 실제 Appwrite 1.8.1 container에서 SDK/JWT 주입·Account.get·transaction·direct DB denial·실제 이미지 처리 확인은 여전히 외부 gate다. 런타임/리소스를 새로 만들거나 변경하지 않았다.

## 최종 검증 및 커밋

검증 코드 후보는 `ec22c3400ffb19ddb575a6a4a8208b8912456149`다. 이후 추가한 비회원 lookup browser 시나리오·인수 문서는 실행 코드를 변경하지 않는다. raw 로그/JSON은 ignored `.superpowers/sdd/2026-10-17-customer-account-stabilization/`, screenshots는 `output/playwright/customer-account/`에 둔다. 합성 데이터만 사용한다.

| 검증 | 결과 |
| --- | --- |
| Node 24.12.0 `npm test` | 총 1836 / **pass 1835 / fail 0 / skipped 1 / cancelled 0**, exit 0 |
| Node 22.23.3 PATH로 `npm test` | 총 1836 / **pass 1835 / fail 0 / skipped 1 / cancelled 0**, exit 0 |
| 양 Node의 `npm run test:customer-account` | 각각 **59 / 0 / 0**, exit 0 |
| 양 Node의 `npm run lint`, `npx tsc -b --pretty false` | exit 0 |
| `npm run test:renewal` | merge 후 전체 통과; 최종 양 Node 전체 실행에서도 pickup/API/UI 포함 |
| Node 22의 `VITE_MARKET=KR VITE_CUSTOMER_ACCOUNT_ENABLED=false npm run build` | exit 0 |
| Node 22의 `VITE_MARKET=AU VITE_CUSTOMER_ACCOUNT_ENABLED=false npm run build` | exit 0; 최종 AU 기본 OFF artifact 유지 |
| KR account/chocolate static | 3 pass / 0 fail / 2 시장 전용 skip |
| AU account/chocolate static | 4 pass / 0 fail / 1 시장 전용 skip |
| migration/readiness/owner/admin/guest/coupon/payment/notification/Custom/Class/archive 회귀 | 기존 전체 npm test에서 양 Node 통과; 실제 리소스 호출 없음 |
| diff·문서 상대 링크·범위 검사 | 통과; 가격/catalog/쿠폰·판매 정책과 모든 lockfile 불변 |

Node 22는 non-TTY TAP(`# pass`), Node 24는 spec(`ℹ pass`) 요약을 출력하므로 두 형식을 각각 집계했다. 이 수는 기존 script들의 실행 건수 합계이며 고유 test ID 수와 같다고 가정하지 않는다. 전체의 skip 1은 AU dist에서 KR 전용 chocolate static assertion을 생략하는 기존 조건이며, 별도 KR artifact 검사에서 실행했다. 최종 candidate의 기존 실패를 숨기거나 테스트를 삭제/완화하지 않았다. build는 기존 큰 chunk 경고와 함께 성공했다. KR 이후 AU를 마지막 생성해 public SEO 파일을 정상 복원했다.

Chrome **155.0.8059.80** 및 Playwright WebKit **26.6** 각각 아래 7개 script를 실행해 모두 통과했다. browser JavaScript pageErrors는 각 시나리오 **0**이며 운영 Appwrite/Resend 호출은 차단했다. 의도한 Mock 401/429/404는 console network error로 나타날 수 있다.

- `customer-account-refresh.browser.mjs`: 같은 UID 미저장 네 필드·상세·DOM/pagination 유지, hidden/inert, 중복 focus, 다른 UID·만료·검증 오류·명시적 인증 알림의 이전 정보 폐기, 늦은 저장/restore/detail 경합.
- `customer-account.browser.mjs`: profile/contact 이메일 분리·저장 가격·pagination·A/B·401·언어, 360/390/768/1440px × EN/KO와 header/menu/focus/overflow.
- `customer-account-state.browser.mjs`: OFF/readiness·OTP 오류·재전송·늦은 인증·logout/guest.
- `customer-checkout.browser.mjs`: 실제 Bag의 주말 **13:00** 및 OAuth 성공/취소·옵션·쿠폰·requestId, 다른 탭의 최신 cart 보호, OTP 실패→guest, ambiguous 명시적 재시도, storage 오류. 각 엔진 합성 제출 6회, productionRequests 0.
- `customer-admin.browser.mjs`: 관리자 권한 검사·기존 Google callback·명시적 전환/비밀번호·고객 session 및 cart/draft 보존.
- `customer-lookup.browser.mjs`: customer readiness가 unavailable인 상태에서 비회원 예약번호+전체 전화번호 조회, 오류 응답 시 이전 결과 제거. 각 엔진 lookup 2회, Account 호출 0. 실제 서버 전화번호 검증은 기존 API tests로 별도 확인한다.
- `customer-account-disabled.browser.mjs`: 최신 candidate를 test-only localhost 매핑과 flag OFF로 build한 preview에서 direct callback→form/cart/coupon/requestId→guest 제출 및 account noindex. 각 엔진 Account 호출 0. 이후 기본 OFF AU build·static 검증을 다시 수행했다.

별도 저자 자체 리뷰로 안정화 delta와 계획 Review Focus를 대조했다. 안정화 변경에서 새로 발견된 blocking 회귀는 없었다. 독립 subagent 리뷰는 사용자 단독 실행 조건에 따라 수행하지 않았다. **sharp 위험 대응과 실제 공급자/운영 ACL/실기기·container gate는 미완료**다.

커밋은 `5aed85d`(승인 작업 순서), `9b34129`(일반 main merge), `ec22c34`(profile/session 보존과 경합 수정) 및 최종 인수 문서·lookup 검증 커밋으로 구분한다. 최종 문서 커밋 SHA와 clean 상태는 사용자 보고에서 확인할 수 있다.

## 실제 공급자 검증 준비사항 — 생성/설정 미실행

1. 이후 별도 승인으로 전용 nonproduction Appwrite 1.8.1 project·정확한 DB/Function/resource 매핑과 metadata-only ACL 점검 자격을 준비한다. test 실행 설정에서 production host/project를 거부하고 대상과 runtime을 확인한다. 이번에는 프로젝트를 만들지 않았다.
2. SMTP 시험 발신/수신함과 Google test client/users를 준비한다. Google에는 Appwrite Console이 표시하는 정확한 provider callback URI를, Appwrite Web platform에는 승인된 테스트 origin을 등록한다. 프론트 success/failure는 `/account/auth/callback`으로 돌아와야 한다. 운영 설정을 이 작업에서 변경하지 않았다.
3. 같은 이메일 Google→logout→OTP 및 역순에서 같은 `$id`·신규 회원 주문을 확인한다. 신규/기존 OTP 6자리·만료·429·실패/재전송, cookie/session·다중 탭·관리자 충돌을 실제 공급자로 검증한다.
4. 실제 platform JWT/ID 검증, 다른 사용자·guest·임의 ID/cursor 차단, DB 직접 접근 거부와 실제 ACL inventory, requestId/coupon transaction/reconciliation을 격리 데이터로 확인한다. 기존 guest 조회/알림을 포함한다. 과거 guest backfill은 금지한다.
5. 실제 iPhone Safari/Android Chrome 및 OAuth 성공·취소·실패, 13:00 주말 pickup, 다른 탭 cart, profile draft/detail 보존·계정 소실 시 제거를 확인한다. Chrome/WebKit local Mock을 실기기·공급자 검증으로 대체하지 않는다.

frontend/server flags는 기본 OFF다. 실제 migration dry-run/apply, Appwrite DB/ACL·운영 데이터·Function·사이트·Google/SMTP 변경과 main 병합은 수행하지 않는다. production/merge 승인은 이후 별도 검토 대상이다.

## 안정화 변경 파일

시작 `dc8cba6` 대비 총 30개다. main에서 가져온 16개 파일은 승인된 upstream 변경을 그대로 유지했다.

직접 수정/추가한 파일:

```text
docs/customer-account-rollout.md
docs/customer-account-stabilization.md
docs/customer-account-validation.md
docs/superpowers/plans/2026-10-17-customer-account-stabilization.md
src/CustomerAccountProvider.tsx
src/lib/customer-account-types.ts
src/lib/customer-auth.ts
src/pages/AccountPage.tsx
tests/customer-account-page.test.tsx
tests/customer-account-refresh.browser.mjs
tests/customer-auth-sdk.test.mjs
tests/customer-auth.test.ts
tests/customer-checkout.browser.mjs
tests/customer-lookup.browser.mjs
```

main merge로 통합한 파일:

```text
appwrite-functions/reservation-api/src/au-renewal-pickup-policy.js
docs/renewal-20261013/au-renewal-final-v0.7.md
docs/renewal-20261013/backend-plan-v0.7.md
docs/renewal-20261013/changes-v0.7.md
docs/renewal-20261013/codex-start-v0.7.md
docs/renewal-20261013/frontend-plan-v0.7.md
docs/renewal-20261013/implementation-progress.md
docs/renewal-20261013/public-decisions-20261014.md
docs/renewal-20261013/qa-contract-v0.7.md
public/llms.txt
src/content/au-public-pages.json
tests/au-public-content.test.mjs
tests/au-renewal-api.test.mjs
tests/au-renewal-pickup-ui.test.tsx
tests/au-renewal-pickup.test.mjs
tests/au-renewal-seo.test.mjs
```
