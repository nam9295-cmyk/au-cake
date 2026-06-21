당신은 Codex 구현 담당자입니다. Hermes가 총괄하고, Antigravity/Gemini가 프론트 디자인을 맡습니다. 당신은 디자인 구현을 크게 건드리지 말고 AU/KR 기능/설정 분리를 담당하세요.

작업 위치: /home/john/workspace/cake
참고 계획: docs/planning/AU_CAKE_REDESIGN_PLAN.md

목표:
기존 한국 케이크 예약 앱을 유지하면서, 호주용 예약 사이트로 빌드할 수 있게 market config를 분리하세요. 기능은 고객 예약/조회/관리자 흐름을 보존해야 합니다.

핵심 요구사항:
1. `src/lib/market.ts` 또는 유사 파일을 만들어 KR/AU 설정을 분리하세요.
   - market 선택: `import.meta.env.VITE_MARKET`, 기본값은 `KR`, 값은 `KR` 또는 `AU`.
   - KR은 기존 문구/가격/통화/전화 검증을 최대한 유지.
   - AU는 영어 문구, AUD 통화, Australia/Sydney timezone 기준 가능성을 반영.
2. `formatCurrency`가 market의 locale/currency를 사용하도록 변경하세요.
   - KR: ko-KR/KRW, maximumFractionDigits 0
   - AU: en-AU/AUD, 일반 AUD 표시
3. 전화번호 검증/도움말을 market별로 분리하세요.
   - KR: 기존 한국 휴대폰/전화 패턴 유지
   - AU: `+61` 또는 `0`으로 시작하는 호주 번호를 허용하는 실용적인 검증
4. 예약번호 prefix를 market별로 분리하세요.
   - KR 예: `VG-C-KR-YYYYMMDD-...`
   - AU 예: `VG-C-AU-YYYYMMDD-...`
   - 기존 예약 조회 호환성을 위해 너무 파괴적이면 주석/마이그레이션 고려를 남기세요.
5. 상품/기본 설정/문구를 market별로 분리하세요.
   - KR: 기존 한국어 상품/가격 유지
   - AU: 영어 상품명/설명/notice/guide copy와 AUD placeholder 가격으로 구성
   - 실제 AU 가격은 john/제니가 나중에 확정할 수 있게 코드상 한 곳에서 수정 가능해야 합니다.
6. `BankAccountBox`, SMS message, CSV headers 등 하드코딩된 한국어/한국 계좌/주소 문구를 market config 기반으로 바꾸세요.
7. `StoreSettings` 타입에 필요한 필드를 추가해도 되지만 Appwrite 기존 문서와 호환되도록 fallback을 안전하게 처리하세요.
8. `scripts/setup-appwrite.mjs`와 README를 최소 보완하세요.
   - AU/KR env 예시
   - 운영에서 `APPWRITE_ADMIN_USER_IDS`를 반드시 지정해야 개인정보 read/update 권한이 넓어지지 않는다는 경고
   - AU용 database/collection 분리 방법 안내

중요 제약:
- 고객 예약/조회/관리자 기능을 깨뜨리지 마세요.
- Appwrite 실제 데이터에 접근하거나 변경하지 마세요.
- 배포하지 마세요.
- 커밋하지 마세요.
- Antigravity가 맡을 디자인 CSS 대수술은 하지 마세요. 필요한 UI 문구 연결 정도만 하세요.
- `node_modules`, `dist`는 커밋 대상이 아닙니다.

검증:
- `npm run build`
- 가능하면 `npm run lint`도 실행하되, 실패 시 원인 요약
- 변경 파일 요약

완료 후 한국어로 요약을 남기세요.
