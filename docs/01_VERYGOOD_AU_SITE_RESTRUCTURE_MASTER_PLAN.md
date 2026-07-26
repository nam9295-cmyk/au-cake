# Verygood Chocolate AU 사이트 구조 개편 전체 계획

- 작성일: 2026-07-26
- 적용 대상: `au.verygood-chocolate.com`
- 주 실행 담당: 베리서버의 Hermes
- 디자인 담당: Penpot MCP에 연결한 Antigravity 또는 Codex
- 연관 문서:
  - `02_CAKE_DETAIL_PAGE_PRODUCT_SPEC.md`
  - `03_CAKE_DETAIL_PAGE_DESIGN_PENPOT_SPEC.md`

---

## 1. 프로젝트 한 줄 목표

현재의 **메인페이지 → 예약페이지** 직행 구조를 다음처럼 바꾼다.

```text
메인페이지
→ 케이크 상세페이지
→ 사이즈·수량·픽업 희망일 등 옵션 선택
→ 선택값이 미리 채워진 예약 확인 페이지
→ 고객 정보 입력 및 요청 전송
→ 기존 Appwrite 예약 저장 로직
```

핵심은 **고객이 케이크를 충분히 이해한 뒤 예약하도록 만들되, 현재 Appwrite 데이터베이스와 예약 운영 방식은 최대한 유지하는 것**이다.

---

## 2. 현재 상태와 문제 정의

현재 공개 사이트는 다음 내용을 제공한다.

- Sydney의 소량 주문 제작 초콜릿 케이크 서비스
- Melrose Park에서 사전 약속된 픽업만 제공
- 워크인 매장과 배달은 제공하지 않음
- 현재 주요 상품:
  - Pavé Chocolate Cake: 15cm, 19cm, 22cm / AUD 75부터
  - Gâteau au Chocolat: AUD 45부터
  - Chocolate Cupcakes: 12개 AUD 55부터
- 고객이 요청을 보내면 Jenny가 가능 여부를 확인하고 결제 정보를 전달
- 결제 후 주문 확정 및 정확한 픽업 장소 전달

현재 구조의 문제는 다음과 같다.

1. 고객이 제품 사진, 단면, 맛, 크기, 보관법, 알레르기 정보를 충분히 확인하기 전에 예약폼으로 이동한다.
2. 상품 사이즈와 옵션을 예약페이지에서 다시 선택해야 할 가능성이 있다.
3. 케이크별 고유 URL이 없어 검색 노출과 공유가 약하다.
4. 가격 차이와 제품별 차별점이 충분히 설명되지 않는다.
5. `예약 요청`과 `주문 확정`의 차이를 고객이 오해할 수 있다.

---

## 3. 이번 개편에서 확정할 핵심 원칙

### 3.1 Appwrite는 상세페이지 제작 단계에서 건드리지 않는다

- 상세페이지, 상품 데이터, 옵션 선택, 예약페이지 자동 입력까지는 프론트엔드에서 먼저 완성한다.
- 고객이 최종 `Send cake request`를 누를 때만 기존 Appwrite 저장 로직을 사용한다.
- 기존 컬렉션이 선택값을 충분히 저장하지 못할 때만 마지막 통합 단계에서 최소 속성을 추가한다.
- UI가 확정되기 전에 데이터베이스 마이그레이션을 먼저 하지 않는다.

### 3.2 상품 정보는 우선 코드 내 단일 데이터 파일로 관리한다

현재 상품 수가 적으므로 상품용 Appwrite DB나 CMS를 새로 만들지 않는다.

권장 개념 구조:

```text
cake catalog data
├─ 홈페이지 상품 카드
├─ 케이크 목록 페이지
├─ 케이크 상세페이지
└─ 예약페이지 주문 요약
```

제품명, 가격, 사이즈, 이미지, 설명을 여러 페이지에 중복 작성하지 않는다.

### 3.3 가격은 URL에서 전달하지 않는다

예약 URL에는 상품 ID와 옵션 ID만 전달한다.

좋은 예:

```text
/reserve?cake=pave-chocolate-cake&size=15cm&qty=1&date=2026-08-15
```

나쁜 예:

```text
/reserve?cake=pave&size=15cm&price=75
```

고객이 주소를 수정할 수 있으므로 가격은 항상 상품 데이터에서 다시 계산한다.

### 3.4 쇼핑몰이 아니라 예약 요청형 스튜디오로 설계한다

이번 범위에 포함하지 않는 기능:

- 장바구니
- 회원가입과 로그인
- 즉시 온라인 결제
- 배송비 계산
- 재고 관리
- 할인쿠폰
- 대형 상품관리 CMS
- Appwrite 상품 데이터베이스
- 자동 예약 가능 시간 확정

고객에게 사용할 핵심 문구:

```text
View cake
Request this cake
Send cake request
```

사용하지 않을 문구:

```text
Buy now
Add to cart
Order confirmed
```

결제가 완료되기 전에는 주문이 확정된 것처럼 표현하지 않는다.

---

## 4. 목표 사이트 정보 구조

```text
/
├─ /cakes
├─ /cakes/pave-chocolate-cake
├─ /cakes/gateau-au-chocolat
├─ /cakes/chocolate-cupcakes
├─ /reserve
├─ /how-it-works        선택 사항: 콘텐츠가 충분할 때 분리
├─ /faq                 선택 사항: 공통 FAQ가 늘어날 때 분리
└─ /classes             기존 클래스 페이지 유지
```

### 메인 내비게이션 권장안

```text
Cakes
How it works
Classes
FAQ
Instagram
[Request a cake]
```

상품이 적은 초기에는 `Shop`, `Collections`, `Best Sellers`처럼 규모가 큰 쇼핑몰 메뉴를 만들지 않는다.

---

## 5. 목표 고객 흐름

### 5.1 기본 흐름

```text
1. 고객이 메인페이지에서 케이크 사진을 본다.
2. `View cake`를 눌러 상세페이지로 이동한다.
3. 사진, 맛, 사이즈, 가격, 픽업 조건을 확인한다.
4. 사이즈, 수량, 픽업 희망일, 메시지 옵션을 선택한다.
5. `Request this cake`를 누른다.
6. 예약페이지에서 선택 내용이 자동으로 채워진 것을 확인한다.
7. 이름, 전화번호, 이메일, 실제 케이크 문구, 추가 요청을 입력한다.
8. `Send cake request`를 누른다.
9. 기존 Appwrite 예약 저장 로직으로 요청이 저장된다.
10. 완료 화면에서 아직 확정 주문이 아님을 명확히 안내한다.
```

### 5.2 예약페이지 직접 진입 흐름

기존 링크나 검색 결과를 통해 `/reserve`로 직접 들어오는 고객도 막지 않는다.

- 쿼리 파라미터가 있으면 선택값을 자동 입력한다.
- 쿼리 파라미터가 없으면 기존처럼 고객이 제품과 옵션을 직접 선택할 수 있게 한다.
- 잘못된 상품 ID나 사이즈가 들어오면 오류로 중단하지 않고 유효하지 않은 값만 제거한다.

---

## 6. 프론트엔드 데이터 구조

실제 경로와 문법은 현재 프로젝트 프레임워크와 라우터를 먼저 확인한 뒤 기존 방식에 맞춘다. 아래는 역할 기준의 권장 구조다.

```text
src/
├─ data/
│  └─ cakes.*
├─ lib/
│  ├─ cake-selection.*
│  ├─ reservation-url.*
│  └─ reservation-payload.*
├─ components/
│  └─ cake-detail/
│     ├─ CakeGallery.*
│     ├─ CakePurchasePanel.*
│     ├─ CakeOptionSelector.*
│     ├─ CakeOrderSummary.*
│     ├─ CakeFeatureGrid.*
│     ├─ CakeLayerStory.*
│     ├─ CakeTasteProfile.*
│     ├─ CakeSizeGuide.*
│     ├─ CakeInfoAccordion.*
│     └─ MobileRequestBar.*
└─ routes 또는 pages/
   ├─ cakes/
   └─ reserve/
```

프레임워크가 React가 아니거나 현재 구조가 다르면 디렉터리를 억지로 바꾸지 말고 같은 책임만 유지한다.

### 6.1 권장 상품 데이터 형태

```ts
interface CakeProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  basePrice: number;
  currency: "AUD";
  status: "available" | "seasonal" | "unavailable";
  sizes: CakeSizeOption[];
  images: CakeImage[];
  features: CakeFeature[];
  layers: CakeLayer[];
  tasteProfile?: TasteProfile;
  allergens: string[];
  dietaryNotes: string[];
  storage: string;
  serving: string;
  pickup: string;
  minimumNotice: string;
  faq: FaqItem[];
  seo: ProductSeo;
}

interface CakeSizeOption {
  id: string;
  label: string;
  serves: string;
  price: number;
}
```

### 6.2 선택 상태

상세페이지에서 필요한 최소 선택값:

```ts
interface CakeSelection {
  cakeId: string;
  sizeId: string;
  quantity: number;
  preferredPickupDate: string;
  messageOption: "none" | "cake-message";
}
```

실제 메시지 문구, 고객 이름, 전화번호, 이메일, 추가 요청사항은 예약페이지에서 입력한다.

### 6.3 URL 전달 규칙

권장 파라미터:

```text
cake     상품 ID 또는 slug
size     사이즈 옵션 ID
qty      수량, 기본값 1
date     YYYY-MM-DD
message  none 또는 yes
```

실제 주소 예시:

```text
/reserve?cake=pave-chocolate-cake&size=15cm&qty=1&date=2026-08-15&message=yes
```

전달하지 않을 값:

- 가격
- 고객 이름
- 전화번호
- 이메일
- 긴 메모
- 결제 정보

### 6.4 예약페이지 검증 규칙

예약페이지는 URL 값을 그대로 신뢰하지 않는다.

1. `cake`가 상품 데이터에 존재하는지 확인한다.
2. `size`가 해당 상품에 존재하는지 확인한다.
3. `qty`를 허용 범위 내 정수로 변환한다.
4. 날짜가 올바른 ISO 형식인지 확인한다.
5. 가격은 검증된 상품과 사이즈로 다시 계산한다.
6. 무효한 값은 제거하고 고객에게 해당 항목만 다시 선택하게 한다.

---

## 7. Appwrite 통합 전략

### 7.1 지금 유지할 것

- 현재 Appwrite 프로젝트와 인증 방식
- 현재 예약 요청 생성 함수
- 현재 성공·실패 처리 방식
- 현재 알림 또는 이메일 연동이 있다면 그대로 유지

### 7.2 새 UI와 Appwrite 사이에 어댑터를 둔다

상세페이지나 예약 UI가 Appwrite SDK를 직접 호출하지 않게 한다.

```text
UI selection + customer form
→ buildReservationPayload()
→ existing Appwrite create request function
```

이렇게 하면 UI 데이터 이름이 바뀌어도 Appwrite 로직을 한곳에서 조정할 수 있다.

### 7.3 DB 스키마 확인 시점

DB 확인은 다음 기능이 모두 동작한 뒤 실시한다.

- 상세페이지 렌더링
- 옵션 선택
- 예약 URL 생성
- 예약페이지 자동 입력
- 가격 재계산
- 고객용 주문 요약

그 후 기존 컬렉션이 아래 값을 이미 저장하는지 확인한다.

```text
productId
productName
size
quantity
estimatedPrice
currency
pickupDate
cakeMessage
customerName
phone
email
notes
status
createdAt
```

기존 필드로 충분하면 DB를 변경하지 않는다. 부족할 때도 새 UI가 실제로 필요로 하는 값만 최소 추가한다.

### 7.4 주문 상태 권장안

현재 상태 체계가 이미 있으면 유지한다. 새로 정리해야 할 때만 다음 의미를 사용한다.

```text
requested               요청 접수
availability_confirmed  제작 가능 여부 확인
confirmed               결제 완료, 주문 확정
completed               픽업 완료
cancelled               취소
```

초기 저장 상태는 반드시 `requested`이며 `confirmed`가 아니다.

---

## 8. 단계별 실행 계획

## Phase 0. 안전한 작업 준비와 현황 감사

### 작업

- 현재 저장소와 배포 방식을 확인한다.
- 사용 프레임워크, 라우터, 스타일 방식, 테스트 방식, 빌드 명령을 기록한다.
- 현재 홈페이지, 예약페이지, Appwrite 호출 위치를 찾는다.
- 현재 아이보리, 그린, 레드, 글꼴, 버튼, 카드 스타일의 실제 토큰을 추출한다.
- 현재 브랜치에서 직접 작업하지 않고 기능 브랜치를 만든다.
- 작업 전 현재 사이트의 데스크톱·모바일 캡처를 보관한다.

### 완료 기준

- 기존 예약 흐름이 어디서 시작하고 Appwrite에 어디서 저장되는지 설명할 수 있다.
- 변경 예정 파일과 유지할 파일이 분리되어 있다.
- 현재 빌드와 테스트가 작업 전 상태에서 통과한다.

### 금지

- 이 단계에서 Appwrite 스키마 변경
- 전체 프로젝트 리팩터링
- 현재 디자인 토큰 임의 교체

---

## Phase 1. 상품 데이터 단일화

### 작업

- 케이크 상품 데이터 파일을 만든다.
- 우선 Pavé Chocolate Cake 데이터를 완성한다.
- 홈페이지의 기존 상품 카드가 가능하면 동일 데이터에서 제품명과 가격을 읽도록 바꾼다.
- 가격 계산 함수와 상품 조회 함수를 분리한다.

### 완료 기준

- 상품명과 가격이 한 파일에서만 관리된다.
- 존재하지 않는 상품이나 사이즈에 대해 안전한 결과를 반환한다.
- URL에서 들어온 가격을 사용하지 않는다.

---

## Phase 2. 공통 상세페이지 템플릿 제작

### 작업

- `/cakes/[slug]`에 해당하는 공통 상세 템플릿을 만든다.
- 첫 구현 상품은 `pave-chocolate-cake`로 한다.
- Penpot 승인 디자인을 기준으로 데스크톱과 모바일을 구현한다.
- 상세페이지의 섹션, 문구, 상호작용은 `02`와 `03` 문서를 따른다.
- 상품이 없으면 사이트 공통 404 또는 케이크 목록으로 안전하게 안내한다.

### 완료 기준

- 하나의 템플릿이 상품 데이터만 바꿔 여러 상품에 재사용된다.
- 모바일 390px 전후부터 데스크톱까지 레이아웃이 깨지지 않는다.
- 주요 정보가 첫 화면 또는 첫 두 화면 안에 보인다.

---

## Phase 3. 옵션 선택과 예약 URL 생성

### 작업

- 사이즈 선택을 필수로 한다.
- 수량 기본값은 1로 한다.
- 픽업 희망일을 선택하게 한다.
- 메시지 필요 여부만 상세페이지에서 선택하게 한다.
- 실제 메시지 문구는 예약페이지에서 입력하게 한다.
- 유효한 선택이 완료되기 전에는 CTA를 비활성화하거나 누락 항목을 명확히 안내한다.
- `Request this cake` 클릭 시 검증된 URL을 만든다.

### 완료 기준

- 새로고침과 뒤로 가기 후에도 브라우저의 일반 동작이 자연스럽다.
- 주소에 가격이 포함되지 않는다.
- 키보드만으로 옵션을 선택할 수 있다.
- 사이즈를 바꾸면 표시 가격과 예상 인원이 즉시 갱신된다.

---

## Phase 4. 예약페이지 자동 입력과 최종 확인 UX

### 작업

- 예약페이지가 쿼리 파라미터를 읽는다.
- 상품 데이터로 검증한 뒤 주문 요약을 표시한다.
- 선택한 제품 사진, 제품명, 사이즈, 인원수, 수량, 픽업 희망일, 예상 가격을 보여준다.
- `Change selection`으로 상세페이지에 돌아가 수정할 수 있게 한다.
- 고객은 이름, 전화번호, 이메일, 실제 케이크 문구, 추가 요청을 입력한다.
- 알레르기 및 예약 확정 조건 확인을 받는다.
- 직접 `/reserve`에 온 고객을 위한 수동 선택 기능을 유지한다.

### 완료 기준

- 상세페이지에서 고른 옵션을 예약페이지에서 다시 고를 필요가 없다.
- 잘못된 파라미터가 있어도 페이지 전체가 실패하지 않는다.
- 고객이 제출 전에 모든 선택값을 한눈에 확인한다.
- 예약 요청과 확정 주문의 차이가 CTA 근처에 표시된다.

---

## Phase 5. 기존 Appwrite 제출 연결

### 작업

- 검증된 주문 선택과 고객 정보를 하나의 payload로 만든다.
- 기존 Appwrite 생성 함수를 통해 저장한다.
- 중복 클릭 방지를 위해 제출 중 버튼을 비활성화한다.
- 성공과 실패 상태를 명확히 제공한다.
- 저장된 문서가 실제 선택값과 일치하는지 검증한다.
- 이 시점에만 기존 스키마가 부족한지 판단한다.

### 성공 화면 필수 문구

```text
Your request has been received.

This is not yet a confirmed order.
Jenny will check availability and contact you with payment details.
Your order is confirmed after payment.
```

### 완료 기준

- Appwrite에 요청이 한 번만 생성된다.
- 상품, 사이즈, 수량, 날짜, 예상 가격이 올바르게 저장된다.
- 네트워크 오류 때 재시도할 수 있으며 입력값이 사라지지 않는다.

---

## Phase 6. 홈페이지와 사이트 이동 구조 변경

### 작업

- 홈페이지 상품 카드의 주 CTA를 `View cake`로 바꾼다.
- 상품 카드가 각 상세페이지로 연결되게 한다.
- 헤더의 `Request a cake`는 예약페이지 직접 진입용 보조 경로로 유지한다.
- 메인 히어로 CTA는 `Explore our cakes`를 우선 사용한다.
- 기존 클래스 페이지와 링크가 깨지지 않는지 확인한다.

### 완료 기준

```text
홈 → 상세 → 예약 → 요청 완료
```

전체 흐름이 자연스럽고, 기존 `/reserve` 링크도 계속 작동한다.

---

## Phase 7. 나머지 제품 확장

### 적용 순서

1. Pavé Chocolate Cake
2. Gâteau au Chocolat
3. Chocolate Cupcakes
4. 이후 Basque Cheesecake, Lemon Cakes 등 실제 판매 확정 상품

### 원칙

- 새로운 페이지를 복사해 별도 구현하지 않는다.
- 같은 템플릿에 상품 데이터와 사진만 추가한다.
- 제품별로 다른 옵션이 필요하면 공통 데이터 구조에서 선택적으로 표현한다.

---

## Phase 8. SEO, 성능, 접근성 마감

### SEO

- 케이크별 고유 title과 description
- canonical URL
- Open Graph 이미지
- Product 및 Breadcrumb 구조화 데이터 검토
- 실제 페이지에 보이는 정보와 구조화 데이터 일치
- `Sydney`, `Melrose Park`, `made-to-order chocolate cake`를 자연스럽게 사용

### 성능

- 대표 이미지는 적절한 크기로 preload 또는 우선 로딩
- 아래쪽 이미지는 lazy loading
- WebP 또는 AVIF 활용
- 모바일용 `srcset` 제공
- 전체 페이지를 하나의 거대한 이미지로 만들지 않음
- 과도한 스크롤 애니메이션 금지

### 접근성

- 모든 폼 요소에 실제 label 연결
- 옵션 그룹에 fieldset/legend 또는 동등한 시맨틱 적용
- 포커스 표시 유지
- 이미지 alt 작성
- 색상만으로 선택 상태를 구분하지 않음
- 버튼 최소 터치 영역 44×44px
- 아이보리/그린/레드 조합의 텍스트 대비 확인

---

## Phase 9. 출시와 관찰

### 출시 전

- 스테이징 또는 프리뷰 URL에서 Jenny와 John 확인
- 실제 휴대폰에서 iPhone Safari, Android Chrome 확인
- 테스트 요청을 Appwrite에 저장하고 운영 화면에서 확인
- 기존 사이트 링크와 QR이 정상 작동하는지 확인
- 주문 완료 메시지와 이메일이 정확한지 확인

### 출시 후 확인

- 404 및 자바스크립트 오류
- 상세페이지에서 예약페이지 이동률
- 예약폼 이탈 지점
- 고객이 반복해서 묻는 질문
- 이미지 로딩 속도
- 잘못된 날짜 요청 빈도

초기에는 복잡한 분석 도구를 새로 붙이기보다 기존 분석 도구가 있다면 다음 이벤트만 추가한다.

```text
cake_detail_view
cake_option_selected
cake_request_started
cake_request_submitted
```

---

## 9. 테스트 계획

### 9.1 단위 테스트

- 올바른 slug로 상품 조회
- 없는 slug 처리
- 상품과 사이즈의 조합 검증
- 가격 재계산
- 수량 범위 검증
- 날짜 형식 검증
- 예약 URL 생성
- URL에서 가격을 무시하는지 검증
- Appwrite payload 매핑

### 9.2 통합 테스트

```text
홈 상품 카드 클릭
→ 상세페이지 진입
→ 15cm 선택
→ 날짜 선택
→ 예약페이지 이동
→ 선택값 자동 입력 확인
→ 고객 정보 입력
→ 제출
→ Appwrite 문서 확인
```

### 9.3 필수 예외 테스트

- 존재하지 않는 cake 값
- 다른 상품의 size 값
- qty가 0, 음수, 문자, 지나치게 큰 값
- 잘못된 날짜 형식
- 과거 날짜
- 옵션 없이 CTA 클릭
- 네트워크 실패
- 제출 버튼 연속 클릭
- 예약페이지 새로고침
- `/reserve` 직접 접속

### 9.4 시각 회귀 확인

- 390px 모바일
- 768px 태블릿
- 1024px 작은 데스크톱
- 1440px 데스크톱
- 긴 제품명과 긴 FAQ
- 이미지 로딩 실패 상태

---

## 10. 프로젝트 완료 기준

아래 항목이 모두 충족되어야 전체 개편이 완료된 것으로 본다.

- [ ] 홈페이지 상품 카드가 상세페이지로 연결된다.
- [ ] 각 케이크가 독립된 URL을 가진다.
- [ ] Pavé 상세페이지가 승인된 Penpot 디자인과 일치한다.
- [ ] 상세페이지에서 사이즈, 수량, 날짜를 선택할 수 있다.
- [ ] 선택값이 예약페이지에 자동 입력된다.
- [ ] 고객은 예약페이지에서 내용을 수정하거나 확인할 수 있다.
- [ ] 가격이 URL에 의존하지 않는다.
- [ ] 기존 Appwrite 요청 저장이 정상 작동한다.
- [ ] 요청 완료가 주문 확정으로 오해되지 않는다.
- [ ] `/reserve` 직접 접근도 계속 작동한다.
- [ ] 모바일 고정 CTA가 콘텐츠를 가리지 않는다.
- [ ] 키보드와 스크린리더로 주요 흐름을 사용할 수 있다.
- [ ] 현재 아이보리·그린·빨강 하트 톤앤매너가 유지된다.
- [ ] 장바구니, 결제, 상품 DB 같은 불필요한 기능을 추가하지 않았다.

---

## 11. 롤백 전략

- 기존 `/reserve` 페이지를 제거하지 않는다.
- 홈페이지 카드 링크 변경은 한 번에 되돌릴 수 있게 작은 커밋으로 분리한다.
- 새 상세페이지에 문제가 생기면 홈 CTA를 기존 `/reserve`로 되돌린다.
- Appwrite 컬렉션을 변경해야 한다면 기존 속성을 삭제하거나 이름을 바꾸지 않고 새 속성만 추가한다.
- 배포 전에 현재 프로덕션 빌드 또는 태그를 보관한다.

---

## 12. Hermes 작업 규칙

1. 먼저 저장소와 현재 구현을 읽고 기존 패턴을 따른다.
2. 관련 없는 파일을 정리하거나 전면 리팩터링하지 않는다.
3. Appwrite 스키마는 Phase 5 전까지 변경하지 않는다.
4. 디자인 토큰을 임의로 새로 정하지 않고 현재 코드와 Penpot 값을 사용한다.
5. 상세페이지를 제품별 복사본으로 만들지 않는다.
6. 가격과 인원수의 단일 출처를 유지한다.
7. 모든 단계가 독립적으로 실행·확인 가능한 작은 커밋이 되게 한다.
8. 각 Phase 종료 시 빌드, 테스트, 모바일 확인 결과를 기록한다.
9. 제품 사실을 추측하지 않는다. 가격, 인원수, 알레르기, 보관법, 최소 예약 기간은 확정 데이터만 표시한다.
10. 기존 예약 기능을 깨뜨리지 않는 것을 새 기능 추가보다 우선한다.

---

## 13. Hermes에 전달할 시작 프롬프트

아래 문장을 이 문서들과 함께 전달한다.

```text
au.verygood-chocolate.com 프로젝트의 구조를 개편해줘.

먼저 아래 3개 문서를 순서대로 읽어.
1. 01_VERYGOOD_AU_SITE_RESTRUCTURE_MASTER_PLAN.md
2. 02_CAKE_DETAIL_PAGE_PRODUCT_SPEC.md
3. 03_CAKE_DETAIL_PAGE_DESIGN_PENPOT_SPEC.md

바로 코드를 수정하지 말고 먼저 현재 저장소를 감사해줘.
프레임워크, 라우터, 스타일 구조, 현재 디자인 토큰, 홈페이지 상품 카드,
/reserve 페이지, Appwrite 예약 생성 함수와 컬렉션 필드 사용 위치를 찾아서
변경 대상과 유지 대상을 짧은 감사 보고서로 정리해.

핵심 제약:
- 상세페이지와 예약 자동 입력을 먼저 만든다.
- Appwrite DB 스키마는 마지막 통합 단계 전까지 건드리지 않는다.
- 상품 정보는 우선 코드 내 단일 데이터 소스로 관리한다.
- URL에서 가격을 받지 않고 상품 데이터로 다시 계산한다.
- 장바구니, 회원, 즉시 결제, 상품 DB는 만들지 않는다.
- 현재 아이보리 배경, 그린 메인 컬러, 빨강 하트 포인트를 유지한다.
- 기존 /reserve 직접 접근과 클래스 페이지를 깨뜨리지 않는다.

감사 후 Phase 1부터 작은 단위로 진행하고, 각 Phase마다 빌드와 테스트 결과를 확인해.
Penpot MCP에서 완성된 디자인이 있으면 그 디자인의 컴포넌트, 간격, 토큰을 우선 적용해.
```

---

## 14. 참고 사이트

```text
현재 사이트
https://au.verygood-chocolate.com/

예약페이지
https://au.verygood-chocolate.com/reserve

구조 참고
https://enze.com.au/
https://enze.com.au/products/pistachio-raspberry-cream-cake
```

ENZE의 구매 영역, 큰 이미지 갤러리, 짧은 핵심 설명, 사이즈/인원 선택, `Why you'll love it`, 보관·알레르기·FAQ 구조를 참고한다. 다만 ENZE의 장바구니, 즉시 결제, 배송, 리뷰 규모는 베리굿의 현재 운영 방식에 적용하지 않는다.
