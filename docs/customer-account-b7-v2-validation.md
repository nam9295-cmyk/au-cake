# B7 V2 — 주문 계약 수정 및 로컬 호환성 검증

2026-10-18. Branch `feat/customer-account`, 시작 HEAD `91c7e2c`. 지정 worktree에서 문서/로컬 테스트만 작성했다. 원본 제품·Function 비즈니스 코드 변경 없음.

## 승인 상태

- 이전 [manifest](customer-account-b7-execution-manifest.json)는 byte 그대로 보존: `f71da5a2f768e9789086548d9af5c12c06b25e2f4480d5762daf1c781af27a43`.
- 새 [V2 manifest](customer-account-b7-execution-manifest-v2.json): `2421d820d99e38652a1adff4e37ca4afdbd0c002a37281462ac9b5a892d50c41`.
- 새 [V2 실행 계획](superpowers/plans/2026-10-18-customer-account-b7-google-orders-v2.md).
- `executionApproved=false`. 이번 승인은 수정·로컬 검증에 한정된다. 실제 실행에는 **새 SHA를 명시한 별도 승인**이 필요하다. 승인 proof는 파일을 true로 바꾸지 않고 별도 보호 파일로 검증한다.

## 변경된 주문 명세

신규 6건 모두 `au-renewal.2026-10.v2`이며 기존 상품·수량1·원가격·requestId 정책·고객별 배정·쿠폰2건을 유지했다. 날짜/시간은 기존 `2026-10-23 10:00`이다. 지연되어 날짜가 유효하지 않게 되면 임의 변경하지 않고 새 명세 승인을 받는다.

| 고객 | 상품 | 원가격 AUD | 쿠폰 | 최종 AUD |
| --- | --- | ---: | --- | ---: |
| G | Pavé cake 6in dark ×1 | 75.00 | 없음 | 75.00 |
| G | Pavé chocolate 100g ×1 | 12.00 | 없음 | 12.00 |
| H | Pavé cake 6in dark ×1 | 75.00 | manual 5% | 71.25 |
| H | Pavé chocolate 100g ×1 | 12.00 | review 10% | 10.80 |
| Guest | Pavé cake 6in dark ×1 | 75.00 | 없음 | 75.00 |
| Guest | Pavé chocolate 100g ×1 | 12.00 | 없음 | 12.00 |

`cake` scope는 원본 validateReviewCoupon에서 검증된다. Renewal 가격계산은 일반 대상 상품을 적용 대상으로 삼으므로 위 단품 초콜릿에도 할인한다. scope 이름만 보고 chocolate을 제외하지 않는다. bundle/addon/mochi/smore/cookie 및 모든 초콜릿 상품의 지원을 의미하지 않는다. 기존 H 쿠폰 배정의 변경은 필요 없다.

## 원본 로직 로컬 검증

명령: `node --test tests/customer-account-b7-compatibility.test.mjs`.

- 승인 당시 V1 내용을 복제한 초안에서 먼저 실행: 예상한 계약 누락/불일치로 실패 확인. 그 후 V2 manifest의 format/contract만 수정하고 같은 검사 13건 PASS. 제품 로직 수정 없음.
- 원본 `createCake`, Renewal 가격계산, coupon validator/digest, 기존 legacy builder/fingerprint 사용. DB I/O만 메모리 대역이며 commit/rollback을 분리한다. 신규 생성/쿠폰 차감·동일 요청 재시도 결과를 확인한다. 모든 테스트 입력/코드/key는 로컬 합성값이며 운영/테스트 프로젝트 Secret을 읽지 않는다.

| 구분 | 결과 | 검증 범위 |
| --- | --- | --- |
| 기존 SHA·보호 조건 보존 | PASS 1 | target/actors/limits/flags/restore/쿠폰·상품 배정 동일, 실행승인 false |
| Renewal 6개 주문 | PASS 6 | 정확한 가격·회원 owner 저장/guest owner 없음, 동일 requestId 재시도 1건 유지, 변경 payload409, 타인 owner replay409, guest의 회원 재시도 자동연결 없음 |
| 쿠폰 교차 조합 | PASS 4 | manual5%·review10% × cake·단품 chocolate, 할인기준7500/1200cents, 한 번만 차감, 다른 requestId 재사용 거부 |
| Legacy 신규 | PASS 1 | Renewal flag 고정 ON에서409 RENEWAL_CONTRACT_REQUIRED, write0 |
| Legacy 기존 requestId | PASS 1 | 로컬 historical snapshot·fingerprint 기반 재시도 성공, 저장 가격/contact/owner 불변, payload 변경409, guest 자동귀속 없음 |

**합계 13 pass / 0 fail / 0 skipped.** 실제 JWT 검증과 Appwrite transaction 동시성·공급자 인증 인수는 이 로컬 테스트가 입증하지 않는다. verifiedCustomerUserId를 주입한 서비스 계층 검증이며, 실제 플랫폼 JWT 검증은 후속 B7에서 수행한다.

Legacy 기존 requestId 검증은 로컬 합성 snapshot만 사용했다. 원격 DB에 7번째 주문·historical fixture를 추가하지 않는다. 원격 legacy 신규 부정시험은 아직 생성하지 않은 승인 requestId를 사용하고, 원본409까지 통과시키는 guard 부정시험을 먼저 작성한다. 이 요청도120회 상한에 포함한다.

## 전체 회귀 및 문서 검증

- `npm test`: **1,899 pass / 0 fail / 1 skipped**, 총1,900건(69개 Node test summary 합산), exit0. 신규13건 포함, 기존1skip 유지.
- `npm run lint`: PASS, exit0.
- 전체 테스트 안의 `VITE_MARKET=AU npm run build` (`tsc -b` 포함): PASS. 기존500kB chunk 경고 있음. KR 별도 빌드는 이번 문서/테스트 수정에서 재실행하지 않았다.
- 구 manifest byte SHA 불변, 문서 링크/`git diff --check`: PASS.
- 실패 확인 단계는 V1 초안13건 중2pass/11fail이었다. V2 적용 후13pass이며 실패를 무시하거나 제품/기존 테스트를 약화하지 않았다.

## 안전 제한과 미실행 항목

15분 단일 창/자동연장 없음, M+G+H3명, 실행120회/동시1, 고유주문6/쿠폰2, site배포최대3/guarded deployment1, HMAC·deadline·watchdog 조건을 그대로 유지했다. `execute=[any]`는 외부 미서명 요청의 초기 runtime/metadata 소비를 막지 못한다. HMAC은 ingress firewall이 아니며 예상 밖 execution1건이면 즉시 중단한다.

이번 작업에서 외부 API/Console/SSH 호출, Account ON, Function 실행/활성화/배포, 사이트 배포, Auth 사용자/주문/쿠폰 생성, 서명키 발급, 세션 변경, main/운영 변경은 모두 **0회**다. 원격 현재 상태를 새로 읽지는 않았으며 이전 차단 상태 확인과 이번 무변경을 구분한다.

Guard/overlay/runner/watchdog 구현 및 실제 Google/JWT/MY ORDERS/브라우저 시험은 **NOT RUN**이다. 로컬 호환성 PASS를 전체 B7 완료나 활성화 준비 완료로 해석하지 않는다. [이전 중단 보고](customer-account-b7-validation.md)는 역사적 근거로 보존한다.

## B5 — DEFERRED — RELEASE BLOCKER

- [ ] 기존 운영4+Console 공통 SMTP 영향 승인
- [ ] 테스트 OTP 수신자 접근·남용 방지
- [ ] Gallery 의미적 지문 예외 검토
- [ ] System SMTP 전용 Key·발신자 확정
- [ ] 운영 보호 백업/root 인증/API·mail-worker 재생성 및 복구
- [ ] 실제 이메일 OTP 및 Google↔OTP 동일 UID

Native OTP OFF 유지. Google+OTP 최종 출시 준비 미완료. 실제 B7 실행도 새 명세 검토·승인을 기다린다.
