# Verygood Cake Reservation

베리굿초콜릿 단일 케이크 `Gâteau au Chocolat` 예약 사이트입니다.

## 구현 범위

- 고객 랜딩 페이지
- 고객 예약 신청 페이지
- 예약 신청 완료 페이지
- 예약 조회 페이지
- Appwrite DB 연결
- Appwrite 스키마 자동 생성 스크립트
- 관리자 로그인
- 관리자 대시보드
- 관리자 예약 목록/상세
- 예약/입금 상태 변경
- 관리자 메모 저장
- 문자 복사
- CSV 다운로드

## 실행

```bash
npm install
npm run dev
```

Appwrite 환경변수가 없으면 로컬 데모 저장소로 실행됩니다.

## Market 빌드

`VITE_MARKET`로 빌드 대상 market을 선택합니다. 기본값은 `KR`입니다.

```bash
VITE_MARKET=KR npm run build
VITE_MARKET=AU npm run build
```

- `KR`: `ko-KR`, `KRW`, 한국 전화번호 검증, 기존 한국어 상품/문구
- `AU`: `en-AU`, `AUD`, Australia/Sydney 기준 날짜, 호주 전화번호 검증, 영어 상품/문구

AU 가격과 기본 운영 문구는 `src/lib/market.ts`에 모아 두었습니다. 실제 AU 가격이 확정되면 `MARKET_CONFIG.AU.products`, `cakeSizeOptions`, `cacaoOptions`, `defaultSettings`만 수정하면 됩니다.

## Appwrite 설정

`.env.example`을 `.env.local`로 복사한 뒤 값을 채웁니다.

```bash
npm run setup:appwrite
```

스크립트는 다음 리소스를 생성합니다.

- database: `APPWRITE_DATABASE_ID`
- collection: `reservations`
- collection: `settings`
- reservations/settings attributes
- 예약 목록 필터용 indexes
- 기본 settings 문서

관리자 화면은 Appwrite Auth 계정으로 로그인합니다. Appwrite 콘솔에서 운영자 이메일 계정을 먼저 생성하세요.

`APPWRITE_ADMIN_USER_IDS`를 반드시 지정한 뒤 `npm run setup:appwrite`를 실행하세요. 이 값이 비어 있으면 개인정보 권한이 넓어지는 설정을 만들지 않고 setup script가 중단됩니다.

### AU/KR Appwrite 분리

한국 사이트와 호주 사이트는 database 또는 collection id를 분리해서 운영하는 것을 권장합니다.

```bash
# KR 예시
VITE_MARKET=KR
VITE_APPWRITE_CAKE_DATABASE_ID=verygood_cake_kr
VITE_APPWRITE_CAKE_RESERVATIONS_TABLE_ID=reservations
VITE_APPWRITE_SETTINGS_TABLE_ID=settings
APPWRITE_CAKE_DATABASE_ID=verygood_cake_kr
APPWRITE_CAKE_RESERVATIONS_TABLE_ID=reservations
APPWRITE_SETTINGS_TABLE_ID=settings

# AU 예시
VITE_MARKET=AU
VITE_APPWRITE_CAKE_DATABASE_ID=verygood_cake_au
VITE_APPWRITE_CAKE_RESERVATIONS_TABLE_ID=reservations
VITE_APPWRITE_SETTINGS_TABLE_ID=settings
APPWRITE_CAKE_DATABASE_ID=verygood_cake_au
APPWRITE_CAKE_RESERVATIONS_TABLE_ID=reservations
APPWRITE_SETTINGS_TABLE_ID=settings
```

같은 database를 써야 한다면 `reservations_kr/settings_kr`, `reservations_au/settings_au`처럼 collection id를 분리하세요. 기존 KR 예약번호는 과거 `VG-C-YYYYMMDD-...` 형식일 수 있고, 신규 예약은 `VG-C-KR-...` 또는 `VG-C-AU-...` prefix를 사용합니다.

## 이메일 알림 설정

예약 신청이 Appwrite DB에 저장된 뒤 Appwrite Function이 Resend로 내부 운영자 알림 메일을 보냅니다. 고객에게는 이메일을 보내지 않습니다.

```bash
RESEND_API_KEY=
RESEND_FROM_EMAIL="Reservation <reservation@example.com>"
RESEND_TO_EMAILS="owner@example.com"
```

Function 리소스와 배포는 아래 명령으로 생성/업데이트합니다.

```bash
npm run deploy:reservation-notification
```

이 명령에 사용하는 `APPWRITE_API_KEY`에는 최소 `functions.read`, `functions.write` 스코프가 필요합니다. 배포 후 실행 로그까지 CLI에서 확인하려면 `execution.read`도 추가하세요.

기본 함수 ID는 `reservation-notification`이며 현재 운영 Appwrite 인스턴스와 호환되는 기본 런타임은 `node-16.0`입니다. 기본 이벤트는 `tablesdb.{APPWRITE_CAKE_DATABASE_ID}.tables.{APPWRITE_CAKE_RESERVATIONS_TABLE_ID}.rows.*.create`와 기존 `databases.{APPWRITE_CAKE_DATABASE_ID}.collections.{APPWRITE_CAKE_RESERVATIONS_TABLE_ID}.documents.*.create`를 순서대로 시도하며, 필요하면 `APPWRITE_RESERVATION_CREATE_EVENT`로 직접 지정할 수 있습니다.

메일 발송 실패는 예약 데이터를 삭제하거나 되돌리지 않습니다. 실패 내용은 Appwrite Function 로그에 남습니다.

## 예약 API와 권한

신규 설치는 우선 `VITE_RESERVATION_API_MODE=off`, `APPWRITE_RESERVATION_WRITE_MODE=direct`로 기존 저장 흐름을 유지합니다. 서버 검증 Function을 배포하고 조회/저장을 단계별로 확인한 뒤에만 공개 DB 생성 권한을 닫습니다.

전체 배포·검증·롤백 순서는 [예약 API 무중단 전환 체크리스트](docs/RESERVATION_API_ROLLOUT.md)를 따르세요. `scripts/set-reservation-write-mode.mjs`는 `--apply`가 없으면 항상 dry-run이며, Function 배포 명령은 컬렉션 권한을 변경하지 않습니다.
