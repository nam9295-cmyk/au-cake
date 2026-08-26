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
# 실제 Appwrite 변경
npm run setup:appwrite

# credential, .env.local 로드, network 호출 없이 리뷰 schema 계획만 출력
node scripts/setup-appwrite.mjs --dry-run
```

스크립트는 다음 리소스를 생성합니다.

- database: `APPWRITE_CAKE_DATABASE_ID`
- collections: `reservations`, `settings`, `review_invites`, `reviews`, `review_coupons`, `review_photo_cleanup`
- Storage bucket: `review-photos` (1.5MB, jpg/jpeg/png/webp, encryption/antivirus)
- reservations/settings/review attributes와 조회·unique indexes
- 기본 settings 문서

리뷰 컬렉션과 사진 bucket에는 공개 read/create/update/delete 권한을 주지 않습니다. `APPWRITE_ADMIN_USER_IDS`의 정확한 사용자 role에만 필요한 read/update/delete 권한을 부여하고, 리뷰·쿠폰·사진 생성은 server Function API key 경로를 전제로 합니다. 기존 review resource의 속성, index, 권한 또는 bucket 제한이 정의와 다르면 setup은 자동 삭제/재생성하지 않고 drift 오류로 중단합니다.

리뷰 사진 업로드는 browser가 Storage file ID나 파일명을 지정하는 방식이 아닙니다. Review API의 `upload-photo`가 정확한 43자 초대 token과 canonical WebP base64를 검증하고, **초대당 누적 10회**, 1.5MB, 단일 frame, **입력 8MP 이하** 제한을 적용한 뒤 metadata 제거/회전/최대 1600×1600 WebP 재인코딩을 수행합니다. Storage 생성 전에 `staged_upload`/`staging` cleanup intent를 먼저 예약하고, 5분 grace 뒤 reconciler가 미완료 upload를 회수할 수 있게 해 Storage 성공 직후 process crash에도 file ID가 ledger 없이 남지 않게 합니다. attachment transaction은 새 파일의 staged intent 삭제, 기존 파일의 cleanup intent 생성, invite의 `pendingPhotoFileId` 교체를 함께 commit합니다. `remove-photo`와 초대 token rotation도 기존 파일 cleanup intent 생성과 optional string의 명시적 `null` unlink를 같은 transaction에서 처리합니다. `load-invite`는 `hasPhoto` boolean만 반환하며 private file ID를 반환하지 않습니다.

cleanup ledger의 reason은 `replacement | remove | rotation | uncertain_attach | staged_upload`, status는 `staging | pending | failed`입니다. 운영자는 Appwrite 인증을 통과하고 `REVIEW_ADMIN_USER_IDS`에 포함된 세션에서 Review API에 `{ "action": "cleanup-photo-files", "data": { "limit": 25 } }`를 호출해 최대 25건씩 재처리합니다. Storage 404는 이미 삭제된 것으로 수렴시키고 ledger를 제거합니다. `staged_upload`/`uncertain_attach`는 invite를 다시 읽어 현재 참조 중이면 Storage를 삭제하지 않고 ledger만 해결합니다. 삭제 실패 누적 9회는 `failed`로 dead-letter되어 pending query에서 제외되므로 오래된 25개 poison row가 새 cleanup을 영구 차단하지 않습니다. 응답은 `processed/deleted/retained/failed` 집계만 제공하며 private file ID나 고객 데이터는 반환·기록하지 않습니다. `failed` row는 Appwrite admin에서 원인 확인 후 status/attempts를 명시적으로 reset해야 재시도됩니다.

리뷰 제출 시 reward는 client의 `hasPhoto`, `photoFileId`, consent 값이 아니라 submit transaction에서 다시 읽은 invite의 pending server file 유무만으로 10%/5%를 결정합니다. 사진이 없으면 review의 `photoPublishConsent`는 항상 `false`로 기록됩니다. rollback 시 pending private 파일은 재시도를 위해 유지되고, commit 후에도 moderation 전에는 공개 file permission을 부여하지 않습니다.

`--dry-run`은 shell에서 전달한 resource ID와 안전한 기본값만으로 database/collection/attribute/index/bucket/permission 계획을 출력합니다. API key, endpoint, secret 또는 `.env.local` 값은 읽거나 출력하지 않으며, 관리자 ID가 없으면 `adminUserCount: 0`, `wouldFailApply: true`로 표시합니다.

리뷰 보상률은 Appwrite integer attribute에서 `min=5`, `max=10`으로 저장 범위를 제한하고, review API runtime에서 허용값을 정확히 `5 | 10`으로 다시 강제합니다. DB bound 5..10은 중간 정수를 상품 규칙으로 허용한다는 뜻이 아닙니다.

기존 `reservations`에는 프로모션 감사용 optional 필드 `subtotalCents`, `discountPercent`, `discountCents`, `appliedPromoCodeLast4`, `reviewCouponId`가 추가됩니다. 리뷰 resource ID는 `APPWRITE_*`/`VITE_APPWRITE_*` 쌍으로 설정할 수 있으며, 미지정 시 `.env.example`의 안전한 기본 ID를 사용합니다.

### Cake customer email schema rollout

Cake booking requests require a normalized customer email, but the Appwrite `reservations.customerEmail` string attribute (maximum 120 characters) must remain **optional** so historical reservations without an email continue to load. For production, apply this compatibility migration in this exact order: (1) create and wait for the optional attribute to become available, (2) verify the schema, (3) deploy the reservation API/backend, then (4) deploy the frontend. Do not deploy the frontend before the attribute is available.

리뷰 쿠폰 digest에는 server-only `REVIEW_COUPON_HMAC_SECRET` 하나만 사용합니다. 최소 32 random bytes를 padding 없는 canonical base64url로 인코딩한 값을 만들고, **Review API(발급)와 Reservation API(사용)에 글자 하나까지 동일한 값**을 설정하세요. 예시는 `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`로 생성할 수 있습니다. 이 값은 `VITE_*`로 노출하거나 저장소에 채워 넣지 않으며 `.env.example`은 빈 값만 둡니다. 이미 발급되어 `active`인 쿠폰이 하나라도 있으면 secret을 회전하지 마세요. 회전하면 기존 쿠폰 digest를 다시 찾을 수 없습니다. 두 Function 배포 dry-run은 변수 이름과 masked 값만 보여 주며 원문 secret을 출력하지 않습니다.

이 명령은 실제 Appwrite 리소스를 변경합니다. production migration은 별도 승인과 백업/롤백 확인 후에만 실행하세요. 로컬 스키마 검증에는 네트워크를 사용하지 않는 `npm run test:review-schema`를 사용합니다.

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

예약 신청이 Appwrite DB에 저장된 뒤 Appwrite Function이 Resend로 내부 운영자 알림과 별도의 고객용 “예약 요청 접수” 이메일을 각각 보냅니다. 이 고객 이메일은 최종 확정이 아니며, 확인 후 별도 확정 안내가 발송된다는 내용을 포함합니다. cake는 `customerEmail`, 키즈 클래스는 `parentEmail`을 수신자로 사용합니다.

고객용 transactional email은 한 통 안에서 **한국어 우선, 영어 병기**로 제공합니다. cake/class의 예약 요청 접수와 관리자 버튼으로 보내는 최종 예약 확정 이메일, 리뷰 요청, 리뷰 리워드 쿠폰 이메일이 이 정책을 따릅니다. 내부 운영자 예약 알림은 고객용 메일이 아니므로 이 bilingual 요구사항의 대상이 아니며 기존 내부 템플릿을 유지합니다.

```bash
RESEND_API_KEY=
RESEND_FROM_EMAIL="Reservation <reservation@example.com>"
RESEND_REPLY_TO_EMAIL=
RESEND_TO_EMAILS="owner@example.com"
# Server-only private ledger ID; omit only to use the source-schema default `email_deliveries`.
APPWRITE_EMAIL_DELIVERIES_TABLE_ID=email_deliveries
# Server-only private one-use Safe Retry claim ledger.
APPWRITE_EMAIL_DELIVERY_RETRY_CLAIMS_TABLE_ID=email_delivery_retry_claims
```

Function 리소스와 배포는 아래 명령으로 생성/업데이트합니다.

```bash
npm run deploy:reservation-notification
```

이 명령에 사용하는 `APPWRITE_API_KEY`에는 최소 `functions.read`, `functions.write` 스코프가 필요합니다. 배포 후 실행 로그까지 CLI에서 확인하려면 `execution.read`도 추가하세요.

기본 함수 ID는 `reservation-notification`이며 현재 운영 Appwrite 인스턴스와 호환되는 기본 런타임은 `node-16.0`입니다. 기본 이벤트는 `tablesdb.{APPWRITE_CAKE_DATABASE_ID}.tables.{APPWRITE_CAKE_RESERVATIONS_TABLE_ID}.rows.*.create`와 기존 `databases.{APPWRITE_CAKE_DATABASE_ID}.collections.{APPWRITE_CAKE_RESERVATIONS_TABLE_ID}.documents.*.create`를 순서대로 시도하며, 필요하면 `APPWRITE_RESERVATION_CREATE_EVENT`로 직접 지정할 수 있습니다.

운영자와 고객 이메일은 별도 Resend 요청 및 별도 `email_deliveries` ledger event로 처리됩니다. 메일 발송 실패는 예약 데이터를 삭제하거나 되돌리지 않으며, raw recipient·API key·예약 요청사항은 로그에 남기지 않습니다. 같은 신규 예약 이벤트는 pending ledger row의 unique eventKey로 한 번만 첫 발송을 claim합니다. failed/uncertain/stale pending 상태의 자동 재발송은 아직 하지 않습니다.

Function runtime은 Appwrite가 주입하는 endpoint/project 값과 실행별 `x-appwrite-key`만 사용해 ledger에 접근합니다. browser나 관리자 session이 ledger를 직접 읽거나 변경하지 않도록 schema permissions는 비어 있어야 합니다.

### 안전한 이메일 재시도

`email_deliveries`는 장기 중복 방지/audit source of truth이며, Resend의 24시간 idempotency 보존 기간을 대체하지 않습니다. 관리자가 실패 또는 전달 여부 불명 메일에 대해 **Retry email**을 누른 경우에만, 다음을 모두 만족할 때 한 번만 안전하게 재시도합니다.

- 실제 첫 provider 호출 시각인 `firstAttemptAt`부터 **23시간 미만**이어야 합니다. 정확히 23시간인 시점부터는 재시도하지 않습니다. `lastAttemptAt`은 이 기한을 연장하지 않습니다.
- 서버가 최신 authoritative source에서 원래 payload를 다시 만들었을 때 recipientHash와 payloadHash가 저장값과 같아야 합니다.
- 같은 eventKey에서 파생한 동일 Resend `Idempotency-Key`를 사용하며, private `email_delivery_retry_claims`의 immutable unique claim이 없어야 합니다.

각 논리적 메일은 초기 발송 1회와 명시적 Safe Retry 최대 1회만 허용합니다. `sent`, fresh `pending`, terminal 오류, 이메일 주소/내용 변경, 23시간 만료, 기존 claim, 또는 legacy row의 `firstAttemptAt` 누락은 모두 재시도하지 않습니다. 자동 재시도와 Force resend는 제공하지 않으며, 이 경우 기존 SMS/메시지 복사 기능을 사용하세요. 리뷰 재시도는 같은 암호화된 링크 또는 이미 발급된 같은 쿠폰만 복구하며 예약·리뷰·쿠폰 상태를 변경하지 않습니다.

Resend POST 성공 응답의 `id`(Email Resource ID)는 기존 field 이름 `providerMessageId`에만 저장합니다. 이는 RFC `Message-ID`가 아니며 browser에는 노출하지 않습니다. provider GET/webhook reconciliation과 full-access Resend key는 필요하지 않습니다.

Retry 기능을 production에 적용할 때에는 기존 메일 발송을 중단하지 않도록 다음 순서를 지키세요. 실제 적용 전에는 모든 명령을 `--dry-run`으로 검토해야 합니다.

1. `email_deliveries.firstAttemptAt` optional attribute를 생성하고 available 상태를 확인합니다.
2. private `email_delivery_retry_claims` table과 unique `eventKey` index를 생성하고 public/browser permissions가 없는지 확인합니다.
3. reservation-notification과 review-api Function을 배포합니다.
4. 관리자 frontend를 배포합니다.

기존 ledger row에는 `firstAttemptAt`을 backfill하지 않습니다. 해당 row는 retry unavailable로 fail-closed되지만 기존 발송 기능에는 영향이 없습니다. rollback 시에는 frontend와 Function만 이전 버전으로 되돌리고 audit/claim table 및 row는 삭제하지 마세요.

최종 확정 이메일은 status 변경의 부수효과가 아닙니다. 관리자 drawer에서 cake는 실제 저장 상태가 `예약확정`, class는 `Confirmed`인 뒤에만 **Send confirmation email** 버튼으로 명시적으로 요청합니다. Function은 browser가 보낸 예약 ID와 source type만 받고, `REVIEW_ADMIN_USER_IDS`의 Appwrite user ID allowlist와 `x-appwrite-user-id`를 확인한 후 최신 reservation row를 다시 읽습니다. `booking-confirmed-customer:{sourceType}:{reservationId}` ledger event가 이미 `sent`, `pending`, `failed`, `uncertain`이면 자동 재발송하지 않습니다. 기존 문자/결제 안내 복사 기능은 이 버튼과 독립적으로 유지됩니다.

이 관리자 action을 rollout할 때는 `REVIEW_ADMIN_USER_IDS`와 `VITE_RESERVATION_NOTIFY_FUNCTION_ID`를 설정하고, notification Function execute permission을 해당 정확한 Appwrite user IDs로만 배포해야 합니다. anonymous execution은 허용하지 않습니다.

## 예약 API와 권한

신규 설치는 우선 `VITE_RESERVATION_API_MODE=off`, `APPWRITE_RESERVATION_WRITE_MODE=direct`로 기존 저장 흐름을 유지합니다. 서버 검증 Function을 배포하고 조회/저장을 단계별로 확인한 뒤에만 공개 DB 생성 권한을 닫습니다.

전체 배포·검증·롤백 순서는 [예약 API 무중단 전환 체크리스트](docs/RESERVATION_API_ROLLOUT.md)를 따르세요. `scripts/set-reservation-write-mode.mjs`는 `--apply`가 없으면 항상 dry-run이며, Function 배포 명령은 컬렉션 권한을 변경하지 않습니다.

## Review API 배포와 설정

Review API Function의 기본 ID는 `review-api`입니다. 운영에서 다른 ID를 쓰면 배포 측은 `APPWRITE_REVIEW_API_FUNCTION_ID`, 이후 frontend 연동 측은 동일한 값의 `VITE_REVIEW_API_FUNCTION_ID`를 설정합니다.

배포 스크립트에는 아래 server-only 환경변수가 필요합니다. `VITE_*` 값으로 fallback하지 않습니다.

- credential: `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`
- database: `APPWRITE_CAKE_DATABASE_ID`, `APPWRITE_KIDS_DATABASE_ID`
- source collections: `APPWRITE_CAKE_RESERVATIONS_TABLE_ID`, `APPWRITE_KIDS_RESERVATIONS_TABLE_ID`
- review collections/storage: `APPWRITE_REVIEW_INVITES_TABLE_ID`, `APPWRITE_REVIEWS_TABLE_ID`, `APPWRITE_REVIEW_COUPONS_TABLE_ID`, `APPWRITE_REVIEW_PHOTO_CLEANUP_TABLE_ID`, `APPWRITE_REVIEW_PHOTOS_BUCKET_ID`
- review administrator source of truth: `REVIEW_ADMIN_USER_IDS`
- exact HTTPS origins allowed to request private admin photo previews: `REVIEW_FRONTEND_ORIGINS`
- coupon lookup secret shared by Review API and Reservation API: `REVIEW_COUPON_HMAC_SECRET`
- separate 32-byte AES key used only by Review API to recover active coupon messages: `REVIEW_COUPON_ENCRYPTION_KEY`
- separate 32-byte AES key used only by Review API to recover active review invitation links: `REVIEW_INVITE_TOKEN_ENCRYPTION_KEY`
- review invitation email sender: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, optional `RESEND_REPLY_TO_EMAIL`
- private email ledger: `APPWRITE_EMAIL_DELIVERIES_TABLE_ID` (defaults to `email_deliveries`)
- private one-use Safe Retry claim ledger: `APPWRITE_EMAIL_DELIVERY_RETRY_CLAIMS_TABLE_ID` (defaults to `email_delivery_retry_claims`)

두 쿠폰 키는 서로 다른 값이어야 하며 공백이나 padding 없는 canonical base64url이어야 합니다. 아래 명령을 각각 한 번씩 실행해 서로 다른 값을 생성하세요.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

`REVIEW_COUPON_HMAC_SECRET`은 Review API와 Reservation API에 같은 값으로 설정하고, `REVIEW_COUPON_ENCRYPTION_KEY`와 `REVIEW_INVITE_TOKEN_ENCRYPTION_KEY`는 서로 다른 Review API 전용 값으로 설정합니다. 활성 쿠폰 또는 활성 리뷰 링크가 남아 있는 동안 어떤 암호화 키도 회전하지 마세요. 키를 잃거나 바꾸면 각각 기존 관리자 리워드 메시지 또는 리뷰 링크 복구가 fail-closed 됩니다.

완료된 cake(`픽업완료`) 또는 class(`Completed`) 예약에서만 관리자 drawer의 **Send review email**로 한 통의 한국어 우선/영어 병기 리뷰 요청을 보냅니다. 이 메일은 긍정적인 후기나 별점에 대한 보상이 아니라 honest review에 대한 안내이며, 텍스트 후기는 다음 cake order 5%, 사진 후기는 10%입니다. 개인 링크는 발급 시점부터 Sydney calendar 30일, 후기 작성 뒤 발급되는 쿠폰은 발급 시점부터 30일이며 다음 cake order에 한 번 사용할 수 있습니다. **Copy review request**는 계속 제공되며 동일한 암호화된 active link만 복구합니다. sent/pending/failed/uncertain은 자동 재발송하지 않습니다.

`APPWRITE_ADMIN_USER_IDS`는 schema 리소스 권한을 설정하는 `setup:appwrite` 전용이고, Review API의 관리자 요청 판정과 Function 환경변수에는 반드시 별도의 `REVIEW_ADMIN_USER_IDS`를 사용합니다. `REVIEW_ADMIN_USER_IDS`는 비어 있지 않은 comma-separated Appwrite user ID 목록이어야 하며, 배포 전에 형식 검증과 중복 제거를 거칩니다. 배포 작업자의 `APPWRITE_API_KEY`에는 `functions.read`와 `functions.write`만 필요하며 Function runtime 변수로 전달하지 않습니다.

관리자 리뷰 사진은 private bucket 권한을 공개로 바꾸지 않습니다. Frontend는 Appwrite Auth 세션에서 짧은 수명의 user JWT를 만들고 Review Function의 direct HTTPS domain으로 review ID만 전송합니다. Function은 JWT를 다시 검증하고 `REVIEW_ADMIN_USER_IDS`와 현재 review-photo 연결을 확인한 뒤 WebP bytes를 `private, no-store`로 반환합니다. 운영 frontend에는 Function domain을 `VITE_REVIEW_API_DIRECT_URL`로 설정하고, Function에는 허용할 사이트 origin을 경로·wildcard·trailing slash 없이 `REVIEW_FRONTEND_ORIGINS=https://example.com` 형태로 설정하세요. 두 값을 설정하기 전에는 관리자 사진 미리보기가 fail-closed로 비활성화됩니다.

```bash
# credential/.env.local/client/network 없이 안전한 masked 계획만 출력
npm run deploy:review-api -- --dry-run

# 실제 배포: production 승인 후에만 실행
npm run deploy:review-api
```

스크립트는 Function을 idempotent하게 생성/업데이트하며, rollout이 소유하는 `name/runtime/execute/entrypoint/commands/scopes`만 강제합니다. 기존 Function의 event, schedule, timeout, enabled/logging 및 VCS/provider 설정은 보존합니다. `appwrite-functions/review-api`의 `package.json`, lockfile, `src`만 묶고 `.env`, secret, `node_modules`는 포함하지 않으며 production dependency를 `npm ci --omit=dev`로 설치합니다. 동적 Function key에는 database/document read/write와 Task 7 파일 처리에 필요한 정확한 `files.read`, `files.write`만 설정하고 bucket metadata scope는 부여하지 않습니다. `REVIEW_ADMIN_USER_IDS` Function 변수는 secret으로 저장합니다. 배포 생성 후 최대 120초 동안 알려진 진행 상태만 polling하며 `ready` 외 failed/canceled/알 수 없는 상태 또는 timeout이면 fail-closed합니다. 실패 build log는 runtime 환경값과 관리자 ID를 redact하고 길이를 제한합니다. API key와 실제 환경변수 값은 출력하지 않고 식별자는 masking하며, collection permission은 변경하지 않습니다.

사진 정규화 dependency인 `sharp@0.34.5`는 Node 18.17 이상이 필요하고 Node 16을 지원하지 않으므로 Review API 기본 runtime은 `node-20.0`이며, 지원 여부 fallback도 `node-20.0`과 `node-18.0`까지만 허용합니다. 운영 Appwrite가 두 runtime을 모두 지원하지 않으면 배포를 강행하지 말고 Appwrite runtime을 먼저 업그레이드해야 합니다.

리뷰 초대 링크 recovery rollout 순서는 반드시 **optional `review_invites` encrypted-envelope attribute 생성/available 확인 → private `email_deliveries` schema/permission 확인 → Review Function secret/runtime variable 설정 및 deployment `ready` 확인 → 일부러 잘못된 요청으로 no-write smoke 확인 → frontend 배포** 순서입니다. 이전 Function/frontend로 rollback하더라도 기존 `tokenHash` 기반 review submit은 유지됩니다. 실제 schema apply, Function 배포, smoke, frontend 전환은 각각 production 승인 후 진행하며 이 로컬 작업만으로 live apply하지 않습니다.
