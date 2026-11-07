# **verygood** AU — 케이크 메뉴·미니 사이즈·딸기 옵션 Implementation Plan

작성일: 2026-11-07
문서 상태: 사용자 요청과 현재 코드 확인을 바탕으로 작성한 실행 계획. 이 문서 작성 단계에서는 상품 코드를 수정하지 않았다.

> 실행 담당자: 아래 체크리스트를 순서대로 수행한다. 기존 구현을 읽고 필요한 회귀 테스트와 함께 수정하며, 각 단계의 검증 결과를 기록한다. 작업은 준비된 워크트리에서 진행한다.

**Goal:** 커스텀/프라이빗 클래스 메뉴 4개, 종료된 케이크 프로모션 정리, 파베·바스크 미니 추가, 딸기 옵션, 바스크 사이즈별 생크림 가격, 파베 다크 전용 주문을 일관된 주문 흐름으로 구현한다.
**Architecture:** 현재 AU Renewal 상품·주문 경로를 수정한다. 공개 메뉴와 상세 UI는 기존 컴포넌트를 확장하고, 가격과 허용 옵션은 서버와 프런트가 공유하는 정책으로 관리한다. 기존 주문의 가격·선택값은 당시 버전으로 읽는다.
**Tech Stack:** React 19 / TypeScript / Vite, Appwrite reservation-api 및 notification/reminder 함수, Cloudflare Pages.
**Spec:** 이 문서의 2~6절이 사용자 확정 요구사항과 실행 기본값이다. 첨부 스크린샷 없이도 이 문서만으로 가격을 구현할 수 있다.

## 1. 작업 위치와 확인한 기준 상태

- Mac 워크트리: `/Users/nam9295/Desktop/john_2.0/code/au-cake/.worktrees/cake-mini-strawberry-20261107`
- 브랜치: `feat/cake-mini-strawberry-20261107`
- 확인한 HEAD: `1d888a47bd596a1c202503c6319cd0ba4cdd36a6`
- 원격 저장소: `nam9295-cmyk/au-cake`
- 계획 작성 직전 이 워크트리는 clean이며, 확인된 `origin/main`과 차이가 없었다.
- 앞선 환경 준비에서 `npm run test:cake` 346개, `npm run test:renewal` 118개가 통과했다. 이 기록을 이번 구현 이후의 검증 결과로 재사용하지 않는다.
- Mac 기본 `au-cake` 폴더는 `feat/account-design`에서 Codex가 실행 중이다. 그곳의 브랜치를 전환하거나 파일을 수정하지 않는다.
- Journal 작업 폴더, 서버의 이전 결제/관리자 워크트리, 백업 폴더는 이번 구현 위치가 아니다.
- 실행 시 `AGENTS.md`, 새로 생긴 하위 지침, 실제 HEAD·상태·최신 원격을 다시 확인한다. 다른 변경이 생겼다면 내용을 보존하고, 이번 문서를 핑계로 덮어쓰거나 reset하지 않는다.
- 이 문서 자체 `plan.md`는 사용자가 요청한 산출물이므로 예상된 변경으로 취급한다.

## 2. 이번에 반드시 구현할 범위

1. `/custom-cakes`에서 아래 4개가 각각 독립적인 메뉴 카드로 보이게 한다.
   - 커스텀 케이크 1단
   - 커스텀 케이크 2단
   - 프라이빗 케이크 클래스 1단
   - 프라이빗 케이크 클래스 2단
2. 종료된 케이크 프로모션의 실제 코드·기간·노출 위치를 확인하고, 신규 주문 경로와 공개 안내에서 제거한다.
3. 파베 홀케이크와 브라우니 바스크 홀케이크에 4인치 미니를 추가한다.
4. 파베 홀케이크에 사이즈별 딸기 추가 옵션을 넣는다.
5. 파베 홀케이크의 밀크 초콜릿 선택을 제거하고 신규 주문은 다크만 받는다.
6. 브라우니 바스크 홀케이크의 생크림 추가금을 사이즈별로 나눈다.
7. 바스크 홀케이크의 생크림+딸기를 하나의 옵션으로 제공한다.
8. 상세·장바구니·주문 확인·관리자·이메일·계정 주문 내역·재주문에서 같은 구성과 금액을 전달한다.

**가격 결정:** 기존 6·8·10인치 기본가는 유지한다. 5% 인상안과 앞서 잠시 제안된 $5 단위 가격 조정안은 채택하지 않았다. 미니 기본가는 파베 $45, 바스크 $49다. 모든 금액은 AUD이며 코드에서는 정수 센트로 계산한다.

## 3. 커스텀 케이크 / 프라이빗 클래스 메뉴 4개

### 3.1 화면과 진입 동작

메인 내비게이션의 기존 `/custom-cakes` 진입점을 유지하고, 이 페이지의 주요 선택 영역에 아래 카드를 표시한다. 4개 텍스트 링크나 단수 선택 버튼만 추가하고 끝내지 않는다. 각 카드에는 이름, 적절한 이미지, 짧은 설명, CTA가 있어야 한다.

| 메뉴 ID | 한국어 | 영어 | CTA 목적지 |
|---|---|---|---|
| custom-single | 커스텀 케이크 · 1단 | Custom Cake · Single Tier | `/cakes/custom-cake?tier=single` |
| custom-double | 커스텀 케이크 · 2단 | Custom Cake · Two Tiers | `/cakes/custom-cake?tier=double` |
| private-class-single | 프라이빗 케이크 클래스 · 1단 | Private Cake Class · Single Tier | `/custom-cakes?service=private-class&tier=single#private-class-enquiry` |
| private-class-double | 프라이빗 케이크 클래스 · 2단 | Private Cake Class · Two Tiers | `/custom-cakes?service=private-class&tier=double#private-class-enquiry` |

- 커스텀 케이크 CTA는 기존 주문/견적 폼에 연결하고 해당 단수를 미리 선택한다. 쿼리의 허용값은 `single|double`이며, 잘못된 값은 안전한 기본값으로 처리한다.
- 직접 URL 방문, 새로고침, 뒤로 가기, 한/영 전환 뒤에도 선택 의도가 유지되어야 한다.
- 프라이빗 클래스의 별도 수업료·시간·대상·정원·새 일정은 이번 대화에서 확정되지 않았다. 기존 Kids Class의 요금/일정을 새 프라이빗 클래스의 조건으로 전용하지 않는다.
- **실행 기본값:** 프라이빗 클래스는 두 개의 문의형 메뉴로 구현한다. 선택한 클래스와 단수가 표시되는 문의 영역에서 기존 공식 Instagram 문의로 연결한다. 가격 표기는 `Enquire for pricing / 수업료 문의`로 하고 즉시 결제나 예약 확정은 만들지 않는다.
- Instagram 링크가 메시지를 자동으로 미리 입력한다고 가정하지 않는다. 선택한 수업명을 화면에 보이고 문의용 문구를 복사할 수 있게 하면 된다.
- 기존 `/classes`의 종료된 방학 수업 아카이브와 예약 마감 상태는 유지한다. 신규 프라이빗 클래스 문의와 과거 Kids Class 휴강 안내를 같은 상태로 묶지 않는다.
- 클래스와 커스텀 케이크는 서비스가 다르다. 클래스 클릭을 케이크 구매로 저장하거나, 고객 메모에만 수업 여부를 감춰서 주문으로 전송하지 않는다.
- PC는 2×2, 모바일은 한 열을 기본으로 한다. 기존 **verygood** AU 색·서체·버튼·여백을 재사용하고, 키보드 포커스와 읽기 순서를 맞춘다.
- 사진은 실제 보유한 적합한 자산을 확인해서 사용한다. 1단/2단 이미지와 수업 이미지가 내용을 오인시키지 않도록 하고, 사진이 없다고 무단으로 생성하거나 미제공 사진을 있는 것처럼 연결하지 않는다.

### 3.2 커스텀 케이크 가격

이번 작업은 커스텀 케이크 자체의 요금 변경이 아니다. 확인된 현재 코드 가격은 다음과 같다. 더 최신 코드가 있다면 실제 정책을 먼저 대조하고 임의로 과거 대화 숫자를 적용하지 않는다.

| 단수 | 사이즈 | 현재 기본 견적 |
|---|---|---:|
| 1단 | 6 / 8 / 10인치 | $159 / $219 / $319 |
| 2단 | 4+6 / 6+8 / 8+10인치 | $239 / $339 / $459 |

카드에 From 가격을 표시한다면 실제 폼과 같은 원본을 사용한다. 디자인/피규어 등 최종 견적 절차는 기존 기능을 유지한다.

## 4. 파베·바스크 가격과 옵션 — 확정 명세

미니는 4인치, 지름 약 10cm다. 기존 6·8·10인치와 같은 상품의 사이즈 선택지로 넣는다. 홀케이크의 미니 추가를 별도 커스텀 케이크나 로프 옵션으로 만들지 않는다. 미니의 정확한 높이·중량·인분은 실물 확인 없이 새 숫자를 약속하지 않는다.

### 4.1 파베 홀케이크

| 사이즈 | 기본가 | 딸기 추가금 | 딸기 포함 최종가 |
|---|---:|---:|---:|
| 미니 4인치 | $45 | +$10 | $55 |
| 6인치 | $75 | +$18 | $93 |
| 8인치 | $107 | +$30 | $137 |
| 10인치 | $159 | +$45 | $204 |

- 선택은 `기본 / 딸기 추가` 두 가지다. 파베에 생크림을 자동으로 추가하지 않는다.
- 신규 파베 주문은 다크 초콜릿만 제공한다. Milk 옵션을 숨기고 서버도 명시적인 `milk` 주문을 거절해야 한다.
- 초콜릿 선택값이 생략되면 신규 파베는 `dark`로 정규화한다. 다크 하나만 있는 선택 UI를 남기는 대신 고정 안내로 표시해도 된다.
- 밀크가 있었던 예전 주문의 조회·메일·내역은 당시의 Milk 표시를 유지한다.
- 다른 상품/초콜릿/모찌의 밀크 옵션까지 전역 삭제하지 않는다.

### 4.2 브라우니 바스크 홀케이크

| 사이즈 | 기본가 | 생크림만 추가금 | 생크림 최종가 | 생크림+딸기 추가금 | 생크림+딸기 최종가 |
|---|---:|---:|---:|---:|---:|
| 미니 4인치 | $49 | +$5 | $54 | +$15 | $64 |
| 6인치 | $82 | +$10 | $92 | +$25 | $107 |
| 8인치 | $117 | +$15 | $132 | +$40 | $157 |
| 10인치 | $168 | +$20 | $188 | +$60 | $228 |

- 선택은 `기본 / 바닐라 생크림 / 바닐라 생크림+딸기` 중 하나다.
- 생크림+딸기 추가금은 **생크림이 포함된 총 추가금**이다. 생크림 비용을 한 번 더 더하지 않는다.
- 사이즈 변경 시 선택한 장식을 유지하면서 그 사이즈의 추가금과 총액을 다시 계산한다.
- 이 표는 `brownie-whole`만 대상이다. `brownie-loaf`나 컵케이크에 새 사이즈/딸기/생크림 가격표를 퍼뜨리지 않는다. 현재 로프의 기본가와 생크림 추가금은 유지한다.

### 4.3 공통 구현 규칙

- UI의 `+$금액`은 케이크 한 개당 추가금이다. 수량을 곱한 합계와 구분한다.
- 가격을 상세 페이지에만 하드코딩하지 않는다. 서버 계산, 카드 From 가격, 고정 주문바, 장바구니, 주문서와 정적 SEO 가격까지 일치시킨다.
- 신규 상세의 기본 선택은 미니 4인치·기본 장식으로 두고, 목록 From 가격을 파베 $45 / 바스크 $49에 맞춘다. 명시적인 URL/장바구니 편집 선택은 우선 복원한다.
- 장바구니 상품 구분 키에 사이즈·장식·초콜릿 구성이 포함되어 서로 다른 옵션이 합쳐지지 않아야 한다.
- 카드·상세·조회 표시에서 내부 옵션 키가 그대로 노출되지 않게 한/영 이름을 제공한다.
- 새 딸기 장식 사진이 없으면 적합한 실제 기본 사진과 옵션 텍스트를 사용한다. 딸기 사진/완성 사진이 준비된 것처럼 표시하지 않는다.
- 기존 `Add something extra · 5% off`의 별도 추가상품과 케이크 위 장식 옵션을 구별한다. 생크림 박스 100g은 바스크 위 생크림 장식과 다른 상품이다.

## 5. 종료된 프로모션 정리

### 5.1 실제 확인된 코드와 위치

| 항목 | 확인한 현재 코드 | 처리 기준 |
|---|---|---|
| 커스텀 케이크 9월 캠페인 | `VERYGOOD CUSTOM`, 기본가 10%; 접수 2026-09-12~09-30, 픽업 2026-09-12~11-30 | **접수 종료됨.** 신규 고객용 홍보·코드 입력·적용 기능 정리 |
| 구 치즈케이크 코드 | `chocolate`, 만료 2026-07-15 | AU 신규 경로에서 만료 코드가 다시 적용되지 않는지 확인 |
| 구 레몬 코드 | `lemoni`, 만료 2026-07-16 | AU 신규 경로에서 만료 코드가 다시 적용되지 않는지 확인 |
| 리뷰/수동 발급 쿠폰 | 현 AU checkout도 `promoCode` 필드와 리뷰 쿠폰 검증을 사용 | 이번 종료 캠페인과 구별하여 유지 |

- `src/pages/CustomCakePage.tsx`에 남은 September Pre-order Offer 배지, 코드 입력 필드, Instagram에서 프로모션 코드를 찾으라는 문구, 관련 FAQ를 정리한다.
- 폼에서 블록이 빠지면 안내 순번·레이블 연결·모바일 흐름도 함께 수정한다.
- 영어·한국어, 실제 노출 분기, 정적 SEO/FAQ/llms 및 관련 테스트를 모두 검색한다.
- 신규 생성 API가 종료 코드를 받으면 할인하지 않아야 한다. 이미 처리된 과거 요청의 동일 requestId 재시도는 기존 응답을 그대로 반환해야 한다.
- 기존 정상 쿠폰도 같은 이름의 입력 필드를 사용한다. 모든 `promoCode` 입력/타입/검증을 일괄 삭제하지 않는다. 일반 결제 화면의 리뷰/수동 쿠폰 입력은 유지하고 필요하면 표시 이름만 Coupon code로 정리한다.
- 스모어의 기존 판매/수량 할인, 별도 추가상품 5% 할인, 운영자의 수동 할인은 이번 케이크 기간제 프로모션과 별개다. 종료 캠페인에 실제 종속된 할인인지 확인 없이 함께 삭제하지 않는다.
- 과거 계약/영수증/주문 가격 검증용 프로모션 정의는 읽기 전용 호환성 코드로 유지할 수 있다. “프로모션 삭제”를 과거 주문의 할인 기록 삭제로 구현하지 않는다.
- `CUSTOM_CAKE_PROMOTION_STARTS_AT`처럼 runtime 준비 상태에도 사용되는 환경값은 이름만 보고 지우지 않는다. 쓰임을 추적하고 이번 작업에 필요하지 않은 운영 설정은 유지한다.
- 공유 KR 경로가 있다면 AU의 종료 처리 때문에 KR의 기능·문구·가격까지 바뀌지 않도록 테스트한다.

## 6. 코드 확인 결과와 핵심 구현 경계

### 6.1 수정 대상 지도

| 책임 | 확인한 현재 파일 |
|---|---|
| Custom Cake 허브 | `src/pages/AuServiceLandingPage.tsx`, `src/styles/au-service-landing.css` |
| 기존 커스텀 폼·단수·프로모션 UI | `src/pages/CustomCakePage.tsx`, `src/lib/custom-cake-ui.ts` |
| 실제 AU 홀케이크 상세·옵션·checkout | `src/pages/AuRenewalShop.tsx`, `src/styles/au-renewal.css` |
| 실제 AU 가격·정규화·합계·옵션 요약 | `appwrite-functions/reservation-api/src/au-renewal.js` 및 `.d.ts` |
| AU 목록 카드·상세 연결 | `appwrite-functions/reservation-api/src/au-renewal-catalog.js` 및 `.d.ts` |
| 보관 주문 판독·새 주문 저장 | `appwrite-functions/reservation-api/src/au-renewal-reader.js`, `au-renewal-storage.js` |
| 장바구니·계정 저장·재주문 | `src/lib/renewal-cart.ts`, `src/CartProvider.tsx`, `src/lib/customer-cart-storage.ts` 및 관련 소비자 |
| 서버 capabilities·응답 버전 | `src/lib/renewal-client.ts` 및 reservation-api capabilities 경로 |
| 커스텀 캠페인 서버 정의 | `appwrite-functions/reservation-api/src/cake-order-catalog.js`, `cake-order-input.js`, `cake-order-pricing.js` |
| 과거 주문 호환 정책 | `appwrite-functions/reservation-api/src/stored-order-policy.js`, `stored-order-reader.js`, custom-cake 저장/재시도 경로 |
| 검색/정적 산출물 | `appwrite-functions/reservation-api/src/au-renewal-seo.js`, `scripts/generate-seo-pages.mjs` |
| 메일·리마인더 패키징 | `scripts/reservation-notification-deploy-runtime.mjs`, `scripts/booking-reminder-deploy-runtime.mjs`, 각 함수의 `shared/reservation-api/` 사본 |

**주의:** 실제 현재 AU 상품 화면은 `App.tsx`가 연결하는 Renewal 경로다. 예전 `CakeDetailPage.tsx`나 `src/lib/constants.ts`만 고쳐 놓고 현재 화면을 수정했다고 판단하지 않는다.

### 6.2 과거 주문과 새 가격 정책 분리

현재 활성 정책은 `au-renewal.2026-10.v2`이고 `v1`도 읽는다. 현재 reader가 policyVersion으로 다시 계산한 뒤 저장된 금액과 비교하므로, 활성 가격만 직접 덮어쓰면 예전 바스크 생크림 주문이 읽히지 않을 수 있다.

**실행 설계:**
- 이번 신규 가격/선택 정책은 `au-renewal.2026-11.v3`로 분리한다. JSON 저장 외형의 `version: 2`와 가격 정책의 v3는 다른 값이다. 저장 형식까지 불필요하게 바꾸지 않는다.
- 구 v1/v2의 가격, 옵션 허용 범위, 상품 승인/시즌/모찌 관련 기존 호환성을 고정한다. 특히 구 바스크 생크림 +$10와 구 파베 Milk를 새 규칙으로 다시 계산하지 않는다.
- 신규 생성은 현재 v3 정책으로 검증하고, 과거 저장·조회·멱등 재시도는 해당 과거 policyVersion으로 검증한다.
- `normalizeRenewalLines`가 역사 버전 판독 전에 새 가격·옵션 규칙을 강제하지 않도록, 정규화 단계에도 policyVersion을 전달한다. `allowHistorical`, `storedOnly`, 타입 선언, capabilities, 클라이언트 응답 검증도 함께 확인한다.
- 기존 주문의 가격·옵션은 소급 변경하지 않는다. 취소/변경/완료·관리자·조회·메일/리마인더 모두 과거 문서를 읽을 수 있어야 한다.
- 기존 localStorage/계정 장바구니의 파베 Milk 항목은 **자동으로 Dark로 바꾸지 않는다.** 해당 항목을 재선택/삭제하도록 알리고, 함께 담긴 유효 상품을 보존한다. 재주문도 같은 재선택 규칙을 따른다.
- 오래된 페이지에서 새 주문을 보내는 경우 명확한 재확인/갱신 안내를 제공하고 입력을 보존한다. 기존 requestId의 이미 접수된 주문을 새 정책으로 중복 생성하지 않는다.
- 신규 모듈을 추출하면 notification/reminder의 공유 모듈 목록과 빌드 패키지에도 포함한다. 원본 하나만 수정한 채 배포 사본을 누락하지 않는다.

## 7. 단계별 구현 작업

### Task 0 — 실행 기준 재확인

- [ ] 지정 폴더에서 `pwd`, `git status --short --branch`, `git worktree list --porcelain`, `git log -1`을 확인한다.
- [ ] `git fetch origin` 후 현재 HEAD와 `origin/main`의 차이를 확인한다. 최신 커밋이 생겼다면 차이를 읽고 이 브랜치에서 안전하게 반영한다. 다른 워크트리를 전환하거나 force push하지 않는다.
- [ ] `plan.md` 외에 다른 미커밋 변경이 있다면 소유권/범위를 파악하고 보존한다.
- [ ] 활성 AU 라우트, 위 파일 지도, 사용 중인 공개/고객 계정 기능 플래그와 패키징 스크립트를 읽는다. 환경값/비밀을 출력하지 않는다.
- [ ] 적용 범위를 2절 목록과 대조한 뒤 기능 구현을 시작한다. 사소한 구현 선택 때문에 매 단계 승인을 반복해서 묻지 않는다.

### Task 1 — 4개 서비스 메뉴와 단수별 진입

**Files:** 수정 `AuServiceLandingPage.tsx`, `CustomCakePage.tsx`, `au-service-landing.css`; 생성 `src/lib/custom-cake-menu.ts`, `src/components/CustomCakeMenuCards.tsx`; 테스트 `tests/au-service-landing.test.tsx`, `tests/custom-cake-ui.test.mjs`, `tests/au-custom-cake-menu.test.tsx`.

**Interface:** 메뉴 정의는 `id, kind: 'custom-cake'|'private-class', tier: 'single'|'double', nameEn, nameKo, href`를 가진 readonly 배열로 내보낸다. `getCustomCakeInitialTier(search: string): 'single'|'double'`을 같은 모듈에 두어 URL 해석을 한 곳에 모은다.

- [ ] 실패 테스트: 한/영 각각 카드 ID 4개가 한 번씩 렌더되고, 케이크 1단/2단 링크의 쿼리와 실제 폼 단수가 일치함을 검증한다.
- [ ] 실패 테스트: private-class 두 링크가 수업 선택을 표시하며 케이크 생성 API를 호출하지 않는지, 잘못된 tier와 직접 방문/새로고침을 검증한다.
- [ ] 3절 카드/문의 흐름을 구현한다. 기존 Kids Class 아카이브로만 보내는 것을 새 프라이빗 클래스 메뉴 구현으로 간주하지 않는다.
- [ ] 기존 URL·한/영 전환·접근성·모바일 레이아웃을 확인하고 관련 테스트를 통과시킨다.
- [ ] 이 단계의 diff만 검토하고 로컬 커밋한다.

### Task 2 — 종료 캠페인 노출·신규 적용 제거

**Files:** `CustomCakePage.tsx`, 실제 사용되는 AU 프로모션 입력/가격 경로, `cake-order-{catalog,input,pricing}.js`, SEO/FAQ 소비자; 테스트 `tests/custom-cake-order-core.test.mjs`, `tests/custom-cake-frontend.test.ts`, `tests/custom-cake-integration.test.mjs`, `tests/au-cake-promotion-retirement.test.mjs`.

- [ ] 먼저 코드별 사용처·기간·적용 상품·프런트/서버/보관 판독 역할을 표로 기록한다.
- [ ] 실패 테스트: AU 공개 화면에 September offer, 종료 코드 입력/Instagram 코드 안내가 없고, 2026-11-07 시드니 기준 신규 요청에 종료된 코드가 적용되지 않는지 검증한다.
- [ ] 실패 테스트: 과거 할인 주문 조회와 같은 requestId 재시도, 정상 리뷰/수동 쿠폰은 유지되는지 검증한다.
- [ ] 5절에 따라 공개 캠페인 블록과 신규 적용 의존을 정리한다. 과거 가격 판독에 필요한 정의는 역사 정책으로 남긴다.
- [ ] 관련 테스트를 통과시키고 로컬 커밋한다.

### Task 3 — v3 가격 정책·과거 주문 호환성

**Files:** `au-renewal.js/.d.ts`, `au-renewal-reader.js/.d.ts`, `au-renewal-storage.js`, `src/lib/renewal-client.ts`; 필요 시 생성 `appwrite-functions/reservation-api/src/au-renewal-price-policies.js/.d.ts`, `au-whole-cake-options.js/.d.ts`; 관련 capabilities·공유 패키징.
**Tests:** `tests/au-renewal-pricing.test.mjs`, `au-renewal-storage.test.mjs`, `au-renewal-api.test.mjs`, `tests/au-renewal-cake-options-v3.test.mjs`, `tests/au-renewal-history-v3.test.mjs`.

**Interfaces / 고정값:**
- 활성 policyVersion은 `au-renewal.2026-11.v3`이며, 과거 v1/v2의 read 경로를 유지한다.
- `wholeCakeToppingSurchargeCents(offerId: string, size: string, finish: string): number`는 4절 표의 센트를 반환하고, 다른 상품/사이즈/옵션 조합은 오류 처리한다.
- 신규 파베 finish: `basic | fresh-strawberries`.
- 신규 바스크 홀 finish: `basic | vanilla-fresh-cream | vanilla-fresh-cream-strawberries`.
- 로프 등 다른 상품에는 각자의 기존 허용 옵션을 유지한다.
- `normalizeRenewalLines(value, options)`와 `priceRenewalOrder(value, options)`의 options에서 policyVersion을 일관되게 전달한다. 기존 `contractVersion` 옵션 이름을 재사용하고 `.d.ts`도 맞춘다.
- v1/v2의 역사 가격·정규화 규칙은 v3 표의 참조 변경에 영향을 받지 않아야 한다.

- [ ] 실패 테스트: 4절의 파베 8개 조합과 바스크 12개 조합 전부를 정수 센트로 검증한다.
- [ ] 예시 고정 검증: 파베 6인치 딸기 2개 = 18,600센트, 바스크 8인치 생크림+딸기 2개 = 31,400센트. 별도 추가상품이 없으면 이 금액에 생크림이나 딸기를 다시 가산하지 않는다.
- [ ] 실패 테스트: 신규 파베 Milk 거절, 생략값 Dark 정규화, 파베 생크림/바스크 딸기 단독/로프 딸기 등 금지 조합 거절을 검증한다.
- [ ] 실패 테스트: 구 v2 바스크 8인치 생크림은 $127, 10인치는 $178로 계속 읽히고, 구 v1/v2 파베 Milk와 기존 모찌/쿠폰/시즌 주문도 읽힌다.
- [ ] 실패 테스트: 기존에 지원하지 않던 미니/딸기 조합을 구 policyVersion으로 위조하여 제출하거나 저장 문서를 변조하면 거절한다.
- [ ] 정책 분리·서버 검증·요약 라벨·capabilities와 공유 모듈 패키징을 구현하고 관련 테스트를 통과시킨다.
- [ ] 신규 필드/스키마 변경이 필요한지 실제 저장 경로로 확인한다. finish와 기존 JSON 저장으로 해결 가능하면 불필요한 Appwrite 속성/컬렉션을 추가하지 않는다.
- [ ] 구 주문을 다시 저장/마이그레이션하지 않고 읽을 수 있는지 확인하고 로컬 커밋한다.

### Task 4 — 미니·딸기·생크림 UI와 장바구니/주문 소비자

**Files:** `AuRenewalShop.tsx`, `au-renewal.css`, `renewal-cart.ts`, `CartProvider.tsx`, `customer-cart-storage.ts`, `au-renewal-catalog.js/.d.ts`, `au-renewal-seo.js`; 실제 관리자·메일·계정·재주문 소비자.
**Tests:** `tests/au-renewal-detail-ui.test.tsx`, `au-renewal-cart.test.ts`, `au-renewal-consumers.test.ts`, `tests/customer-account-cart-*.test.*`, `tests/au-renewal-cake-options-ui.test.tsx`.

- [ ] 실패 테스트: 두 홀케이크의 4·6·8·10인치, 기본/장식의 추가금·총액, 크기를 바꿀 때 재계산, 기본 4인치와 목록 From 가격을 검증한다.
- [ ] 실패 테스트: 생크림+딸기 선택 후 크기를 바꿔도 생크림이 두 번 붙지 않고, 서로 다른 finish/size가 장바구니에서 별도 항목으로 유지되는지 검증한다.
- [ ] 실패 테스트: 구 Milk 장바구니/재주문 항목은 명시적인 재선택 안내가 나오고, 함께 담긴 다른 유효 상품은 사라지지 않는지 검증한다.
- [ ] 실제 AU Renewal 상세에 독점 선택 옵션과 공유 가격을 연결한다. `Photo coming soon` 블록 때문에 옵션 영역이 불필요하게 커지지 않도록 기존 디자인에 맞춘다.
- [ ] 옵션명·사이즈·금액이 checkout, 고객 확인/조회, 관리자, 메일/리마인더, 계정 내역에 보이는지 소비 경로를 추적한다.
- [ ] SEO/정적 HTML/가격 구조화 데이터/목록 From 가격과 클래스 4개 메뉴 링크도 현재 내용에 맞춘다. 생성 산출물은 기존 빌드 방식으로 만든다.
- [ ] 해당 테스트를 통과시키고 로컬 커밋한다.

### Task 5 — 통합 검증과 전달

- [ ] 필요한 의존성은 lockfile 기준으로 설치한다. 기존 설치가 정상이라면 매번 재설치하지 않는다.
- [ ] 구현한 신규 테스트를 실행하고, 아래 기존 검증을 수행한다.

```bash
npm run test:renewal
npm run test:custom-cake-integration
npm run test:customer-account
npm run test:class
npm run test:cloudflare-pages
npm run lint
VITE_MARKET=AU VITE_CUSTOMER_ACCOUNT_ENABLED=true npm run build
VITE_MARKET=KR npm run build
npm test
git diff --check
git status --short --branch
```

- [ ] AU/KR 빌드는 같은 dist를 쓰므로 순차 실행한다. 필요 공개 모드·계정·Appwrite 식별자 등은 기존 검증된 설정을 확인해 사용하며 운영 값을 임의로 바꾸지 않는다.
- [ ] 새 파일 테스트가 위 스크립트에 실제 포함되는지 확인한다. 포함되지 않으면 package.json의 관련 테스트 명령에 연결한다. 존재하지 않는 npm script를 실행했다고 기록하지 않는다.
- [ ] notification/reminder 공유 모듈을 기존 런타임 빌더로 staging 패키징하고, 새 정책 모듈 포함 여부를 검사한다. 검증을 위해 운영 함수를 배포하지 않는다.
- [ ] 로컬 미리보기에서 390px/768px/1440px로 4개 메뉴, 단수별 진입, 모든 장식, 금액, 수량, 장바구니 편집, 한/영, 새로고침과 뒤로 가기를 확인한다.
- [ ] Milk 잔여 장바구니 재선택, 과거 주문 읽기, 정상 쿠폰과 종료 캠페인 거절을 테스트한다. 운영 주문·이메일 발송·실결제로 시험하지 않는다.
- [ ] 실패를 기존 실패/신규 회귀로 구분해 원인을 기록한다. 불필요한 광범위 리팩터링으로 계획 범위를 늘리지 않는다.
- [ ] 최종 보고에는 변경 파일·커밋, 각 기능의 완료 여부, 가격 검증 결과, 실행한 명령/성공·실패, 미검증 항목, 미리보기 방법과 배포에 필요한 함수 목록을 적는다.
- [ ] 이 계획의 실행 완료 범위는 구현·로컬 검증·리뷰 가능한 로컬 커밋까지다. main 병합과 운영 배포는 별도 지시가 있을 때 수행한다.

## 8. Review Focus — 반드시 걸러야 할 실패 5개

1. **과거 주문 재계산 오류:** v3의 +$15/+20 생크림이 구 v2 주문에 적용되면 안 된다. Task 3의 v1/v2 fixture·reader·재시도 테스트로 검증한다.
2. **장식 중복 과금:** 바스크 생크림+딸기에 생크림 비용이 한 번 더 붙으면 안 된다. Task 3·4의 조합/수량/사이즈 변경 테스트로 검증한다.
3. **장바구니 유실·무단 변경:** 구 Milk 항목 때문에 다른 상품까지 비워지거나 자동 Dark 치환되면 안 된다. Task 4의 부분 복원·재선택·재주문 테스트로 검증한다.
4. **메뉴만 있고 동작이 없음:** 2단 카드를 눌러도 1단이 선택되거나 클래스가 케이크 구매로 전송되면 안 된다. Task 1의 직접 URL/선택 유지/API 비호출 테스트로 검증한다.
5. **프로모션 정리가 정상 쿠폰·역사 기록을 훼손:** 과거 할인 기록과 리뷰/수동 쿠폰을 함께 없애면 안 된다. Task 2·5의 신규 거절/과거 조회/정상 쿠폰 테스트로 검증한다.

## 9. 완료 조건 — 누락 대조표

- [ ] 커스텀 1단 / 커스텀 2단 / 프라이빗 클래스 1단 / 프라이빗 클래스 2단의 메뉴 카드 4개.
- [ ] 커스텀 케이크 단수별 올바른 폼 진입, 클래스는 선택된 수업을 보여주는 문의형 진입.
- [ ] 종료된 케이크 캠페인의 공개 홍보·입력·신규 할인 적용 정리.
- [ ] 파베 미니 $45 / 바스크 미니 $49 추가. 기존 6·8·10인치 기본가 유지.
- [ ] 파베 딸기 추가금 $10 / $18 / $30 / $45, 최종가 $55 / $93 / $137 / $204.
- [ ] 바스크 생크림 추가금 $5 / $10 / $15 / $20, 최종가 $54 / $92 / $132 / $188.
- [ ] 바스크 생크림+딸기 추가금 $15 / $25 / $40 / $60, 최종가 $64 / $107 / $157 / $228.
- [ ] 파베 신규 Milk 제외·서버 거절, 과거 Milk 주문 판독 유지.
- [ ] 바스크 로프/컵케이크·다른 상품 옵션은 이번 홀케이크 변경과 분리.
- [ ] 상세·장바구니·서버·조회·관리자·메일·계정·재주문·정적 SEO의 구성과 금액 일치.
- [ ] 정상 쿠폰, 과거 주문, 멱등 재시도, KR 경계, Journal 기능의 회귀 방지.
- [ ] 기능 검증 결과와 배포 준비 상태를 구분해 보고.

## 10. 별도 확정이 필요한 운영 정보

이번 구현을 막지 않고 아래 기본값으로 진행한다. 새 숫자나 예약 가능 상태를 만들어내지 않는다.

| 미확정 정보 | 이번 실행 기준 |
|---|---|
| 프라이빗 클래스 수업료·대상·시간·정원·일정 | 문의형 메뉴, 수업료 문의 표시. 새 예약/결제 기능은 만들지 않음 |
| 미니의 실측 높이·중량·정확한 인분 | 4인치/약 10cm만 표시. 미확인 숫자 생략 |
| 새 딸기 완성 사진·단수별 전용 사진 | 실제 검증된 기존 자산 사용. 판매 구성을 오인시키는 사진은 사용하지 않음 |
| main 병합·운영 배포 일정 | 구현과 로컬 검증까지 진행하고 결과를 전달 |
