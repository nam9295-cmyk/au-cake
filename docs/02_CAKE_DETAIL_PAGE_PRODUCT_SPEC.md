# Verygood Chocolate AU 케이크 상세페이지 기획서

- 작성일: 2026-07-26
- 첫 적용 상품: `Pavé Chocolate Cake`
- 사용 대상: 기획 검토, Penpot 화면 설계, 프론트엔드 구현
- 목표 언어: 고객 화면은 영어, 내부 주석과 기획 문서는 한국어 가능

---

## 1. 상세페이지의 역할

상세페이지는 한국 쇼핑몰처럼 모든 정보를 긴 설명 이미지 하나에 넣는 페이지가 아니다. 또한 외국 쇼핑몰처럼 제품명과 장바구니 버튼만 있는 짧은 페이지도 아니다.

베리굿의 상세페이지는 다음 두 가지를 결합한다.

```text
해외형 상세페이지
= 첫 화면에서 가격·사이즈·주문 조건을 빠르게 이해

한국형 상세페이지의 장점
= 큰 사진과 시원한 간격으로 맛과 질감을 충분히 설득
```

따라서 목표는 **짧은 페이지가 아니라 정보 밀도가 낮고 읽기 편한 롱 스크롤 페이지**다.

---

## 2. 고객이 페이지에서 반드시 답을 얻어야 하는 질문

첫 두 화면 안에 다음 질문 중 대부분에 답할 수 있어야 한다.

1. 어떤 케이크인가?
2. 어떤 맛과 질감인가?
3. 가격은 얼마부터인가?
4. 어떤 사이즈가 있고 몇 명이 먹는가?
5. 픽업은 어디서 하는가?
6. 원하는 날짜에 어떻게 요청하는가?
7. 지금 누르는 버튼이 결제인지 예약 요청인지?

페이지 전체를 읽으면 다음 질문에도 답을 얻어야 한다.

8. 안쪽 레이어가 어떻게 구성되는가?
9. 단맛과 초콜릿 진함은 어느 정도인가?
10. 어떻게 보관하고 언제 꺼내 먹는가?
11. 알레르기 성분은 무엇인가?
12. 최소 며칠 전에 요청해야 하는가?
13. 메시지를 넣을 수 있는가?
14. 주문은 언제 최종 확정되는가?

---

## 3. 제품 사실 원칙

상세페이지는 마케팅 문구보다 정확성이 우선이다.

다음 정보는 Jenny 또는 실제 레시피 기준으로 확인된 값만 사용한다.

- 사이즈별 정확한 가격
- 사이즈별 권장 인원
- 실제 케이크 높이와 중량을 표시할 경우 그 수치
- 구성 레이어 수
- 사용 초콜릿과 원재료 표현
- 알레르기 항목
- 교차오염 안내
- 냉장 보관 가능 기간
- 최적의 섭취 온도와 실온 대기 시간
- 최소 예약 요청 기간
- 케이크 문구 또는 플라크 제공 여부와 추가금
- 픽업 가능한 요일과 시간 정책

제품 사실이 확정되지 않은 문구를 디자인에 고정하지 않는다. Penpot에서는 교체 가능한 텍스트 레이어로 유지한다.

---

## 4. 첫 적용 상품의 기본 방향

### 상품명

```text
Pavé Chocolate Cake
```

URL slug:

```text
/cakes/pave-chocolate-cake
```

### 추천 짧은 설명

```text
Layered chocolate sponge and silky pavé ganache,
finished with deep dark chocolate.
Rich, smooth and beautifully balanced.
```

`balanced` 또는 `not overly sweet`는 실제 맛 방향과 일치한다고 Jenny가 확인한 뒤 사용한다.

### 가격 표시

```text
From $75 AUD
```

사이즈를 선택하면 해당 사이즈의 실제 가격으로 즉시 변경한다.

### 운영 배지

```text
Made to order
Melrose Park pick-up
Pre-order required
```

### 핵심 버튼

```text
Request this cake
```

버튼 아래 필수 안내:

```text
No payment is taken at this stage.
Jenny will confirm availability and send payment details.
Your order is confirmed after payment.
```

---

## 5. 전체 페이지 섹션 순서

```text
00. 상단 안내 바와 헤더
01. Breadcrumb
02. Product Hero: 갤러리 + 상품 선택 패널
03. 핵심 신뢰 정보 스트립
04. Why you'll love it
05. 감성 라이프스타일 이미지와 짧은 카피
06. Inside the cake
07. Taste profile
08. Size guide
09. Good to know: 픽업·보관·알레르기·예약 조건
10. How ordering works
11. Product FAQ
12. Other cakes
13. Final request CTA
14. Footer
```

모든 섹션을 항상 강제로 표시할 필요는 없다. 제품 정보가 없는 섹션은 빈 상태로 노출하지 않고 데이터에 따라 숨긴다.

---

## 6. 섹션별 상세 기획

## 00. 상단 안내 바와 헤더

### 상단 안내 문구 권장안

```text
Made to order in Sydney ♥ Pre-arranged pick-up in Melrose Park
```

작은 빨강 하트는 이 문구에서 첫 번째 브랜드 포인트로 사용한다.

### 헤더

- 로고
- Cakes
- How it works
- Classes
- FAQ
- Instagram
- 우측 CTA: `Request a cake`

모바일에서는 메뉴 버튼과 로고, 필요 시 작은 CTA만 유지한다.

---

## 01. Breadcrumb

```text
Home / Cakes / Pavé Chocolate Cake
```

- 데스크톱에서 얇고 작게 표시한다.
- 모바일에서는 `Back to cakes` 형태로 단순화할 수 있다.
- 검색엔진용 Breadcrumb 구조화 데이터와 의미가 일치해야 한다.

---

## 02. Product Hero

상세페이지에서 가장 중요한 구간이다.

### 데스크톱 구조

```text
┌───────────────────────────┬────────────────────────┐
│                           │ Pavé Chocolate Cake    │
│  큰 대표 이미지/갤러리     │ 짧은 설명               │
│                           │ 가격                    │
│                           │ 운영 배지               │
│                           │ 사이즈 선택             │
│                           │ 수량                    │
│                           │ 픽업 희망일             │
│                           │ 메시지 필요 여부        │
│                           │ 주문 요약               │
│                           │ Request this cake       │
│                           │ 예약 확정 안내          │
└───────────────────────────┴────────────────────────┘
```

- 이미지 영역 약 58~62%
- 정보 영역 약 38~42%
- 데스크톱에서는 정보 패널을 일정 구간 동안 sticky 처리 가능
- sticky는 하단 콘텐츠를 가리거나 푸터까지 따라가지 않게 제한

### 모바일 구조

```text
[대표 이미지 슬라이더]
[썸네일 또는 페이지 점]

Pavé Chocolate Cake
짧은 설명
From $75 AUD
배지

Size
[15cm] [19cm] [22cm]

Quantity
[-] 1 [+]

Preferred pick-up date
[date field]

Cake message
[No message] [Add a message]

Order summary
[Request this cake]
예약 확정 안내
```

### 이미지 갤러리 순서

1. 전체 케이크 45도 대표 사진
2. 정면 또는 위쪽에서 본 전체 형태
3. 한 조각을 자른 단면
4. 가나슈와 표면 질감 매크로
5. 실제 크기를 느낄 수 있는 손·접시·박스 사진
6. 생일이나 모임 테이블 라이프스타일 사진

### 이미지 상호작용

- 썸네일 클릭/탭으로 대표 이미지 변경
- 이미지 확대가 필요하다면 단순 라이트박스 사용
- 모바일 스와이프 지원
- 장식용 자동 슬라이드 금지
- 상품과 실제로 다른 AI 사진 금지

---

## 03. 핵심 신뢰 정보 스트립

Hero 바로 아래에 짧은 3개 항목을 배치한다.

```text
Small-batch
Made to order
Melrose Park pick-up
```

각 항목은 한 줄 제목과 최대 한 줄 설명만 사용한다.

예시:

```text
Small-batch
Prepared with care for your confirmed date.
```

아이콘은 선택 사항이다. 아이콘이 정보보다 커지지 않게 한다.

---

## 04. Why you'll love it

제목 권장안:

```text
Why you'll love it ♥
```

빨강 하트의 두 번째 주요 사용 위치다.

권장 4항목:

### Deep chocolate flavour

```text
A rich cocoa profile with a clean dark-chocolate finish.
```

### Silky pavé layers

```text
Smooth ganache layered between soft chocolate sponge.
```

### Balanced sweetness

```text
Rich enough to feel special, with a finish that stays clean.
```

### Made for your date

```text
Prepared in small batches for your confirmed pick-up.
```

제품 사실과 맞지 않는 표현은 삭제하거나 교체한다. 항목당 1~2문장을 넘기지 않는다.

---

## 05. 감성 라이프스타일 이미지와 짧은 카피

한국형 상세페이지의 시각적 설득력을 가져오는 구간이다.

- 케이크가 놓인 생일 테이블
- 케이크를 자르는 손
- 접시에 담긴 한 조각
- 골든아워 또는 부드러운 자연광

사진 위 또는 옆의 문구:

```text
Deep chocolate.
A beautiful moment to share.
```

또는:

```text
Made for birthdays,
gatherings and thoughtful gifts.
```

긴 설명을 넣지 않는다. 사진이 경험을 말하도록 한다.

---

## 06. Inside the cake

목적은 고객이 케이크 단면과 레이어를 쉽게 이해하게 하는 것이다.

### 권장 구성

```text
[큰 단면 사진]       Inside the cake
                     01 Chocolate sponge
                     02 Thin pavé ganache layers
                     03 Smooth chocolate coating
                     04 Dark chocolate finish
```

실제 제품이 4단 시트라면 해당 사실을 정확히 표현한다. 확정 전에는 임의의 레이어 수를 노출하지 않는다.

사진 위에 화살표와 글자를 하나의 이미지로 합치지 않는다. HTML 텍스트 또는 Penpot의 별도 레이어로 설계해 모바일에서 재배치할 수 있게 한다.

---

## 07. Taste profile

외국 고객이 `Pavé`라는 이름만 보고 맛을 추측하지 않도록 돕는 구간이다.

권장 표현:

```text
Taste profile

Chocolate intensity  ● ● ● ● ○
Sweetness            ● ● ○ ○ ○
Texture              Moist · Silky · Dense
Best for             Chocolate lovers
```

주의:

- 점수는 Jenny가 제품 간 비교 기준을 확정한 뒤 사용한다.
- 점만으로 정보를 전달하지 말고 텍스트 설명을 함께 둔다.
- 색각에 의존하지 않는다.
- 지나치게 과학적인 차트처럼 만들지 않는다.

점수 사용이 부담스러우면 다음처럼 문장형으로 대체한다.

```text
Rich chocolate intensity
Gentle sweetness
Moist sponge with silky ganache
```

---

## 08. Size guide

고객이 `15cm`만 보고 크기를 판단하지 않게 한다.

예시 구조:

```text
Choose your size

15 cm
Serves 6–8
For intimate birthdays and small gatherings
$75 AUD

19 cm
Serves 10–12
For family celebrations
확정 판매가

22 cm
Serves 14–16
For larger gatherings
확정 판매가
```

위 인원수와 가격은 예시가 아니라 실제 절단 기준을 확인한 값으로 교체해야 한다.

### 시각 자료

- 같은 비율의 케이크 원형 실루엣 비교
- 또는 같은 테이블 위에 크기별 케이크를 나란히 촬영
- 사람 수를 과도한 아이콘 수로 표현하지 않음
- cm와 예상 인원수를 항상 함께 표시

---

## 09. Good to know

모바일에서 긴 페이지가 복잡해지지 않도록 아코디언으로 구성한다.

필수 항목:

### Pick-up

```text
Pre-arranged pick-up in Melrose Park, Sydney.
The exact meeting point is shared after your order is confirmed.
```

### Ordering notice

```text
Choose your preferred date when sending a request.
Jenny will confirm availability before payment.
```

### Storage and serving

실제 기준이 확인된 문구를 사용한다. 예시 형식:

```text
Keep refrigerated in the original box.
For the best texture, follow the serving instructions provided with your order.
```

### Allergens

실제 레시피와 공용 작업 공간을 기준으로 작성한다. 예시 형식:

```text
Contains: dairy, eggs, gluten and soy.
May contain traces of nuts.
```

### Order confirmation

```text
Submitting a request does not confirm your order.
Your order is confirmed after availability is checked and payment is received.
```

아코디언이 접혀 있어도 제목만으로 어떤 정보를 찾을 수 있는지 명확해야 한다.

---

## 10. How ordering works

3단계로 끝낸다.

```text
01 Choose your cake
Select a size, quantity and preferred pick-up date.

02 Jenny confirms availability
You will receive confirmation and payment details.

03 Pick up and enjoy ♥
Your order is confirmed after payment.
The Melrose Park meeting point is shared with your confirmation.
```

세 번째 단계의 작은 빨강 하트는 페이지 중간 이후의 감성 포인트로 사용할 수 있다.

---

## 11. Product FAQ

권장 질문:

```text
What does Pavé Chocolate Cake taste like?
Is the cake very sweet?
How many people does each size serve?
How early should I send my request?
Can I add a birthday message?
How should I store and serve the cake?
Does the cake contain nuts?
Where do I pick up the cake?
When is my order confirmed?
```

답변 원칙:

- 첫 문장에서 직접 답한다.
- 2~4문장 이내로 끝낸다.
- 불확실한 약속을 하지 않는다.
- 픽업 주소 전체를 공개하지 않는다.
- 제품별 답변과 공통 정책을 구분한다.

---

## 12. Other cakes

페이지 하단에 다른 제품 2개만 보여준다.

```text
You may also like

Gâteau au Chocolat
From $45 AUD
[View cake]

Chocolate Cupcakes
From $55 AUD
[View cake]
```

상품이 3개뿐이므로 무한 슬라이더나 복잡한 추천 알고리즘은 만들지 않는다.

---

## 13. Final request CTA

짙은 그린 배경의 넓은 섹션으로 마무리한다.

권장 문구:

```text
Ready to plan a chocolate moment? ♥

Choose your preferred size and date,
then send Jenny a cake request.

[Request this cake]
```

- 빨강 하트의 마지막 주요 사용 위치
- 버튼은 아이보리 또는 현재 브랜드 대비색
- 예약 요청이며 즉시 확정이 아님을 한 줄로 재안내

---

## 14. 옵션 선택 상세 규칙

## 14.1 사이즈

- 필수 선택
- 카드 또는 segmented chip 형태
- 표시값: 크기, 예상 인원, 가격
- 선택 시 Hero 가격과 주문 요약이 갱신
- 기본값을 임의 선택할 경우 가장 작은 사이즈로 하되, 사용자가 선택 사실을 인지할 수 있어야 함
- 더 안전한 방식은 첫 진입 시 미선택 상태로 두고 직접 선택하게 하는 것

권장안은 **직접 선택 필수**다. 가격과 인원 오해를 줄일 수 있다.

## 14.2 수량

- 기본 1
- `-`, 숫자, `+`
- 1 미만 불가
- 대량 주문 상한은 운영 기준에 맞춰 제한
- 상한을 넘으면 `Contact Jenny for larger orders` 안내

## 14.3 픽업 희망일

- 상세페이지에서 선택
- 과거 날짜 선택 불가
- 최소 예약 기간이 있다면 그 이전 날짜 비활성화
- 수동 확인 방식이므로 `Available`이라고 단정하지 않음

필드 라벨:

```text
Preferred pick-up date
```

보조문구:

```text
Your date will be confirmed by Jenny.
```

## 14.4 케이크 메시지

상세페이지에서는 필요 여부만 선택한다.

```text
No message
Add a cake message
```

실제 문구는 예약페이지에서 입력한다. 특수문자, 줄바꿈, 글자 수와 추가금 정책을 예약페이지에서 관리한다.

## 14.5 예상 가격

표기:

```text
Estimated total
$75 AUD
```

- 수량과 사이즈로 계산
- 추가 메시지 비용이 확정되어 있다면 포함
- 픽업만 제공하므로 배송비를 표시하지 않음
- 최종 확정 전 가격 변경 가능성이 있다면 운영상 필요한 설명을 명확히 추가

---

## 15. 상세페이지에서 예약페이지로 넘길 값

### URL 예시

```text
/reserve?cake=pave-chocolate-cake&size=15cm&qty=1&date=2026-08-15&message=yes
```

### 예약페이지 자동 입력 항목

- 제품
- 사이즈
- 예상 인원
- 수량
- 픽업 희망일
- 메시지 필요 여부
- 예상 가격

### 예약페이지에서 고객이 추가 입력할 항목

```text
Name
Mobile number
Email
Cake message, when selected
Additional notes
Allergen acknowledgement
Request terms acknowledgement
```

### 예약 요약 카드

```text
Your cake request

[제품 썸네일]
Pavé Chocolate Cake
15 cm · Serves 6–8
Quantity 1
Preferred pick-up: 15 August 2026
Cake message: Yes
Estimated total: $75 AUD

[Change selection]
```

### 제출 버튼

```text
Send cake request
```

제출 직전 문구:

```text
This sends a request only. Jenny will confirm availability and payment details.
```

---

## 16. 모바일 UX 규칙

1. 첫 화면에서 대표 이미지, 상품명, 가격이 빠르게 보인다.
2. 옵션은 가로 스크롤에 숨기지 않고 가능한 한 줄바꿈한다.
3. 사이즈 카드에 크기·인원·가격이 함께 보인다.
4. 하단 고정 CTA를 사용할 수 있다.
5. 고정 CTA는 iOS safe area를 고려한다.
6. 사용자가 Hero를 벗어난 뒤에만 고정 CTA를 노출하는 방식도 가능하다.
7. 키보드가 열렸을 때 고정 CTA가 입력 필드를 가리지 않는다.
8. 사진은 스와이프할 수 있지만 페이지 가로 스크롤은 생기지 않는다.
9. 아코디언 터치 영역은 최소 44px다.
10. CTA를 눌렀는데 항목이 누락되었으면 첫 누락 필드로 이동하고 이유를 보여준다.

모바일 고정 CTA 예시:

```text
$75 AUD                   Request this cake
```

가격과 버튼이 너무 좁아지면 가격을 작은 상단 라벨로 쌓는다.

---

## 17. 문체와 카피 규칙

### 말투

- 따뜻함
- 간결함
- 제품 중심
- 과장하지 않음
- 호주 고객이 자연스럽게 읽는 영어

### 선호 표현

```text
Made to order
Small-batch
Deep chocolate flavour
Silky ganache
Balanced
Prepared for your date
Pre-arranged pick-up
```

### 피할 표현

```text
The world's best
Perfect for everyone
Guaranteed to impress everyone
Healthy
Guilt-free
Sugar-free
Gluten-free
Nut-free
```

검증되지 않은 건강, 식이, 절대적 품질 주장을 하지 않는다.

### 표기 통일

- 통화: `$75 AUD` 또는 `AUD 75` 중 사이트 전체에서 하나로 통일
- 권장: 상품 UI에서는 `$75 AUD`
- 크기: `15 cm`처럼 숫자와 단위 사이 공백
- 날짜: 고객 표시 `15 August 2026`, URL/데이터 `2026-08-15`
- 제품 표기: `Pavé Chocolate Cake`
- slug와 코드 ID: ASCII `pave-chocolate-cake`

---

## 18. 사진 제작 체크리스트

### 필수 촬영

- [ ] 전체 케이크 45도 대표 사진
- [ ] 정면 또는 탑뷰
- [ ] 한 조각 단면
- [ ] 가나슈 매크로
- [ ] 손·접시·박스로 크기 감각을 주는 사진
- [ ] 생일 또는 모임 라이프스타일 사진

### 일관성

- 첫 사진의 배경, 각도, 조명이 제품별로 일관됨
- 실제 판매 제품과 레이어 수, 장식, 크기가 일치
- 케이크에 포함되지 않는 과일이나 소품을 제품 일부처럼 보이게 하지 않음
- 지나친 반사와 플라스틱 같은 AI 질감을 피함
- 제품 색을 과도하게 보정하지 않음
- 모바일 크롭에서도 케이크가 잘리지 않음

### 권장 비율

```text
상품 갤러리: 4:5 중심
홈 상품 카드: 4:5
감성 가로 섹션: 3:2 또는 16:9
Open Graph: 1.91:1
```

---

## 19. 접근성과 SEO 요구사항

### 접근성

- 각 이미지에 용도에 맞는 alt
- 장식용 하트는 스크린리더에서 숨김
- 정보성 하트가 있다면 보조 텍스트 제공
- 라디오형 옵션은 실제 라디오 의미를 유지
- 오류 문구를 필드와 연결
- 선택 상태를 색상 외 테두리, 체크, 굵기로 함께 표현
- 애니메이션 감소 설정 지원

### SEO

페이지 title 예시:

```text
Pavé Chocolate Cake Sydney | Verygood Chocolate
```

meta description 예시:

```text
Order a small-batch Pavé Chocolate Cake for pre-arranged pick-up in Melrose Park, Sydney. Explore sizes, flavour, serving guidance and request your preferred date.
```

실제 제품 정보로 다음을 제공한다.

- product name
- description
- image
- price 또는 가격 범위
- currency AUD
- availability 의미
- brand
- breadcrumb

즉시 결제가 불가능하므로 구조화 데이터가 실제 예약형 운영을 구매 가능 쇼핑몰처럼 오해시키지 않게 검토한다.

---

## 20. 상세페이지 완료 기준

- [ ] 고객이 제품의 맛과 형태를 이해할 수 있다.
- [ ] 첫 두 화면 안에 가격, 사이즈, 픽업 방식, CTA가 보인다.
- [ ] 모든 사이즈에 예상 인원과 가격이 함께 표시된다.
- [ ] 사이즈 변경 시 가격이 즉시 갱신된다.
- [ ] 픽업 희망일을 상세페이지에서 선택한다.
- [ ] CTA 전 예약 요청과 주문 확정의 차이가 보인다.
- [ ] 선택값이 예약 URL에 정확히 전달된다.
- [ ] 가격은 URL에 포함되지 않는다.
- [ ] 모바일에서 고정 CTA가 콘텐츠를 가리지 않는다.
- [ ] 보관, 알레르기, 픽업, 확정 조건을 찾기 쉽다.
- [ ] 실제 제품과 일치하지 않는 사진이나 문구가 없다.
- [ ] 영어 문장이 짧고 자연스럽다.
- [ ] 빨강 하트는 제한된 강조 위치에만 사용된다.

---

## 21. Penpot 설계 담당에게 전달할 프롬프트

```text
Verygood Chocolate AU의 Pavé Chocolate Cake 상세페이지를 Penpot MCP로 설계해줘.

먼저 다음 문서를 읽어.
- 02_CAKE_DETAIL_PAGE_PRODUCT_SPEC.md
- 03_CAKE_DETAIL_PAGE_DESIGN_PENPOT_SPEC.md

현재 au.verygood-chocolate.com의 헤더, 로고, 폰트, 아이보리 배경,
그린 메인 컬러, 버튼과 카드 스타일을 우선 조사하고 재사용해.
새로운 브랜드를 만드는 것이 아니라 현재 톤을 유지하면서 상세페이지를 확장하는 작업이야.

필수 프레임:
- Desktop 1440px
- Mobile 390px
- Components / States

필수 구간:
- Gallery + purchase panel hero
- Size, quantity, preferred pick-up date, message option
- Why you'll love it
- Lifestyle image
- Inside the cake
- Taste profile
- Size guide
- Good to know accordion
- How ordering works
- FAQ
- Other cakes
- Final CTA

빨강 하트는 장식 포인트로만 제한해서 사용하고,
CTA, 옵션 선택, 주요 레이아웃은 그린과 아이보리를 중심으로 설계해.
구현자가 HTML/CSS 컴포넌트로 재현할 수 있게 간격, 상태, 반응형 규칙과 컴포넌트 이름을 명확히 정리해.
```
