# 사용자 직접 조작 — AU 장바구니 공유 확인

> **현재: 로컬 준비 완료, 실제 실행 보류.** 사용자가 퇴근 후 이어서 진행하기로 해 Account ON·OPEN10·감시 worker를 시작하지 않았다. 최종 읽기 전용 확인은 Account OFF403·M/G/H 세션0·Function OFF/B6·flags false·사이트 CLOSED이며 Pages9/9·Function8/120 불변이다. 사용자가 돌아와 재개를 지시하기 전 자동 활성화하지 않는다.

2026-10-18. Branch `feat/customer-account`. 사용자가 승인한 수동 장바구니 시험이다. 기존 Google-only의 G 로그인·세션·새로고침 PASS, 과거 watchdog 종료 원인 UNVERIFIED는 보존한다. 기존 900초 계획·manifest·proof·journal을 수정하거나 재사용하지 않는다.

## 확인할 현재 동작

실제 `src/CartProvider.tsx`는 활성 장바구니를 `verygood-au-cake-cart-v1`, `verygood-au-renewal-cart-v1`에 저장하며 사용자 UID를 키에 넣지 않는다. `verygood-au-mochi-reselection`은 별도의 재선택 보관 키다. 로그인·로그아웃과 CartProvider의 저장 구조는 이번에 변경하지 않는다. 같은 Chrome 프로필·같은 테스트 origin에서 G/H가 공유하는지 직접 확인한다. 운영 사이트와 테스트 hostname은 다른 origin이므로 운영 장바구니를 읽거나 복사하지 않는다.

- 기존 test project `verygood-au-account-test`, endpoint `https://api.verygood-chocolate.com/v1`, 기존 G/H만 사용한다. M 포함 사용자3명, `authLimit=2`, Google만 enabled, 다른 인증·sessionAlerts OFF를 유지한다.
- 실제 AU 상품 `Pavé Whole Cake`, `Pavé Chocolate · Heart Tin 100g`와 기존 `AuRenewalShop`·Bag·CartProvider를 사용한다. CartProvider와 상품 source는 수정하지 않는다. DEV=false로 미확정가/판매 비활성 상품을 활성화하지 않는다.
- `/account`는 이 시험의 Google 로그인·로그아웃·계정 표시만 제공한다. 프로필 저장·MY ORDERS·쿠폰·Checkout/주문·결제는 제외한다.
- 주문 client/repository를 테스트 빌드에서 로컬 거부 adapter로 대체한다. Bag의 Checkout UI는 테스트 CSS로 제외하며 capability=false다. 별도의 fetch guard가 정확한 test project header와 Account GET/current-session GET·DELETE, 같은 origin의 mode GET만 허용한다. 이 UI 제한을 서버 보안 대신으로 주장하지 않는다. 실제 Function disabled/execute=[]/B6, customer·Renewal flags false와 private DB ACL도 유지한다.

## 수동 종료 모드

새 `MANUAL_CART` proof/journal을 별도로 만든다. `test-mode.json`은 enabled/mode/runId/startedAt만 가지며 **endsAt/900초 deadline이 없다**. 기존 15분 watchdog을 사용하지 않고, 기존 watchdog의5초 계약도 변경하지 않는다. 새 모드는 사용자 종료가 원칙이며 시간·heartbeat age에 따른 자동 만료가 없다.

수동 모드의 독립 CLI 감시는15초 간격으로 작은 Owner metadata 검사만 수행한다. 반복 SSH·reservation health·Function 실행은 없다. 알 수 없는 사용자/세션, 프로젝트/Function/flags/execution drift, 관리 인증·통신 이상은 비상 OFF/CLOSED 사유다. 비민감 종료 사유와 API 단계 진단을 보존한다. Mac/네트워크 가용성에 의존하며 서버 측 TTL이 아니다. Mac은 켜 두고, 감시/복구 실패 시 사용자 Console에서 정확한 test Account OFF를 직접 수행해야 한다.

기존 Cloudflare Zero Trust/Access는 미구성이고 테스트 페이지는 공개다. Google Testing 목록/프론트 UID 제한은 Appwrite의 이메일 allowlist가 아니다. 실제 기존 사용자3명·상한2명과 Google-only 정책으로 신규 user 생성 경로를 제한하고, G/H 외 세션은 감시에서 비상 차단한다. 공개 API에 대한 외부 요청 자체가 차단된다고 주장하지 않는다. Google provider/SMTP/플랫폼/운영 설정은 변경하지 않는다. 실제 정책이 예상과 다르면 열지 않는다.

Pages는 기존9회에 이어 **OPEN10 1회 / CLOSED11 1회**만 허용한다. OPEN 실패도 사용량으로 보존하고 자동 재배포하지 않는다. CLOSED11은 종료용으로 예약한다. Function 추가 실행·배포0, 기존8/120 유지다. 시험 전후 공식 metadata와 실제 HTTPS를 확인한다.

## 사용자가 할 일

1. 테스트 `/account`에서 G로 Google 로그인한다. 기존 Bag이 이미 차 있으면 보존하고 시작 상태를 알려 준다.
2. 케이크 링크에서1개를 담고 Bag을 확인한다.
3. `/account`에서 G 로그아웃 → H로 Google 로그인 → Bag에 G 상품이 남는지 확인한다.
4. 초콜릿 링크에서 다른 상품1개를 담고 H 로그아웃 → G 재로그인 → Bag에 두 상품이 보이는지 확인한다.
5. `종료`라고 알린다. 오류나 예상 밖 계정이 나오면 추가 조작 없이 알려 준다. 비밀번호·2FA·Cookie·키는 보내지 않는다.

사용자 종료 시 Account OFF를 먼저 요청하고, 이번 시작 이후 생성된 G/H Google 세션만 확인해 정리한 뒤 CLOSED11을 배포한다. Account403, 세션0, Function OFF/B6·flags false·execution 불변, 정적 CLOSED, 운영/테스트 보호 지문을 확인한다. 사용자·장바구니·프로필·기존 합성 주문/쿠폰은 자동 삭제하지 않는다. 보호 파일 `close.command`는 OFF/정리/CLOSED만 수행한다.

실제 네 단계 결과는 사용자 확인 전 **NOT RUN**이다. 예상되는 공유 현상을 사전에 수정하거나 PASS로 간주하지 않는다. 종료 후 결과를 기록하고 계정별 저장 전환 여부를 제안한다. 전환 시에는 guest cart 처리, 명시적 merge, 로그아웃 시 표시 범위, 다른 탭 동기화, 기존 공통 키 이행 정책을 별도로 결정해야 한다.

로컬 검증: 신규 수동 모드8개 RED→GREEN, target/header/쓰기 거부·15분 이후 유지·비상 계정 검사·OPEN10/CLOSED11 예산·실제 source/이미지 빌드·OFF 우선 복구를 검증한다. 실제 Chrome 조작·Google 인증은 사용자가 직접 수행한다. 준비/실행 evidence는 Git 제외 보호 폴더에 두고 secret을 출력하지 않는다.

준비 최종 검증: 전체 `npm test` **2,095 PASS / 0 FAIL / 기존 SKIP1**(총2,096), 계정 그룹318 PASS, 신규 수동8 PASS. 프로젝트 ESLint·신규 MJS 별도 ESLint·테스트 entry 별도 TypeScript PASS. 실제 compiled artifact의 로컬 HTTP7개 경로·JS/CSS MIME·주문/관리자 등 비허용 경로 hard404·CSP PASS. 실제 Chrome·Google·공유 현상 인수는 **NOT RUN**이다. 검증 중 초기 Fast Refresh export·JS never return typing·MJS lint 오류를 수정하고 GREEN으로 확인했다. source CartProvider/AuRenewalShop은 원본과 동일하다.

**B5 — DEFERRED — RELEASE BLOCKER**, native OTP OFF·실제 OTP/Google↔OTP UID NOT RUN. 과거 AU raw 설정 차이는 **UNVERIFIED** 유지. production 배포·main 병합·운영 프로젝트 변경은 금지다.
