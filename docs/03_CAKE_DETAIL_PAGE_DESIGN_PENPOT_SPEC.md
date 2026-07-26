# Verygood Chocolate AU 케이크 상세페이지 디자인 및 Penpot MCP 명세

- 작성일: 2026-07-26
- 디자인 요청: Jenny
- 핵심 색상 방향:
  - Background: Ivory
  - Main colour: Green
  - Accent: Red heart
- 디자인 원칙: 현재 `au.verygood-chocolate.com`의 톤앤매너를 유지하면서 ENZE처럼 시원하고 명료한 상품 상세 구조를 추가한다.

---

## 1. 디자인 컨셉

### 컨셉 문장

```text
Warm, fresh and quietly premium.
Chocolate-focused, friendly and easy to order.
```

### 시각 키워드

- 따뜻한 아이보리
- 신선하고 안정적인 그린
- 작은 빨강 하트
- 넓은 여백
- 큰 제품 사진
- 명확한 옵션 선택
- 부드럽지만 유아틱하지 않음
- 고급스럽지만 검정·금색 중심의 무거운 럭셔리 아님
- 홈베이킹의 친근함과 전문 초콜릿 브랜드의 정돈된 인상

### 피해야 할 방향

- ENZE의 화면을 그대로 복제
- 검정 배경과 금색 위주의 전통 럭셔리
- 파스텔 색상을 여러 개 추가
- 하트를 모든 항목에 반복
- 귀여운 스티커와 아이콘을 과도하게 사용
- 카드마다 강한 그림자
- 둥근 모서리를 지나치게 크게 사용
- 긴 설명을 하나의 이미지에 합성
- 제품 이미지 위에 많은 텍스트를 겹침

---

## 2. 컬러 시스템

### 가장 중요한 규칙

현재 사이트 코드 또는 기존 Penpot 파일에 이미 사용 중인 아이보리와 그린의 **실제 값을 먼저 추출해 그대로 사용한다.** 이번 작업을 위해 비슷한 새 그린이나 새 아이보리를 임의로 만들지 않는다.

현재 값이 CSS 변수나 디자인 토큰으로 정리되어 있지 않다면 다음 의미로 Penpot 스타일을 만든 뒤 정확한 값을 구현자에게 전달한다.

```text
color/background/page       현재 아이보리
color/background/card       현재 카드용 밝은 색 또는 아이보리보다 약간 밝은 색
color/background/green      현재 메인 그린
color/text/primary          현재 본문용 가장 진한 색
color/text/secondary        현재 보조 본문색
color/border/subtle         현재 연한 테두리
color/action/primary        현재 메인 그린
color/action/on-primary     아이보리 또는 흰색
color/accent/heart          Jenny가 요청한 빨강
color/state/error           접근성 기준을 충족하는 오류용 진한 빨강
color/state/success         현재 그린 계열에서 분리 가능한 성공색
```

### 컬러 역할

#### Ivory

- 전체 페이지 기본 배경
- 이미지 사이의 넓은 여백
- 카드나 옵션 영역의 기본 면
- 따뜻하고 편안한 인상

#### Green

- 주요 CTA
- 선택된 옵션
- 헤더 또는 강조 밴드
- 섹션 제목의 일부
- 포커스/활성 상태
- 하단 주문 CTA 배경

#### Red heart

- 감성적 강조
- 브랜드의 친근한 손맛
- 작은 아이콘 또는 문장 끝 포인트

빨강을 넓은 버튼 배경이나 큰 섹션 배경으로 사용하지 않는다. 이 페이지의 주 행동색은 그린이다.

### 색상 대비

- 아이보리 위 그린 본문은 WCAG AA 기준 확인
- 그린 버튼 위 아이보리 텍스트 대비 확인
- 빨강 하트는 장식이면 대비 요구가 낮지만, 정보를 전달하면 대비와 보조 텍스트 필요
- 오류 상태는 하트와 동일한 아이콘만 사용하지 말고 문구와 테두리를 함께 사용

---

## 3. 빨강 하트 사용 위치

John이 Penpot에서 직접 조정하기 쉬우도록 하트의 권장 위치를 명확히 제한한다.

## 필수 또는 우선 사용 위치

### 1. 상단 안내 바

```text
Made to order in Sydney ♥ Pre-arranged pick-up in Melrose Park
```

- 크기 12~14px 전후
- 문장 중간 또는 끝에 작은 포인트
- 자동으로 깜빡이거나 움직이지 않음

### 2. `Why you'll love it` 제목

```text
Why you'll love it ♥
```

- 제목보다 작게
- baseline을 맞추거나 살짝 위로 올림
- 빨강 하트가 섹션 제목의 일부처럼 보이되 너무 귀엽지 않게

### 3. 주문 과정 마지막 단계

```text
03 Pick up and enjoy ♥
```

- 고객 경험의 따뜻한 마무리
- 단계 번호나 아이콘 자체는 그린 유지

### 4. 최종 CTA 제목

```text
Ready to plan a chocolate moment? ♥
```

- 그린 배경 위 작은 빨강 하트
- 아이보리 텍스트와 함께 포인트 역할

## 선택 사용 위치

- 브랜드 스토리 사진 옆 작은 장식
- 포장 카드나 실제 제품 사진 안에 이미 존재하는 하트
- 예약 완료 화면의 작은 하트

## 사용하지 않을 위치

- 모든 bullet
- 모든 카드 제목
- 가격 옆
- 사이즈 선택 표시
- 버튼 배경 전체
- 폼 필수 표시
- 오류 아이콘 대용
- 즐겨찾기 기능처럼 보이는 갤러리 우측 상단

페이지 한 화면에 하트가 2개 이상 동시에 강하게 보이지 않게 한다. 전체 페이지 기준 3~5개의 명확한 사용이면 충분하다.

---

## 4. 타이포그래피

### 원칙

현재 사이트와 브랜드에 사용하는 글꼴을 유지한다. 베리굿의 기본 브랜드 글꼴이 Work Sans라면 새 세리프를 도입하지 않고 Work Sans의 크기와 굵기 차이만으로 시원한 편집 디자인을 만든다.

### 권장 타입 스케일

#### Desktop

```text
Display / H1       56–64px / 1.00–1.08 / 600–700
H2                 40–48px / 1.10–1.18 / 600
H3                 26–32px / 1.20 / 600
Body large         18–20px / 1.55
Body               16–18px / 1.60
Small              14px / 1.50
Eyebrow / Label    12–13px / 1.20 / 600 / 선택적 대문자
Price              28–36px / 1.10 / 600
Button              15–16px / 1.00 / 600
```

#### Mobile

```text
H1                 36–42px / 1.05–1.12
H2                 28–34px / 1.15
H3                 22–26px / 1.25
Body large         17–18px / 1.55
Body               16px / 1.60
Small              13–14px / 1.45
Price              26–30px / 1.10
Button              15–16px / 1.00
```

### 문장 폭

- 긴 본문은 55~70 characters 내외
- 전체 폭 섹션에서도 문단 폭을 제한
- H1은 데스크톱에서 2~3줄을 넘지 않음
- 상품 설명은 Hero에서 3~4줄 내외

### 강조 방식

- 빨강 텍스트를 넓게 사용하지 않음
- 굵기와 크기, 여백을 우선 사용
- 가격과 제품명은 그린 또는 진한 본문색
- 보조 정보는 채도를 낮춘 텍스트

---

## 5. 레이아웃 시스템

### Desktop Frame

```text
Frame width: 1440px
Content max-width: 1240–1280px
Grid: 12 columns
Outer margin: 64–80px
Column gutter: 24–32px
Section vertical padding: 96–144px
```

Hero 권장 비율:

```text
Gallery: 7 columns
Gap: 48–64px
Purchase panel: 5 columns
```

### Tablet

```text
Breakpoint guide: 768–1023px
Outer margin: 32–40px
Hero는 6/6 또는 세로 스택 전환
Section padding: 72–96px
```

### Mobile Frame

```text
Frame width: 390px
Horizontal padding: 20px
Card gap: 12–16px
Section vertical padding: 64–88px
Control height: 최소 48px
Sticky CTA height: 약 72–80px + safe area
```

### 여백 원칙

- 섹션 사이를 선으로 계속 나누기보다 여백과 배경 변화로 구분
- 카드 내부는 20–32px
- Hero 옵션 그룹 사이 24–32px
- 제목과 본문 사이 16–24px
- 버튼과 예약 안내 사이 12–16px

---

## 6. 페이지 배경 리듬

페이지가 아이보리 한 색으로만 길어 보이지 않게, 색과 이미지로 리듬을 만든다.

권장 순서:

```text
Announcement bar      Green
Header                Ivory
Hero                  Ivory
Trust strip           아주 연한 Green tint 또는 밝은 카드색
Why you'll love it    Ivory
Lifestyle image       Full bleed image
Inside the cake       Ivory
Taste profile         밝은 Green tint
Size guide            Ivory
Good to know          Ivory 또는 밝은 카드색
How ordering works    Green
FAQ                   Ivory
Other cakes           Ivory
Final CTA             Green
Footer                 현재 사이트 스타일 유지
```

새로운 연한 그린을 만드는 경우 메인 그린에 낮은 투명도를 적용한 tint로 정의한다. 무관한 민트색을 새로 추가하지 않는다.

---

## 7. 섹션별 시각 설계

## 7.1 Announcement bar

- 높이 32–40px
- 그린 배경
- 아이보리 글자
- 작은 빨강 하트 1개
- 모바일에서 한 줄이 길면 핵심만 남김

모바일 축약:

```text
Made to order ♥ Melrose Park pick-up
```

---

## 7.2 Header

- 현재 사이트의 로고와 헤더 높이 유지
- 배경 아이보리
- 메뉴 텍스트 진한 그린 또는 본문색
- 메인 CTA는 그린 채움 버튼
- 스크롤 고정은 현재 사이트에서 이미 사용 중일 때만 유지
- 상세페이지에서 헤더가 Hero를 과도하게 압박하지 않게 함

---

## 7.3 Hero Gallery

### Desktop

권장 2가지 방식 중 A를 우선한다.

#### A. 큰 대표 이미지 + 세로 썸네일

- 구현과 사용성이 명확
- 4:5 대표 이미지
- 왼쪽 또는 아래에 4~6개의 썸네일
- 선택 썸네일은 그린 테두리

#### B. 편집형 2열 이미지 그리드

- 시각적으로 풍부하지만 첫 화면 높이가 길어짐
- 이미지 수와 촬영 품질이 충분할 때만 사용

초기에는 A가 안전하다.

### Mobile

- 1장씩 보이는 스와이프 갤러리
- 페이지 점 또는 `1 / 6`
- 썸네일을 가로로 길게 나열하지 않음
- 이미지 모서리는 현재 사이트 카드 radius를 사용

---

## 7.4 Purchase Panel

- 데스크톱에서 top align
- 옵션 그룹이 많아도 하나의 거대한 테두리 카드로 감싸지 않아도 됨
- 정보 위계를 여백과 얇은 구분선으로 표현
- sticky 사용 시 상단 헤더 높이를 고려

구성 순서:

```text
Eyebrow: Chocolate cake / Made to order
H1
Short description
Price
Badges
Divider
Size selector
Quantity
Date
Message option
Order summary
Primary CTA
Confirmation note
```

### 배지

- pill 형태 또는 작은 아이콘+텍스트
- 아이보리 또는 연한 그린 배경
- 테두리 그린 15~25% 농도
- 한 줄에 무리하게 모두 넣지 않음

---

## 7.5 Size Selector

각 카드에 다음 세 줄을 표시한다.

```text
15 cm
Serves 6–8
$75 AUD
```

### 상태

#### Default

- 아이보리/밝은 배경
- 얇은 그린 또는 중성 테두리

#### Hover

- 그린 테두리 강화
- 아주 약한 그린 tint

#### Selected

- 메인 그린 채움
- 아이보리 텍스트
- 체크 아이콘 또는 분명한 테두리
- 빨강 하트 사용 금지

#### Focus

- 2px 이상 눈에 보이는 focus ring
- hover와 다른 상태로 인식 가능

#### Disabled

- 낮은 대비
- 선택 불가 이유를 tooltip에만 숨기지 않음

---

## 7.6 Quantity Stepper

- 높이 48px 이상
- `-`와 `+` 터치 영역 각각 44px 이상
- 숫자는 가운데
- 테두리는 옵션 선택기와 같은 계열
- 상한에 도달하면 버튼 비활성화와 안내 문구

---

## 7.7 Date Field

- 현재 폼 스타일 재사용
- `Preferred pick-up date` 라벨을 항상 표시
- placeholder에만 의미를 의존하지 않음
- 달력 아이콘은 그린
- 선택 후 사람이 읽기 쉬운 날짜 표기 가능
- 하단 보조문구:

```text
Your date will be confirmed by Jenny.
```

---

## 7.8 Primary CTA

### 기본

- 그린 채움
- 아이보리 글자
- 최소 높이 52–56px
- Hero에서는 전체 폭
- 현재 사이트 버튼 radius 유지

### Hover

- 그린을 약간 어둡게
- 과한 확대나 그림자 없음

### Focus

- 명확한 외곽선

### Disabled

- 대비를 낮추되 버튼 라벨은 읽을 수 있음
- 왜 비활성인지 옵션 그룹 아래에 문구 표시

### Loading

```text
Sending request…
```

상세페이지 CTA는 페이지 이동이므로 로딩 스피너가 꼭 필요하지 않다. 예약 최종 제출에서만 사용한다.

---

## 7.9 Trust Strip

- 3열
- 모바일은 세로 또는 1열 3행
- 작은 선형 아이콘 사용 가능
- 아이콘 색은 그린
- 빨강 하트 반복 금지
- 카드 테두리 없이 배경 tint와 간격으로 정리 가능

---

## 7.10 Why you'll love it

- 2×2 grid 또는 4열
- 큰 숫자나 복잡한 아이콘보다 제목+두 줄 설명
- 제목 `Why you'll love it` 옆 빨강 하트
- 각 항목 사이 충분한 여백
- 모바일은 1열

---

## 7.11 Lifestyle Image Section

- 데스크톱에서 화면 폭 전체 또는 max-width보다 넓은 이미지
- 텍스트를 이미지 위에 올릴 때 사진의 빈 영역을 사용
- 텍스트 대비가 부족하면 그라데이션보다 별도 아이보리 텍스트 박스를 우선
- 모바일에서는 이미지와 텍스트를 분리할 수 있음

---

## 7.12 Inside the cake

- 데스크톱 6/6 split
- 단면 사진 크게
- 레이어 설명은 번호 01~04
- 번호는 그린
- 얇은 연결선은 선택 사항
- 빨강 하트 없음
- 모바일에서 사진 다음 설명 순서

---

## 7.13 Taste Profile

권장 시각:

- 작은 dot scale 또는 짧은 bar
- 활성 dot/bar는 그린
- 비활성은 연한 테두리
- 항목마다 텍스트 결과를 함께 표시
- 레이더 차트처럼 복잡한 그래프는 사용하지 않음

이 섹션은 연한 그린 tint 배경으로 페이지 리듬을 준다.

---

## 7.14 Size Guide

권장 시각:

- 3개의 케이크 원형 실루엣 또는 실제 사진
- 크기 차이를 비례에 맞춰 표현
- 15/19/22 cm를 실제 비율에 가깝게 표시
- 각 크기 아래 인원과 가격
- 선택 버튼을 다시 제공할 경우 Hero 선택 상태와 동기화

실루엣은 그린 선, 내부는 아이보리 또는 연한 그린으로 단순화한다.

---

## 7.15 Good to know Accordion

### 항목

- Pick-up
- Ordering notice
- Storage and serving
- Allergens
- Order confirmation

### 스타일

- 한 항목당 최소 56px 헤더
- 얇은 상·하단 구분선
- 제목 진한 색
- `+` 또는 chevron은 그린
- 열린 상태에서 아이콘 방향 변경
- 한 번에 하나만 열거나 여러 개 열 수 있는지는 구현 단순성을 기준으로 결정
- FAQ와 동일 컴포넌트를 재사용 가능

---

## 7.16 How ordering works

- 그린 배경
- 아이보리 제목과 본문
- 3단계 가로 배치
- 모바일 세로 배치
- 단계 번호는 아이보리 테두리 원 또는 큰 숫자
- 마지막 제목 옆 빨강 하트
- 선형 연결선은 모바일에서 생략 가능

---

## 7.17 FAQ

- 아이보리 배경
- 최대 폭을 본문보다 좁게 800–900px로 제한
- 질문은 16–18px, 답변은 15–17px
- 아코디언 상태를 컴포넌트 variant로 설계
- 키보드 focus 상태 포함

---

## 7.18 Other Cakes

- 데스크톱 2열 큰 카드
- 모바일 1열
- 이미지 4:5
- 제품명, 한 줄 설명, From 가격, `View cake`
- 이미지 hover는 아주 미세한 확대만 허용
- 카드 전체 클릭 가능하더라도 내부 링크 의미를 유지

---

## 7.19 Final CTA

- 그린 full-width band
- 아이보리 텍스트
- 제목 옆 빨강 하트
- 아이보리 채움 또는 outline 버튼
- 배경에 큰 하트 패턴 반복 금지
- 텍스트 최대 3줄

---

## 7.20 Mobile Sticky Request Bar

### 구조

```text
From $75 AUD       Request this cake
```

### 규칙

- Hero의 원래 CTA가 화면 밖으로 나간 뒤 노출 가능
- 옵션 미선택 시 눌렀을 때 누락 항목으로 스크롤
- iOS safe-area 반영
- 흰색/아이보리 배경과 얇은 상단 테두리
- 버튼은 그린
- 빨강 하트 없음
- 페이지 하단 Final CTA와 겹칠 때 숨김 가능

---

## 8. 이미지 아트 디렉션

### 제품 사진 톤

- 부드러운 자연광 또는 큰 확산광
- 따뜻한 아이보리, 원목, 중성 천 소재
- 초콜릿의 진한 갈색이 주인공
- 소품은 2~4개 이내
- 그림자는 자연스럽고 너무 짙지 않게
- 실제 매장에서 촬영한 듯한 현실감
- 반짝이는 3D 렌더 느낌을 피함

### 대표 사진

- 케이크 전체가 잘리지 않음
- 제품 중심을 약간 아래에 배치해 텍스트나 UI 크롭 여유 확보
- 모바일 4:5에 맞춰도 장식이 잘리지 않음
- 배경과 케이크의 명도 대비 확보

### 단면 사진

- 레이어가 정확히 보임
- 크림이 지나치게 완벽한 3D 선처럼 보이지 않음
- 실제 칼자국과 질감 유지
- 가나슈 두께와 시트 수가 실제 판매 제품과 일치

### 라이프스타일 사진

- 생일 초, 접시, 포크, 손 등 사용 장면
- 인물 얼굴이 없어도 분위기가 전달됨
- 호주 고객의 집과 테이블에 자연스럽게 어울리는 장면
- 제품에 포함되지 않는 장식을 상품 구성으로 오해하지 않게 함

### 이미지 전달 형식

- 원본 보존
- 구현용 WebP/AVIF
- 1x/2x 또는 responsive source
- 투명 하트 아이콘은 SVG
- 사진에 UI 텍스트를 합성하지 않음

---

## 9. Penpot 파일 구조

권장 페이지:

```text
00 Foundations
01 Components
02 Cake Detail - Desktop
03 Cake Detail - Mobile
04 Reservation Prefill - Desktop
05 Reservation Prefill - Mobile
06 Prototype & Notes
```

### 00 Foundations

- Color styles
- Typography styles
- Spacing tokens
- Radius
- Shadow
- Grid
- Icon rules

### 01 Components

- Announcement bar
- Header
- Button / variants
- Badge
- Size option / variants
- Quantity stepper
- Date field
- Message choice
- Product summary
- Thumbnail
- Gallery control
- Trust item
- Feature item
- Taste profile row
- Size guide item
- Accordion / variants
- Cake card
- Mobile sticky CTA
- Red heart icon

### 프레임 이름

```text
Cake Detail / Pavé / Desktop 1440
Cake Detail / Pavé / Mobile 390
Reservation / Prefilled / Desktop 1440
Reservation / Prefilled / Mobile 390
```

### 컴포넌트 이름

```text
Button/Primary/Default
Button/Primary/Hover
Button/Primary/Focus
Button/Primary/Disabled

Option/Size/Default
Option/Size/Hover
Option/Size/Selected
Option/Size/Focus
Option/Size/Disabled

Accordion/Closed
Accordion/Open

Heart/Accent/Small
Heart/Accent/Medium
```

레이어 이름을 `Rectangle 123`, `Group 44`로 남기지 않는다.

---

## 10. Penpot MCP 작업 순서

### Step 1. 현재 톤 조사

- 현재 라이브 사이트 또는 기존 Penpot 파일 열기
- 로고, 폰트, 색상, 버튼, 카드, radius, header, footer 확인
- 실제 색상값을 Foundations에 등록
- 현재 UI와 충돌하는 새 스타일을 만들지 않음

### Step 2. Foundations와 컴포넌트 제작

- 아이보리, 그린, 빨강 하트의 역할 정의
- 타입 스케일 정의
- 버튼과 옵션 상태 제작
- 아코디언과 모바일 sticky CTA 제작

### Step 3. Pavé Desktop 프레임

- 1440px 기준
- 실제 또는 최종에 가까운 제품 사진 사용
- Hero부터 Final CTA까지 전체 롱스크롤 구성
- 화면 밖 콘텐츠도 실제 간격으로 제작

### Step 4. Pavé Mobile 프레임

- 390px 기준
- Desktop을 단순 축소하지 않고 순서를 재배치
- 갤러리 스와이프, 옵션 줄바꿈, sticky CTA 고려
- 긴 FAQ와 폼 오류 상태 확인

### Step 5. 예약 자동 입력 화면

- 상세페이지에서 선택한 상품 요약이 이미 채워진 상태
- `Change selection`
- 고객 정보 필드
- 실제 메시지 입력
- 알레르기 확인
- `Send cake request`
- 요청 성공 상태

### Step 6. Prototype 연결

```text
Pavé detail
→ size selected
→ date selected
→ Request this cake
→ prefilled reservation
→ Send cake request
→ request received
```

프로토타입은 핵심 흐름만 연결하며 복잡한 애니메이션을 만들지 않는다.

### Step 7. 개발자 주석

각 주요 화면에 다음을 기록한다.

- max-width
- grid와 gap
- section padding
- sticky 동작
- 선택/오류/disabled 상태
- 모바일 변경점
- 사진 비율
- 실제 색상 토큰 이름
- 폰트 스타일 이름
- 하트 사용 위치

---

## 11. 구현 전달 시 금지 사항

- Penpot 화면 전체를 한 장의 이미지로 export해 구현하지 않음
- 텍스트를 이미지로 만들지 않음
- 옵션 선택기를 클릭 불가능한 장식으로 구현하지 않음
- 모든 치수를 절대 위치로 고정하지 않음
- 데스크톱 프레임을 비율 축소해 모바일로 사용하지 않음
- 새로운 UI 라이브러리를 디자인 때문에 추가하지 않음
- 기존 사이트의 header/footer를 불필요하게 다시 만들지 않음
- 빨강 하트를 emoji 폰트에 의존하지 않음

하트는 기존 브랜드 자산이 있으면 그것을 사용하고, 없으면 단순한 SVG 아이콘을 만든다. 플랫폼마다 모양이 달라지는 텍스트 emoji `❤️`만으로 구현하지 않는 것이 좋다. 카피 예시에서는 의미 전달을 위해 하트 문자를 사용하지만 실제 UI는 SVG를 권장한다.

---

## 12. John이 Penpot에서 직접 강조 조정할 부분

Jenny의 요청을 반영하면서 John이 최종적으로 손보기 좋은 지점은 다음 6곳이다.

1. **상단 안내 바 하트 크기와 위치**
2. **Hero에서 그린이 차지하는 양**
   - CTA만 그린으로 둘지, 작은 배지까지 그린 tint를 사용할지
3. **Why you'll love it 제목의 빨강 하트**
4. **How ordering works의 그린 배경 농도**
5. **Final CTA의 빨강 하트와 버튼 대비**
6. **제품 사진과 아이보리 배경 사이의 따뜻한 정도**

반대로 다음은 디자인이 아니라 기능 상태이므로 John이 장식적으로 바꾸지 않는 것이 좋다.

- 선택된 사이즈 상태
- 오류 상태
- 비활성 CTA
- 포커스 링
- 날짜 필드
- 알레르기 안내

이 부분은 접근성과 사용성을 우선한다.

---

## 13. 디자인 QA 체크리스트

### 브랜드

- [ ] 현재 사이트의 아이보리와 그린을 그대로 사용했다.
- [ ] 새로운 브랜드처럼 보이지 않는다.
- [ ] 빨강 하트는 3~5개 이내의 명확한 포인트다.
- [ ] 하트가 즐겨찾기 기능으로 오해되지 않는다.

### 정보 위계

- [ ] 제품명, 가격, 사이즈, CTA가 먼저 보인다.
- [ ] 예약 요청과 주문 확정의 차이가 보인다.
- [ ] 사이즈별 인원과 가격이 한 번에 읽힌다.
- [ ] 보관·알레르기·픽업 정보를 찾기 쉽다.

### 반응형

- [ ] Desktop 1440과 Mobile 390이 모두 완성됐다.
- [ ] 모바일에서 가로 스크롤이 없다.
- [ ] sticky CTA가 입력 필드와 Final CTA를 가리지 않는다.
- [ ] 텍스트 확대 시 레이아웃이 무너지지 않는다.

### 상태

- [ ] 옵션 default/hover/selected/focus/disabled가 있다.
- [ ] 버튼 default/hover/focus/disabled/loading이 있다.
- [ ] 아코디언 closed/open/focus가 있다.
- [ ] 폼 error/success가 있다.

### 이미지

- [ ] 대표, 단면, 질감, 라이프스타일 사진의 역할이 구분된다.
- [ ] 실제 제품과 사진이 일치한다.
- [ ] 모바일 크롭에서도 제품이 잘리지 않는다.
- [ ] 텍스트가 사진 안에 합성되어 있지 않다.

### 개발 전달

- [ ] Foundations 토큰이 정리됐다.
- [ ] 컴포넌트 이름이 의미 있게 작성됐다.
- [ ] 간격과 grid가 주석으로 제공된다.
- [ ] 실제 디자인 토큰 값이 구현자에게 전달된다.
- [ ] 핵심 프로토타입 흐름이 연결됐다.

---

## 14. Antigravity 또는 Codex에 전달할 Penpot MCP 프롬프트

```text
Penpot MCP에 연결해서 Verygood Chocolate AU의 Pavé Chocolate Cake 상세페이지와
선택값이 미리 채워진 예약 확인 페이지를 설계해줘.

반드시 먼저 아래 문서를 읽어.
1. 02_CAKE_DETAIL_PAGE_PRODUCT_SPEC.md
2. 03_CAKE_DETAIL_PAGE_DESIGN_PENPOT_SPEC.md

작업 전에 현재 au.verygood-chocolate.com 또는 기존 Penpot 파일의 디자인을 조사해서
실제 아이보리 배경, 메인 그린, 폰트, 버튼, radius, header, footer를 추출해.
새로운 색상이나 다른 브랜드 스타일을 임의로 만들지 마.

Jenny의 컬러 요청:
- Background: Ivory
- Main colour: Green
- Accent: Red heart

하트는 다음 위치를 우선으로 제한해.
- 상단 안내 바
- Why you'll love it 제목
- How ordering works 마지막 단계
- Final CTA 제목

하트를 사이즈 선택, 가격, 모든 bullet, 오류 표시, 버튼 배경으로 사용하지 마.
주 행동색은 반드시 그린이야.

Penpot에 다음 페이지를 만들어.
- 00 Foundations
- 01 Components
- 02 Cake Detail - Desktop
- 03 Cake Detail - Mobile
- 04 Reservation Prefill - Desktop
- 05 Reservation Prefill - Mobile
- 06 Prototype & Notes

필수 프레임:
- Cake Detail / Pavé / Desktop 1440
- Cake Detail / Pavé / Mobile 390
- Reservation / Prefilled / Desktop 1440
- Reservation / Prefilled / Mobile 390

Desktop Hero는 큰 제품 갤러리와 우측 옵션 패널의 7:5 구조로 설계하고,
Mobile은 갤러리 → 상품 정보 → 옵션 → CTA 순서로 재배치해.

반드시 디자인할 상태:
- Button: default, hover, focus, disabled, loading
- Size option: default, hover, selected, focus, disabled
- Accordion: closed, open, focus
- Form: default, error, success
- Mobile sticky request bar

페이지 전체는 큰 사진과 넓은 여백을 사용한 시원한 롱스크롤로 만들되,
한국 쇼핑몰처럼 긴 설명 이미지를 한 장으로 만들지 마.
모든 문구와 정보는 실제 HTML 텍스트로 구현할 수 있는 별도 레이어로 구성해.

완료 후 구현자가 바로 사용할 수 있도록
컬러 토큰, 타입 스타일, grid, max-width, section spacing, image ratio,
sticky 동작, 모바일 변경점을 Notes에 정리해.
```

---

## 15. 참고 화면에서 가져올 것과 가져오지 않을 것

### ENZE에서 참고할 것

- 큰 이미지 갤러리
- 상품명, 가격, 옵션, CTA의 명확한 위계
- 사이즈와 예상 인원 동시 표기
- `Why you'll love it`
- 보관, 알레르기, 주문법, FAQ 분리
- 넓은 여백과 짧은 문장

### ENZE에서 가져오지 않을 것

- Add to Cart
- 즉시 결제 흐름
- 배송 마감 카운트다운
- 무료배송 배너
- 대규모 리뷰 수
- 회원가입
- 많은 카테고리

Verygood Chocolate AU는 **작고 전문적인 Sydney chocolate cake studio**로 보여야 하며, 대형 쇼핑몰처럼 보이게 만드는 것이 목표가 아니다.
