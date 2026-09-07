# S’more backend blocker 검증 보고

상태: 로컬 수정/테스트 완료. 운영 schema migration·Function 배포·env 수정·commit·push·PR은 실행하지 않음.
작업 경로: `/home/john/workspace/au-cake-hermes`, branch `feat/smore-stick-ordering`, HEAD `bf9d9ae29cc31de1a3e54a3f59e5bb035e01e80e`.
이전 미커밋 초안을 보존했고 main/Antigravity에서 개발하거나 reset/clean/checkout하지 않았다.

## 1. Root cause

### quantity

- 원래 `scripts/setup-appwrite.mjs:205`의 integer quantity는 required=false/min1/max5였다.
- `ensureAttribute()`는 기존 enum을 갱신하지만 기존 integer min/max는 갱신하지 않고 반환한다. setup 재실행은 migration이 아니다.
- 초안 `buildCakeReservation()`은 첫 line이 S'more이면 quantity=1을 저장했고 서버 `parseStoredOrderLines()`와 TS `parseAdminStoredOrder()`가 이 값을 요구했다.
- API `createCake()`의 일반/쿠폰 transaction createDocument는 그 문서를 저장한다. 생성 응답과 public lookup은 JSON 실제 수량을 내보내므로 오류를 숨겼다.
- `toReservation()` → `buildAdminReservationUpdate()` → `updateReservation()`은 실제 수량을 다시 쓰므로, quantity1 우회와 불일치했다.
- notification/reminder/calendar는 기존 공통 stored parser를 사용한다. legacy JSON 없는 경로는 변경하지 않았다.
- 원래 회귀 테스트를 다시 실행하여 expected50/actual1로 RED를 확인한 뒤 builder와 strict stored readers의 특례를 제거했다.

### test runner

- `npm test` → `test:smore` → `smore-response-contract.test.ts`의 esbuild Node ESM 번들 실행에서 실패했다.
- 테스트가 backend `main.js`를 import → `node-appwrite@22.1.3/dist/client.mjs` → `node-fetch-native-with-agent/agent`의 `dist/agent.cjs` → `require("node:http")`를 번들에 포함한다.
- esbuild ESM 출력의 dynamic require helper는 Node ESM에 require가 없어 throw한다. assertion 도달 전 실행 오류이며 production 코드 오류가 아니었다.
- 기존 admin-order-lines esbuild 테스트는 같은 node-appwrite 서버 SDK import graph가 아니어서 이 사례를 보장하지 않는다.
- 설치된 `rolldown@1.1.5`의 node 플랫폼은 createRequire 기반 CommonJS interop을 생성한다. 프로젝트 Vite가 사용하는 기존 의존성을 재사용했다.

## 2. 최종 quantity 계약

- 일반 케이크 상품 정책: 기존 1~5.
- S'more 상품 정책: positive safe integer, business max 없음. cents 안전 범위를 넘는 금액은 기존 `ORDER_AMOUNT_OVERFLOW`.
- top-level quantity = 첫 normalized line의 실제 quantity. orderItemCount = 모든 line 수량 합계.
- S'more 50 단독: quantity50 / orderItemCount50 / JSON 첫 quantity50.
- DB 전송 기술 경계: source max5로 생성한 Appwrite integer는 32비트 경로. `createCake()`는 top quantity >2147483647을 `QUANTITY_STORAGE_OVERFLOW`로 거절한다. 상품 계산기/JSON 수량 정책과 분리하며 예약/쿠폰 쓰기 전에 실패한다.
- 2147483647 자체의 persistence payload/응답/재시도 성공, 2147483648의 상품 계산 허용 및 persistence write 없는 명시적 거절을 로컬 double로 검증했다. 이 큰 수량을 production에 전송하지 않았다.
- 실제 운영 물리 컬럼 크기는 직접 조회하지 않았다. Appwrite 1.8.1 공식 Create/Update 소스 기준의 보수적 저장 범위다.

## 3. 운영 GET 결과

Appwrite 1.8.1. quantity type integer / required false / array false / min1 / max5 / default null / status available / error 빈 문자열.
기존 private env의 server/frontend mapping 일치 확인 후 실제 quantity GET을 수행했다. 부모도 기본 CLI의 `--dry-run`을 실행하여 같은 상태를 독립 확인했다. live Function env 전체를 대조한 것은 아니다.

## 4. 미실행 migration

`scripts/migrate-reservation-quantity.mjs`
- GET-only 기본값. `--apply` 명시 때만 quantity integer PATCH.
- before schema/version fail-closed, 직전 재조회, quantity 외 수정 없음, 적용 뒤 GET 검증, 이미 목표이면 noop.
- max5 → max2147483647만 변경. required=false, min1, default=null 유지.
- 1.8.1은 max:null/생략이면 이전 max를 유지하며, integer update는 물리 size를 확대하지 않는다. 따라서 null 제거 또는 무작정 safe-integer max PATCH를 사용하지 않는다.
- 정확한 read-only/apply 명령과 공식 소스 링크는 `RESERVATION_QUANTITY_MIGRATION.md` 참조. apply는 실행하지 않았다.

## 5. Runner 수정

`package.json`의 test:smore를 `scripts/run-bundled-tests.mjs`로 연결했다. TS만 기존 rolldown node/ESM으로 묶고 mjs는 직접 실행한다. 모든 테스트를 node --test로 실제 실행하며 exit code를 전파하고 임시 디렉터리를 finally에서 정리한다. assertion 약화/skip/삭제/production interop hack/package upgrade 없음.

전체 회귀 중 기존 review-api function의 libheif-js가 worktree에 없어 별도 ERR_MODULE_NOT_FOUND가 발생했다. 선언된 기존 function 의존성이 main checkout에 이미 설치돼 있어 Hermes worktree `appwrite-functions/review-api/node_modules`에 해당 디렉터리 symlink만 만들었다. 새 설치/lockfile 변경/main 변경은 없다.

## 6. 가격 (cents)

| quantity | totalPriceCents |
|---|---|
| 1 | 450 |
| 5 | 2250 |
| 6 | 2430 |
| 11 | 4455 |
| 12 | 4320 |
| 20 | 7200 |
| 50 | 18000 |
| 100 | 36000 |

모든 기대값은 실제 서버 builder 테스트로 재검증했다. 위조 unit/subtotal/discount/total을 사용하지 않는다. 5→6, 11→12 할인 경계 유지.

## 7. 쿠폰

기존 승인 정책 유지: 모든 S'more 수량 promo/review/manual 대상 제외. bulk는 line 상품 가격 정책. 혼합 주문은 일반 케이크에만 쿠폰 배분. S'more-only 리뷰/수동 쿠폰은 거절하고 coupon active 및 예약/쿠폰 write0 검증. 일반 상품 static promo 범위도 기존대로.

## 8. Reader 증거

서버 생성 문서의 admin hydrator/상태 수정/lookup: 실제50. 기존 공통 summary: S'more Stick · x50 · AUD180.00 · 20% bulk discount. 운영자·고객 접수·확정 이메일·reminder: 제품명/50/180.00/20% 검증. Calendar: S'more Stick ×50. 기존 케이크 및 historical reader 회귀 통과. 실제 이메일 발송/운영 예약 생성 없이 기존 formatter와 API double로 검증했다.

## 9. 최종 명령 결과

모든 테스트 행 skip0/fail0. 합계는 suite 실행 횟수 기준이며 중복 실행을 서로 합산해 고유 테스트 수로 주장하지 않는다.

| command | pass | exit | log |
|---|---:|---:|---|
| `node --test tests/smore-storage-contract.test.mjs` | 10 | 0 | `/tmp/smore-phase2-quantity.log` |
| `VITE_MARKET=AU node scripts/run-bundled-tests.mjs tests/smore-response-contract.test.ts` | 20 | 0 | `/tmp/smore-phase2-response.log` |
| `npm run test:smore` | 81 | 0 | `/tmp/smore-phase2-smore.log` |
| `npm run test:reservation-api` | 129 | 0 | `/tmp/smore-phase2-api.log` |
| `node --test tests/smore-notifications.test.mjs tests/reservation-notification-cake.test.mjs tests/booking-reminder.test.mjs tests/calendar-access.test.mjs` | 54 | 0 | `/tmp/smore-phase2-email-calendar.log` |
| `npm run test:cake` | 308 | 0 | `/tmp/smore-phase2-cake.log` |
| `node --test tests/migrate-reservation-quantity.test.mjs` | 7 | 0 | `/tmp/smore-phase2-migration.log` |
| `npm run lint` | — | 0 | `/tmp/smore-phase2-lint.log` |
| `git diff --check` | — | 0 | `/tmp/smore-phase2-diff.log` |
| `node_modules/.bin/tsc -b --pretty false` | — | 0 | `/tmp/smore-phase2-typecheck.log` |
| `VITE_MARKET=AU npm run build` | — | 0 | `/tmp/smore-phase2-build.log` |
| `npm_config_offline=true npm test` | 1137 | 0 | `/tmp/smore-phase2-npm-test.log` |

AU build는 기존 대형 chunk 경고가 있으나 exit0. 운영 배포 아님.

## 10. 범위와 변경 파일

이번 blocker 단계에서 기존 초안에 추가/수정: business.js, main.js, repository.ts, package.json, setup-appwrite.mjs, migrate-reservation-quantity.mjs, run-bundled-tests.mjs, migrate-reservation-quantity.test.mjs, smore-backend.test.mjs, smore-response-contract.test.ts, smore-storage-contract.test.mjs, reservation-review-coupon.test.mjs 및 두 문서.

아래 git status는 이전 초안의 변경까지 포함한다. Orders opening soon/CTA/CakeDetailPage/catalogue/CSS/images/SEO 파일 diff 없음. package-lock 변경 없음. main와 Antigravity HEAD는 시작과 동일. 운영에는 GET만 수행했다.

## 11. 승인 후 rollout 순서

1. 사용자 결과 검토 → 별도 commit/push/PR 승인 → 독립 review와 merge 승인.
2. 배포 직전 운영 version/quantity/config·rollback 대상 재확인.
3. 별도 승인 후 quantity migration 적용 및 GET postcheck. 전체 setup 재실행 금지.
4. S'more reader를 포함한 admin/lookup shared contract 산출물과 notification/reminder 공통 parser를 먼저 승인 배포. CTA는 잠금 유지.
5. Reservation API 승인 배포. 승인된 수신자/테스트 레코드 범위에서 create→저장→lookup/admin/email→재시도 검증 및 TEST 정리.
6. backend/storage 검증 완료 후에만 별도 frontend branch에서 CTA/OutOfStock 전환.

## 12. Rollback

지금은 운영 변경이 없어 rollback할 운영 작업 없음. 나중에 장애가 나면 신규 접수를 우선 차단한다. S'more 주문이 이미 있으면 기존 미지원 parser로 단순 회귀하지 않고 읽기 호환 코드를 보존한다. 넓힌 DB max는 그대로 두며 quantity1 덮어쓰기/레코드 삭제/max5 자동 축소 금지. 승인된 물리/데이터 영향 검증 없이는 스키마 축소하지 않는다.

## 13. Git 상태

미커밋·미스테이징. commit/push/PR/merge 없음.

```
## feat/smore-stick-ordering...origin/main
 M appwrite-functions/booking-reminder/src/reminder-business.js
 M appwrite-functions/reservation-api/src/active-cake-products.js
 M appwrite-functions/reservation-api/src/business.js
 M appwrite-functions/reservation-api/src/calendar-access.js
 M appwrite-functions/reservation-api/src/main.js
 M appwrite-functions/reservation-notification/src/main.js
 M package.json
 M scripts/setup-appwrite.mjs
 M src/lib/order-lines.ts
 M src/lib/repository.ts
 M src/lib/review-coupon-client.ts
 M src/lib/types.ts
 M tests/reservation-review-coupon.test.mjs
?? docs/RESERVATION_QUANTITY_MIGRATION.md
?? scripts/migrate-reservation-quantity.mjs
?? scripts/run-bundled-tests.mjs
?? tests/migrate-reservation-quantity.test.mjs
?? tests/smore-backend.test.mjs
?? tests/smore-notifications.test.mjs
?? tests/smore-order-summary.test.ts
?? tests/smore-response-contract.test.ts
?? tests/smore-storage-contract.test.mjs
```

이 보고서 파일 자체는 위 status 수집 직후 추가되었다.
