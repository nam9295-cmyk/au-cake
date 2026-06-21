Gemini/Antigravity CLI가 인증 문제로 실행되지 않아, Codex가 프론트 디자인 fallback 구현을 맡습니다.

작업 위치: /home/john/workspace/cake
참고 계획: docs/planning/AU_CAKE_REDESIGN_PLAN.md
디자인 참고 레포: /home/john/workspace/vcc_page
특히 참고:
- /home/john/workspace/vcc_page/src/index.css
- /home/john/workspace/vcc_page/src/components/sections/HeroSection.jsx
- /home/john/workspace/vcc_page/src/components/sections/HeroSection.css
- /home/john/workspace/vcc_page/src/components/sections/CakeReservationSection.css

현재 상태:
- AU/KR market config 분리는 이미 일부 구현되어 있고 `npm run build`, `npm run lint`가 통과했습니다.
- 이제 customer-facing UI를 VCC/Hartzler billboard 스타일로 바꿔야 합니다.

목표:
기존 예약 기능을 보존하면서 현재 브라운/베이지 모바일형 디자인을 `kr.verygood-chocolate.com` 느낌으로 재구성하세요.

디자인 토큰:
- white canvas: #ffffff
- forest green: #035542
- billboard blue: #2b7bb9
- cream teal: #56dddb
- butter yellow: #f9e9a9
- charcoal: #333333
- font: Work Sans 400/500/900
- billboard word: 96px mobile, 170px tablet, 290px desktop 근처, weight 900, line-height 0.7
- outline/pill buttons, minimal shadows, no brown mobile shell, no glass/gradient/heavy cards

구현 범위:
1. `src/index.css` 중심으로 customer-facing layout/style을 VCC 스타일로 바꾸세요.
2. 필요하면 `src/App.tsx`의 HomePage/ReservePage 마크업에 className이나 decorative text를 조금 추가해도 됩니다.
3. 관리자 화면은 기능/가독성이 깨지지 않게 유지하세요. admin-shell 쪽은 과도하게 바꾸지 마세요.
4. Appwrite/repository/data schema/actual env/deploy는 건드리지 마세요.
5. AU/KR market config 기능을 망가뜨리지 마세요.
6. 가능하면 남아 있는 고객-facing 한국어 라벨 중 AU에서 어색한 핵심 라벨(가격/옵션/제품/수량/사이즈/픽업일/연락처/개인정보 등)을 market-aware로 약간 정리하세요. 너무 큰 리팩터링은 하지 마세요.

검증:
- npm run build
- npm run lint
- 변경 파일 요약
- 커밋/배포 금지

완료 후 한국어 요약을 남기세요.
