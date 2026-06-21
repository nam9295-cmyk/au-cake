# AU Cake Reservation Redesign Plan

## 목표

기존 `cake.verygood-chocolate.com` 예약 기능은 유지하면서, 호주에서 제니가 사용할 수 있는 AU 전용 케이크 예약 사이트를 만든다. 시각 디자인은 `kr.verygood-chocolate.com`/`vcc_page`의 Hartzler Family Dairy 스타일을 기준으로 재구성한다.

## 역할 분담

- Hermes: 총괄/통합/검증. 두 에이전트 작업 충돌 관리, build/lint/browser smoke test, 보안 점검.
- Antigravity/Gemini: 프론트 디자인. VCC/Hartzler 스타일을 cake 앱에 적용하고 예약 전환이 좋은 UI로 개선.
- Codex: 기능/설정 분리. AU/KR 설정 구조, 통화/문구/전화번호/시간대/은행 정보/관리자 설정, Appwrite 스키마 호환성 정리.

## 기준 레포

- 현재 작업 레포: `/home/john/workspace/cake`
- 디자인 참고 레포: `/home/john/workspace/vcc_page`
- 디자인 참고 파일:
  - `/home/john/workspace/vcc_page/src/index.css`
  - `/home/john/workspace/vcc_page/src/components/sections/HeroSection.jsx`
  - `/home/john/workspace/vcc_page/src/components/sections/HeroSection.css`
  - `/home/john/workspace/vcc_page/src/components/sections/CakeReservationSection.jsx`
  - `/home/john/workspace/vcc_page/src/components/sections/CakeReservationSection.css`

## 현재 cake 앱 구조 요약

- Vite + React + TypeScript
- 단일 파일 중심 UI: `src/App.tsx`
- 스타일: `src/index.css`
- Appwrite 설정: `src/lib/appwrite.ts`
- 예약 저장/조회/관리자 로그인: `src/lib/repository.ts`
- 상품/가격/문구/운영시간 기본값: `src/lib/constants.ts`
- 타입: `src/lib/types.ts`
- 유틸: `src/lib/utils.ts`
- Appwrite 스키마 생성: `scripts/setup-appwrite.mjs`
- 알림 함수: `functions/reservation-notification/src/main.js`

## 디자인 방향

Hartzler/VCC 스타일 핵심:

- 흰 배경 `#ffffff`
- Work Sans 400/500/900
- 대형 billboard word: 96px → 170px → 290px, weight 900, line-height 0.7
- Display accent: teal `#56dddb`, butter yellow `#f9e9a9`
- Interactive/brand: forest green `#035542`
- Text/border: charcoal `#333333`
- 버튼은 filled가 아니라 outline/pill 위주
- 그림자/글래스/그라데이션 금지
- 제품 누끼 이미지가 히어로
- 리본형 category tag 활용

케이크 예약 전환을 위해 반드시 추가/유지:

- 첫 화면에 명확한 예약 CTA
- 가격, 사이즈, 픽업 가능 시간, 예약 절차 명확화
- 모바일에서도 예약 버튼이 바로 보이기
- 예약 신청/조회/관리자 기능 유지

## AU/KR 설정 구조 제안

새 파일 후보:

- `src/lib/market.ts` 또는 `src/lib/markets.ts`

시장별 설정 예시:

```ts
export type Market = 'KR' | 'AU'

export const MARKET_CONFIG = {
  KR: {
    locale: 'ko-KR',
    currency: 'KRW',
    timezone: 'Asia/Seoul',
    phoneRegex: /^0\d{1,2}-?\d{3,4}-?\d{4}$/,
    phoneHelp: '예: 01012345678',
    reservationCodePrefix: 'VG-C-KR',
    copy: { ... },
  },
  AU: {
    locale: 'en-AU',
    currency: 'AUD',
    timezone: 'Australia/Sydney',
    phoneRegex: /^(\+?61|0)[2-478](?:[ -]?\d){8}$/,
    phoneHelp: 'Example: 0412 345 678',
    reservationCodePrefix: 'VG-C-AU',
    copy: { ... },
  },
}
```

시장 선택은 우선 `VITE_MARKET=AU` 환경변수로 빌드 타임 분기한다. 나중에 한 앱에서 `/kr`, `/au` 라우팅이 필요하면 확장 가능하게 한다.

## Appwrite/보안 주의점

현재 README 기준 권한은:

- reservations: 고객 create 가능, 로그인 사용자 read/update/delete
- settings: 고객 read 가능, 로그인 사용자 write

주의:

- 예약 조회는 클라이언트에서 reservationNumber로 문서 조회 후 전화번호 검증한다. 컬렉션 read 권한이 public이면 개인정보 노출 위험이 있다.
- setup script는 `APPWRITE_ADMIN_USER_IDS`가 비어 있으면 `Role.users()`에게 read/update/delete를 준다. 운영에서는 반드시 관리자 user id를 지정해야 한다.
- 장기적으로 예약 조회는 Appwrite Function/server API로 `예약번호 + 전화번호` 검증 후 필요한 필드만 반환하는 방식이 더 안전하다.

이번 작업 범위에서는 다음을 목표로 한다:

1. 운영 README/.env.example에 관리자 user id 필수 주석 추가
2. AU/KR 컬렉션 분리 또는 database id 분리 가능하게 env 정리
3. 기능 변경 중 public read 권한을 새로 넓히지 않기

## 구현 우선순위

1. 기준 상태 확인: `npm run build` 통과 완료.
2. Codex: AU/KR market config 분리, currency/phone/copy/SMS/CSV/settings 정리.
3. Antigravity: VCC/Hartzler 디자인으로 customer-facing UI 재구성. 관리자 화면은 기능 유지 우선, 과도한 redesign 금지.
4. Hermes: 충돌 해결, build/lint, browser smoke test.
5. 필요 시 Appwrite schema/setup script 보완.

## 완료 기준

- `npm run build` 성공
- 가능하면 `npm run lint` 성공 또는 기존 lint 이슈 분류
- `/`, `/reserve`, `/lookup`, `/admin/login` 기본 화면 동작
- AU 모드에서 영어/AUD/호주 전화번호/호주 문구 표시
- KR 모드가 크게 깨지지 않음
- 예약 데이터 구조가 기존 Appwrite와 최대한 호환됨
- 디자인이 kr.verygood-chocolate.com의 billboard/product/ribbon/outline-button 감성을 반영함
