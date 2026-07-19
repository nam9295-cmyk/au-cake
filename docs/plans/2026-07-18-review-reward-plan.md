# AU Cake Review & One-time Reward Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 케이크 픽업 또는 키즈 클래스 완료 고객에게 검증된 일회용 리뷰 링크를 보내고, 텍스트 리뷰에는 5%, 사진 리뷰에는 10%의 다음 케이크 주문용 일회성 프로모션 코드를 발급한다.

**Architecture:** 홈페이지/클래스 페이지 하단에는 승인된 리뷰를 보여주는 작은 쇼케이스만 둔다. 실제 작성 폼은 메시지의 고유 링크로만 열리는 `/review#<token>` 전용 페이지로 분리한다. Appwrite의 별도 review API가 완료된 예약과 토큰을 검증하고 리뷰·사진·쿠폰을 발급하며, 기존 reservation API가 다음 주문에서 쿠폰을 서버 측으로 검증하고 예약 생성과 쿠폰 사용 처리를 원자적으로 수행한다.

**Tech Stack:** React 19, TypeScript, Vite, Appwrite Databases/Functions/Storage, Node test runner, existing CSS design system

---

## 1. 확정할 MVP 운영 규칙

구현 기본값은 아래와 같이 잡는다. john/Jenny 확인 후 숫자나 범위만 바꾸고 구조는 유지한다.

1. 리뷰 대상
   - 케이크: 상태가 `픽업완료`인 예약만 링크 발급 가능
   - 클래스: 상태가 `Completed`인 예약만 링크 발급 가능
   - 예약 1건당 리뷰 1개, 쿠폰 1개
2. 리워드
   - 텍스트 리뷰: 5%
   - 사진 1장 이상이 첨부된 리뷰: 10%
   - 별점이나 긍정/부정 내용은 할인율과 무관
   - 발급 후 60일 동안 유효
   - 다음 케이크 주문 1회에만 사용
   - 다른 프로모션과 중복 사용 불가
   - 모든 현재 케이크 상품에 사용 가능
   - 클래스 결제에는 MVP에서 사용하지 않음
3. 리뷰 링크
   - 운영자가 관리자 화면에서 `Copy review request`를 눌러 메시지를 복사해 직접 전송
   - 링크 발급 후 30일 동안 리뷰 작성 가능
   - URL fragment 사용: `https://au.verygood-chocolate.com/review#<token>`
   - fragment는 일반적인 서버 접근 로그와 referrer에 포함되지 않음
4. 사진
   - JPG, PNG, WebP만 허용
   - 브라우저에서 긴 변 1600px 이하 WebP로 압축
   - 최종 업로드 최대 1.5MB
   - 한 리뷰당 최대 3장 대신 MVP는 1장으로 제한
   - 얼굴, 아이 이름표, 주소 등 개인정보가 보이지 않는 케이크/작품 사진을 권장
5. 공개
   - 리뷰 제출과 쿠폰 발급은 즉시 완료
   - 홈페이지 공개 여부는 쿠폰 발급과 무관
   - 고객이 `사이트에 리뷰/사진 공개 허용`을 선택한 리뷰만 공개 후보
   - 관리자 검토는 개인정보·욕설·스팸·부적절한 사진만 확인하며, 부정적인 내용이라는 이유로 보상을 취소하지 않음
   - 공개 리뷰에는 `Incentivised review` 표시

### 호주 리뷰 인센티브 원칙

ACCC 안내에 맞춰 다음 문구와 로직을 제품 요구사항으로 취급한다.

- 인센티브는 긍정적인 리뷰에만 제공하면 안 된다.
- 긍정/부정과 무관하게 동일한 기준으로 제공한다.
- 인센티브를 받은 리뷰임을 소비자가 알 수 있게 명확히 공개한다.

리뷰 폼의 고정 안내 문구:

> Your reward is based only on whether you include a photo, not on your rating or whether your review is positive or negative. Published reviews will be labelled as incentivised.

참고: https://www.accc.gov.au/business/advertising-and-promotions/online-reviews-for-product-and-services

---

## 2. 권장 화면 배치

### 홈페이지 `/`

현재 마지막 순서:

1. 상품
2. 주문 방법
3. 케이크 정보
4. FAQ
5. Pickup location

권장 순서:

1. 상품
2. 주문 방법
3. 케이크 정보
4. FAQ
5. **From our customers 리뷰 쇼케이스**
6. Pickup location

리뷰 섹션은 3개 카드까지만 보여준다. 별점, 짧은 본문, 주문 종류, 선택적 사진, `Verified order`, `Incentivised review`를 표시한다. 리뷰가 0개면 섹션 자체를 숨겨 빈 상태가 홈페이지에 보이지 않게 한다.

### 클래스 페이지 `/classes`

페이지 하단 CTA 직전에 클래스 리뷰만 최대 3개 표시한다. 케이크 리뷰와 시각 언어는 같게 유지하되 `Verified class booking`으로 구분한다.

### 리뷰 작성 `/review#<token>`

홈페이지 안에 폼을 직접 넣지 않는다. 메시지를 받은 실제 고객만 접근하는 집중형 전용 페이지로 만든다.

표시 순서:

1. `Tell us how it went`
2. 검증된 주문 종류와 날짜(이름·전화번호·아이 이름은 노출하지 않음)
3. 별점 1–5
4. 리뷰 본문
5. 선택 사진 1장
6. 사이트 공개 동의(선택)
7. 인센티브 고지
8. 제출
9. 성공 화면: 5% 또는 10% 일회용 코드, 만료일, `Copy code`, `Order again`

유효하지 않거나 이미 사용된 링크에는 예약 존재 여부를 추측할 수 없는 동일한 오류 화면을 표시한다.

### 관리자

- `/admin/reservations`: `픽업완료` 예약 상세에 `Copy review request`
- `/admin/classes`: `Completed` 예약 상세에 `Copy review request`
- `/admin/reviews`: 대기/공개/숨김 목록, 개인정보 검토, 공개 상태 변경

자동 SMS/이메일 발송은 MVP 범위 밖이다. 현재 운영 방식에 맞춰 복사 후 Jenny가 직접 전송한다.

---

## 3. 데이터 모델

모든 리뷰/쿠폰 데이터는 `APPWRITE_CAKE_DATABASE_ID` 아래 중앙 관리한다. 클래스 예약 DB가 별도여도 source reference로 연결한다.

### `review_invites`

- `sourceType`: enum `cake | class`
- `sourceReservationId`: string, required
- `sourceReservationNumber`: string, required
- `tokenHash`: string(64), required, unique
- `expiresAt`: datetime/string, required
- `usedAt`: datetime/string, optional
- `createdByUserId`: string, required
- `createdAt`: datetime/string, required
- unique index: `sourceType + sourceReservationId`

원문 토큰은 DB에 저장하지 않는다. 32-byte random token을 URL에 넣고 SHA-256 hash만 저장한다.

### `reviews`

- `sourceType`: enum `cake | class`
- `sourceReservationId`: string, required
- `sourceReservationNumber`: string, required
- `rating`: integer 1–5
- `body`: string(2000), required
- `photoFileId`: string, optional
- `displayName`: string(50), optional
- `publishConsent`: boolean, required
- `moderationStatus`: enum `pending | published | hidden`
- `rewardPercent`: integer, `5 | 10`
- `couponId`: string, required
- `createdAt`, `updatedAt`
- unique index: `sourceType + sourceReservationId`

전화번호, 이메일, 아이 이름, 알레르기 정보는 복사하지 않는다.

### `review_coupons`

- `codeHash`: string(64), required, unique
- `codeLast4`: string(4), 운영 확인용
- `rewardPercent`: integer, `5 | 10`
- `scope`: enum `cake`
- `status`: enum `active | redeemed | expired | revoked`
- `sourceReviewId`: string, required, unique
- `expiresAt`: datetime/string, required
- `redeemedAt`: datetime/string, optional
- `redeemedReservationId`: string, optional
- `createdAt`: datetime/string, required

고객에게 보여줄 원문 코드는 발급 응답에서 한 번 반환한다. 예: `VG10-K7M4-PQ9X`. DB에는 hash와 마지막 4자리만 둔다.

### 기존 `reservations` 추가 필드

- `subtotalCents`: integer, optional
- `discountPercent`: integer, optional
- `discountCents`: integer, optional
- `appliedPromoCodeLast4`: string, optional
- `reviewCouponId`: string, optional

기존 예약은 필드가 없어도 정상 표시되어야 한다. 더 이상 프로모션 감사 기록을 `requestNote` 문자열에만 의존하지 않는다.

### `review-photos` Storage bucket

- 최대 파일 크기 1.5MB
- 확장자: jpg, jpeg, png, webp
- 공개 읽기 금지 기본값
- review API만 생성
- `published` + 공개 동의를 받은 사진만 공개용 조회 경로에서 제공

---

## 4. API 및 보안 경계

### 새 Appwrite Function: `review-api`

Actions:

1. `create-invite`
   - 관리자 인증 사용자만 허용
   - `REVIEW_ADMIN_USER_IDS` server env allowlist 확인
   - 원본 예약을 서버에서 읽고 완료 상태 검증
   - 기존 미사용 invite가 있으면 재사용 또는 새 만료일로 rotate
   - 원문 token은 응답에서만 반환
2. `load-invite`
   - token hash로 invite 조회
   - 만료/사용 여부 확인
   - 주문 종류와 완료 날짜만 반환
   - PII 미반환
3. `submit-review`
   - token 재검증
   - rating/body/동의/사진 magic bytes와 MIME 검증
   - 리뷰, 사진, 쿠폰, invite used 처리를 transaction으로 묶음
   - 사진 성공 여부로 서버가 5%/10% 결정
   - 일회용 원문 쿠폰과 만료일 반환
4. `list-public-reviews`
   - `published + publishConsent`만 반환
   - displayName, rating, body, sourceType, approved photo URL, incentive label만 반환
5. `list-admin-reviews`, `moderate-review`
   - 관리자 인증/allowlist 필수
   - 공개/숨김 상태와 운영 메모를 관리

공통:

- raw token, 쿠폰 원문, 고객 PII를 로그에 남기지 않는다.
- 오류 응답은 `REVIEW_LINK_INVALID`, `REVIEW_ALREADY_SUBMITTED`처럼 제한한다.
- token 비교는 hash 기반으로 한다.
- 리뷰 제출은 reservation당 unique index와 transaction으로 중복 방지한다.
- review API 요청 크기는 사진 포함 최대치만 허용하고, 다른 action은 작은 payload 제한을 유지한다.

### 기존 `reservation-api`

추가/변경:

1. `validate-promo`
   - 입력 code hash 조회
   - active, scope, Sydney 기준 만료 확인
   - 할인율만 반환하며 review/source 정보는 반환하지 않음
2. `create-cake`
   - static campaign code와 review coupon을 한 promo engine에서 구분
   - 중복 사용 거부
   - subtotal과 discount를 cents로 계산
   - 예약 생성 + coupon redeemed update를 Appwrite transaction으로 묶음
   - 예약 생성 실패 시 coupon은 active 상태 유지
3. idempotency
   - 동일 requestId 재시도는 기존 예약을 반환
   - 이미 해당 예약에 연결된 coupon이면 성공 재시도로 처리
   - 다른 예약에서 사용된 coupon은 `PROMO_ALREADY_USED`

프론트 계산은 미리보기일 뿐이며 최종 할인율과 사용 처리는 항상 server authoritative로 한다.

---

## 5. 구현 작업

### Task 1: Review/Reward 도메인 타입과 순수 규칙

**Objective:** 리뷰 상태, reward percent, coupon expiry, 공개 DTO를 타입과 순수 함수로 고정한다.

**Files:**
- Create: `src/lib/reviews.ts`
- Modify: `src/lib/types.ts`
- Create: `tests/reviews.test.ts`
- Modify: `package.json`

**TDD cases:**

- 사진 없음 → 5
- 유효한 사진 있음 → 10
- rating 1과 rating 5가 동일 기준으로 reward 결정
- 30일 invite expiry와 60일 coupon expiry는 Australia/Sydney 날짜 기준
- 공개 DTO에서 reservation id/number, phone, email, child name이 제거됨
- display name이 비면 `Verified cake order` 또는 `Verified class booking`

**Commands:**

```bash
npm run test:reviews
```

Expected: all review domain tests pass.

---

### Task 2: Appwrite schema와 Storage 정의

**Objective:** review invites/reviews/coupons collections와 review photo bucket을 idempotent하게 생성한다.

**Files:**
- Modify: `scripts/setup-appwrite.mjs`
- Modify: `src/lib/appwrite.ts`
- Modify: `.env.example` if tracked
- Modify: `README.md`

**Steps:**

1. 새 collection/bucket env ID를 추가한다.
2. attributes와 unique/query indexes를 정의한다.
3. public create/update/read permission을 주지 않는다.
4. 기존 reservations에 optional audit fields를 추가한다.
5. setup dry inspection 후 실제 production migration은 별도 승인 단계로 남긴다.

**Verification:**

- 로컬 코드 lint/build
- 실제 Appwrite 적용 전에는 변경 예정 리소스와 권한을 출력하는 dry-run 지원
- production migration은 john 승인 없이는 실행하지 않음

---

### Task 3: Review API 핵심 비즈니스 로직

**Objective:** token, validation, sanitisation, coupon generation을 DB와 분리된 순수 함수로 먼저 구현한다.

**Files:**
- Create: `functions/review-api/src/business.js`
- Create: `functions/review-api/src/main.js`
- Create: `functions/review-api/package.json`
- Create: `tests/review-api.test.mjs`
- Modify: `package.json`

**TDD cases:**

- 완료 전 cake/class 예약은 invite 발급 거부
- 완료 예약은 32-byte token 발급, DB에는 SHA-256 hash만 저장
- 만료/사용 token은 동일한 invalid response
- body 길이/rating/type 검증
- 별점/감정과 무관하게 사진 유무만 reward를 결정
- 같은 예약의 동시 제출 중 하나만 성공
- raw token/coupon/PII가 API log payload에 포함되지 않음

**Command:**

```bash
npm run test:review-api
```

---

### Task 4: Review API deployment script

**Objective:** 기존 Function 배포 패턴을 재사용해 review-api를 안전하게 배포할 수 있게 한다.

**Files:**
- Create: `scripts/deploy-review-api.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Requirements:**

- 기존 `scripts/deploy-reservation-api.mjs` 패턴 재사용
- required env의 존재만 확인하고 값은 출력하지 않음
- `REVIEW_ADMIN_USER_IDS` 필수
- 배포와 DB 권한 변경은 분리
- Function이 `ready`가 되기 전 프론트 배포 금지

---

### Task 5: 관리자 리뷰 링크 발급/메시지 복사

**Objective:** 완료된 예약 상세에서 검증된 리뷰 초대 링크를 복사한다.

**Files:**
- Modify: `src/App.tsx`
- Create: `src/lib/review-messages.ts`
- Create: `tests/review-messages.test.ts`
- Modify: `src/index.css`

**Cake message:**

```text
Hi {firstName}, thank you again for ordering from Verygood Chocolate.

We’d love to hear how your cake was. An honest review earns 5% off your next cake order, or 10% if you include a cake photo. The reward is the same whether your review is positive or negative.

Write your review: {uniqueLink}
The link is valid for 30 days.
```

**Class message:**

```text
Hi {firstName}, thank you for joining Jenny’s cake class.

We’d love to hear how the class went. An honest review earns 5% off your next cake order, or 10% if you include a photo of the finished cake. The reward is the same whether your review is positive or negative.

Write your review: {uniqueLink}
The link is valid for 30 days.
```

**Verification:**

- 완료 상태에서만 버튼 표시
- 발급 중 중복 클릭 방지
- exact full-string message tests
- token이 화면/console에 불필요하게 남지 않음

---

### Task 6: 전용 review page

**Objective:** 모바일 우선 리뷰 작성과 쿠폰 수령 흐름을 만든다.

**Files:**
- Modify: `src/App.tsx` (`Page`, route, render)
- Create: `src/ReviewPage.tsx`
- Create: `src/lib/review-repository.ts`
- Modify: `src/index.css`
- Modify: `src/lib/seo.ts`
- Modify: `scripts/generate-seo-pages.mjs`
- Modify: `public/sitemap.xml` only if route policy requires; `/review` itself is noindex and sitemap 제외

**States:**

- loading
- valid invite
- invalid/expired/used
- submit in progress
- submitted with 5% coupon
- submitted with 10% coupon
- retryable network error without duplicate review/coupon

**Verification:**

- 320px, 360px, 390px
- keyboard-only rating control
- photo preview 제거/재선택
- refresh/back 후 중복 발급 없음
- `/review` is `noindex, nofollow`
- URL token fragment가 analytics event parameter에 포함되지 않음

---

### Task 7: 사진 압축·검증·저장

**Objective:** 사진 리뷰가 빠르고 안전하게 제출되도록 한다.

**Files:**
- Create: `src/lib/review-photo.ts`
- Create: `tests/review-photo.test.ts`
- Modify: `functions/review-api/src/business.js`
- Modify: `functions/review-api/src/main.js`

**Requirements:**

- EXIF orientation 반영 후 canvas resize
- WebP output, long edge <= 1600px, <= 1.5MB
- 서버에서 MIME 선언만 믿지 않고 magic bytes 확인
- SVG/GIF/PDF/실행 파일 거부
- 실패한 transaction의 orphan photo 정리
- 공개 동의가 없는 사진은 public endpoint에서 반환 금지

---

### Task 8: Dynamic one-time coupon을 기존 주문 가격에 통합

**Objective:** 모든 케이크 상품에서 review coupon을 정확히 적용하고 한 번만 사용한다.

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/repository.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/App.tsx`
- Modify: `functions/reservation-api/src/business.js`
- Modify: `functions/reservation-api/src/main.js`
- Modify: `tests/cake-options.test.ts`
- Modify: `tests/reservation-api.test.mjs`
- Modify: `scripts/setup-appwrite.mjs`

**TDD cases:**

- 5% coupon, 10% coupon의 cent rounding
- 모든 active cake product에서 사용 가능
- class booking에는 적용되지 않음
- expired/revoked/redeemed coupon 거부
- static promo와 중복 거부
- 잘못된 code는 할인 없이 조용히 제출하지 않고 명확한 UI 오류
- reservation create 실패 시 coupon active 유지
- 성공 시 coupon redeemed + reservation audit fields 일치
- 동일 requestId 재시도는 이중 사용으로 오판하지 않음

**UI change:**

현재 `isPromoEligibleProduct()`가 일부 기간 프로모션 상품에서만 promo field를 노출한다. 이를 모든 케이크 상품에 보이도록 바꾸되 `Promo or reward code`로 이름을 바꾸고 서버 validation 결과를 표시한다.

---

### Task 9: 공개 리뷰 쇼케이스

**Objective:** 홈페이지와 클래스 페이지 하단에 검증·공개 승인된 리뷰만 표시한다.

**Files:**
- Create: `src/ReviewShowcase.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Modify: `src/lib/review-repository.ts`

**Requirements:**

- 홈페이지: cake/class 혼합 최신 3개
- 클래스 페이지: class 리뷰 최신 3개
- 0개면 section 미렌더링
- 사진은 lazy load, 고정 aspect ratio, object-fit cover
- `Verified order`/`Verified class booking`
- `Incentivised review` 항상 표시
- 리뷰 원문을 임의로 잘라 의미를 바꾸지 않음; 카드에서는 시각적으로 제한하더라도 접근 가능한 전체 본문 제공
- 별점 1–5 모두 같은 레이아웃

**Responsive verification:**

- 320/360: 1열 또는 horizontal scroll-snap
- desktop: 3열
- sticky order CTA/Chatwoot/language toggle과 충돌 없음

---

### Task 10: 관리자 리뷰 moderation page

**Objective:** 개인정보·스팸 검토와 공개 동의를 운영자가 관리한다.

**Files:**
- Modify: `src/App.tsx` (`admin-reviews` route)
- Create: `src/AdminReviewsPage.tsx`
- Modify: `src/index.css`
- Modify: `src/lib/seo.ts`
- Modify: `scripts/generate-seo-pages.mjs`

**Requirements:**

- admin auth 없으면 `/admin/login`으로 이동
- pending/published/hidden filter
- review 본문과 사진, source type, rating, reward percent 표시
- 고객 phone/email/child info 미표시
- `Publish`, `Hide`, `Restore to pending`
- publishConsent=false이면 Publish 버튼 비활성화
- moderation은 coupon 상태를 변경하지 않음

---

### Task 11: 전체 검증과 Tailscale preview

**Objective:** production을 건드리지 않고 고객/운영자 전체 흐름을 검증한다.

**Commands:**

```bash
npm test
npm run lint
VITE_MARKET=AU npm run build
git diff --check
```

**Browser flow:**

1. fixture 완료 케이크 예약 → admin invite 생성
2. `/review#token` → 텍스트 리뷰 → 5% 코드
3. 별도 fixture → 사진 리뷰 → 10% 코드
4. 홈페이지 공개 동의 전 미노출
5. admin publish 후 홈페이지 노출 및 incentive label 확인
6. reward code로 주문 가격 확인
7. 주문 생성 후 coupon 재사용 거부
8. 클래스 완료 예약 → class review → 클래스 페이지 노출
9. invalid/expired/used token 상태
10. 320, 360, 390, desktop에서 고정 CTA 충돌 확인
11. browser console에 error/PII/token 없음 확인

**Preview rule:**

- `/home/john/workspace/au-cake`에서 AU build
- very-server Tailscale 주소로만 먼저 공개
- john 확인 전 commit/push/Cloudflare deploy/Appwrite production migration을 하지 않음
- 검증이 끝나면 preview process 종료

---

## 6. 배포 순서

자동 배포되는 프론트가 먼저 나가면 안 된다.

1. 코드/테스트 완료
2. Appwrite review collections + Storage schema 적용
3. review-api 배포 및 health/test
4. backward-compatible reservation-api 배포
5. invalid test code로 no-write remote smoke test
6. Tailscale frontend preview
7. john/Jenny 실제 운영 문구·UI 확인
8. 프론트 배포
9. 실제 완료 예약 1건으로 invite 생성 테스트
10. 테스트 리뷰/쿠폰 사용 후 test records 정리

Rollback:

- 프론트에서 review entry와 promo validation UI 비활성화
- reservation-api는 기존 static promo path를 유지하되 review coupon lookup을 feature flag로 끔
- 이미 발급된 review coupon은 운영자가 수동으로 honour할 수 있도록 code last4/review record 보존

---

## 7. 명시적 비목표

- 자동 SMS/이메일/WhatsApp 발송
- Google Review에 자동 게시
- 리뷰 내용 AI 요약/감정 분석
- 포인트/회원 계정/다단계 loyalty program
- 여러 장 사진/동영상
- 리뷰 작성 후 사진을 추가해 5% → 10%로 업그레이드
- 클래스 예약 자체의 할인 코드 입력

---

## 8. 완료 조건

- 완료된 실제 예약만 리뷰 링크를 받을 수 있다.
- 동일 예약은 리뷰와 쿠폰을 한 번만 만든다.
- 별점이나 긍정/부정 여부는 보상에 영향을 주지 않는다.
- 텍스트 5%, 사진 10%가 서버에서 결정된다.
- coupon은 모든 케이크 상품에서 정확한 cents로 한 번만 적용된다.
- reservation create와 coupon redeem이 원자적이다.
- public review에는 incentive label이 보인다.
- 고객 PII와 child data가 public/admin review UI/API에 불필요하게 복사되지 않는다.
- 320px/360px 모바일, tests, lint, AU production build가 통과한다.
- john 승인 전 production migration/deploy/commit/push가 없다.
