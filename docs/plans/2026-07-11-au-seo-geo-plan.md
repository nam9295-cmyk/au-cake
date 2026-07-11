# AU Cake SEO / GEO 실행 계획

작성일: 2026-07-11
대상: Sydney 케이크 예약 및 Kids Cake Class

## 1. 목표와 원칙

### 비즈니스 목표

- Sydney 및 Melrose Park 인근에서 구매 의도가 높은 케이크 검색 유입을 만든다.
- Google Search/Maps와 ChatGPT 등 AI 검색에서 Verygood Chocolate이 인용될 수 있는 기반을 만든다.
- 유입이 아니라 `케이크 예약 신청`과 `클래스 신청`을 핵심 전환으로 측정한다.

### 현실적인 기대치

- 검색 1위나 AI 답변 노출은 보장할 수 없다. 기술 기반, 실제 고객에게 유용한 고유 콘텐츠, 지역 신뢰 신호, 리뷰와 외부 언급을 함께 쌓아 가능성을 높인다.
- 신규/저권위 도메인은 보통 기술 수정만으로 경쟁 키워드 상위에 오르지 않는다. 3~6개월 단위로 노출과 전환을 개선한다.
- 실제 제공하지 않는 `custom design`, `same-day delivery`, `Sydney-wide delivery`는 사용하지 않는다.

## 2. 2026-07-11 현재 감사 결과

### 치명적(P0)

1. 대표 도메인은 `https://au.verygood-chocolate.com`으로 확정했다. 처음 전달된 `https://au.cakeverygood-chocolate.com`은 사용하지 않는다.
2. `/classes`도 같은 대표 도메인과 앱에서 운영한다.
3. `robots.txt`와 `sitemap.xml` 요청이 전용 파일 대신 앱 HTML을 반환한다.
4. Cloudflare Managed Robots가 여러 AI 봇을 차단한다. ChatGPT 검색 노출에는 학습용 `GPTBot`과 별개인 `OAI-SearchBot` 허용 여부를 명시적으로 확인해야 한다.

### 높음(P1)

1. `/`, `/classes` 등 모든 경로의 서버 HTML이 동일한 title/description을 반환한다.
2. canonical, sitemap, JSON-LD 구조화 데이터가 없다.
3. Vite React SPA라 최초 HTML에는 핵심 본문이 없고 JavaScript 렌더링에 의존한다.
4. 예약, 완료, 조회, 관리자 페이지가 검색 결과에 들어가지 않도록 하는 명확한 `noindex` 전략이 없다.
5. 케이크와 클래스의 검색 의도별 랜딩 페이지가 없다. 현재 홈 한 페이지가 모든 케이크 키워드를 담당한다.

### 콘텐츠/신뢰(P1)

1. 제품 설명은 있으나 제작자, 재료, 제작 방식, 보관법, 알레르기, 주문 리드타임, 인원별 사이즈, 픽업 범위 같은 구매 결정 정보가 부족하다.
2. 실제 고객 후기와 후기 출처, 제작 사례, 업데이트 날짜가 없다.
3. `Pulse - Melrose Park`가 실제 영업장이 아니라 단순 전달 장소라면 LocalBusiness 주소나 Google Business Profile 주소로 사용하면 안 된다.
4. 브랜드명, 전화번호, 주소/서비스 지역, 운영시간의 일관된 사업자 정보가 웹 전반에 부족하다.

## 3. 도메인 및 정보 구조 권장안

### 권장: 하나의 대표 도메인으로 통합

대표 도메인을 `https://au.verygood-chocolate.com`으로 확정하고 아래처럼 운영한다.

- `/cakes` — Sydney made-to-order chocolate cakes 허브
- `/cakes/pave-chocolate-cake` — Pave chocolate cake 상품 랜딩
- `/cakes/gateau-chocolat` — Pound/gateau chocolat 상품 랜딩
- `/cakes/chocolate-cupcakes` — Chocolate cupcakes 상품 랜딩
- `/order` — 예약 폼(검색 랜딩이 아닌 전환 페이지)
- `/classes` — Kids cake decorating classes Sydney 허브
- `/classes/school-holiday-cake-class` — 일정/대상/가격이 명확한 클래스 랜딩
- `/about` — Jenny/Verygood Chocolate의 실제 경험과 제작 철학
- `/faq` 또는 각 랜딩 내부 FAQ — 주문·픽업·보관·알레르기·취소 정책

기존 또는 별도 도메인이 이미 색인됐다면 모든 이전 URL을 가장 가까운 새 URL로 301 리디렉션한다. 단순히 전부 홈으로 보내지 않는다.

### 대안: 케이크 도메인을 분리 유지

운영상 꼭 별도 도메인이 필요할 때만 사용한다. 이 경우 케이크와 클래스 간 교차 링크, 동일한 Organization 식별자, 일관된 브랜드/NAP, 각 도메인의 별도 Search Console 관리가 필요하다. 초기 브랜드 권위가 나뉘므로 권장안보다 불리하다.

## 4. 키워드/검색 의도 맵

정확한 검색량과 난이도는 Google Ads Keyword Planner/Search Console 데이터 연결 후 확정한다. 아래는 현재 Sydney 검색 결과와 실제 상품 적합도를 기준으로 한 1차 클러스터다.

| 우선순위 | 검색 의도 | 대표 영어 키워드 | 연결 페이지 |
|---|---|---|---|
| P1 | 핵심 상품 | chocolate cake Sydney, Sydney chocolate cake, rich chocolate cake Sydney | `/cakes` 및 Pave/Gateau 상품 페이지 |
| P1 | 주문 의도 | made to order cakes Sydney, order chocolate cake Sydney, cake pickup Sydney | `/cakes`, `/order` |
| P1 | 지역 의도 | cakes Melrose Park, chocolate cake Western Sydney, cake pickup Melrose Park | `/cakes` 내 픽업/서비스 지역 섹션 |
| P1 | 클래스 | kids baking classes Sydney, kids cake decorating classes Sydney, cake making class for kids | `/classes` |
| P1 | 시즌 클래스 | school holiday activities Sydney, school holiday baking classes, kids cooking classes school holidays | 시즌별 클래스 랜딩 |
| P2 | 제품 세부 | ganache cake Sydney, gâteau au chocolat Sydney, chocolate cupcakes Sydney | 각 상품 랜딩 |
| P2 | 행사 | birthday chocolate cake Sydney, party cupcakes Sydney | 실제 사용 사례가 있는 상품 랜딩 |
| 보류 | 완전 맞춤 | custom cakes Sydney, bespoke cakes Sydney | 디자인 맞춤 서비스를 실제 제공할 때만 |
| 제외 | 배송 | cake delivery Sydney, same day cake delivery | 배송을 실제 제공하기 전에는 타깃 금지 |

한국어 페이지를 유지한다면 별도 URL(`/ko/...`)과 `hreflang="en-AU"`, `hreflang="ko-AU"`를 사용한다. 브라우저 저장값으로 같은 URL 본문만 바꾸는 현재 방식은 언어별 색인에 불리하다.

## 5. 기술 SEO 구현

### Wave 1: 색인 기반(P0/P1)

1. 대표 도메인 확정 및 DNS/301 리디렉션 설정
2. 실제 텍스트 `robots.txt` 생성
   - Googlebot/Bingbot 허용
   - `OAI-SearchBot` 허용
   - 학습용 봇 허용 여부는 별도 사업 결정
   - `/admin`, 완료/조회 페이지의 크롤링보다 페이지별 `noindex`를 우선
3. 실제 XML `sitemap.xml` 생성 및 canonical URL만 포함
4. 경로별 고유 title, description, canonical, OG URL/이미지
5. `/reserve`, `/complete`, `/lookup`, `/admin/**`, 예약 완료 경로에 `noindex, nofollow` 또는 적절한 인증 처리
6. 정적 사전 렌더링 또는 SSR 도입
   - 최소 대상: `/`, `/cakes`, 상품 랜딩, `/classes`, `/about`
   - 크롤러가 JavaScript 실행 전에도 제목·본문·링크·JSON-LD를 읽을 수 있어야 함
7. 존재하지 않는 URL은 앱 홈 200이 아니라 실제 404 응답

### Wave 2: 구조화 데이터

- 전역: `Organization` + 안정적인 `@id`, 로고, 공식 사이트, 실제 social profile
- 케이크 허브/픽업이 적법한 경우: 적절한 `FoodEstablishment` 또는 `LocalBusiness`
- 상품: `Product` + `Offer`(실제 가격/통화/재고 또는 예약 가능 상태와 화면 내용 일치)
- 클래스: `Event`(날짜가 확정된 개별 세션만), 또는 `Course`/`CourseInstance`
- 내비게이션: `BreadcrumbList`
- FAQ는 사용자에게 실제로 보이는 질문/답변과 동일하게 마크업하되, FAQ rich result 노출 자체를 기대 목표로 삼지 않는다.
- 자체 사업 후기를 `AggregateRating`으로 과장하거나 Google 리뷰를 임의 복제하지 않는다.

### Wave 3: 품질/성능

- Core Web Vitals 측정: LCP, INP, CLS
- hero 이미지 width/height, 반응형 `srcset`, 적절한 preload, 나머지 lazy load
- 이미지 파일명과 alt를 제품/상황에 맞게 구체화
- 내부 링크를 button+pushState만 쓰지 말고 크롤링 가능한 `<a href>`로 제공
- GA4 전환 이벤트: `view_product`, `begin_booking`, `submit_booking`, `class_booking_start`, `class_booking_submit`, 전화/지도 클릭

## 6. 페이지 콘텐츠 설계

### `/cakes`가 즉시 답해야 할 질문

- 무엇을 파는가: small-batch, made-to-order chocolate cakes
- 어디서 받는가: Melrose Park pickup, 정확한 방식
- 언제까지 주문해야 하는가: 실제 최소 리드타임과 마감
- 가격/사이즈/몇 명이 먹는가
- Pave, gâteau au chocolat, cupcakes의 차이
- 재료와 알레르기 정보
- 보관 및 가장 맛있게 먹는 법
- 주문 확정/결제/취소 과정
- 실제 제품 사진과 실제 고객 사용 사례

### `/classes`가 즉시 답해야 할 질문

- 연령/학년, 수업 시간, 정원, 보호자 동반 여부
- Melrose Park의 정확한 수업 장소와 접근 방법
- 아이가 직접 하는 작업과 가져가는 결과물
- 강사 Jenny의 관련 경험과 안전 관리
- 알레르기/식품 안전/취소 정책
- 날짜별 남은 자리와 실제 가격
- 실제 수업 사진, 보호자 후기, 다음 school holiday 일정

### 고유 콘텐츠 아이디어

- “How to choose a chocolate cake size for 6, 10 or 15 guests”
- “Ganache vs buttercream: which chocolate cake suits your celebration?”
- “How to store and serve a gâteau au chocolat in Sydney weather”
- 실제 케이크 제작 과정과 재료 선택 기준
- school holiday 클래스 회차별 결과와 아이들이 배운 기술

대량의 지역명 바꿔치기 페이지는 만들지 않는다. 실제 픽업/배송/서비스가 있고 페이지마다 고유 정보가 있을 때만 지역 랜딩을 만든다.

## 7. Local SEO 및 외부 신뢰

1. 현재는 Google Business Profile을 픽업 장소 주소로 만들지 않는다.
   - Melrose Park의 표시 지점은 홈베이킹 주문을 전달하는 사전 약속 장소이며, 상시 영업장이나 walk-in shop이 아니다.
   - 사이트와 구조화 데이터에서도 해당 위치를 `LocalBusiness` 주소로 선언하지 않는다.
   - 향후 상시 간판이 있는 고객 응대 영업장 또는 실제 배송/방문 서비스가 생기면 적격한 프로필 유형을 다시 검토한다.
2. 사업자명, 전화번호, 웹사이트, 운영시간, 서비스 지역을 모든 채널에서 동일하게 유지
3. Google 리뷰 요청 프로세스 구축: 픽업/수업 종료 후 실제 고객에게 중립적으로 요청
4. Instagram/TikTok에는 제품명, Sydney/Melrose Park, 주문 URL을 일관되게 표기
5. 지역 부모 커뮤니티, school holiday directories, Sydney food/local media에 실제 수업/제품 정보를 제출
6. 협력 장소가 있다면 양쪽 공식 사이트에서 관계와 위치를 정확히 설명하고 링크

## 8. AI 검색(GEO) 전략

- 별도의 “AI용 글”보다 검색 가능한 고품질 원문과 명확한 사실이 우선이다.
- `OAI-SearchBot`이 robots와 Cloudflare WAF에서 허용되는지 실제 user-agent 테스트를 한다.
- 브랜드/제품/위치/가격/옵션/정책을 페이지마다 모순 없이 명시한다.
- 질문형 검색이 인용할 수 있도록 핵심 답을 명확한 문단, 표, FAQ로 제공한다.
- 제작자 이름, 실제 경험, 원본 사진, 날짜가 있는 클래스 정보처럼 다른 사이트가 복제할 수 없는 1차 정보를 늘린다.
- 독립적인 지역 사이트와 실제 고객 후기에서 브랜드가 자연스럽게 언급되도록 한다.
- `llms.txt`는 선택 사항일 뿐 Google AI 노출의 랭킹 수단으로 취급하지 않는다.
- 월별로 ChatGPT/Google AI Mode의 고정 질문 세트를 수동 기록하되, 개인화와 변동성이 있으므로 순위 KPI가 아니라 `언급/인용/정확성`을 본다.

## 9. 측정 체계

### 초기 설정

- Google Search Console: 대표 도메인 속성, sitemap 제출, URL 검사
- Bing Webmaster Tools: sitemap 제출 및 색인 상태
- GA4 또는 프라이버시 친화 analytics: 예약 퍼널 이벤트
- Google Business Profile Performance: 검색/지도 조회, 웹사이트 클릭, 전화, 길찾기
- UTM 규칙: Google Business Profile, Instagram, school holiday directory

### KPI

- 선행: 유효 색인 페이지 수, 크롤 오류, rich result 오류, non-brand impressions, 지도 노출
- 중간: 목표 쿼리 Top 20/10 진입 수, organic CTR, 랜딩별 engagement, AI 인용/링크 관찰
- 비즈니스: organic 예약 신청 수, 클래스 신청 수, 신청 완료율, 실제 확정 예약 수

### 기준 질문 세트

- best chocolate cake in Sydney
- made-to-order chocolate cake Sydney pickup
- chocolate cake near Melrose Park NSW
- rich ganache cake Sydney
- kids cake decorating classes Sydney
- school holiday baking classes for kids Sydney

## 10. 30 / 60 / 90일 실행 순서

### 0~30일

- 대표 도메인 결정, DNS/리디렉션 정상화
- robots/sitemap/404/noindex/canonical 수정
- `/cakes`, 제품 3개, `/classes`, `/about` 정적 랜딩 구축
- 기본 Organization/Product/Class 구조화 데이터
- Search Console/Bing/GA4 연결과 기준 데이터 기록
- Google Business Profile 적격성 검토 및 정확한 프로필 구성

### 31~60일

- 실제 FAQ, 사이즈 가이드, 재료/알레르기/보관 정보 게시
- 제품 및 클래스 원본 사진/영상 보강
- 실제 고객 후기 요청 흐름 시작
- school holiday 개별 일정 페이지 및 Event/Course 데이터
- 내부 링크/성능/Core Web Vitals 개선

### 61~90일

- Search Console 실제 쿼리로 title/콘텐츠 개선
- 전환이 확인된 세부 검색 의도 콘텐츠 2~4개 발행
- 지역 디렉터리/파트너/미디어 인용 확보
- AI/검색 기준 질문의 언급, 인용 URL, 잘못된 정보 수정 여부 점검
- 주문 데이터에 따라 customisation 또는 delivery 랜딩 확장 여부 결정

## 11. 구현 전 확인이 필요한 사업 정보

1. 고객이 연락할 공개 호주 전화번호와 공식 SNS URL
2. 실제 맞춤 가능 범위: 문구, 색상, 장식, 디자인, 알레르기 대응
3. 향후 배송 계획과 실제 배송 지역
4. Jenny의 공개 가능한 경력/자격/브랜드 스토리
5. Search Console과 GA4의 기존 계정/소유권 여부

## 12. 완료 기준

- 모든 공개 랜딩 URL이 고유한 server-rendered title, description, canonical, 본문을 가진다.
- robots와 sitemap이 올바른 Content-Type/본문/상태 코드로 응답한다.
- 공개 랜딩은 200, 제거 URL은 301/410, 존재하지 않는 URL은 404를 반환한다.
- 예약/개인/관리 페이지는 검색 색인에서 제외된다.
- 구조화 데이터가 화면 내용과 일치하고 검증 도구의 치명적 오류가 없다.
- Google/Bing이 sitemap을 처리하고 주요 페이지가 색인된다.
- 예약과 클래스 신청의 organic 전환을 월별로 측정할 수 있다.
