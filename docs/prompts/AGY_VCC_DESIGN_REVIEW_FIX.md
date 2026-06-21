당신은 Google Antigravity(agy) 기반 UI/UX 디자인 리뷰 및 제한적 수정 담당자입니다. Hermes가 총괄합니다.

작업 위치: /home/john/workspace/cake
현재 확인 URL: http://100.77.126.93:5179 (AU dev server, 사용자가 직접 확인 가능)
디자인 참고 레포: /home/john/workspace/vcc_page
중요 참고 파일:
- /home/john/workspace/vcc_page/src/index.css
- /home/john/workspace/vcc_page/src/components/sections/HeroSection.jsx
- /home/john/workspace/vcc_page/src/components/sections/HeroSection.css
- /home/john/workspace/vcc_page/src/components/sections/CakeReservationSection.css

현재 상태:
- 기존 cake 예약 앱에 AU/KR market config가 이미 추가되어 있습니다.
- `VITE_MARKET=AU npm run build`, `npm run build`, `npm run lint`가 이전 단계에서 통과했습니다.
- 디자인은 1차로 VCC/Hartzler 스타일을 적용했습니다.
- 사용자는 “사진은 직접 누끼 따서 바꿀 예정”입니다. 따라서 이미지 파일 자체를 만들거나 교체하지 마세요.

당신의 목표:
현재 customer-facing UI를 리뷰하고, 필요한 최소 수정으로 더 완성도 있게 다듬어 주세요.

중요 제약:
1. Appwrite, repository, data schema, 실제 예약 데이터 로직은 건드리지 마세요.
2. 배포하지 마세요.
3. 커밋하지 마세요.
4. 이미지 파일을 생성/교체하지 마세요. 사용자가 나중에 누끼 이미지로 바꿀 예정입니다.
5. 관리자 화면은 기능/가독성 유지가 우선입니다. customer-facing 화면 중심으로 개선하세요.
6. AU/KR market config를 깨뜨리지 마세요.
7. 큰 리팩터링 금지. 디자인 polish와 obvious UX 개선만 하세요.

디자인 기준:
- kr.verygood-chocolate.com / vcc_page 스타일
- 흰 캔버스
- Work Sans 400/500/900
- 대형 billboard typography
- forest green #035542
- cream teal #56dddb
- butter yellow #f9e9a9
- charcoal #333333
- outline/pill 버튼
- 얇은 라인과 제품 중심 쇼케이스
- 그림자/글래스/그라데이션/브라운 모바일 shell 금지

특히 봐야 할 문제:
1. 히어로에서 큰 타이틀과 이미지가 겹쳐 가독성이 나빠지는지
2. 사용자가 나중에 투명 누끼 이미지를 넣었을 때도 잘 맞는 구조인지
3. 모바일에서 `CAKE` 대형 타이포/히어로 이미지/CTA가 과하게 겹치지 않는지
4. 예약 CTA가 첫 화면에서 명확한지
5. 제품 카드와 예약 안내가 kr 사이트의 브랜드감과 맞는지
6. `/reserve`, `/lookup` customer-facing 화면이 AU 영어 모드에서 너무 한국어가 많이 남아 있지 않은지

허용 수정:
- `src/index.css` polish
- `src/App.tsx`의 customer-facing className/라벨/장식 요소 소폭 수정
- market-aware 라벨 보완 소폭 수정
- README/docs에 짧은 리뷰 메모 추가 가능

검증:
반드시 실행하세요.
- npm run build
- npm run lint
- VITE_MARKET=AU npm run build

완료 후 다음 내용을 한국어로 출력하세요.
1. 수정한 디자인 포인트
2. 변경 파일 목록
3. 검증 결과
4. 사용자가 교체할 이미지 권장 스펙
