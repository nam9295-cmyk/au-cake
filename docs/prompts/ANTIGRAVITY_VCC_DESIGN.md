당신은 Antigravity/Gemini 프론트 디자인 담당자입니다. Hermes가 총괄하고, Codex가 AU/KR 설정/기능 분리를 맡습니다. 당신은 cake 예약 앱의 customer-facing UI 디자인을 `kr.verygood-chocolate.com`/`vcc_page` 스타일로 바꾸는 역할입니다.

작업 위치: /home/john/workspace/cake
참고 계획: docs/planning/AU_CAKE_REDESIGN_PLAN.md
디자인 참고 레포: /home/john/workspace/vcc_page
특히 참고:
- /home/john/workspace/vcc_page/src/index.css
- /home/john/workspace/vcc_page/src/components/sections/HeroSection.jsx
- /home/john/workspace/vcc_page/src/components/sections/HeroSection.css
- /home/john/workspace/vcc_page/src/components/sections/CakeReservationSection.jsx
- /home/john/workspace/vcc_page/src/components/sections/CakeReservationSection.css

목표:
기존 `cake` 앱의 예약 기능을 보존하면서, 현재 브라운/베이지 모바일형 디자인을 VCC/Hartzler billboard 스타일로 전환하세요. 단순히 예쁜 쇼케이스가 아니라 예약 전환이 좋은 페이지여야 합니다.

디자인 토큰:
- background/canvas: #ffffff
- forest green: #035542 (로고, outline button, interactive border)
- billboard blue: #2b7bb9 (보조 outline/링크 stroke 정도)
- cream teal: #56dddb (대형 display word, 리본 태그)
- butter yellow: #f9e9a9 (alternate 대형 display word)
- charcoal: #333333 (본문/기본 border)
- font: Work Sans 400/500/900
- display type: 96px mobile, 170px tablet, 290px desktop 근처 / weight 900 / line-height 0.7
- 버튼: filled 금지에 가깝게, outline/pill 위주, radius 20px 또는 100px
- 그림자/글래스/그라데이션/두꺼운 카드 UI 금지

반드시 살릴 기능:
- Home에서 예약 CTA
- 상품별 예약 버튼
- `/reserve` 예약 폼
- `/lookup` 예약 조회
- `/admin/login`, `/admin`, `/admin/reservations` 관리자 기능
- Appwrite/repository 로직은 건드리지 마세요.

디자인 요구사항:
1. Home hero를 VCC 스타일 billboard로 재구성하세요.
   - 큰 단어 예: `CAKE`, `RESERVE`, `VERY GOOD`
   - 케이크 제품 사진을 크게 배치
   - 리본 태그: `CHOCOLATE CAKE`, `PICKUP`, `LIMITED`, `RESERVE`
   - 첫 화면에 명확한 outline/pill CTA: `Reserve a Cake` 또는 market copy와 연결 가능하면 연결
2. 상품 섹션은 일반 카드 박스보다 제품 쇼케이스처럼 보이게 하세요.
   - 사진 중심
   - 이름/가격/사이즈/짧은 설명
   - outline 예약 버튼
3. 예약 안내는 `ORDER GUIDE` 같은 대형 typography 섹션으로 바꾸되 실용 정보가 보이게 하세요.
4. 예약 폼(`/reserve`)은 기능을 유지하면서 같은 디자인 언어로 정리하세요.
   - 너무 장식적이면 안 됨. 입력 가능성과 오류 메시지 가독성 우선.
   - 라디오 옵션/수량/date/time/contact fields가 명확해야 함.
5. 모바일에서 대형 타이포가 넘쳐 UX를 해치지 않게 clamp/media query로 조정하세요.
6. 관리자 화면은 크게 손대지 않아도 됩니다. 단, 전역 스타일 변경으로 깨지지 않게 보호하세요.

중요 제약:
- Appwrite, repository, data schema, 실제 예약 데이터 로직 변경 금지.
- 배포 금지.
- 커밋 금지.
- Codex가 설정/문구 분리를 할 수 있으므로, 텍스트 하드코딩 대수술보다 레이아웃/스타일 중심으로 작업하세요.
- `node_modules`, `dist`는 건드리지 마세요.

검증:
- `npm run build`
- 가능하면 `npm run lint`
- 변경 파일 요약
- customer-facing 화면에서 어떤 디자인 요소를 반영했는지 한국어 요약
