# 예약 API 무중단 전환 체크리스트

이 문서는 운영 중인 케이크/키즈 클래스 예약을 중단하지 않고 공개 DB 쓰기를 Appwrite Function으로 옮기는 순서입니다. 각 단계가 확인되기 전에는 다음 단계로 넘어가지 않습니다.

## 현재 안전 기본값

- `VITE_RESERVATION_API_MODE=off`: 기존 브라우저 직접 저장 방식을 그대로 사용합니다.
- `APPWRITE_RESERVATION_WRITE_MODE=direct`: 고객의 기존 공개 생성 권한을 유지합니다.
- 코드만 배포해도 위 기본값에서는 현재 예약 흐름이 바뀌지 않습니다.
- Function 호출이 시간 초과됐을 때 브라우저 직접 저장으로 자동 재시도하지 않습니다. 응답을 잃은 성공 요청을 다시 저장해 중복 예약이 생기는 것을 막기 위해서입니다.

## 0. 사전 확인

1. Appwrite 콘솔에서 최근 케이크 예약과 클래스 예약이 정상적으로 보이는지 확인합니다.
2. `.env.local`의 `APPWRITE_ADMIN_USER_IDS`에 실제 관리자 Appwrite user ID가 있는지 확인합니다.
3. 배포용 API key에 `functions.read`, `functions.write`를 부여합니다. DB 컬렉션 권한 변경 명령에는 `databases.read`, `databases.write`도 필요합니다.
4. 호스팅 환경에는 `APPWRITE_API_KEY`나 `RESEND_API_KEY`를 절대 `VITE_` 변수로 넣지 않습니다.
5. `REVIEW_COUPON_HMAC_SECRET`은 최소 32 random bytes의 padding 없는 canonical base64url 값 하나를 사용합니다. Review API 쿠폰 발급 Function과 Reservation API 쿠폰 사용 Function에 **완전히 같은 값**을 설정하고 `VITE_*`에는 두지 않습니다. `.env.example`은 의도적으로 빈 값이며 실제 값은 secret store에만 둡니다. 발급된 `active` 쿠폰이 남아 있는 동안에는 절대 회전하지 마세요. 기존 digest와 새 digest가 달라져 유효 쿠폰을 사용할 수 없게 됩니다.

리뷰 쿠폰 사용 전에는 `npm run setup:appwrite`의 별도 승인된 schema apply로 기존 예약 컬렉션의 optional 감사 필드 `subtotalCents`, `discountPercent`, `discountCents`, `appliedPromoCodeLast4`, `reviewCouponId`와 private `review_coupons` 컬렉션/index가 준비되어 있어야 합니다. 먼저 `node scripts/setup-appwrite.mjs --dry-run`으로 계획을 확인하세요. `cake_pickup_openings` 컬렉션이 없어도 Function은 기존 동작과 같이 예외 오픈 슬롯 없이 작동합니다.

## 1. Function만 먼저 배포

이 명령은 `reservation-api` Function과 변수/코드만 만들며 DB 컬렉션 권한은 변경하지 않습니다.

```bash
# credential/.env.local/client/network 없이 masked 계획만 확인
npm run deploy:reservation-api -- --dry-run

# 실제 Function 배포(별도 운영 승인 후)
npm run deploy:reservation-api
```

배포 변수에는 server-only `APPWRITE_REVIEW_COUPONS_TABLE_ID`와 위의 동일한 `REVIEW_COUPON_HMAC_SECRET`이 포함되고 `VITE_*` fallback은 사용하지 않습니다. 두 Function의 `--dry-run`은 secret 원문을 절대 출력하지 않고 masked 값만 보여 줍니다. Function dynamic key는 atomic reservation/coupon transaction과 read-only schema readiness에 필요한 database/collection/attribute/index/document scope만 사용합니다. 기본 runtime은 transaction을 지원하는 `node-20.0`이며 Node 18 미만은 거부합니다. 안전한 순서는 **schema apply/검증 → Review Function `ready` → Reservation Function `ready` → 잘못된 쿠폰으로 no-write smoke → frontend 전환**입니다.

스크립트가 배포 빌드를 기다린 뒤 읽기 전용 health check를 수행합니다. 마지막에 아래 두 메시지가 모두 나와야 합니다.

```text
Reservation API deployment and read-only health check complete.
Database collection permissions were not changed.
```

실패하면 현재 사이트는 계속 직접 저장 모드이므로 예약 접수에는 영향이 없습니다.

## 2. 조회 기능만 전환

호스팅 환경변수를 다음과 같이 설정하고 프런트를 배포합니다.

```text
VITE_RESERVATION_API_FUNCTION_ID=reservation-api
VITE_RESERVATION_API_MODE=lookup
```

기존 예약번호와 등록된 휴대폰 전체번호로 고객 조회를 확인합니다. 이 단계에서도 신규 케이크/클래스 예약 저장은 기존 직접 저장 방식입니다.

## 3. 예약 저장을 Function으로 전환

공개 생성 권한을 아직 닫지 않은 상태에서 호스팅 변수만 바꿔 배포합니다.

```text
VITE_RESERVATION_API_MODE=all
```

조용한 시간대에 아래를 확인합니다.

1. 케이크 테스트 신청 1건이 DB와 관리자 화면에 한 번만 생기는지 확인
2. 운영자 이메일 알림이 도착하는지 확인
3. 키즈 클래스 테스트 신청 1건과 동일 시간 중복 차단 확인
4. Appwrite Function 실행 로그에서 `INTERNAL_ERROR`가 없는지 확인

테스트 건은 관리 화면에서 취소 처리하고, 최소 24시간 동안 실제 예약과 알림을 관찰합니다. 이 기간에도 공개 생성 권한이 열려 있으므로 Function 문제가 생기면 호스팅 모드를 `off`로 되돌려 기존 흐름으로 복귀할 수 있습니다.

## 4. 공개 DB 생성 권한 닫기

먼저 변경 예정 권한만 확인합니다. 이 명령은 기본적으로 dry-run입니다.

```bash
npm run reservation-api:permissions -- function
```

출력된 database/collection ID와 관리자 user ID 권한을 확인한 뒤에만 적용합니다.

```bash
npm run reservation-api:permissions -- function --apply
```

적용 후 `.env.local`의 운영 설정도 다음으로 바꿔 향후 `setup:appwrite`가 공개 권한을 다시 열지 않게 합니다.

```text
APPWRITE_RESERVATION_WRITE_MODE=function
```

마지막으로 케이크/클래스 신청과 조회를 다시 한 번 확인합니다.

## 즉시 롤백 순서

공개 권한이 이미 닫힌 뒤에는 반드시 권한을 먼저 복구합니다.

```bash
npm run reservation-api:permissions -- direct --apply
```

그 다음 호스팅의 `VITE_RESERVATION_API_MODE=off`로 재배포합니다. 순서를 반대로 하면 새 프런트 배포가 끝날 때까지 예약 저장이 거절될 수 있습니다.

## 별도 선택 작업

- 클래스 시간 중에도 특정 케이크 픽업 시간을 열어야 할 때만 `cake_pickup_openings` 컬렉션을 만든 뒤 `manage-cake-pickup-opening.mjs`를 사용합니다.
